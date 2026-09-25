import { pool, query } from "../db.server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { Product, ProductUnit, Sale, StockMovement, StockOpnameItem } from "../types/pos";

/**
 * Mengambil semua data produk beserta multi-satuan dan stok realtime dari ledger
 */
export async function getProductsFromDb(): Promise<Product[]> {
  // 1. Ambil data produk & stok realtime dari view
  const productRows = await query<RowDataPacket[]>(`
    SELECT 
      p.id, 
      p.name, 
      p.category, 
      p.base_unit AS baseUnit, 
      p.min_stock_alert AS minStockAlert,
      COALESCE(s.current_stock_base_unit, 0) AS stockInBaseUnit
    FROM products p
    LEFT JOIN v_product_current_stocks s ON p.id = s.product_id
    WHERE p.is_active = TRUE
    ORDER BY p.name ASC
  `);

  if (productRows.length === 0) return [];

  // 2. Ambil seluruh data units
  const unitRows = await query<RowDataPacket[]>(`
    SELECT 
      id,
      product_id AS productId,
      unit_name AS unitName,
      conversion_ratio AS conversionRatio,
      price,
      cost_price AS costPrice,
      barcode,
      is_base_unit AS isBaseUnit
    FROM product_units
    ORDER BY conversion_ratio ASC
  `);

  // 3. Mapping relasi produk ke units
  return productRows.map((p) => {
    const units: ProductUnit[] = unitRows
      .filter((u) => u.productId === p.id)
      .map((u) => ({
        id: u.id,
        productId: u.productId,
        unitName: u.unitName,
        conversionRatio: Number(u.conversionRatio),
        price: Number(u.price),
        costPrice: u.costPrice ? Number(u.costPrice) : undefined,
        barcode: u.barcode,
        isBaseUnit: Boolean(u.isBaseUnit),
      }));

    return {
      id: p.id,
      name: p.name,
      category: p.category,
      baseUnit: p.baseUnit,
      stockInBaseUnit: Number(p.stockInBaseUnit),
      minStockAlert: p.minStockAlert,
      units,
    };
  });
}

/**
 * Mencari produk dan satuan berdasarkan scan barcode (Lookup < 1ms via Index)
 */
export async function findByBarcode(barcode: string): Promise<{ product: Product; unit: ProductUnit } | null> {
  const rows = await query<RowDataPacket[]>(`
    SELECT 
      u.id AS unit_id,
      u.unit_name,
      u.conversion_ratio,
      u.price,
      u.cost_price,
      u.barcode,
      u.is_base_unit,
      p.id AS product_id,
      p.name AS product_name,
      p.category,
      p.base_unit
    FROM product_units u
    JOIN products p ON u.product_id = p.id
    WHERE u.barcode = ? AND p.is_active = TRUE
    LIMIT 1
  `, [barcode.trim()]);

  if (rows.length === 0) return null;
  const row = rows[0];

  const unit: ProductUnit = {
    id: row.unit_id,
    productId: row.product_id,
    unitName: row.unit_name,
    conversionRatio: Number(row.conversion_ratio),
    price: Number(row.price),
    costPrice: row.cost_price ? Number(row.cost_price) : undefined,
    barcode: row.barcode,
    isBaseUnit: Boolean(row.is_base_unit),
  };

  const product: Product = {
    id: row.product_id,
    name: row.product_name,
    category: row.category,
    baseUnit: row.base_unit,
    stockInBaseUnit: 0,
    units: [unit],
  };

  return { product, unit };
}

/**
 * Menyimpan Transaksi Penjualan ke MySQL Lokal dalam 1 Transaksi Atomik
 * (Menulis sales, sale_items, dan stock_movements ledger out)
 */
export async function createSaleTransaction(sale: Sale): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Simpan Header Sales
    await connection.execute(`
      INSERT INTO sales (
        id, invoice_code, total_amount, paid_amount, change_amount, 
        payment_method, cashier_name, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sale.id,
      sale.invoiceCode,
      sale.totalAmount,
      sale.paidAmount,
      sale.changeAmount,
      sale.paymentMethod,
      sale.cashierName,
      sale.syncStatus,
    ]);

    // 2. Simpan Sale Items & Ledger Mutasi Keluar
    for (const item of sale.items) {
      const itemId = `sitem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await connection.execute(`
        INSERT INTO sale_items (
          id, sale_id, product_id, snapshot_product_name, snapshot_unit_name,
          conversion_ratio, price, cost_price, quantity, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        itemId,
        sale.id,
        item.productId,
        item.productName,
        item.unitName,
        item.conversionRatio,
        item.price,
        item.costPrice || null,
        item.qty,
        item.subtotal,
      ]);

      // Kurangi stok di ledger (nilai negatif di base unit)
      const deductionInBaseUnit = -(item.qty * item.conversionRatio);
      const movementId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await connection.execute(`
        INSERT INTO stock_movements (
          id, product_id, type, quantity_in_base_unit, unit_name_used,
          unit_qty_used, reference_type, reference_id, notes
        ) VALUES (?, ?, 'out', ?, ?, ?, 'sale', ?, ?)
      `, [
        movementId,
        item.productId,
        deductionInBaseUnit,
        item.unitName,
        item.qty,
        sale.id,
        `Penjualan ${sale.invoiceCode}`,
      ]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Mencatat Kulakan Stok Masuk ke Ledger MySQL Lokal
 */
export async function createStockKulakan(params: {
  productId: string;
  unit: ProductUnit;
  unitQty: number;
  costPrice: number;
  supplier: string;
}): Promise<void> {
  const { productId, unit, unitQty, costPrice, supplier } = params;
  const qtyInBaseUnit = unitQty * unit.conversionRatio;
  const movementId = `mov-in-${Date.now()}`;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Simpan Mutasi Masuk
    await connection.execute(`
      INSERT INTO stock_movements (
        id, product_id, type, quantity_in_base_unit, unit_name_used,
        unit_qty_used, cost_per_unit, reference_type, notes
      ) VALUES (?, ?, 'in', ?, ?, ?, ?, 'purchase', ?)
    `, [
      movementId,
      productId,
      qtyInBaseUnit,
      unit.unitName,
      unitQty,
      costPrice,
      `Kulakan dari ${supplier}`,
    ]);

    // 2. Update referensi cost price di product_units
    if (costPrice > 0 && unit?.id) {
      await connection.execute(`
        UPDATE product_units 
        SET cost_price = ? 
        WHERE id = ?
      `, [costPrice, unit.id]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Menyimpan Rekonsiliasi Sesi Stok Opname Bulanan
 */
export async function createStockOpnameAdjustment(
  sessionCode: string,
  items: StockOpnameItem[]
): Promise<void> {
  const opnameId = `opn-${Date.now()}`;
  const totalDiffItems = items.filter((it) => it.difference !== 0);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Header Opname
    await connection.execute(`
      INSERT INTO stock_opnames (id, session_code, status, total_discrepancy_items, completed_at)
      VALUES (?, ?, 'completed', ?, NOW())
    `, [opnameId, sessionCode, totalDiffItems.length]);

    // 2. Items & Mutasi Penyesuaian
    for (const it of items) {
      const opnItemId = `opn-item-${Date.now()}-${it.productId}`;
      await connection.execute(`
        INSERT INTO stock_opname_items (id, opname_id, product_id, system_stock, physical_stock, difference, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        opnItemId,
        opnameId,
        it.productId,
        it.systemStock,
        it.physicalStock,
        it.difference,
        it.notes || null,
      ]);

      // Jika ada selisih, buat adjustment ledger
      if (it.difference !== 0) {
        const adjMovementId = `mov-adj-${Date.now()}-${it.productId}`;
        await connection.execute(`
          INSERT INTO stock_movements (
            id, product_id, type, quantity_in_base_unit, unit_name_used,
            unit_qty_used, reference_type, reference_id, notes
          ) VALUES (?, ?, 'adjustment', ?, ?, ?, 'opname', ?, ?)
        `, [
          adjMovementId,
          it.productId,
          it.difference,
          it.baseUnit,
          Math.abs(it.difference),
          opnameId,
          `Opname ${sessionCode}: ${it.notes || "Koreksi Fisik"}`,
        ]);
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Mengambil histori transaksi penjualan beserta items snapshot dari MySQL
 */
export async function getSalesFromDb(): Promise<Sale[]> {
  const salesRows = await query<RowDataPacket[]>(`
    SELECT 
      id, invoice_code AS invoiceCode, total_amount AS totalAmount,
      paid_amount AS paidAmount, change_amount AS changeAmount,
      payment_method AS paymentMethod, cashier_name AS cashierName,
      sync_status AS syncStatus,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS timestamp
    FROM sales
    ORDER BY created_at DESC
    LIMIT 100
  `);

  if (salesRows.length === 0) return [];

  const itemRows = await query<RowDataPacket[]>(`
    SELECT 
      id, sale_id AS saleId, product_id AS productId,
      snapshot_product_name AS productName, snapshot_unit_name AS unitName,
      conversion_ratio AS conversionRatio, price, cost_price AS costPrice,
      quantity AS qty, subtotal
    FROM sale_items
  `);

  return salesRows.map((s) => ({
    id: s.id,
    invoiceCode: s.invoiceCode,
    timestamp: s.timestamp,
    totalAmount: Number(s.totalAmount),
    paidAmount: Number(s.paidAmount),
    changeAmount: Number(s.changeAmount),
    paymentMethod: s.paymentMethod,
    syncStatus: s.syncStatus,
    cashierName: s.cashierName,
    items: itemRows
      .filter((it) => it.saleId === s.id)
      .map((it) => ({
        productId: it.productId,
        productName: it.productName,
        unitName: it.unitName,
        conversionRatio: Number(it.conversionRatio),
        price: Number(it.price),
        qty: Number(it.qty),
        subtotal: Number(it.subtotal),
        costPrice: it.costPrice ? Number(it.costPrice) : undefined,
      })),
  }));
}

/**
 * Mengambil riwayat mutasi stok (ledger) terkini dari MySQL
 */
export async function getStockMovementsFromDb(): Promise<StockMovement[]> {
  const rows = await query<RowDataPacket[]>(`
    SELECT 
      sm.id, sm.product_id AS productId, p.name AS productName,
      sm.type, sm.quantity_in_base_unit AS quantityInBaseUnit,
      sm.unit_name_used AS unitNameUsed, sm.unit_qty_used AS unitQtyUsed,
      sm.cost_per_unit AS costPerUnit, sm.notes,
      DATE_FORMAT(sm.created_at, '%Y-%m-%d %H:%i:%s') AS timestamp
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    ORDER BY sm.created_at DESC
    LIMIT 100
  `);

  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    type: r.type,
    quantityInBaseUnit: Number(r.quantityInBaseUnit),
    unitNameUsed: r.unitNameUsed,
    unitQtyUsed: Number(r.unitQtyUsed),
    costPerUnit: r.costPerUnit ? Number(r.costPerUnit) : undefined,
    notes: r.notes || "",
    timestamp: r.timestamp,
  }));
}

/**
 * Membuat Produk Baru beserta Multi-Satuan di MySQL
 */
export async function createProductWithUnits(product: Product): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert product
    await connection.execute(`
      INSERT INTO products (id, name, category, base_unit, min_stock_alert)
      VALUES (?, ?, ?, ?, ?)
    `, [
      product.id,
      product.name,
      product.category,
      product.baseUnit,
      product.minStockAlert || 10,
    ]);

    // 2. Insert units
    for (const unit of product.units) {
      await connection.execute(`
        INSERT INTO product_units (
          id, product_id, unit_name, conversion_ratio, price, cost_price, barcode, is_base_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        unit.id,
        product.id,
        unit.unitName,
        unit.conversionRatio,
        unit.price,
        unit.costPrice || null,
        unit.barcode?.trim() || null,
        unit.isBaseUnit ? 1 : 0,
      ]);
    }

    // 3. Insert initial stock movement if any
    if (product.stockInBaseUnit > 0) {
      const movId = `mov-init-${Date.now()}`;
      await connection.execute(`
        INSERT INTO stock_movements (
          id, product_id, type, quantity_in_base_unit, unit_name_used,
          unit_qty_used, reference_type, notes
        ) VALUES (?, ?, 'in', ?, ?, 1, 'init', 'Stok Awal Pendaftaran Barang')
      `, [
        movId,
        product.id,
        product.stockInBaseUnit,
        product.baseUnit,
      ]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Menandai transaksi berstatus pending menjadi synced
 */
export async function syncSalesInDb(): Promise<number> {
  const result = await query<ResultSetHeader>(`
    UPDATE sales 
    SET sync_status = 'synced', synced_at = NOW() 
    WHERE sync_status = 'pending'
  `);
  return result.affectedRows;
}

/**
 * Mengubah data produk dan satuan-satuannya di MySQL
 */
export async function updateProductWithUnits(product: Product): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(`
      UPDATE products
      SET name = ?, category = ?, base_unit = ?, min_stock_alert = ?
      WHERE id = ?
    `, [
      product.name,
      product.category,
      product.baseUnit,
      product.minStockAlert || 10,
      product.id,
    ]);

    // Hapus unit lama lalu pasang unit baru
    await connection.execute(`DELETE FROM product_units WHERE product_id = ?`, [product.id]);

    for (const unit of product.units) {
      await connection.execute(`
        INSERT INTO product_units (
          id, product_id, unit_name, conversion_ratio, price, cost_price, barcode, is_base_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        unit.id || `unit-${product.id}-${Date.now()}-${Math.random()}`,
        product.id,
        unit.unitName,
        unit.conversionRatio,
        unit.price,
        unit.costPrice || null,
        unit.barcode?.trim() || null,
        unit.isBaseUnit ? 1 : 0,
      ]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Menghapus produk secara aman (Soft Delete) agar riwayat transaksi & ledger keuangan tetap utuh
 */
export async function deleteProductInDb(productId: string): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.execute(`UPDATE products SET is_active = FALSE WHERE id = ?`, [productId]);
  } finally {
    connection.release();
  }
}

