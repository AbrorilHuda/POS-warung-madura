import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool, ensureDatabaseSchema } from "../db.server";
import type { Supplier, PurchaseRecord, PurchaseItemInput } from "../types/pos";

/**
 * Mengambil semua data master supplier beserta akumulasi utang yang belum lunas
 */
export async function getAllSuppliers(): Promise<Supplier[]> {
  await ensureDatabaseSchema();
  const sql = `
    SELECT 
      s.id,
      s.name,
      s.phone,
      s.address,
      s.default_payment_term_days AS defaultPaymentTermDays,
      s.notes,
      s.is_active AS isActive,
      s.created_at AS createdAt,
      s.updated_at AS updatedAt,
      COALESCE(SUM(CASE WHEN p.payment_status IN ('unpaid', 'partial') THEN (p.total_amount - p.paid_amount) ELSE 0 END), 0) AS totalDebt
    FROM suppliers s
    LEFT JOIN purchases p ON s.id = p.supplier_id
    WHERE s.is_active = TRUE
    GROUP BY s.id, s.name, s.phone, s.address, s.default_payment_term_days, s.notes, s.is_active, s.created_at, s.updated_at
    ORDER BY s.name ASC
  `;
  const rows = await pool.query<RowDataPacket[]>(sql);
  return rows[0].map((r) => ({
    id: String(r.id),
    name: String(r.name),
    phone: r.phone ? String(r.phone) : null,
    address: r.address ? String(r.address) : null,
    defaultPaymentTermDays: Number(r.defaultPaymentTermDays || 0),
    notes: r.notes ? String(r.notes) : null,
    isActive: Boolean(r.isActive),
    totalDebt: Number(r.totalDebt || 0),
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
    updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
  }));
}

/**
 * Mengambil supplier berdasarkan ID
 */
export async function getSupplierById(id: string): Promise<Supplier | null> {
  await ensureDatabaseSchema();
  const sql = `
    SELECT 
      s.id, s.name, s.phone, s.address, 
      s.default_payment_term_days AS defaultPaymentTermDays, 
      s.notes, s.is_active AS isActive
    FROM suppliers s 
    WHERE s.id = ? LIMIT 1
  `;
  const [rows] = await pool.query<RowDataPacket[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    name: String(r.name),
    phone: r.phone ? String(r.phone) : null,
    address: r.address ? String(r.address) : null,
    defaultPaymentTermDays: Number(r.defaultPaymentTermDays || 0),
    notes: r.notes ? String(r.notes) : null,
    isActive: Boolean(r.isActive),
  };
}

/**
 * Membuat supplier baru (PRD F8.1)
 */
export async function createSupplier(data: {
  name: string;
  phone?: string | null;
  address?: string | null;
  defaultPaymentTermDays?: number;
  notes?: string | null;
}): Promise<Supplier> {
  await ensureDatabaseSchema();
  const id = `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const termDays = data.defaultPaymentTermDays !== undefined ? Number(data.defaultPaymentTermDays) : 0;

  await pool.query(
    `INSERT INTO suppliers (id, name, phone, address, default_payment_term_days, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
    [id, data.name.trim(), data.phone?.trim() || null, data.address?.trim() || null, termDays, data.notes?.trim() || null]
  );

  return {
    id,
    name: data.name.trim(),
    phone: data.phone?.trim() || null,
    address: data.address?.trim() || null,
    defaultPaymentTermDays: termDays,
    notes: data.notes?.trim() || null,
    isActive: true,
    totalDebt: 0,
  };
}

/**
 * Memperbarui supplier (PRD F8.1)
 */
export async function updateSupplier(
  id: string,
  data: {
    name?: string;
    phone?: string | null;
    address?: string | null;
    defaultPaymentTermDays?: number;
    notes?: string | null;
  }
): Promise<void> {
  await ensureDatabaseSchema();
  const fields: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    params.push(data.name.trim());
  }
  if (data.phone !== undefined) {
    fields.push("phone = ?");
    params.push(data.phone ? data.phone.trim() : null);
  }
  if (data.address !== undefined) {
    fields.push("address = ?");
    params.push(data.address ? data.address.trim() : null);
  }
  if (data.defaultPaymentTermDays !== undefined) {
    fields.push("default_payment_term_days = ?");
    params.push(Number(data.defaultPaymentTermDays) || 0);
  }
  if (data.notes !== undefined) {
    fields.push("notes = ?");
    params.push(data.notes ? data.notes.trim() : null);
  }

  if (fields.length === 0) return;
  params.push(id);
  await pool.query(`UPDATE suppliers SET ${fields.join(", ")} WHERE id = ?`, params);
}

/**
 * Menghapus supplier secara halus (Soft Delete)
 */
export async function deleteSupplier(id: string): Promise<void> {
  await ensureDatabaseSchema();
  await pool.query("UPDATE suppliers SET is_active = FALSE WHERE id = ?", [id]);
}

/**
 * Mencatat Faktur Nota Kulakan Pembelian Multi-Item & Update Stok / HPP Moving Average (PRD F8.2 & F8.3)
 */
export async function createPurchaseTransaction(
  purchase: Omit<PurchaseRecord, "id" | "createdAt"> & { id?: string }
): Promise<string> {
  await ensureDatabaseSchema();
  const purchaseId = purchase.id || `pch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Simpan Header Faktur Kulakan
    const invoiceNumber = purchase.invoiceNumber.trim();
    const purchaseDate = purchase.purchaseDate || new Date().toISOString().slice(0, 19).replace("T", " ");
    const subtotal = Number(purchase.subtotal || 0);
    const discount = Number(purchase.discount || 0);
    const shippingCost = Number(purchase.shippingCost || 0);
    const totalAmount = Number(purchase.totalAmount || subtotal - discount + shippingCost);
    const paidAmount = Number(purchase.paidAmount || 0);
    const paymentMethod = purchase.paymentMethod || "Tunai";
    const paymentStatus = purchase.paymentStatus || (paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "unpaid");
    const dueDate = purchase.dueDate || null;
    const notes = purchase.notes ? purchase.notes.trim() : null;
    const createdBy = purchase.createdBy || "Kasir";

    await connection.execute(
      `INSERT INTO purchases (
        id, invoice_number, supplier_id, supplier_name, purchase_date,
        subtotal, discount, shipping_cost, total_amount, paid_amount,
        payment_method, payment_status, due_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        purchaseId,
        invoiceNumber,
        purchase.supplierId,
        purchase.supplierName,
        purchaseDate,
        subtotal,
        discount,
        shippingCost,
        totalAmount,
        paidAmount,
        paymentMethod,
        paymentStatus,
        dueDate,
        notes,
        createdBy,
      ]
    );

    // 2. Loop Setiap Item Kulakan: Simpan item, update stok, buat batch FEFO, dan hitung Moving Average HPP
    for (const item of purchase.items) {
      const itemId = `pchi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const qty = Number(item.quantity || 1);
      const ratio = Number(item.conversionRatio || 1);
      const qtyInBaseUnit = qty * ratio;
      const costPrice = Number(item.costPrice || 0);
      const itemSubtotal = Number(item.subtotal || qty * costPrice);
      const costPerBaseUnit = ratio > 0 ? costPrice / ratio : costPrice;

      const cleanBatchNo = item.batchNo && item.batchNo.trim()
        ? item.batchNo.trim()
        : `B-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      // 2a. Insert purchase_items
      await connection.execute(
        `INSERT INTO purchase_items (
          id, purchase_id, product_id, product_name, unit_id, unit_name,
          quantity, conversion_ratio, cost_price, subtotal, batch_no, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          purchaseId,
          item.productId,
          item.productName,
          item.unitId,
          item.unitName,
          qty,
          ratio,
          costPrice,
          itemSubtotal,
          cleanBatchNo,
          item.expiryDate || null,
        ]
      );

      // 2b. Insert stock_batches (FEFO Batch)
      const batchId = `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await connection.execute(
        `INSERT INTO stock_batches (
          id, product_id, batch_no, qty_base, initial_qty_base, cost_price, expiry_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          item.productId,
          cleanBatchNo,
          qtyInBaseUnit,
          qtyInBaseUnit,
          costPerBaseUnit,
          item.expiryDate || null,
          `Kulakan Nota ${invoiceNumber} dari ${purchase.supplierName}`,
        ]
      );

      // 2c. Insert stock_movements (Ledger Mutasi Masuk)
      const movementId = `mov-pch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await connection.execute(
        `INSERT INTO stock_movements (
          id, product_id, type, quantity_in_base_unit, unit_name_used,
          unit_qty_used, cost_per_unit, reference_type, reference_id, batch_id, notes
        ) VALUES (?, ?, 'in', ?, ?, ?, ?, 'purchase', ?, ?, ?)`,
        [
          movementId,
          item.productId,
          qtyInBaseUnit,
          item.unitName,
          qty,
          costPrice,
          purchaseId,
          batchId,
          `Kulakan Nota ${invoiceNumber} (${purchase.supplierName})`,
        ]
      );

      // 2d. Perhitungan HPP Rata-Rata Bergerak (Moving Average HPP - PRD F8.3)
      // Rumus: C_new = (S_old * C_old + S_in * C_in) / (S_old + S_in)
      try {
        // Ambil stok produk sebelum mutasi ini (total stok saat ini dikurangi qtyInBaseUnit yang baru masuk)
        const [stockRows] = await connection.query<RowDataPacket[]>(
          `SELECT COALESCE(SUM(quantity_in_base_unit), 0) AS total_stock
           FROM stock_movements
           WHERE product_id = ? AND id != ?`,
          [item.productId, movementId]
        );
        const currentStockBase = Number(stockRows[0]?.total_stock || 0);

        // Ambil HPP satuan dasar saat ini
        const [baseUnitRows] = await connection.query<RowDataPacket[]>(
          `SELECT cost_price FROM product_units WHERE product_id = ? AND is_base_unit = TRUE LIMIT 1`,
          [item.productId]
        );
        const currentBaseCost = Number(baseUnitRows[0]?.cost_price || 0);

        let newBaseCost = costPerBaseUnit;
        if (currentStockBase > 0 && currentBaseCost > 0) {
          const combinedStock = currentStockBase + qtyInBaseUnit;
          if (combinedStock > 0) {
            newBaseCost = (currentStockBase * currentBaseCost + qtyInBaseUnit * costPerBaseUnit) / combinedStock;
          }
        }

        // Bulatkan HPP ke 2 desimal
        newBaseCost = Math.round(newBaseCost * 100) / 100;

        // Update cost_price untuk seluruh satuan dari produk ini secara proporsional sesuai rasio konversi
        await connection.execute(
          `UPDATE product_units 
           SET cost_price = ROUND(? * conversion_ratio, 2)
           WHERE product_id = ?`,
          [newBaseCost, item.productId]
        );
      } catch (errCost) {
        console.warn("[HPP Moving Average Warning]:", errCost);
      }
    }

    // 3. Catat di Audit Log
    const auditDetails = `Pencatatan nota kulakan ${invoiceNumber} dari supplier ${purchase.supplierName} senilai Rp ${totalAmount.toLocaleString("id-ID")} (${purchase.items.length} macam barang, status: ${paymentStatus})`;
    await connection.execute(
      `INSERT INTO audit_logs (id, user_name, action, target_type, target_id, details)
       VALUES (?, ?, 'PURCHASE_RECORDED', 'purchase', ?, ?)`,
      [`aud-${Date.now()}`, createdBy, purchaseId, auditDetails]
    );

    await connection.commit();
    return purchaseId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Mengambil riwayat nota kulakan yang tersimpan
 */
export async function getPurchases(limit: number = 50): Promise<PurchaseRecord[]> {
  await ensureDatabaseSchema();
  const sql = `
    SELECT 
      p.id,
      p.invoice_number AS invoiceNumber,
      p.supplier_id AS supplierId,
      p.supplier_name AS supplierName,
      p.purchase_date AS purchaseDate,
      p.subtotal,
      p.discount,
      p.shipping_cost AS shippingCost,
      p.total_amount AS totalAmount,
      p.paid_amount AS paidAmount,
      (p.total_amount - p.paid_amount) AS remainingDebt,
      p.payment_method AS paymentMethod,
      p.payment_status AS paymentStatus,
      p.due_date AS dueDate,
      p.notes,
      p.created_by AS createdBy,
      p.created_at AS createdAt
    FROM purchases p
    ORDER BY p.purchase_date DESC, p.created_at DESC
    LIMIT ?
  `;
  const [rows] = await pool.query<RowDataPacket[]>(sql, [limit]);

  const purchaseIds = rows.map((r) => r.id);
  const itemsMap = new Map<string, PurchaseItemInput[]>();

  if (purchaseIds.length > 0) {
    const placeholders = purchaseIds.map(() => "?").join(",");
    const [itemRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        purchase_id AS purchaseId, product_id AS productId, product_name AS productName,
        unit_id AS unitId, unit_name AS unitName, quantity, conversion_ratio AS conversionRatio,
        cost_price AS costPrice, subtotal, batch_no AS batchNo, expiry_date AS expiryDate
       FROM purchase_items 
       WHERE purchase_id IN (${placeholders})`,
      purchaseIds
    );

    for (const ir of itemRows) {
      const pid = String(ir.purchaseId);
      if (!itemsMap.has(pid)) itemsMap.set(pid, []);
      itemsMap.get(pid)!.push({
        productId: String(ir.productId),
        productName: String(ir.productName),
        unitId: String(ir.unitId),
        unitName: String(ir.unitName),
        quantity: Number(ir.quantity || 1),
        conversionRatio: Number(ir.conversionRatio || 1),
        costPrice: Number(ir.costPrice || 0),
        subtotal: Number(ir.subtotal || 0),
        batchNo: ir.batchNo ? String(ir.batchNo) : undefined,
        expiryDate: ir.expiryDate ? String(ir.expiryDate).slice(0, 10) : null,
      });
    }
  }

  return rows.map((r) => ({
    id: String(r.id),
    invoiceNumber: String(r.invoiceNumber),
    supplierId: String(r.supplierId),
    supplierName: String(r.supplierName),
    purchaseDate: r.purchaseDate instanceof Date ? r.purchaseDate.toLocaleString("id-ID") : String(r.purchaseDate),
    subtotal: Number(r.subtotal || 0),
    discount: Number(r.discount || 0),
    shippingCost: Number(r.shippingCost || 0),
    totalAmount: Number(r.totalAmount || 0),
    paidAmount: Number(r.paidAmount || 0),
    remainingDebt: Math.max(0, Number(r.remainingDebt || 0)),
    paymentMethod: r.paymentMethod as any,
    paymentStatus: r.paymentStatus as any,
    dueDate: r.dueDate ? String(r.dueDate).slice(0, 10) : null,
    notes: r.notes ? String(r.notes) : null,
    createdBy: r.createdBy ? String(r.createdBy) : "Kasir",
    items: itemsMap.get(String(r.id)) || [],
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  }));
}
