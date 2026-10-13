import crypto from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { pool, query } from "../db.server";
import type { RowDataPacket } from "mysql2/promise";
import type {
  Product,
  ProductUnit,
  ProductPriceTier,
  CustomerGroupType,
  Sale,
  StockMovement,
  StockOpnameItem,
  StockBatch,
  ExpiryStatus,
  StockAdjustmentInput,
  StockCardEntry,
  ReorderRecommendation,
  StockOpnameSessionRecord,
} from "../types/pos";

/**
 * Reload environment variables dari file .env secara realtime
 */
export function reloadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    try {
      dotenv.config({ path: envPath, override: true });
    } catch (e) {
      console.warn("[POS Service] Gagal memuat file .env:", e);
    }
  }
}


/**
 * Mengambil semua data produk beserta multi-satuan, harga bertingkat (grosir), dan stok realtime dari ledger
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

  // 3. Ambil data tingkat harga grosir / reseller (PRD F3)
  let tierRows: RowDataPacket[] = [];
  try {
    tierRows = await query<RowDataPacket[]>(`
      SELECT 
        id,
        product_id AS productId,
        unit_id AS unitId,
        tier_name AS tierName,
        min_qty AS minQty,
        price,
        customer_group AS customerGroup
      FROM product_prices
      ORDER BY min_qty ASC
    `);
  } catch (err: any) {
    console.warn("[getProductsFromDb] Belum ada tabel product_prices:", err.message);
  }

  // 4. Mapping relasi produk ke units dan priceTiers
  return productRows.map((p) => {
    const units: ProductUnit[] = unitRows
      .filter((u) => u.productId === p.id)
      .map((u) => {
        const priceTiers: ProductPriceTier[] = tierRows
          .filter((t) => t.unitId === u.id)
          .map((t) => ({
            id: t.id,
            productId: t.productId,
            unitId: t.unitId,
            tierName: t.tierName,
            minQty: Number(t.minQty),
            price: Number(t.price),
            customerGroup: t.customerGroup as CustomerGroupType || null,
          }));

        return {
          id: u.id,
          productId: u.productId,
          unitName: u.unitName,
          conversionRatio: Number(u.conversionRatio),
          price: Number(u.price),
          costPrice: u.costPrice ? Number(u.costPrice) : undefined,
          barcode: u.barcode,
          isBaseUnit: Boolean(u.isBaseUnit),
          priceTiers,
        };
      });

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

export { calculateTieredPrice, getNextTierUpsell, validateTierList } from "./pricing";


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

  // Ambil tier harga untuk unit ini
  let priceTiers: ProductPriceTier[] = [];
  try {
    const tierRows = await query<RowDataPacket[]>(`
      SELECT id, product_id AS productId, unit_id AS unitId, tier_name AS tierName, min_qty AS minQty, price, customer_group AS customerGroup
      FROM product_prices
      WHERE unit_id = ?
      ORDER BY min_qty ASC
    `, [row.unit_id]);

    priceTiers = tierRows.map((t) => ({
      id: t.id,
      productId: t.productId,
      unitId: t.unitId,
      tierName: t.tierName,
      minQty: Number(t.minQty),
      price: Number(t.price),
      customerGroup: t.customerGroup as CustomerGroupType || null,
    }));
  } catch { }

  const unit: ProductUnit = {
    id: row.unit_id,
    productId: row.product_id,
    unitName: row.unit_name,
    conversionRatio: Number(row.conversion_ratio),
    price: Number(row.price),
    costPrice: row.cost_price ? Number(row.cost_price) : undefined,
    barcode: row.barcode,
    isBaseUnit: Boolean(row.is_base_unit),
    priceTiers,
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

    // Ambil shift kasir yang aktif saat ini jika ada (PRD F5.3)
    const [shiftRows] = await connection.execute<RowDataPacket[]>(
      "SELECT id, cashier_name FROM cashier_shifts WHERE status = 'open' ORDER BY start_time DESC LIMIT 1"
    );
    const activeShiftId = shiftRows.length > 0 ? String(shiftRows[0].id) : null;
    const activeCashierName = shiftRows.length > 0 ? String(shiftRows[0].cashier_name) : null;
    const finalCashierName = sale.cashierName || activeCashierName || process.env.CASHIER_DEFAULT_NAME || "Kasir";

    // 1. Simpan Header Sales (termasuk customer_id, shift_id, diskon & promo - PRD F6)
    await connection.execute(`
      INSERT INTO sales (
        id, invoice_code, total_amount, paid_amount, change_amount, 
        payment_method, customer_id, customer_name, cashier_name, sync_status, shift_id,
        discount_amount, discount_type, discount_reason, promo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sale.id,
      sale.invoiceCode,
      sale.totalAmount,
      sale.paidAmount,
      sale.changeAmount,
      sale.paymentMethod,
      sale.customerId || null,
      sale.customerName || null,
      finalCashierName,
      sale.syncStatus,
      activeShiftId,
      sale.discountAmount || 0,
      sale.discountType || null,
      sale.discountReason || null,
      sale.promoName || null,
    ]);

    // 1b. Jika pembayaran adalah Kasbon atau pembayaran sebagian dengan sisa utang (PRD F1.2 & F1.3)
    const debtAmount = Math.max(0, sale.totalAmount - sale.paidAmount);
    if ((sale.paymentMethod === "Kasbon" || sale.paymentMethod === "Hutang" || debtAmount > 0) && debtAmount > 0) {
      if (!sale.customerId) {
        throw new Error("Transaksi kasbon / utang wajib memilih data pelanggan!");
      }
      const receivableId = crypto.randomUUID();
      await connection.execute(`
        INSERT INTO receivables (
          id, customer_id, sale_id, invoice_code, amount, paid_amount, due_date, status, notes
        ) VALUES (?, ?, ?, ?, ?, 0, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'open', ?)
      `, [
        receivableId,
        sale.customerId,
        sale.id,
        sale.invoiceCode,
        debtAmount,
        `Kasbon nota ${sale.invoiceCode}`,
      ]);
    }

    // 1c. Simpan Rincian Pembayaran Split Payment jika ada (PRD F4.2)
    if (sale.splitPayments && sale.splitPayments.length > 0) {
      for (const sp of sale.splitPayments) {
        const spId = `sp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await connection.execute(`
          INSERT INTO sale_payments (id, sale_id, payment_method, amount, reference_no)
          VALUES (?, ?, ?, ?, ?)
        `, [
          spId,
          sale.id,
          sp.method,
          sp.amount,
          sp.referenceNo || null,
        ]);
      }
    }

    // 2. Simpan Sale Items & Ledger Mutasi Keluar
    for (const item of sale.items) {
      // Pastikan produk ada di tabel products agar tidak melanggar foreign key constraint
      const [prodCheck] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM products WHERE id = ?`,
        [item.productId]
      );

      if (prodCheck.length === 0) {
        await connection.execute(`
          INSERT INTO products (id, name, category, base_unit, min_stock_alert, is_active)
          VALUES (?, ?, 'Kebutuhan Harian', ?, 10, TRUE)
          ON DUPLICATE KEY UPDATE name = VALUES(name)
        `, [item.productId, item.productName, item.unitName || "pcs"]);
      }

      const itemId = `sitem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await connection.execute(`
        INSERT INTO sale_items (
          id, sale_id, product_id, snapshot_product_name, snapshot_unit_name,
          conversion_ratio, price, cost_price, quantity, subtotal, applied_tier_name,
          discount_amount, discount_type, discount_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        item.appliedTierName || null,
        item.discountAmount || 0,
        item.discountType || null,
        item.discountNote || null,
      ]);

      // Kurangi stok di ledger (nilai negatif di base unit)
      const baseUnitsNeeded = item.qty * item.conversionRatio;
      const deductionInBaseUnit = -baseUnitsNeeded;

      // PRD F7.2: FEFO Batch Deduction
      // Ambil batch stok yang aktif (qty_base > 0) berurutan dari tanggal kedaluwarsa terdekat (FEFO)
      // Produk dengan expiry_date terdekat diambil dulu, diikuti batch tanpa tanggal kedaluwarsa
      let primaryBatchId: string | null = null;
      try {
        const [batchRows] = await connection.query<RowDataPacket[]>(`
          SELECT id, batch_no, qty_base, expiry_date
          FROM stock_batches
          WHERE product_id = ? AND qty_base > 0
          ORDER BY (expiry_date IS NULL) ASC, expiry_date ASC, received_at ASC
          FOR UPDATE
        `, [item.productId]);

        let remainingToDeduct = baseUnitsNeeded;
        for (const b of batchRows) {
          if (remainingToDeduct <= 0) break;
          const bQty = Number(b.qty_base);
          const take = Math.min(bQty, remainingToDeduct);
          if (!primaryBatchId) {
            primaryBatchId = b.id;
          }
          await connection.execute(`
            UPDATE stock_batches
            SET qty_base = GREATEST(0, qty_base - ?)
            WHERE id = ?
          `, [take, b.id]);
          remainingToDeduct -= take;
        }
      } catch (batchErr: any) {
        console.warn("[FEFO deduction warning]:", batchErr.message);
      }

      const movementId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await connection.execute(`
        INSERT INTO stock_movements (
          id, product_id, type, quantity_in_base_unit, unit_name_used,
          unit_qty_used, reference_type, reference_id, batch_id, notes
        ) VALUES (?, ?, 'out', ?, ?, ?, 'sale', ?, ?, ?)
      `, [
        movementId,
        item.productId,
        deductionInBaseUnit,
        item.unitName,
        item.qty,
        sale.id,
        primaryBatchId,
        `Penjualan ${sale.invoiceCode}${primaryBatchId ? ' (FEFO)' : ''}`,
      ]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // Coba kirimkan snapshot transaksi ke Invoice Publik (non-blocking jika offline)
  try {
    await pushSaleToPublicInvoice(sale);
  } catch {
    // Mode offline normal: jika cloud tidak aktif, transaksi tetap tersimpan aman di MySQL lokal
  }
}

/**
 * Mencatat Kulakan Stok Masuk ke Ledger MySQL Lokal & Batch FEFO
 */
export async function createStockKulakan(params: {
  productId: string;
  unit: ProductUnit;
  unitQty: number;
  costPrice: number;
  supplier: string;
  batchNo?: string;
  expiryDate?: string | null;
}): Promise<void> {
  const { productId, unit, unitQty, costPrice, supplier, batchNo, expiryDate } = params;
  const qtyInBaseUnit = unitQty * unit.conversionRatio;
  const movementId = `mov-in-${Date.now()}`;
  const batchId = `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanBatchNo = (batchNo && batchNo.trim())
    ? batchNo.trim()
    : `B-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Simpan Batch Baru (PRD F7.2 FEFO)
    const costPerBaseUnit = unit.conversionRatio > 0 ? costPrice / unit.conversionRatio : costPrice;
    await connection.execute(`
      INSERT INTO stock_batches (
        id, product_id, batch_no, qty_base, initial_qty_base, cost_price, expiry_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      batchId,
      productId,
      cleanBatchNo,
      qtyInBaseUnit,
      qtyInBaseUnit,
      costPerBaseUnit,
      expiryDate || null,
      `Kulakan dari ${supplier}`,
    ]);

    // 2. Simpan Mutasi Masuk
    await connection.execute(`
      INSERT INTO stock_movements (
        id, product_id, type, quantity_in_base_unit, unit_name_used,
        unit_qty_used, cost_per_unit, reference_type, batch_id, notes
      ) VALUES (?, ?, 'in', ?, ?, ?, ?, 'purchase', ?, ?)
    `, [
      movementId,
      productId,
      qtyInBaseUnit,
      unit.unitName,
      unitQty,
      costPrice,
      batchId,
      `Kulakan dari ${supplier} (Batch: ${cleanBatchNo})`,
    ]);

    // 3. Update referensi cost price di product_units & Algoritma Moving Average HPP (PRD F8.3)
    if (costPrice > 0) {
      try {
        const [stockRows] = await connection.query<RowDataPacket[]>(
          `SELECT COALESCE(SUM(quantity_in_base_unit), 0) AS total_stock
           FROM stock_movements
           WHERE product_id = ? AND id != ?`,
          [productId, movementId]
        );
        const currentStockBase = Number((stockRows as any)[0]?.total_stock || 0);

        const [baseUnitRows] = await connection.query<RowDataPacket[]>(
          `SELECT cost_price FROM product_units WHERE product_id = ? AND is_base_unit = TRUE LIMIT 1`,
          [productId]
        );
        const currentBaseCost = Number((baseUnitRows as any)[0]?.cost_price || 0);

        let newBaseCost = costPerBaseUnit;
        if (currentStockBase > 0 && currentBaseCost > 0) {
          const combinedStock = currentStockBase + qtyInBaseUnit;
          if (combinedStock > 0) {
            newBaseCost = (currentStockBase * currentBaseCost + qtyInBaseUnit * costPerBaseUnit) / combinedStock;
          }
        }
        newBaseCost = Math.round(newBaseCost * 100) / 100;

        await connection.execute(
          `UPDATE product_units 
           SET cost_price = ROUND(? * conversion_ratio, 2)
           WHERE product_id = ?`,
          [newBaseCost, productId]
        );
      } catch (errHpp) {
        console.warn("[createStockKulakan HPP warning]:", errHpp);
        if (unit?.id) {
          await connection.execute(`UPDATE product_units SET cost_price = ? WHERE id = ?`, [costPrice, unit.id]);
        }
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
 * Menyimpan Rekonsiliasi Sesi Stok Opname Bulanan & Per Kategori (PRD F7.3)
 */
export async function createStockOpnameAdjustment(
  sessionCode: string,
  items: StockOpnameItem[],
  options?: {
    categoryFilter?: string | null;
    approvedBy?: string;
    notes?: string;
  }
): Promise<void> {
  const opnameId = `opn-${Date.now()}`;
  const totalDiffItems = items.filter((it) => it.difference !== 0);

  // Ambil harga modal dasar untuk menghitung selisih finansial
  const [costRows] = await pool.query<RowDataPacket[]>(`
    SELECT product_id, cost_price 
    FROM product_units 
    WHERE is_base_unit = TRUE
  `);
  const costMap = new Map<string, number>();
  for (const r of costRows) {
    costMap.set(r.product_id, Number(r.cost_price || 0));
  }

  let totalFinancialDiff = 0;
  const enrichedItems = items.map((it) => {
    const unitCost = it.costPrice !== undefined ? it.costPrice : (costMap.get(it.productId) || 0);
    const finDiff = it.difference * unitCost;
    totalFinancialDiff += finDiff;
    return {
      ...it,
      costPrice: unitCost,
      financialDiff: finDiff,
    };
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Header Opname
    await connection.execute(`
      INSERT INTO stock_opnames (
        id, session_code, status, category_filter, 
        total_discrepancy_items, total_financial_diff, notes, completed_at
      )
      VALUES (?, ?, 'completed', ?, ?, ?, ?, NOW())
    `, [
      opnameId,
      sessionCode,
      options?.categoryFilter || null,
      totalDiffItems.length,
      totalFinancialDiff,
      options?.notes || null,
    ]);

    // 2. Items & Mutasi Penyesuaian
    for (const it of enrichedItems) {
      const opnItemId = `opn-item-${Date.now()}-${it.productId}`;
      await connection.execute(`
        INSERT INTO stock_opname_items (
          id, opname_id, product_id, system_stock, physical_stock, 
          difference, cost_price, financial_diff, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        opnItemId,
        opnameId,
        it.productId,
        it.systemStock,
        it.physicalStock,
        it.difference,
        it.costPrice || 0,
        it.financialDiff || 0,
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

        // Jika selisih negatif (stok kurang/hilang), potong batch terdekat
        if (it.difference < 0) {
          try {
            const [bRows] = await connection.query<RowDataPacket[]>(`
              SELECT id, qty_base FROM stock_batches
              WHERE product_id = ? AND qty_base > 0
              ORDER BY (expiry_date IS NULL) ASC, expiry_date ASC, received_at ASC
              LIMIT 1
            `, [it.productId]);
            if (bRows.length > 0) {
              await connection.execute(`
                UPDATE stock_batches
                SET qty_base = GREATEST(0, qty_base - ?)
                WHERE id = ?
              `, [Math.abs(it.difference), bRows[0].id]);
            }
          } catch { }
        }
      }
    }

    // 3. Catat di audit log
    await connection.execute(`
      INSERT INTO audit_logs (id, user_name, action, target_type, target_id, details)
      VALUES (?, ?, 'STOCK_OPNAME_COMPLETED', 'stock_opname', ?, ?)
    `, [
      `aud-${Date.now()}`,
      options?.approvedBy || "Pemilik",
      opnameId,
      `Sesi Opname ${sessionCode}: ${totalDiffItems.length} barang selisih, total nilai finansial: Rp ${Math.round(totalFinancialDiff).toLocaleString("id-ID")}`,
    ]);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Mengambil daftar Batch & Status Kedaluwarsa (PRD F7.2)
 */
export async function getStockBatches(productId?: string): Promise<StockBatch[]> {
  const sql = `
    SELECT 
      sb.id,
      sb.product_id AS productId,
      p.name AS productName,
      p.category,
      p.base_unit AS baseUnit,
      sb.batch_no AS batchNo,
      sb.qty_base AS qtyBase,
      sb.initial_qty_base AS initialQtyBase,
      sb.cost_price AS costPrice,
      DATE_FORMAT(sb.expiry_date, '%Y-%m-%d') AS expiryDate,
      sb.received_at AS receivedAt,
      sb.notes
    FROM stock_batches sb
    JOIN products p ON sb.product_id = p.id
    WHERE p.is_active = TRUE ${productId ? "AND sb.product_id = ?" : ""}
    ORDER BY (sb.expiry_date IS NULL) ASC, sb.expiry_date ASC, sb.received_at ASC
  `;

  const rows = await query<RowDataPacket[]>(sql, productId ? [productId] : []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return rows.map((r) => {
    let daysUntilExpiry: number | null = null;
    let expiryStatus: ExpiryStatus = "safe";

    if (r.expiryDate) {
      const expDate = new Date(r.expiryDate);
      expDate.setHours(0, 0, 0, 0);
      daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        expiryStatus = "expired";
      } else if (daysUntilExpiry <= 7) {
        expiryStatus = "warning_7";
      } else if (daysUntilExpiry <= 30) {
        expiryStatus = "warning_30";
      } else {
        expiryStatus = "safe";
      }
    }

    return {
      id: r.id,
      productId: r.productId,
      productName: r.productName,
      category: r.category,
      baseUnit: r.baseUnit,
      batchNo: r.batchNo,
      qtyBase: Number(r.qtyBase),
      initialQtyBase: Number(r.initialQtyBase),
      costPrice: Number(r.costPrice),
      expiryDate: r.expiryDate || null,
      receivedAt: String(r.receivedAt),
      notes: r.notes || null,
      daysUntilExpiry,
      expiryStatus,
    };
  });
}

/**
 * Penyesuaian Stok Manual dengan Alasan Wajib & Audit Log (PRD F7.4)
 */
export async function createManualStockAdjustment(input: StockAdjustmentInput): Promise<void> {
  const { productId, qtyDiff, reasonCategory, notes, batchId, approvedBy } = input;
  if (!productId || qtyDiff === 0) {
    throw new Error("Produk dan jumlah selisih tidak boleh kosong");
  }

  const [prodRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, name, base_unit FROM products WHERE id = ?",
    [productId]
  );
  if (prodRows.length === 0) {
    throw new Error("Produk tidak ditemukan");
  }
  const prod = prodRows[0];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const movementId = `mov-adj-${Date.now()}`;
    const reasonLabelMap: Record<string, string> = {
      rusak: "Barang Rusak/Pecah",
      hilang: "Barang Hilang",
      kedaluwarsa: "Kedaluwarsa/Basi",
      konsumsi_sendiri: "Konsumsi Pribadi/Toko",
      koreksi: "Koreksi Stok Manual",
    };
    const formattedNotes = `[${reasonLabelMap[reasonCategory] || reasonCategory.toUpperCase()}] ${notes || ""}`.trim();

    // 1. Simpan ke stock_movements
    await connection.execute(`
      INSERT INTO stock_movements (
        id, product_id, type, quantity_in_base_unit, unit_name_used,
        unit_qty_used, reference_type, batch_id, notes
      ) VALUES (?, ?, 'adjustment', ?, ?, ?, 'adjustment', ?, ?)
    `, [
      movementId,
      productId,
      qtyDiff,
      prod.base_unit,
      Math.abs(qtyDiff),
      batchId || null,
      formattedNotes,
    ]);

    // 2. Potong / tambah batch jika batchId diberikan atau potong FEFO jika pengurangan
    if (batchId) {
      if (qtyDiff < 0) {
        await connection.execute(`
          UPDATE stock_batches
          SET qty_base = GREATEST(0, qty_base - ?)
          WHERE id = ?
        `, [Math.abs(qtyDiff), batchId]);
      } else {
        await connection.execute(`
          UPDATE stock_batches
          SET qty_base = qty_base + ?
          WHERE id = ?
        `, [qtyDiff, batchId]);
      }
    } else if (qtyDiff < 0) {
      // FEFO deduction dari batch aktif
      const [bRows] = await connection.query<RowDataPacket[]>(`
        SELECT id, qty_base FROM stock_batches
        WHERE product_id = ? AND qty_base > 0
        ORDER BY (expiry_date IS NULL) ASC, expiry_date ASC, received_at ASC
        FOR UPDATE
      `, [productId]);

      let remaining = Math.abs(qtyDiff);
      for (const b of bRows) {
        if (remaining <= 0) break;
        const take = Math.min(Number(b.qty_base), remaining);
        await connection.execute(`
          UPDATE stock_batches
          SET qty_base = GREATEST(0, qty_base - ?)
          WHERE id = ?
        `, [take, b.id]);
        remaining -= take;
      }
    }

    // 3. Catat di audit_logs (Wajib PRD F7.4)
    await connection.execute(`
      INSERT INTO audit_logs (id, user_name, action, target_type, target_id, details)
      VALUES (?, ?, 'STOCK_MANUAL_ADJUSTMENT', 'product', ?, ?)
    `, [
      `aud-${Date.now()}`,
      approvedBy || "Pemilik",
      productId,
      JSON.stringify({
        productName: prod.name,
        qtyDiff,
        reason: reasonCategory,
        notes: notes || "",
        batchId: batchId || null,
      }),
    ]);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Kartu Stok per Produk dengan Saldo Berjalan (PRD F7.6)
 */
export async function getStockCardHistory(productId: string, limit = 100): Promise<StockCardEntry[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT 
      sm.id,
      sm.created_at AS createdAt,
      sm.type,
      COALESCE(sm.reference_type, 'manual') AS refType,
      sm.reference_id AS refId,
      sm.quantity_in_base_unit AS qtyChange,
      sm.unit_name_used AS unitNameUsed,
      sm.unit_qty_used AS unitQtyUsed,
      sm.cost_per_unit AS costPerUnit,
      sm.notes,
      sb.batch_no AS batchNo,
      DATE_FORMAT(sb.expiry_date, '%Y-%m-%d') AS batchExpiry
    FROM stock_movements sm
    LEFT JOIN stock_batches sb ON sm.batch_id = sb.id
    WHERE sm.product_id = ?
    ORDER BY sm.created_at ASC, sm.id ASC
  `, [productId]);

  let runningBalance = 0;
  const listWithBalance: StockCardEntry[] = [];

  for (const r of rows) {
    runningBalance += Number(r.qtyChange);
    listWithBalance.push({
      id: r.id,
      date: new Date(r.createdAt).toLocaleString("id-ID"),
      type: r.type,
      refType: r.refType,
      refId: r.refId || undefined,
      qtyChange: Number(r.qtyChange),
      unitNameUsed: r.unitNameUsed,
      unitQtyUsed: Number(r.unitQtyUsed),
      runningBalance: Number(runningBalance.toFixed(2)),
      costPerUnit: r.costPerUnit ? Number(r.costPerUnit) : undefined,
      notes: r.notes || "",
      batchNo: r.batchNo || undefined,
      batchExpiry: r.batchExpiry || undefined,
    });
  }

  return listWithBalance.reverse().slice(0, limit);
}

/**
 * Rekomendasi Kulakan Berdasarkan Kecepatan Jual 30 Hari & Lead Time (PRD F7.5)
 */
export async function getReorderRecommendations(): Promise<ReorderRecommendation[]> {
  // 1. Ambil data produk aktif dan stok saat ini
  const [products] = await pool.query<RowDataPacket[]>(`
    SELECT 
      p.id, 
      p.name, 
      p.category, 
      p.base_unit AS baseUnit, 
      COALESCE(p.min_stock_alert, 5) AS minStock,
      COALESCE(v.current_stock_base_unit, 0) AS currentStock,
      COALESCE(pu.cost_price, 0) AS lastCostPrice
    FROM products p
    LEFT JOIN v_product_current_stocks v ON p.id = v.product_id
    LEFT JOIN product_units pu ON p.id = pu.product_id AND pu.is_base_unit = TRUE
    WHERE p.is_active = TRUE
  `);

  // 2. Ambil akumulasi penjualan dalam 30 hari terakhir
  const [salesRows] = await pool.query<RowDataPacket[]>(`
    SELECT 
      si.product_id,
      COALESCE(SUM(si.quantity * si.conversion_ratio), 0) AS sold_30_days
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.is_void = FALSE 
      AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY si.product_id
  `);

  const salesMap = new Map<string, number>();
  for (const r of salesRows) {
    salesMap.set(r.product_id, Number(r.sold_30_days || 0));
  }

  const recommendations: ReorderRecommendation[] = products.map((p) => {
    const sold30 = salesMap.get(p.id) || 0;
    const avgDailySales = Number((sold30 / 30).toFixed(2));
    const currentStock = Number(p.currentStock);
    const minStock = Number(p.minStock);
    const lastCostPrice = Number(p.lastCostPrice);

    // Hitung sisa hari stok bertahan
    let daysOfStockLeft = 999;
    if (avgDailySales > 0) {
      daysOfStockLeft = Number((currentStock / avgDailySales).toFixed(1));
    } else if (currentStock <= 0) {
      daysOfStockLeft = 0;
    }

    // Lead time target: 7 hari stok aman + minStock
    const targetBuffer = Math.ceil(avgDailySales * 7);
    let suggestedOrderQty = Math.max(0, Math.ceil(targetBuffer + minStock - currentStock));

    // Jika stok habis atau di bawah minimum tetapi belum ada riwayat penjualan 30 hari
    if (currentStock <= minStock && suggestedOrderQty === 0) {
      suggestedOrderQty = minStock * 2;
    }

    // Tentukan tingkat urgensi
    let urgency: "critical" | "warning" | "normal" = "normal";
    if (currentStock <= 0 || daysOfStockLeft <= 2) {
      urgency = "critical";
    } else if (currentStock <= minStock || daysOfStockLeft <= 7) {
      urgency = "warning";
    }

    return {
      productId: p.id,
      productName: p.name,
      category: p.category,
      baseUnit: p.baseUnit,
      currentStock,
      minStock,
      avgDailySales,
      daysOfStockLeft: daysOfStockLeft < 0 ? 0 : daysOfStockLeft,
      suggestedOrderQty,
      lastCostPrice,
      estimatedTotalCost: suggestedOrderQty * lastCostPrice,
      urgency,
    };
  });

  // Urutkan: Kritis dulu, lalu Waspada, lalu Normal
  const urgencyWeight = { critical: 0, warning: 1, normal: 2 };
  return recommendations.sort((a, b) => {
    if (urgencyWeight[a.urgency] !== urgencyWeight[b.urgency]) {
      return urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    }
    return a.daysOfStockLeft - b.daysOfStockLeft;
  });
}

/**
 * Mengambil Riwayat Sesi Stok Opname (PRD F7.3)
 */
export async function getStockOpnameHistory(limit = 20): Promise<StockOpnameSessionRecord[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT 
      id,
      session_code AS sessionCode,
      status,
      category_filter AS categoryFilter,
      total_discrepancy_items AS totalDiscrepancyItems,
      total_financial_diff AS totalFinancialDiff,
      notes,
      created_at AS createdAt,
      completed_at AS completedAt
    FROM stock_opnames
    ORDER BY created_at DESC
    LIMIT ?
  `, [limit]);

  return rows.map((r) => ({
    id: r.id,
    sessionCode: r.sessionCode,
    status: r.status,
    categoryFilter: r.categoryFilter || null,
    totalItems: 0,
    totalDiscrepancyItems: Number(r.totalDiscrepancyItems || 0),
    totalFinancialDiff: Number(r.totalFinancialDiff || 0),
    notes: r.notes || null,
    createdAt: new Date(r.createdAt).toLocaleString("id-ID"),
    completedAt: r.completedAt ? new Date(r.completedAt).toLocaleString("id-ID") : null,
  }));
}

/**
 * Mengambil histori transaksi penjualan beserta items snapshot dari MySQL
 */
export async function getSalesFromDb(): Promise<Sale[]> {
  const salesRows = await query<RowDataPacket[]>(`
    SELECT 
      id, invoice_code AS invoiceCode, total_amount AS totalAmount,
      paid_amount AS paidAmount, change_amount AS changeAmount,
      payment_method AS paymentMethod, customer_id AS customerId,
      customer_name AS customerName, cashier_name AS cashierName,
      sync_status AS syncStatus,
      is_void AS isVoid, void_reason AS voidReason,
      DATE_FORMAT(voided_at, '%Y-%m-%d %H:%i:%s') AS voidedAt,
      voided_by AS voidedBy,
      discount_amount AS discountAmount,
      discount_type AS discountType,
      discount_reason AS discountReason,
      promo_name AS promoName,
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
      quantity AS qty, subtotal, applied_tier_name AS appliedTierName,
      discount_amount AS discountAmount, discount_type AS discountType,
      discount_note AS discountNote
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
    customerId: s.customerId || undefined,
    customerName: s.customerName || undefined,
    syncStatus: s.syncStatus,
    cashierName: s.cashierName,
    isVoid: Boolean(s.isVoid),
    voidReason: s.voidReason || undefined,
    voidedAt: s.voidedAt || undefined,
    voidedBy: s.voidedBy || undefined,
    discountAmount: Number(s.discountAmount || 0),
    discountType: s.discountType || undefined,
    discountReason: s.discountReason || undefined,
    promoName: s.promoName || undefined,
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
        appliedTierName: it.appliedTierName || undefined,
        discountAmount: Number(it.discountAmount || 0),
        discountType: it.discountType || undefined,
        discountNote: it.discountNote || undefined,
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

    // 2. Insert units & price tiers (PRD F3)
    for (const unit of product.units) {
      const cleanBarcode = unit.barcode?.trim() || null;

      if (cleanBarcode) {
        // Bebaskan barcode jika sebelumnya menempel pada produk yang sudah dihapus/dinonaktifkan (is_active = FALSE)
        const [inactiveRows] = await connection.execute<RowDataPacket[]>(`
          SELECT pu.id, pu.product_id,
                 (SELECT COUNT(*) FROM sale_items si WHERE si.product_id = p.id) AS sales_count
          FROM product_units pu
          JOIN products p ON pu.product_id = p.id
          WHERE pu.barcode = ? AND p.is_active = FALSE
        `, [cleanBarcode]);

        if (inactiveRows && inactiveRows.length > 0) {
          for (const row of inactiveRows) {
            if (Number(row.sales_count) === 0) {
              await connection.execute(`DELETE FROM stock_movements WHERE product_id = ?`, [row.product_id]);
              await connection.execute(`DELETE FROM product_prices WHERE product_id = ?`, [row.product_id]);
              await connection.execute(`DELETE FROM product_units WHERE product_id = ?`, [row.product_id]);
              await connection.execute(`DELETE FROM products WHERE id = ?`, [row.product_id]);
            } else {
              await connection.execute(`UPDATE product_units SET barcode = NULL WHERE id = ?`, [row.id]);
            }
          }
        }
      }

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
        cleanBarcode,
        unit.isBaseUnit ? 1 : 0,
      ]);

      if (unit.priceTiers && unit.priceTiers.length > 0) {
        for (const tier of unit.priceTiers) {
          const tierId = tier.id || `tier-${unit.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await connection.execute(`
            INSERT INTO product_prices (id, product_id, unit_id, tier_name, min_qty, price, customer_group)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            tierId,
            product.id,
            unit.id,
            tier.tierName.trim(),
            Number(tier.minQty) || 1,
            Number(tier.price) || 0,
            tier.customerGroup || null,
          ]);
        }
      }
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

export const DEFAULT_CLOUD_SYNC_URL = "https://pos-warungmadura.ainulhuda.my.id/api/sync";
export const DEFAULT_CLOUD_BASE_URL = "https://pos-warungmadura.ainulhuda.my.id";

export function getSyncSecretKey(): string {
  reloadEnv();
  return (process.env.SYNC_SECRET_KEY || "").trim();
}

export function getSyncApiUrl(): string {
  reloadEnv();
  const configured = (process.env.PUBLIC_INVOICE_SYNC_URL || "").trim();
  if (configured && !configured.includes("5175")) {
    return configured;
  }
  return DEFAULT_CLOUD_SYNC_URL;
}

export interface InstallationIdentity {
  storeId: string;
  deviceKey: string;
  createdAt: string;
}

let cachedIdentity: InstallationIdentity | null = null;

/**
 * Mendapatkan atau membuat identitas instalasi unik (store_id UUID & device_key 256-bit)
 * Disimpan permanen di tabel store_settings MySQL lokal (PRD T1.2)
 */
export async function getOrCreateInstallationIdentity(): Promise<InstallationIdentity> {
  if (cachedIdentity) return cachedIdentity;

  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT setting_key, setting_value FROM store_settings WHERE setting_key IN ('installation_store_id', 'installation_device_key', 'installation_created_at')`
    );

    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.setting_key] = r.setting_value;
    }

    let storeId = map["installation_store_id"];
    let deviceKey = map["installation_device_key"];
    let createdAt = map["installation_created_at"];
    const now = new Date().toISOString();

    if (!storeId) {
      storeId = crypto.randomUUID();
      await query(
        `INSERT INTO store_settings (setting_key, setting_value) VALUES ('installation_store_id', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [storeId]
      );
    }

    if (!deviceKey) {
      // Kunci perangkat acak 256-bit (32 bytes hex)
      deviceKey = crypto.randomBytes(32).toString("hex");
      await query(
        `INSERT INTO store_settings (setting_key, setting_value) VALUES ('installation_device_key', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [deviceKey]
      );
    }

    if (!createdAt) {
      createdAt = now;
      await query(
        `INSERT INTO store_settings (setting_key, setting_value) VALUES ('installation_created_at', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [createdAt]
      );
    }

    cachedIdentity = { storeId, deviceKey, createdAt };
    return cachedIdentity;
  } catch (err) {
    const storeId = process.env.STORE_ID || "store-" + (process.env.STORE_CODE || "WM01");
    const deviceKey = crypto.randomBytes(32).toString("hex");
    return { storeId, deviceKey, createdAt: new Date().toISOString() };
  }
}

/**
 * Merotasi kunci perangkat (device_key) tanpa menghilangkan transaksi pending (PRD T1.5)
 */
export async function rotateDeviceKey(): Promise<InstallationIdentity> {
  const newDeviceKey = crypto.randomBytes(32).toString("hex");
  await query(
    `INSERT INTO store_settings (setting_key, setting_value) VALUES ('installation_device_key', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [newDeviceKey]
  );
  if (cachedIdentity) {
    cachedIdentity.deviceKey = newDeviceKey;
  }
  return getOrCreateInstallationIdentity();
}

export interface StoreConfig {
  storeCode: string;
  storeName: string;
  ownerName: string;
  storeSlug: string;
  storeTagline: string;
  storeAddress: string;
  storeCity: string;
  cashierName: string;
  publicInvoiceBaseUrl: string;
  syncSecretKey?: string;
  publicInvoiceSyncUrl: string;
}

export interface CloudTenantInfo {
  valid: boolean;
  id?: string;
  storeName?: string;
  ownerName?: string | null;
  storeCode?: string;
  storeSlug?: string;
  storeAddress?: string | null;
  ownerEmail?: string | null;
  contactWa?: string | null;
  plan?: "free" | "pro";
  status?: "active" | "suspended" | "pending";
  invoiceCount?: number;
  invoiceLimit?: number;
  quotaRemaining?: number;
  error?: string;
  errorCode?: string;
}

export interface CloudStatusResult {
  ok: boolean;
  message: string;
  supabaseConnected?: boolean;
  tenant?: CloudTenantInfo | null;
  saas?: {
    freePlanLimit: number;
    proPlanPrice: number;
    resetDay: number;
  };
}

/**
 * Membaca konfigurasi profil toko / warung dari environment variable (.env)
 */
export function getStoreConfig(): StoreConfig {
  reloadEnv();
  return {
    storeCode: process.env.STORE_CODE || "WM01",
    storeName: process.env.STORE_NAME || "Warung Madura Berkah",
    ownerName: process.env.OWNER_NAME || "Cak Mat (Pemilik)",
    storeSlug: process.env.STORE_SLUG || "warung-madura-berkah",
    storeTagline: process.env.STORE_TAGLINE || "Buka 24 Jam Non-Stop",
    storeAddress: process.env.STORE_ADDRESS || "Jl. Raya Warung Madura No. 24, Buka 24 Jam Non-Stop",
    storeCity: process.env.STORE_CITY || "",
    cashierName: process.env.CASHIER_DEFAULT_NAME || "Cak Mat",
    publicInvoiceBaseUrl: process.env.PUBLIC_INVOICE_BASE_URL || "",
    syncSecretKey: getSyncSecretKey(),
    publicInvoiceSyncUrl: getSyncApiUrl(),
  };
}

/**
 * Mengecek ketersediaan server Cloud Invoice Sync & Validasi Tenant SaaS
 */
export async function testCloudConnection(): Promise<CloudStatusResult> {
  reloadEnv();
  const syncSecret = getSyncSecretKey();
  if (!syncSecret) {
    return {
      ok: false,
      message: "Cloud offline / belum terhubung (Secret Key kosong)",
      tenant: null,
    };
  }

  let syncUrl = getSyncApiUrl();
  const envSync = process.env.PUBLIC_INVOICE_SYNC_URL?.trim();
  if (syncUrl.includes("5175") && envSync && !envSync.includes("5175")) {
    syncUrl = envSync;
  }
  if (!syncUrl || syncUrl.includes("5175")) {
    syncUrl = DEFAULT_CLOUD_SYNC_URL;
  }

  try {
    const res = await fetch(syncUrl, {
      method: "GET",
      headers: {
        "x-sync-secret": syncSecret,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const tenant: CloudTenantInfo | null = data.tenant || null;
      let message = "Server Cloud Terhubung";

      if (tenant) {
        if (!tenant.valid) {
          message = `Cloud Online — ${tenant.error || "Secret Key tidak valid"}`;
        } else if (tenant.plan === "pro") {
          message = `Cloud Online — Paket Pro (Unlimited)`;
        } else if (tenant.plan === "free") {
          message = `Cloud Online — Paket Free (Sisa: ${tenant.quotaRemaining}/${tenant.invoiceLimit})`;
        }
      }

      return {
        ok: Boolean(tenant && tenant.valid),
        message,
        supabaseConnected: data.supabase?.connected ?? data.supabaseConnected,
        tenant,
        saas: data.saas,
      };
    }
    return { ok: false, message: `Server Cloud respon HTTP ${res.status}`, tenant: null };
  } catch (err: any) {
    const causeMsg = err.cause?.message || err.cause?.code || "";
    const detail = causeMsg ? `${err.message} (${causeMsg})` : err.message;
    return {
      ok: false,
      message: `Server Cloud Offline (${detail})`,
      tenant: null,
    };
  }
}

export interface UpdateCloudConfigInput {
  syncSecretKey: string;
  syncApiUrl?: string;
  publicBaseUrl?: string;
  storeCode?: string;
  storeSlug?: string;
  storeName?: string;
  ownerName?: string;
  storeAddress?: string;
}

/**
 * Memverifikasi Secret Key ke server SaaS tanpa menyimpan terlebih dahulu
 */
export async function verifyTenantSecret(secretKey: string, apiUrl?: string): Promise<{
  ok: boolean;
  message: string;
  tenant?: CloudTenantInfo | null;
}> {
  reloadEnv();
  const configuredUrl = getSyncApiUrl();
  let url = (apiUrl || "").trim();

  // Jika URL tidak diisi atau menunjuk ke port 5175 / localhost, arahkan ke cloud URL
  if (!url || url.includes("5175") || url.includes("localhost") || url.includes("127.0.0.1")) {
    url = configuredUrl && !configuredUrl.includes("5175") ? configuredUrl : DEFAULT_CLOUD_SYNC_URL;
  }
  if (!url) {
    url = DEFAULT_CLOUD_SYNC_URL;
  }

  const tryFetch = async (targetUrl: string) => {
    return await fetch(targetUrl, {
      method: "GET",
      headers: {
        "x-sync-secret": secretKey.trim(),
      },
      signal: AbortSignal.timeout(15000), // 15 detik agar tidak mudah timeout pada cold-start cloud
    });
  };

  try {
    let res: Response;
    let targetUsed = url;
    try {
      res = await tryFetch(url);
    } catch (fetchErr: any) {
      // Jika request ke url pertama gagal dan url bukan cloud URL default, coba fallback otomatis ke DEFAULT_CLOUD_SYNC_URL
      if (url !== DEFAULT_CLOUD_SYNC_URL) {
        targetUsed = DEFAULT_CLOUD_SYNC_URL;
        res = await tryFetch(DEFAULT_CLOUD_SYNC_URL);
      } else {
        throw fetchErr;
      }
    }

    if (res.ok) {
      const data = await res.json();
      const tenant = data.tenant as CloudTenantInfo | null;
      if (tenant && tenant.valid) {
        return {
          ok: true,
          message: `Secret Key Valid! Toko: ${tenant.storeName} (${tenant.storeCode}) — Paket ${tenant.plan?.toUpperCase()}`,
          tenant,
        };
      }
      return {
        ok: false,
        message: tenant?.error || "Secret Key tidak terdaftar di platform SaaS",
        tenant: null,
      };
    }
    return {
      ok: false,
      message: `Server merespon HTTP ${res.status}`,
      tenant: null,
    };
  } catch (err: any) {
    const causeMsg = err.cause?.message || err.cause?.code || "";
    const detail = causeMsg ? `${err.message}: ${causeMsg}` : err.message;
    return {
      ok: false,
      message: `Gagal menghubungi server sync [${url}] (${detail})`,
      tenant: null,
    };
  }
}

/**
 * Menyimpan konfigurasi cloud SaaS ke file .env dan runtime process.env
 * Jika hanya secret key yang diinput, identitas toko otomatis diambil dari respon SaaS!
 */
export async function saveCloudConfig(input: UpdateCloudConfigInput): Promise<{
  ok: boolean;
  message: string;
  tenant?: CloudTenantInfo | null;
}> {
  reloadEnv();
  const secretKey = (input.syncSecretKey || "").trim();
  if (!secretKey) {
    return { ok: false, message: "Secret Key tidak boleh kosong", tenant: null };
  }

  const configuredUrl = getSyncApiUrl();
  let syncUrl = (input.syncApiUrl || "").trim();
  if (!syncUrl || syncUrl.includes("5175")) {
    syncUrl = configuredUrl && !configuredUrl.includes("5175") ? configuredUrl : DEFAULT_CLOUD_SYNC_URL;
  }
  if (!syncUrl) {
    syncUrl = DEFAULT_CLOUD_SYNC_URL;
  }

  // 1. Verifikasi secret key ke server SaaS & ambil profil toko lengkap
  const verifyResult = await verifyTenantSecret(secretKey, syncUrl);
  if (!verifyResult.ok || !verifyResult.tenant) {
    return {
      ok: false,
      message: verifyResult.message || "Secret Key tidak valid di platform SaaS",
      tenant: null,
    };
  }

  const tenant = verifyResult.tenant;

  // 2. Ambil identitas otomatis dari respon SaaS (kecuali dioverride secara eksplisit)
  const storeName = input.storeName?.trim() || tenant.storeName || process.env.STORE_NAME || "Warung Madura";
  const ownerName = input.ownerName?.trim() || tenant.ownerName || process.env.OWNER_NAME || "";
  const storeCode = input.storeCode?.trim().toUpperCase() || tenant.storeCode || process.env.STORE_CODE || "WM01";
  const storeSlug = input.storeSlug?.trim() || tenant.storeSlug || process.env.STORE_SLUG || "warung-madura";
  const storeAddress = input.storeAddress?.trim() || tenant.storeAddress || process.env.STORE_ADDRESS || "";
  const publicBaseUrl = input.publicBaseUrl !== undefined ? input.publicBaseUrl.trim() : (process.env.PUBLIC_INVOICE_BASE_URL || "");

  // 3. Update runtime process.env
  process.env.SYNC_SECRET_KEY = secretKey;
  process.env.PUBLIC_INVOICE_SYNC_URL = syncUrl;
  process.env.STORE_NAME = storeName;
  if (ownerName) process.env.OWNER_NAME = ownerName;
  process.env.STORE_CODE = storeCode;
  process.env.STORE_SLUG = storeSlug;
  if (storeAddress) process.env.STORE_ADDRESS = storeAddress;
  if (publicBaseUrl !== undefined) process.env.PUBLIC_INVOICE_BASE_URL = publicBaseUrl;

  // 4. Update file .env secara permanen
  const envPath = path.resolve(process.cwd(), ".env");
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf-8");
  }

  const updateEnvKey = (key: string, value: string) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  };

  updateEnvKey("SYNC_SECRET_KEY", secretKey);
  updateEnvKey("PUBLIC_INVOICE_SYNC_URL", syncUrl);
  updateEnvKey("STORE_NAME", storeName);
  if (ownerName) updateEnvKey("OWNER_NAME", ownerName);
  updateEnvKey("STORE_CODE", storeCode);
  updateEnvKey("STORE_SLUG", storeSlug);
  if (storeAddress) updateEnvKey("STORE_ADDRESS", storeAddress);
  if (publicBaseUrl !== undefined) updateEnvKey("PUBLIC_INVOICE_BASE_URL", publicBaseUrl);

  try {
    fs.writeFileSync(envPath, content, "utf-8");
  } catch (err: any) {
    console.error("[saveCloudConfig] Gagal menulis ke .env:", err);
  }

  // Update profil owner di database lokal jika ada
  try {
    if (ownerName) {
      await query("UPDATE users SET name = ? WHERE role = 'owner'", [ownerName]);
      await query(
        "INSERT INTO store_settings (setting_key, setting_value) VALUES ('owner_name', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [ownerName]
      );
    }
  } catch (dbErr) {
    console.warn("[saveCloudConfig] Gagal update owner di database:", dbErr);
  }

  return {
    ok: true,
    message: `Toko "${storeName}" (${storeCode}) berhasil dihubungkan! Paket: ${tenant.plan?.toUpperCase()}.`,
    tenant: {
      ...tenant,
      storeName,
      ownerName,
      storeCode,
      storeSlug,
      storeAddress,
    },
  };
}

/**
 * Memutuskan sambungan toko dari Cloud SaaS
 */
export async function disconnectCloudConfig(): Promise<{ ok: boolean; message: string }> {
  process.env.SYNC_SECRET_KEY = "";
  const envPath = path.resolve(process.cwd(), ".env");
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf-8");
  }

  const regex = new RegExp(`^SYNC_SECRET_KEY=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `SYNC_SECRET_KEY=`);
  } else {
    content += `\nSYNC_SECRET_KEY=`;
  }

  try {
    fs.writeFileSync(envPath, content, "utf-8");
  } catch (err: any) {
    console.error("[disconnectCloudConfig] Gagal mengosongkan SYNC_SECRET_KEY:", err);
  }

  return { ok: true, message: "Koneksi cloud toko berhasil diputuskan." };
}

export interface PushSaleResult {
  success: boolean;
  publicUrl?: string | null;
  quotaRemaining?: number;
  error?: string;
  errorCode?: string;
}

/**
 * Mengirimkan snapshot satu invoice ke server Invoice Publik (Supabase Cloud API)
 */
export async function pushSaleToPublicInvoice(sale: Sale): Promise<PushSaleResult> {
  const storeConfig = getStoreConfig();
  const syncSecret = getSyncSecretKey();
  if (!syncSecret) {
    return {
      success: false,
      error: "Cloud sync belum dikonfigurasi (Secret Key belum terhubung)",
      errorCode: "NOT_CONNECTED",
    };
  }

  const identity = await getOrCreateInstallationIdentity();
  const syncUrl = getSyncApiUrl();

  try {
    const payload = {
      secretKey: syncSecret,
      storeId: identity.storeId,
      invoice: {
        id: sale.invoiceCode,
        storeName: storeConfig.storeName,
        storeAddress: storeConfig.storeAddress,
        totalAmount: sale.totalAmount,
        paidAmount: sale.paidAmount,
        changeAmount: sale.changeAmount,
        paymentMethod: sale.paymentMethod,
        cashierName: sale.cashierName || storeConfig.cashierName,
        createdAt: new Date().toISOString(),
        isVoid: Boolean(sale.isVoid),
        discountAmount: sale.discountAmount || 0,
        promoName: sale.promoName,
        items: sale.items.map((it) => ({
          productName: it.productName,
          unitName: it.unitName,
          qty: it.qty,
          price: it.price,
          subtotal: it.subtotal,
          discountAmount: it.discountAmount || 0,
        })),
      },
    };

    const rawPayload = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac("sha256", syncSecret)
      .update(`${timestamp}.${rawPayload}`)
      .digest("hex");

    const res = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": syncSecret,
        "x-sync-store-id": identity.storeId,
        "x-sync-timestamp": timestamp,
        "x-sync-signature": signature,
      },
      body: rawPayload,
      signal: AbortSignal.timeout(4000),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.ok) {
      await query(
        `UPDATE sales SET sync_status = 'synced', synced_at = NOW() WHERE id = ?`,
        [sale.id]
      );
      return {
        success: true,
        publicUrl: data.publicUrl,
        quotaRemaining: data.quotaRemaining,
      };
    }

    const errorMsg = data?.error || `HTTP ${res.status}`;
    const errorCode = data?.errorCode;
    console.warn(`[Sync Cloud POS] Gagal kirim invoice ${sale.invoiceCode}:`, errorMsg);

    return {
      success: false,
      error: errorMsg,
      errorCode,
    };
  } catch (err: any) {
    // Mode offline normal: jika server cloud tidak dapat dihubungi, transaksi tetap aman di MySQL
    console.log("[Sync Cloud POS] Transaksi tersimpan lokal (akan disinkronkan saat online):", err.message);
    return {
      success: false,
      error: err.message || "Cloud server offline",
    };
  }
}

export interface SyncSalesResult {
  syncedCount: number;
  totalPending: number;
  cloudOnline: boolean;
  message: string;
  quotaRemaining?: number;
  plan?: string;
  errorDetail?: string;
}

/**
 * Menyinkronkan seluruh transaksi berstatus pending ke server Invoice Publik
 */
export async function syncSalesInDb(): Promise<SyncSalesResult> {
  const cloudHealth = await testCloudConnection();
  if (!cloudHealth.ok) {
    const pendingSales = await query<RowDataPacket[]>(`
      SELECT COUNT(*) AS count FROM sales WHERE sync_status = 'pending'
    `);
    const totalPending = pendingSales[0]?.count || 0;
    return {
      syncedCount: 0,
      totalPending: Number(totalPending),
      cloudOnline: false,
      message: "Server cloud belum aktif atau tidak dapat dijangkau. Pastikan endpoint invoice publik online.",
    };
  }

  // Jika auth secret salah atau toko disuspend
  if (cloudHealth.tenant && !cloudHealth.tenant.valid) {
    const pendingSales = await query<RowDataPacket[]>(`
      SELECT COUNT(*) AS count FROM sales WHERE sync_status = 'pending'
    `);
    const totalPending = pendingSales[0]?.count || 0;
    return {
      syncedCount: 0,
      totalPending: Number(totalPending),
      cloudOnline: true,
      errorDetail: cloudHealth.tenant.errorCode,
      message: `Autentikasi Cloud Gagal: ${cloudHealth.tenant.error || "Secret Key tidak valid"}. Periksa SYNC_SECRET_KEY di .env.`,
    };
  }

  const pendingSales = await query<RowDataPacket[]>(`
    SELECT 
      id, invoice_code AS invoiceCode, total_amount AS totalAmount,
      paid_amount AS paidAmount, change_amount AS changeAmount,
      payment_method AS paymentMethod, cashier_name AS cashierName,
      sync_status AS syncStatus,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS timestamp
    FROM sales
    WHERE sync_status = 'pending'
    ORDER BY created_at ASC
    LIMIT 50
  `);

  if (pendingSales.length === 0) {
    return {
      syncedCount: 0,
      totalPending: 0,
      cloudOnline: true,
      quotaRemaining: cloudHealth.tenant?.quotaRemaining,
      plan: cloudHealth.tenant?.plan,
      message: "Semua transaksi sudah tersinkron ke cloud.",
    };
  }

  const placeholders = pendingSales.map(() => "?").join(",");
  const itemRows = await query<RowDataPacket[]>(`
    SELECT 
      sale_id AS saleId, product_id AS productId,
      snapshot_product_name AS productName, snapshot_unit_name AS unitName,
      conversion_ratio AS conversionRatio, price, quantity AS qty, subtotal
    FROM sale_items
    WHERE sale_id IN (${placeholders})
  `, pendingSales.map((s) => s.id));

  let syncedCount = 0;
  let lastQuotaRemaining = cloudHealth.tenant?.quotaRemaining;
  let stopReason: string | null = null;

  for (const s of pendingSales) {
    const items = itemRows
      .filter((it) => it.saleId === s.id)
      .map((it) => ({
        productId: it.productId,
        productName: it.productName,
        unitName: it.unitName,
        conversionRatio: Number(it.conversionRatio),
        price: Number(it.price),
        qty: Number(it.qty),
        subtotal: Number(it.subtotal),
      }));

    const saleObj: Sale = {
      id: s.id,
      invoiceCode: s.invoiceCode,
      totalAmount: Number(s.totalAmount),
      paidAmount: Number(s.paidAmount),
      changeAmount: Number(s.changeAmount),
      paymentMethod: s.paymentMethod,
      cashierName: s.cashierName,
      syncStatus: s.syncStatus,
      timestamp: s.timestamp,
      items,
    };

    const pushResult = await pushSaleToPublicInvoice(saleObj);
    if (pushResult.success) {
      syncedCount++;
      if (typeof pushResult.quotaRemaining === "number") {
        lastQuotaRemaining = pushResult.quotaRemaining;
      }
    } else {
      if (pushResult.errorCode === "QUOTA_EXCEEDED") {
        stopReason = "Kuota invoice paket Free telah habis. Upgrade ke paket Pro untuk invoice tanpa batas.";
        break;
      } else if (pushResult.errorCode === "INVALID_SECRET" || pushResult.errorCode === "SUSPENDED") {
        stopReason = pushResult.error || "Akses cloud ditolak.";
        break;
      }
    }
  }

  const finalMsg = stopReason
    ? `${syncedCount} dari ${pendingSales.length} transaksi disinkronkan. Berhenti: ${stopReason}`
    : `${syncedCount} dari ${pendingSales.length} transaksi berhasil disinkronkan ke cloud.`;

  return {
    syncedCount,
    totalPending: pendingSales.length,
    cloudOnline: true,
    quotaRemaining: lastQuotaRemaining,
    plan: cloudHealth.tenant?.plan,
    errorDetail: stopReason || undefined,
    message: finalMsg,
  };
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
      const cleanBarcode = unit.barcode?.trim() || null;

      if (cleanBarcode) {
        // Bebaskan barcode jika sebelumnya menempel pada produk lain yang sudah dihapus/dinonaktifkan (is_active = FALSE)
        const [inactiveRows] = await connection.execute<RowDataPacket[]>(`
          SELECT pu.id, pu.product_id,
                 (SELECT COUNT(*) FROM sale_items si WHERE si.product_id = p.id) AS sales_count
          FROM product_units pu
          JOIN products p ON pu.product_id = p.id
          WHERE pu.barcode = ? AND p.is_active = FALSE AND p.id != ?
        `, [cleanBarcode, product.id]);

        if (inactiveRows && inactiveRows.length > 0) {
          for (const row of inactiveRows) {
            if (Number(row.sales_count) === 0) {
              await connection.execute(`DELETE FROM stock_movements WHERE product_id = ?`, [row.product_id]);
              await connection.execute(`DELETE FROM product_prices WHERE product_id = ?`, [row.product_id]);
              await connection.execute(`DELETE FROM product_units WHERE product_id = ?`, [row.product_id]);
              await connection.execute(`DELETE FROM products WHERE id = ?`, [row.product_id]);
            } else {
              await connection.execute(`UPDATE product_units SET barcode = NULL WHERE id = ?`, [row.id]);
            }
          }
        }
      }

      const unitId = unit.id || `unit-${product.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await connection.execute(`
        INSERT INTO product_units (
          id, product_id, unit_name, conversion_ratio, price, cost_price, barcode, is_base_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        unitId,
        product.id,
        unit.unitName,
        unit.conversionRatio,
        unit.price,
        unit.costPrice || null,
        cleanBarcode,
        unit.isBaseUnit ? 1 : 0,
      ]);

      if (unit.priceTiers && unit.priceTiers.length > 0) {
        for (const tier of unit.priceTiers) {
          const tierId = tier.id || `tier-${unitId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await connection.execute(`
            INSERT INTO product_prices (id, product_id, unit_id, tier_name, min_qty, price, customer_group)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            tierId,
            product.id,
            unitId,
            tier.tierName.trim(),
            Number(tier.minQty) || 1,
            Number(tier.price) || 0,
            tier.customerGroup || null,
          ]);
        }
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
 * Menghapus produk dari database:
 * - Jika produk BELUM pernah memiliki transaksi penjualan (sale_items = 0), dilakukan Hard Delete total:
 *   membersihkan riwayat mutasi stok awal, tier harga, satuan kemasan, dan produk secara tuntas.
 * - Jika produk SUDAH memiliki transaksi penjualan (sale_items > 0), dilakukan Soft Delete (is_active = FALSE)
 *   dan melepaskan barcode-nya (SET barcode = NULL) agar barcode tidak memicu ER_DUP_ENTRY jika didaftarkan kembali.
 */
export async function deleteProductInDb(productId: string): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Cek apakah produk pernah terlibat dalam transaksi penjualan
    const [saleRows] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM sale_items WHERE product_id = ?`,
      [productId]
    );
    const salesCount = Number(saleRows[0]?.count || 0);

    if (salesCount === 0) {
      // Tidak ada riwayat penjualan: Hapus mutasi stok (misal stok awal), tier harga, satuan, dan produk
      await connection.execute(`DELETE FROM stock_movements WHERE product_id = ?`, [productId]);
      await connection.execute(`DELETE FROM product_prices WHERE product_id = ?`, [productId]);
      await connection.execute(`DELETE FROM product_units WHERE product_id = ?`, [productId]);
      await connection.execute(`DELETE FROM products WHERE id = ?`, [productId]);
    } else {
      // Ada riwayat penjualan: Soft delete produk & lepaskan barcode agar barcode bisa digunakan kembali
      await connection.execute(`UPDATE products SET is_active = FALSE WHERE id = ?`, [productId]);
      await connection.execute(`UPDATE product_units SET barcode = NULL WHERE product_id = ?`, [productId]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

