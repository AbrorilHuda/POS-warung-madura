import crypto from "crypto";
import { pool, query, ensureDatabaseSchema } from "../db.server";
import type { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import type {
  Customer,
  CustomerSummary,
  ReceivableItem,
  ReceivablePayment,
  CustomerLedgerEntry,
} from "../types/pos";

/**
 * Mengambil daftar pelanggan beserta ringkasan saldo utang riil (PRD F1.1 & F1.4)
 */
export async function getCustomersSummary(search?: string, activeOnly = true): Promise<CustomerSummary[]> {
  await ensureDatabaseSchema();
  let sql = `
    SELECT 
      customer_id AS id,
      name,
      phone,
      address,
      credit_limit AS creditLimit,
      is_active AS isActive,
      total_debt AS totalDebt,
      unpaid_invoices_count AS unpaidInvoicesCount,
      earliest_due_date AS earliestDueDate,
      last_receivable_at AS lastReceivableAt
    FROM v_customer_receivables_summary
    WHERE 1=1
  `;
  const params: any[] = [];

  if (activeOnly) {
    sql += ` AND is_active = TRUE`;
  }

  if (search && search.trim()) {
    sql += ` AND (name LIKE ? OR phone LIKE ?)`;
    const pattern = `%${search.trim()}%`;
    params.push(pattern, pattern);
  }

  sql += ` ORDER BY total_debt DESC, name ASC`;

  const rows = await query<RowDataPacket[]>(sql, params);

  return rows.map((r) => {
    const creditLimit = Number(r.creditLimit || 0);
    const totalDebt = Number(r.totalDebt || 0);
    const isOverLimit = creditLimit > 0 && totalDebt > creditLimit;

    return {
      id: r.id,
      name: r.name,
      phone: r.phone || undefined,
      address: r.address || undefined,
      creditLimit,
      isActive: Boolean(r.isActive),
      totalDebt,
      unpaidInvoicesCount: Number(r.unpaidInvoicesCount || 0),
      earliestDueDate: r.earliestDueDate ? String(r.earliestDueDate).slice(0, 10) : null,
      lastReceivableAt: r.lastReceivableAt ? String(r.lastReceivableAt) : null,
      createdAt: "",
      isOverLimit,
    };
  });
}

/**
 * Mengambil detail satu pelanggan berdasarkan ID
 */
export async function getCustomerById(id: string): Promise<CustomerSummary | null> {
  await ensureDatabaseSchema();
  const rows = await query<RowDataPacket[]>(`
    SELECT 
      customer_id AS id,
      name,
      phone,
      address,
      credit_limit AS creditLimit,
      is_active AS isActive,
      total_debt AS totalDebt,
      unpaid_invoices_count AS unpaidInvoicesCount,
      earliest_due_date AS earliestDueDate,
      last_receivable_at AS lastReceivableAt
    FROM v_customer_receivables_summary
    WHERE customer_id = ?
    LIMIT 1
  `, [id]);

  if (rows.length === 0) return null;
  const r = rows[0];
  const creditLimit = Number(r.creditLimit || 0);
  const totalDebt = Number(r.totalDebt || 0);

  return {
    id: r.id,
    name: r.name,
    phone: r.phone || undefined,
    address: r.address || undefined,
    creditLimit,
    isActive: Boolean(r.isActive),
    totalDebt,
    unpaidInvoicesCount: Number(r.unpaidInvoicesCount || 0),
    earliestDueDate: r.earliestDueDate ? String(r.earliestDueDate).slice(0, 10) : null,
    lastReceivableAt: r.lastReceivableAt ? String(r.lastReceivableAt) : null,
    createdAt: "",
    isOverLimit: creditLimit > 0 && totalDebt > creditLimit,
  };
}

/**
 * Membuat data master pelanggan baru (PRD F1.1)
 */
export async function createCustomer(input: {
  name: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
  notes?: string;
}): Promise<Customer> {
  await ensureDatabaseSchema();
  const id = crypto.randomUUID();
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;
  const address = input.address?.trim() || null;
  const creditLimit = Math.max(0, Number(input.creditLimit) || 0);
  const notes = input.notes?.trim() || null;

  if (!name) {
    throw new Error("Nama pelanggan wajib diisi");
  }

  await query(`
    INSERT INTO customers (id, name, phone, address, credit_limit, notes, is_active)
    VALUES (?, ?, ?, ?, ?, ?, TRUE)
  `, [id, name, phone, address, creditLimit, notes]);

  return {
    id,
    name,
    phone: phone || undefined,
    address: address || undefined,
    creditLimit,
    isActive: true,
    notes: notes || undefined,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Memperbarui data pelanggan
 */
export async function updateCustomer(
  id: string,
  input: {
    name?: string;
    phone?: string;
    address?: string;
    creditLimit?: number;
    isActive?: boolean;
    notes?: string;
  }
): Promise<void> {
  await ensureDatabaseSchema();
  const updates: string[] = [];
  const params: any[] = [];

  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Error("Nama pelanggan tidak boleh kosong");
    updates.push("name = ?");
    params.push(input.name.trim());
  }
  if (input.phone !== undefined) {
    updates.push("phone = ?");
    params.push(input.phone.trim() || null);
  }
  if (input.address !== undefined) {
    updates.push("address = ?");
    params.push(input.address.trim() || null);
  }
  if (input.creditLimit !== undefined) {
    updates.push("credit_limit = ?");
    params.push(Math.max(0, Number(input.creditLimit) || 0));
  }
  if (input.isActive !== undefined) {
    updates.push("is_active = ?");
    params.push(Boolean(input.isActive));
  }
  if (input.notes !== undefined) {
    updates.push("notes = ?");
    params.push(input.notes.trim() || null);
  }

  if (updates.length === 0) return;

  params.push(id);
  await query(`UPDATE customers SET ${updates.join(", ")} WHERE id = ?`, params);
}

/**
 * Menghapus atau menonaktifkan pelanggan
 * Aturan PRD F1: Pelanggan yang masih memiliki saldo utang TIDAK BISA DIHAPUS,
 * melainkan dinonaktifkan secara otomatis.
 */
export async function deleteOrDeactivateCustomer(id: string): Promise<{ action: "deleted" | "deactivated"; message: string }> {
  await ensureDatabaseSchema();
  const summary = await getCustomerById(id);
  if (!summary) throw new Error("Pelanggan tidak ditemukan");

  if (summary.totalDebt > 0) {
    await query(`UPDATE customers SET is_active = FALSE WHERE id = ?`, [id]);
    return {
      action: "deactivated",
      message: `Pelanggan memiliki sisa utang Rp ${summary.totalDebt.toLocaleString("id-ID")}. Data telah dinonaktifkan (bukan dihapus).`,
    };
  }

  try {
    await query(`DELETE FROM customers WHERE id = ?`, [id]);
    return { action: "deleted", message: "Data pelanggan berhasil dihapus." };
  } catch {
    await query(`UPDATE customers SET is_active = FALSE WHERE id = ?`, [id]);
    return { action: "deactivated", message: "Pelanggan memiliki riwayat lama, dinonaktifkan." };
  }
}

/**
 * Mengambil daftar nota piutang milik seorang pelanggan (PRD F1.6 & F1.8)
 */
export async function getCustomerReceivables(customerId: string): Promise<ReceivableItem[]> {
  await ensureDatabaseSchema();
  const rows = await query<RowDataPacket[]>(`
    SELECT 
      id,
      customer_id AS customerId,
      sale_id AS saleId,
      invoice_code AS invoiceCode,
      amount,
      paid_amount AS paidAmount,
      (amount - paid_amount) AS remainingAmount,
      due_date AS dueDate,
      status,
      notes,
      created_at AS createdAt
    FROM receivables
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `, [customerId]);

  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    saleId: r.saleId || null,
    invoiceCode: r.invoiceCode || null,
    amount: Number(r.amount),
    paidAmount: Number(r.paidAmount),
    remainingAmount: Number(r.remainingAmount),
    dueDate: r.dueDate ? String(r.dueDate).slice(0, 10) : null,
    status: r.status,
    notes: r.notes || undefined,
    createdAt: String(r.createdAt),
  }));
}

/**
 * Mengambil buku besar (ledger) riwayat kasbon & pelunasan pelanggan lengkap (PRD F1.4 & F1.8)
 */
export async function getCustomerLedgerHistory(customerId: string): Promise<CustomerLedgerEntry[]> {
  await ensureDatabaseSchema();
  // 1. Ambil seluruh transaksi kasbon
  const recRows = await query<RowDataPacket[]>(`
    SELECT 
      id,
      created_at AS date,
      'kasbon' AS type,
      amount AS debit,
      0 AS credit,
      invoice_code AS invoiceCode,
      CONCAT('Kasbon Nota ', COALESCE(invoice_code, '-')) AS description,
      NULL AS paymentMethod
    FROM receivables
    WHERE customer_id = ? AND status != 'void'
  `, [customerId]);

  // 2. Ambil seluruh pelunasan kasbon
  const payRows = await query<RowDataPacket[]>(`
    SELECT 
      id,
      paid_at AS date,
      'pelunasan' AS type,
      0 AS debit,
      amount AS credit,
      NULL AS invoiceCode,
      CONCAT('Pelunasan (', payment_method, ') - ', COALESCE(notes, 'Diterima kasir')) AS description,
      payment_method AS paymentMethod
    FROM receivable_payments
    WHERE customer_id = ?
  `, [customerId]);

  // 3. Gabungkan dan urutkan secara kronologis
  const allEntries = [...recRows, ...payRows].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentBalance = 0;
  return allEntries.map((item) => {
    const debit = Number(item.debit || 0);
    const credit = Number(item.credit || 0);
    currentBalance = currentBalance + debit - credit;

    return {
      id: item.id,
      date: String(item.date),
      type: item.type,
      description: item.description,
      debit,
      credit,
      balance: Math.max(0, currentBalance),
      invoiceCode: item.invoiceCode || null,
      paymentMethod: item.paymentMethod || null,
    };
  });
}

/**
 * Pelunasan Piutang Kasbon Menggunakan Algoritma FIFO Otomatis (PRD F1.5)
 * Mendukung pelunasan seluruh utang, sebagian utang, atau penargetan nota spesifik.
 */
export async function payCustomerDebtFIFO(params: {
  customerId: string;
  amount: number;
  paymentMethod: 'Tunai' | 'Transfer' | 'QRIS';
  specificReceivableId?: string;
  notes?: string;
  createdBy?: string;
}): Promise<{
  success: boolean;
  totalPaid: number;
  remainingDebt: number;
  allocatedCount: number;
  message: string;
}> {
  await ensureDatabaseSchema();
  const paymentAmount = Math.round(Number(params.amount));
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Nominal pelunasan harus lebih dari 0");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Ambil daftar piutang terbuka milik pelanggan
    let recSql = `
      SELECT id, amount, paid_amount, (amount - paid_amount) AS remaining_debt, invoice_code
      FROM receivables
      WHERE customer_id = ? AND status IN ('open', 'partial')
    `;
    const recParams: any[] = [params.customerId];

    if (params.specificReceivableId) {
      recSql += ` AND id = ?`;
      recParams.push(params.specificReceivableId);
    } else {
      recSql += ` ORDER BY created_at ASC`; // FIFO (Tertua duluan)
    }

    const [rows] = await connection.query<RowDataPacket[]>(recSql, recParams);
    if (rows.length === 0) {
      throw new Error("Pelanggan tidak memiliki catatan utang aktif untuk dilunasi");
    }

    const totalOpenDebt = rows.reduce((acc, r) => acc + Number(r.remaining_debt), 0);

    // Aturan PRD F1: Pelunasan tidak boleh melebihi sisa utang; kelebihan ditolak!
    if (paymentAmount > totalOpenDebt) {
      throw new Error(
        `Nominal pembayaran (Rp ${paymentAmount.toLocaleString("id-ID")}) melebihi total sisa utang (Rp ${totalOpenDebt.toLocaleString("id-ID")}). Kelebihan pembayaran ditolak.`
      );
    }

    let remainingToPay = paymentAmount;
    let allocatedCount = 0;

    // 2. Alokasikan pembayaran ke tiap nota
    for (const rec of rows) {
      if (remainingToPay <= 0) break;

      const recDebt = Number(rec.remaining_debt);
      const alloc = Math.min(remainingToPay, recDebt);

      const newPaidAmount = Number(rec.paid_amount) + alloc;
      const newStatus = newPaidAmount >= Number(rec.amount) ? "paid" : "partial";

      // Update receivable
      await connection.execute(`
        UPDATE receivables
        SET paid_amount = ?, status = ?, updated_at = NOW()
        WHERE id = ?
      `, [newPaidAmount, newStatus, rec.id]);

      // Ambil active shift id untuk pelunasan kasbon selama shift ini (PRD F5.4)
      const [shiftRows] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM cashier_shifts WHERE status = 'open' ORDER BY start_time DESC LIMIT 1"
      );
      const activeShiftId = shiftRows.length > 0 ? String(shiftRows[0].id) : null;

      // Catat ke buku besar pembayaran (receivable_payments)
      const paymentId = crypto.randomUUID();
      await connection.execute(`
        INSERT INTO receivable_payments (
          id, customer_id, receivable_id, amount, payment_method, notes, created_by, shift_id, paid_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        paymentId,
        params.customerId,
        rec.id,
        alloc,
        params.paymentMethod,
        params.notes || `Pelunasan FIFO nota ${rec.invoice_code || "-"}`,
        params.createdBy || "Kasir",
        activeShiftId,
      ]);

      remainingToPay -= alloc;
      allocatedCount++;
    }

    await connection.commit();

    const newRemainingDebt = totalOpenDebt - paymentAmount;

    return {
      success: true,
      totalPaid: paymentAmount,
      remainingDebt: newRemainingDebt,
      allocatedCount,
      message: `Pelunasan Rp ${paymentAmount.toLocaleString("id-ID")} berhasil dialokasikan ke ${allocatedCount} nota. Sisa utang: Rp ${newRemainingDebt.toLocaleString("id-ID")}.`,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Validasi PIN Pemilik untuk override batas kasbon atau aksi sensitif (PRD F1.7)
 * Terintegrasi penuh dengan pengecekan hash & Emergency Recovery Code dari shift.server
 */
export { verifyOwnerPin } from "./shift.server";

/**
 * Membuat tautan WhatsApp wa.me dengan teks penagihan otomatis yang rapi (PRD F1.9)
 */
export function generateWhatsAppReminderUrl(
  customer: { name: string; phone?: string; totalDebt: number },
  storeName: string,
  receivables?: ReceivableItem[]
): string {
  if (!customer.phone) return "";
  let cleanPhone = customer.phone.replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "62" + cleanPhone.slice(1);
  } else if (!cleanPhone.startsWith("62")) {
    cleanPhone = "62" + cleanPhone;
  }

  let notaDetails = "";
  if (receivables && receivables.length > 0) {
    const openRecs = receivables.filter((r) => r.status === "open" || r.status === "partial");
    if (openRecs.length > 0) {
      notaDetails = "\n\nRincian nota:\n" + openRecs
        .map((r, i) => `${i + 1}. Nota ${r.invoiceCode || "-"}: Rp ${r.remainingAmount.toLocaleString("id-ID")}`)
        .join("\n");
    }
  }

  const message = `Halo Kak ${customer.name},\n\nSalam dari *${storeName}*.\nIni pengingat ramah untuk catatan kasbon saat ini sebesar *Rp ${customer.totalDebt.toLocaleString("id-ID")}*.${notaDetails}\n\nBisa dibayarkan saat mampir ke warung ya kak. Matur suwun banyak! 🙏`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
