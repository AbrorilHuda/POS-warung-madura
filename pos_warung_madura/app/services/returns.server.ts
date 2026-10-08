import type { RowDataPacket } from "mysql2";
import { pool, query, ensureDatabaseSchema } from "../db.server";
import { verifyOwnerPin, createAuditLog } from "./shift.server";

export interface ReturnItemRequest {
  saleItemId: string;
  productId: string;
  quantity: number;
  refundPrice: number;
  isRestockable: boolean;
  conditionNotes?: string;
}

export interface SaleDetailWithItems {
  id: string;
  invoiceCode: string;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  customerName: string;
  cashierName: string;
  createdAt: string;
  isVoid: boolean;
  voidReason: string | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    unitName: string;
    quantity: number;
    price: number;
    subtotal: number;
    returnedQuantity: number;
  }>;
}

/**
 * Mengambil detail penjualan beserta item & riwayat retur sebelumnya untuk kalkulasi retur
 */
export async function getSaleDetailForReturn(
  invoiceCodeOrId: string
): Promise<SaleDetailWithItems | null> {
  await ensureDatabaseSchema();

  const saleRows = await query<RowDataPacket[]>(
    `SELECT * FROM sales WHERE invoice_code = ? OR id = ? LIMIT 1`,
    [invoiceCodeOrId.trim(), invoiceCodeOrId.trim()]
  );

  if (saleRows.length === 0) return null;
  const s = saleRows[0];

  const itemRows = await query<RowDataPacket[]>(
    `SELECT 
      si.*,
      COALESCE(SUM(sri.quantity), 0) AS total_returned_qty
    FROM sale_items si
    LEFT JOIN sale_return_items sri ON si.id = sri.sale_item_id
    WHERE si.sale_id = ?
    GROUP BY si.id`,
    [s.id]
  );

  return {
    id: String(s.id),
    invoiceCode: String(s.invoice_code),
    totalAmount: Number(s.total_amount),
    paidAmount: Number(s.paid_amount),
    paymentMethod: String(s.payment_method || "Tunai"),
    customerName: String(s.customer_name || "Pelanggan Umum"),
    cashierName: String(s.cashier_name || "Kasir"),
    createdAt: s.created_at instanceof Date ? s.created_at.toLocaleString("id-ID") : String(s.created_at),
    isVoid: Boolean(s.is_void),
    voidReason: s.void_reason ? String(s.void_reason) : null,
    items: itemRows.map((it) => ({
      id: String(it.id),
      productId: String(it.product_id),
      productName: String(it.snapshot_product_name),
      unitName: String(it.snapshot_unit_name),
      quantity: Number(it.quantity),
      price: Number(it.price),
      subtotal: Number(it.subtotal),
      returnedQuantity: Number(it.total_returned_qty || 0),
    })),
  };
}

/**
 * Void Transaksi Penjualan Penuh (PRD F6.1)
 * Membatalkan transaksi, mengembalikan seluruh stok barang, membatalkan piutang (jika kasbon),
 * serta membutuhkan persetujuan PIN Pemilik.
 */
export async function voidSale(
  saleId: string,
  voidReason: string,
  ownerPin: string,
  approvedBy: string = "Pemilik"
): Promise<{ ok: boolean; invoiceCode: string }> {
  await ensureDatabaseSchema();

  // 1. Verifikasi PIN Pemilik
  const isAuthorized = await verifyOwnerPin(ownerPin);
  if (!isAuthorized) {
    throw new Error("Otorisasi ditolak: PIN Pemilik tidak valid.");
  }

  if (!voidReason.trim()) {
    throw new Error("Alasan void transaksi wajib diisi.");
  }

  // 2. Ambil data penjualan
  const saleRows = await query<RowDataPacket[]>(
    "SELECT * FROM sales WHERE id = ? LIMIT 1",
    [saleId]
  );
  if (saleRows.length === 0) {
    throw new Error("Transaksi tidak ditemukan.");
  }
  const sale = saleRows[0];
  if (sale.is_void) {
    throw new Error(`Transaksi nota ${sale.invoice_code} sudah dibatalkan sebelumnya.`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 3. Kembalikan stok untuk semua item
    const [items] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM sale_items WHERE sale_id = ?",
      [saleId]
    );

    for (const item of items) {
      const movementId = `sm-void-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const baseQty = Number(item.quantity) * Number(item.conversion_ratio || 1);

      await conn.query(
        `INSERT INTO stock_movements 
          (id, product_id, type, quantity_in_base_unit, unit_name_used, unit_qty_used, reference_type, reference_id, notes)
         VALUES (?, ?, 'in', ?, ?, ?, 'void_sale', ?, ?)`,
        [
          movementId,
          item.product_id,
          baseQty,
          item.snapshot_unit_name,
          item.quantity,
          sale.invoice_code,
          `Pengembalian stok pembatalan nota ${sale.invoice_code}: ${voidReason}`,
        ]
      );
    }

    // 4. Jika transaksi kasbon, batalkan piutang (receivables)
    await conn.query(
      "UPDATE receivables SET status = 'void', notes = CONCAT(COALESCE(notes, ''), ' [Dibatalkan via Void Nota]') WHERE sale_id = ?",
      [saleId]
    );

    // 5. Update status penjualan menjadi void
    await conn.query(
      `UPDATE sales SET 
        is_void = TRUE, 
        void_reason = ?, 
        voided_at = CURRENT_TIMESTAMP, 
        voided_by = ? 
       WHERE id = ?`,
      [voidReason.trim(), approvedBy, saleId]
    );

    await conn.commit();

    // 6. Catat ke Audit Log
    await createAuditLog(
      "VOID_SALE",
      "sale",
      saleId,
      `Void Nota ${sale.invoice_code} senilai Rp ${Number(sale.total_amount).toLocaleString("id-ID")}. Alasan: ${voidReason}`,
      approvedBy
    );

    return { ok: true, invoiceCode: String(sale.invoice_code) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Retur Sebagian Item Barang (PRD F6.2)
 * Kasir/pemilik memilih item dan jumlah yang dikembalikan, menentukan kondisi barang
 * (layak jual = restock, rusak = tidak restock), serta metode pengembalian uang.
 */
export async function returnSaleItems(
  saleId: string,
  itemsToReturn: ReturnItemRequest[],
  refundMethod: "Tunai" | "Kasbon_Dipotong" | "Kredit_Toko",
  reason: string,
  ownerPin: string,
  approvedBy: string = "Pemilik"
): Promise<{ ok: boolean; returnCode: string; totalRefund: number }> {
  await ensureDatabaseSchema();

  const isAuthorized = await verifyOwnerPin(ownerPin);
  if (!isAuthorized) {
    throw new Error("Otorisasi ditolak: PIN Pemilik tidak valid untuk persetujuan retur.");
  }

  if (itemsToReturn.length === 0) {
    throw new Error("Pilih setidaknya satu item barang yang akan diretur.");
  }
  if (!reason.trim()) {
    throw new Error("Alasan retur barang wajib diisi.");
  }

  const saleDetail = await getSaleDetailForReturn(saleId);
  if (!saleDetail) {
    throw new Error("Transaksi penjualan tidak ditemukan.");
  }
  if (saleDetail.isVoid) {
    throw new Error("Transaksi sudah berstatus VOID, tidak dapat dilakukan retur parsial.");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let totalRefund = 0;
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randSuffix = Math.floor(100 + Math.random() * 900);
    const returnCode = `RET-${dateCode}-${randSuffix}`;
    const returnId = `ret-${Date.now()}`;

    // Validasi kuantiti item tidak boleh melebihi sisa yang dibeli
    for (const ret of itemsToReturn) {
      const original = saleDetail.items.find((it) => it.id === ret.saleItemId);
      if (!original) {
        throw new Error(`Item transaksi ${ret.saleItemId} tidak ditemukan.`);
      }

      const availableToReturn = original.quantity - original.returnedQuantity;
      if (ret.quantity > availableToReturn) {
        throw new Error(
          `Jumlah retur untuk ${original.productName} (${ret.quantity}) melebihi sisa yang dibeli (${availableToReturn}).`
        );
      }

      const subRefund = ret.refundPrice * ret.quantity;
      totalRefund += subRefund;
    }

    // 1. Simpan header sale_returns
    await conn.query(
      `INSERT INTO sale_returns 
        (id, return_code, sale_id, invoice_code, total_refund_amount, refund_method, reason, approved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        returnId,
        returnCode,
        saleId,
        saleDetail.invoiceCode,
        totalRefund,
        refundMethod,
        reason.trim(),
        approvedBy,
      ]
    );

    // 2. Simpan setiap item retur dan update stok jika layak jual
    for (const ret of itemsToReturn) {
      const retItemId = `sri-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await conn.query(
        `INSERT INTO sale_return_items
          (id, sale_return_id, sale_item_id, product_id, quantity, refund_price, is_restockable, condition_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          retItemId,
          returnId,
          ret.saleItemId,
          ret.productId,
          ret.quantity,
          ret.refundPrice,
          ret.isRestockable,
          ret.conditionNotes || null,
        ]
      );

      // Jika layak jual, kembalikan ke stok
      if (ret.isRestockable) {
        const movementId = `sm-ret-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await conn.query(
          `INSERT INTO stock_movements 
            (id, product_id, type, quantity_in_base_unit, unit_name_used, unit_qty_used, reference_type, reference_id, notes)
           VALUES (?, ?, 'in', ?, 'pcs', ?, 'sale_return', ?, ?)`,
          [
            movementId,
            ret.productId,
            ret.quantity,
            ret.quantity,
            returnCode,
            `Retur barang nota ${saleDetail.invoiceCode} (${ret.conditionNotes || "Layak Jual"})`,
          ]
        );
      }
    }

    // 3. Jika refund method adalah Kasbon_Dipotong, kurangi sisa piutang. Jika Tunai, catat kas keluar laci di shift aktif.
    if (refundMethod === "Kasbon_Dipotong") {
      await conn.query(
        `UPDATE receivables SET 
          paid_amount = LEAST(amount, paid_amount + ?),
          status = CASE WHEN paid_amount + ? >= amount THEN 'paid' ELSE 'partial' END
         WHERE sale_id = ?`,
        [totalRefund, totalRefund, saleId]
      );
    } else if (refundMethod === "Tunai") {
      const [openShifts] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM cashier_shifts WHERE status = 'open' LIMIT 1"
      );
      if (openShifts.length > 0) {
        const activeShiftId = openShifts[0].id;
        const movementId = `scm-ret-${Date.now()}`;
        await conn.query(
          "INSERT INTO shift_cash_movements (id, shift_id, type, amount, reason, created_by) VALUES (?, ?, 'cash_out', ?, ?, ?)",
          [
            movementId,
            activeShiftId,
            totalRefund,
            `Pengembalian Retur Kas (Nota ${saleDetail.invoiceCode})`,
            approvedBy,
          ]
        );
      }
    }

    await conn.commit();

    // 4. Catat Audit Log
    await createAuditLog(
      "RETURN_SALE",
      "sale_return",
      returnId,
      `Retur barang nota ${saleDetail.invoiceCode} senilai Rp ${totalRefund.toLocaleString("id-ID")} (${refundMethod}). Alasan: ${reason}`,
      approvedBy
    );

    return { ok: true, returnCode, totalRefund };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
