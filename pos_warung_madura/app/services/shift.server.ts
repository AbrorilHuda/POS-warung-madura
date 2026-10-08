import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool, query, ensureDatabaseSchema } from "../db.server";

export interface UserSession {
  id: string;
  name: string;
  role: "owner" | "cashier" | "stock_admin";
}

export interface UserDetail {
  id: string;
  name: string;
  role: "owner" | "cashier" | "stock_admin";
  isActive: boolean;
  hasPin: boolean;
  createdAt: string;
}

export interface ShiftSecuritySettings {
  isSetupCompleted: boolean;
  requireCashierPin: boolean;
  hasOwnerPin: boolean;
  ownerName: string;
  ownerHasRecoveryCode: boolean;
}

export interface ShiftData {
  id: string;
  shiftCode: string;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime: string | null;
  startingCash: number;
  expectedCash: number;
  actualCash: number | null;
  cashDifference: number | null;
  totalCashSales: number;
  totalQrisSales: number;
  totalDebtSales: number;
  totalDebtCollectedCash: number;
  totalCashIn: number;
  totalCashOut: number;
  status: "open" | "closed";
  notes: string | null;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  type: "cash_in" | "cash_out";
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  userName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
}

/**
 * Hash PIN menggunakan SHA-256 agar tidak pernah tersimpan sebagai plain text (PRD F5.2)
 */
export function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin.trim()).digest("hex");
}

/**
 * Login kasir atau pemilik menggunakan PIN 4-6 digit
 */
export async function loginWithPin(pin: string): Promise<UserSession | null> {
  await ensureDatabaseSchema();
  const hashed = hashPin(pin);

  const rows = await query<RowDataPacket[]>(
    "SELECT id, name, role FROM users WHERE pin_hash = ? AND is_active = TRUE LIMIT 1",
    [hashed]
  );

  if (rows.length === 0) {
    // Audit failed attempt
    await createAuditLog("LOGIN_FAILED", "auth", null, "Percobaan login dengan PIN salah", "Sistem");
    return null;
  }

  const u = rows[0];
  const user: UserSession = {
    id: String(u.id),
    name: String(u.name),
    role: u.role as UserSession["role"],
  };

  await createAuditLog("LOGIN_SUCCESS", "auth", user.id, `User ${user.name} (${user.role}) berhasil login`, user.name);
  return user;
}

/**
 * Verifikasi apakah PIN yang dimasukkan adalah milik Pemilik (Owner)
 */
export async function verifyOwnerPin(pin: string): Promise<boolean> {
  await ensureDatabaseSchema();
  if (!pin || !pin.trim()) return false;
  const cleanPin = pin.trim();
  const hashed = hashPin(cleanPin);

  // 1. Cek di tabel users role owner
  const rows = await query<RowDataPacket[]>(
    "SELECT id FROM users WHERE pin_hash = ? AND role = 'owner' AND is_active = TRUE LIMIT 1",
    [hashed]
  );
  if (rows.length > 0) return true;

  // 2. Cek store_settings owner_pin (bisa plain atau hash)
  const [setting] = await query<RowDataPacket[]>(
    "SELECT setting_value FROM store_settings WHERE setting_key = 'owner_pin' LIMIT 1"
  );
  if (setting && (setting.setting_value === cleanPin || setting.setting_value === hashed)) {
    return true;
  }

  // 3. Cek emergency recovery code
  const [recRows] = await query<RowDataPacket[]>(
    "SELECT setting_value FROM store_settings WHERE setting_key = 'owner_recovery_code' LIMIT 1"
  );
  if (recRows && recRows.setting_value && recRows.setting_value.trim().toUpperCase() === cleanPin.toUpperCase()) {
    return true;
  }

  return false;
}

/**
 * Mencatat riwayat Audit Log (PRD F5.7)
 */
export async function createAuditLog(
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: string | null,
  userName: string = "Kasir"
): Promise<void> {
  try {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await query(
      "INSERT INTO audit_logs (id, user_name, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)",
      [id, userName, action, targetType, targetId, details]
    );
  } catch (err) {
    console.warn("[createAuditLog error]:", err);
  }
}

/**
 * Mengambil shift kasir yang sedang aktif terbuka (PRD F5.3)
 */
export async function getActiveShift(): Promise<ShiftData | null> {
  await ensureDatabaseSchema();

  const rows = await query<RowDataPacket[]>(
    `SELECT * FROM cashier_shifts WHERE status = 'open' ORDER BY start_time DESC LIMIT 1`
  );

  if (rows.length === 0) return null;

  const r = rows[0];

  // Hitung ulang secara dinamis penjualan tunai, QRIS, kasbon, pelunasan utang, dan arus kas selama shift ini
  const shiftId = String(r.id);
  const shiftStart = r.start_time;

  // 1. Penjualan selama shift (Mendukung Tunai, QRIS, Kasbon, dan Split Payment 'Campuran')
  const [salesAgg] = await query<RowDataPacket[]>(
    `SELECT 
      COALESCE(SUM(
        CASE 
          WHEN s.payment_method = 'Tunai' THEN s.total_amount
          WHEN s.payment_method = 'Campuran' THEN (
            SELECT COALESCE(SUM(sp.amount), 0) 
            FROM sale_payments sp 
            WHERE sp.sale_id = s.id AND sp.payment_method = 'Tunai'
          )
          ELSE 0
        END
      ), 0) AS cash_sales,
      COALESCE(SUM(
        CASE 
          WHEN s.payment_method = 'QRIS' THEN s.total_amount
          WHEN s.payment_method = 'Campuran' THEN (
            SELECT COALESCE(SUM(sp.amount), 0) 
            FROM sale_payments sp 
            WHERE sp.sale_id = s.id AND sp.payment_method = 'QRIS'
          )
          ELSE 0
        END
      ), 0) AS qris_sales,
      COALESCE(SUM(
        CASE 
          WHEN s.payment_method IN ('Kasbon', 'Hutang') THEN s.total_amount
          WHEN s.payment_method = 'Campuran' THEN (
            SELECT COALESCE(SUM(sp.amount), 0) 
            FROM sale_payments sp 
            WHERE sp.sale_id = s.id AND sp.payment_method = 'Kasbon'
          )
          ELSE 0
        END
      ), 0) AS debt_sales
    FROM sales s
    WHERE (s.shift_id = ? OR (s.created_at >= ? AND (s.shift_id IS NULL OR s.shift_id = '')))
      AND (s.is_void = FALSE OR s.is_void IS NULL)`,
    [shiftId, shiftStart]
  );

  // 2. Pelunasan kasbon tunai selama shift
  const [debtPayAgg] = await query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) AS debt_collected_cash
     FROM receivable_payments
     WHERE (shift_id = ? OR (paid_at >= ? AND (shift_id IS NULL OR shift_id = '')))
       AND payment_method = 'Tunai'`,
    [shiftId, shiftStart]
  );

  // 3. Kas masuk / keluar operasional selama shift
  const [movementsAgg] = await query<RowDataPacket[]>(
    `SELECT 
      COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount ELSE 0 END), 0) AS total_in,
      COALESCE(SUM(CASE WHEN type = 'cash_out' THEN amount ELSE 0 END), 0) AS total_out
    FROM shift_cash_movements
    WHERE shift_id = ?`,
    [shiftId]
  );

  const startingCash = Number(r.starting_cash || 0);
  const totalCashSales = Number(salesAgg?.cash_sales || 0);
  const totalQrisSales = Number(salesAgg?.qris_sales || 0);
  const totalDebtSales = Number(salesAgg?.debt_sales || 0);
  const totalDebtCollectedCash = Number(debtPayAgg?.debt_collected_cash || 0);
  const totalCashIn = Number(movementsAgg?.total_in || 0);
  const totalCashOut = Number(movementsAgg?.total_out || 0);

  // Kas di laci yang diharapkan = Modal Awal + Penjualan Tunai + Pelunasan Kasbon Tunai + Kas Masuk - Kas Keluar
  const expectedCash = startingCash + totalCashSales + totalDebtCollectedCash + totalCashIn - totalCashOut;

  return {
    id: shiftId,
    shiftCode: String(r.shift_code),
    cashierId: String(r.cashier_id),
    cashierName: String(r.cashier_name),
    startTime: r.start_time instanceof Date ? r.start_time.toLocaleString("id-ID") : String(r.start_time),
    endTime: r.end_time ? (r.end_time instanceof Date ? r.end_time.toLocaleString("id-ID") : String(r.end_time)) : null,
    startingCash,
    expectedCash,
    actualCash: r.actual_cash !== null ? Number(r.actual_cash) : null,
    cashDifference: r.cash_difference !== null ? Number(r.cash_difference) : null,
    totalCashSales,
    totalQrisSales,
    totalDebtSales,
    totalDebtCollectedCash,
    totalCashIn,
    totalCashOut,
    status: r.status,
    notes: r.notes ? String(r.notes) : null,
  };
}

/**
 * Buka Shift Kasir Baru (PRD F5.3)
 */
export async function openShift(
  cashierId: string,
  cashierName: string,
  startingCash: number,
  pin?: string
): Promise<ShiftData> {
  await ensureDatabaseSchema();

  // Pastikan tidak ada shift yang masih aktif
  const existing = await getActiveShift();
  if (existing) {
    throw new Error(`Shift ${existing.shiftCode} masih aktif. Tutup shift sebelumnya terlebih dahulu.`);
  }

  // Cek apakah PIN kasir / pemilik diwajibkan
  const [userRows] = await query<RowDataPacket[]>(
    "SELECT id, name, role, pin_hash FROM users WHERE id = ? AND is_active = TRUE LIMIT 1",
    [cashierId]
  );
  const targetUser = userRows[0];
  const sec = await getShiftSecuritySettings();

  if (targetUser?.role === "cashier" && sec.requireCashierPin && targetUser.pin_hash) {
    if (!pin || hashPin(pin) !== targetUser.pin_hash) {
      throw new Error("PIN Kasir salah. Silakan coba lagi.");
    }
  }

  if (targetUser?.role === "owner" && targetUser.pin_hash && pin) {
    if (hashPin(pin) !== targetUser.pin_hash) {
      throw new Error("PIN Pemilik salah. Silakan coba lagi.");
    }
  }

  const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randSuffix = Math.floor(100 + Math.random() * 900);
  const shiftCode = `SFT-${dateCode}-${randSuffix}`;
  const id = `sft-${Date.now()}`;

  await query(
    `INSERT INTO cashier_shifts 
      (id, shift_code, cashier_id, cashier_name, starting_cash, expected_cash, status)
     VALUES (?, ?, ?, ?, ?, ?, 'open')`,
    [id, shiftCode, cashierId, cashierName, startingCash, startingCash]
  );

  await createAuditLog(
    "OPEN_SHIFT",
    "shift",
    id,
    `Buka shift kasir ${shiftCode} oleh ${cashierName} dengan modal awal Rp ${startingCash.toLocaleString("id-ID")}`,
    cashierName
  );

  const active = await getActiveShift();
  if (!active) throw new Error("Gagal menginisialisasi shift baru.");
  return active;
}

/**
 * Mengganti Kasir Aktif pada Shift Berjalan (Handover Kasir / Pemilik Ambil Alih Layanan)
 */
export async function switchActiveCashier(
  shiftId: string,
  newCashierId: string,
  newCashierName: string,
  pin?: string
): Promise<ShiftData> {
  await ensureDatabaseSchema();

  const current = await getActiveShift();
  if (!current || current.id !== shiftId) {
    throw new Error("Shift aktif tidak ditemukan.");
  }

  const [userRows] = await query<RowDataPacket[]>(
    "SELECT id, name, role, pin_hash FROM users WHERE id = ? AND is_active = TRUE LIMIT 1",
    [newCashierId]
  );
  if (userRows.length === 0) {
    throw new Error("Pengguna tidak ditemukan atau sedang dinonaktifkan.");
  }

  const targetUser = userRows[0];
  const sec = await getShiftSecuritySettings();

  if (targetUser.role === "cashier" && sec.requireCashierPin && targetUser.pin_hash) {
    if (!pin || hashPin(pin) !== targetUser.pin_hash) {
      throw new Error("PIN Kasir salah. Silakan coba lagi.");
    }
  }

  if (targetUser.role === "owner" && targetUser.pin_hash && pin) {
    if (hashPin(pin) !== targetUser.pin_hash) {
      throw new Error("PIN Pemilik salah. Silakan coba lagi.");
    }
  }

  const effectiveName = targetUser.name || newCashierName;

  await query(
    "UPDATE cashier_shifts SET cashier_id = ?, cashier_name = ? WHERE id = ?",
    [targetUser.id, effectiveName, shiftId]
  );

  await createAuditLog(
    "SWITCH_CASHIER",
    "shift",
    shiftId,
    `Ganti kasir bertugas shift ${current.shiftCode} dari '${current.cashierName}' ke '${effectiveName}'`,
    effectiveName
  );

  const updated = await getActiveShift();
  if (!updated) throw new Error("Gagal memuat shift yang diperbarui.");
  return updated;
}

/**
 * Tutup Shift Kasir & Rekonsiliasi Uang Laci Fisik (PRD F5.4)
 */
export async function closeShift(
  shiftId: string,
  actualCash: number,
  notes: string = ""
): Promise<ShiftData> {
  await ensureDatabaseSchema();

  const current = await getActiveShift();
  if (!current || current.id !== shiftId) {
    throw new Error("Shift tidak ditemukan atau sudah ditutup.");
  }

  const expectedCash = current.expectedCash;
  const difference = actualCash - expectedCash;

  await query(
    `UPDATE cashier_shifts SET
      end_time = CURRENT_TIMESTAMP,
      expected_cash = ?,
      actual_cash = ?,
      cash_difference = ?,
      total_cash_sales = ?,
      total_qris_sales = ?,
      total_debt_sales = ?,
      total_debt_collected_cash = ?,
      total_cash_in = ?,
      total_cash_out = ?,
      status = 'closed',
      notes = ?
     WHERE id = ?`,
    [
      expectedCash,
      actualCash,
      difference,
      current.totalCashSales,
      current.totalQrisSales,
      current.totalDebtSales,
      current.totalDebtCollectedCash,
      current.totalCashIn,
      current.totalCashOut,
      notes,
      shiftId,
    ]
  );

  const diffLabel =
    difference === 0
      ? "Pas (Sesuai)"
      : difference > 0
      ? `Lebih Rp ${difference.toLocaleString("id-ID")}`
      : `Kurang Rp ${Math.abs(difference).toLocaleString("id-ID")}`;

  await createAuditLog(
    "CLOSE_SHIFT",
    "shift",
    shiftId,
    `Tutup shift ${current.shiftCode} oleh ${current.cashierName}. Kas fisik: Rp ${actualCash.toLocaleString("id-ID")} (Selisih: ${diffLabel})`,
    current.cashierName
  );

  return {
    ...current,
    endTime: new Date().toLocaleString("id-ID"),
    actualCash,
    cashDifference: difference,
    status: "closed",
    notes,
  };
}

/**
 * Tambah Catatan Kas Masuk / Keluar selama shift (PRD F5.5)
 */
export async function recordCashMovement(
  shiftId: string,
  type: "cash_in" | "cash_out",
  amount: number,
  reason: string,
  createdBy: string
): Promise<CashMovement> {
  await ensureDatabaseSchema();

  if (amount <= 0) {
    throw new Error("Nominal uang harus lebih dari Rp 0.");
  }
  if (!reason.trim()) {
    throw new Error("Alasan pengeluaran / pemasukan kas wajib diisi.");
  }

  const id = `scm-${Date.now()}`;
  await query(
    "INSERT INTO shift_cash_movements (id, shift_id, type, amount, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    [id, shiftId, type, amount, reason.trim(), createdBy]
  );

  const actionText = type === "cash_in" ? "Kas Masuk Laci" : "Pengeluaran Kas Laci";
  await createAuditLog(
    "CASH_MOVEMENT",
    "shift",
    shiftId,
    `${actionText}: Rp ${amount.toLocaleString("id-ID")} (${reason}) oleh ${createdBy}`,
    createdBy
  );

  return {
    id,
    shiftId,
    type,
    amount,
    reason: reason.trim(),
    createdBy,
    createdAt: new Date().toLocaleString("id-ID"),
  };
}

/**
 * Mengambil daftar kas movement pada shift tertentu
 */
export async function getShiftMovements(shiftId: string): Promise<CashMovement[]> {
  await ensureDatabaseSchema();
  const rows = await query<RowDataPacket[]>(
    "SELECT * FROM shift_cash_movements WHERE shift_id = ? ORDER BY created_at DESC",
    [shiftId]
  );

  return rows.map((r) => ({
    id: String(r.id),
    shiftId: String(r.shift_id),
    type: r.type,
    amount: Number(r.amount),
    reason: String(r.reason),
    createdBy: String(r.createdBy || r.created_by),
    createdAt: r.created_at instanceof Date ? r.created_at.toLocaleString("id-ID") : String(r.created_at),
  }));
}

/**
 * Mengambil riwayat audit log terbaru (PRD F5.7)
 */
export async function getRecentAuditLogs(limit: number = 50): Promise<AuditLogItem[]> {
  await ensureDatabaseSchema();
  const rows = await query<RowDataPacket[]>(
    "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?",
    [limit]
  );

  return rows.map((r) => ({
    id: String(r.id),
    userName: String(r.user_name),
    action: String(r.action),
    targetType: r.target_type ? String(r.target_type) : null,
    targetId: r.target_id ? String(r.target_id) : null,
    details: r.details ? String(r.details) : null,
    createdAt: r.created_at instanceof Date ? r.created_at.toLocaleString("id-ID") : String(r.created_at),
  }));
}

/**
 * Mengambil daftar pengguna aktif di sistem
 */
export async function getActiveUsers(): Promise<UserSession[]> {
  await ensureDatabaseSchema();
  const rows = await query<RowDataPacket[]>(
    "SELECT id, name, role FROM users WHERE is_active = TRUE ORDER BY name ASC"
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    role: r.role,
  }));
}

/**
 * Mengambil pengaturan keamanan shift & status setup awal
 */
export async function getShiftSecuritySettings(): Promise<ShiftSecuritySettings> {
  await ensureDatabaseSchema();
  const rows = await query<RowDataPacket[]>(
    "SELECT setting_key, setting_value FROM store_settings WHERE setting_key IN ('is_initial_setup_completed', 'require_cashier_pin', 'owner_pin', 'owner_recovery_code', 'owner_name')"
  );
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.setting_key] = r.setting_value;
  }

  const [ownerRows] = await query<RowDataPacket[]>(
    "SELECT id, name, pin_hash FROM users WHERE role = 'owner' AND is_active = TRUE LIMIT 1"
  );
  const owner = ownerRows[0];
  const hasOwnerPin = Boolean(owner?.pin_hash || map["owner_pin"]);
  const ownerName = owner?.name || map["owner_name"] || process.env.OWNER_NAME || "Cak Mat (Pemilik)";
  const isSetupCompleted = map["is_initial_setup_completed"] === "true";
  const requireCashierPin = map["require_cashier_pin"] === "true";
  const ownerHasRecoveryCode = Boolean(map["owner_recovery_code"]);

  return {
    isSetupCompleted,
    requireCashierPin,
    hasOwnerPin,
    ownerName,
    ownerHasRecoveryCode,
  };
}

/**
 * Mengambil daftar seluruh pengguna (Owner & Kasir) dengan info PIN & status aktif
 */
export async function getAllUsersDetailed(): Promise<UserDetail[]> {
  await ensureDatabaseSchema();
  const rows = await query<RowDataPacket[]>(
    "SELECT id, name, role, is_active, pin_hash, created_at FROM users ORDER BY role = 'owner' DESC, name ASC"
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    role: r.role,
    isActive: Boolean(r.is_active),
    hasPin: Boolean(r.pin_hash && r.pin_hash.trim() !== ""),
    createdAt: r.created_at instanceof Date ? r.created_at.toLocaleString("id-ID") : String(r.created_at),
  }));
}

/**
 * Tambah Kasir Baru (PRD F5.2)
 */
export async function createCashier(name: string, pin?: string): Promise<UserSession> {
  await ensureDatabaseSchema();
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Nama kasir wajib diisi.");

  const id = `usr-cashier-${Date.now()}`;
  const pinHash = pin && pin.trim() ? hashPin(pin.trim()) : null;

  await query(
    "INSERT INTO users (id, name, role, pin_hash, is_active) VALUES (?, ?, 'cashier', ?, TRUE)",
    [id, cleanName, pinHash]
  );

  await createAuditLog("CREATE_CASHIER", "user", id, `Kasir baru '${cleanName}' ditambahkan`, "Pemilik");

  return { id, name: cleanName, role: "cashier" };
}

/**
 * Perbarui Akun Kasir (Ubah Nama, Status Aktif, atau Reset PIN)
 */
export async function updateCashier(id: string, name: string, isActive: boolean, pin?: string): Promise<void> {
  await ensureDatabaseSchema();
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Nama kasir wajib diisi.");

  if (pin !== undefined && pin.trim() !== "") {
    const pinHash = hashPin(pin.trim());
    await query("UPDATE users SET name = ?, is_active = ?, pin_hash = ? WHERE id = ?", [cleanName, isActive, pinHash, id]);
  } else {
    await query("UPDATE users SET name = ?, is_active = ? WHERE id = ?", [cleanName, isActive, id]);
  }

  await createAuditLog("UPDATE_CASHIER", "user", id, `Kasir '${cleanName}' diperbarui (Aktif: ${isActive})`, "Pemilik");
}

/**
 * Mengubah Toggle Global: Wajibkan PIN untuk Kasir (4 Digit) (On / Off)
 */
export async function toggleRequireCashierPin(required: boolean): Promise<boolean> {
  await ensureDatabaseSchema();
  const val = required ? "true" : "false";
  await query(
    "INSERT INTO store_settings (setting_key, setting_value) VALUES ('require_cashier_pin', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
    [val]
  );
  await createAuditLog(
    "SECURITY_SETTINGS_CHANGE",
    "settings",
    "require_cashier_pin",
    `Mode keamanan kasir diubah: ${required ? "Wajibkan PIN 4 Digit" : "Cukup Pilih Nama (Tanpa PIN)"}`,
    "Pemilik"
  );
  return required;
}

/**
 * Mengubah PIN Pemilik (Verifikasi PIN lama atau Emergency Recovery Code)
 */
export async function updateOwnerPin(oldPinOrRecovery: string, newPin: string): Promise<void> {
  await ensureDatabaseSchema();
  if (!newPin || newPin.trim().length < 4) {
    throw new Error("PIN baru minimal 4-6 digit angka.");
  }

  const isOldValid = await verifyOwnerPin(oldPinOrRecovery);
  if (!isOldValid) {
    throw new Error("PIN lama atau Kode Pemulihan Darurat tidak valid.");
  }

  const newHash = hashPin(newPin.trim());
  await query("UPDATE users SET pin_hash = ? WHERE role = 'owner'", [newHash]);
  await query(
    "INSERT INTO store_settings (setting_key, setting_value) VALUES ('owner_pin', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
    [newPin.trim()]
  );

  await createAuditLog("OWNER_PIN_CHANGED", "auth", "owner", "PIN Pemilik berhasil diperbarui", "Pemilik");
}

/**
 * Login Cepat atau Pilih Profil Kasir (Memvalidasi PIN jika mode PIN diwajibkan)
 */
export async function loginOrSelectCashier(cashierId: string, pin?: string): Promise<UserSession> {
  await ensureDatabaseSchema();
  const rows = await query<RowDataPacket[]>(
    "SELECT id, name, role, pin_hash FROM users WHERE id = ? AND is_active = TRUE LIMIT 1",
    [cashierId]
  );
  if (rows.length === 0) {
    throw new Error("Akun kasir tidak ditemukan atau sedang dinonaktifkan.");
  }
  const u = rows[0];
  const sec = await getShiftSecuritySettings();

  if (sec.requireCashierPin && u.pin_hash && u.pin_hash.trim() !== "") {
    const isOwner = u.role === "owner";
    const matchesOwner = isOwner && pin ? await verifyOwnerPin(pin) : false;
    if (!matchesOwner && (!pin || hashPin(pin) !== u.pin_hash)) {
      await createAuditLog("LOGIN_FAILED", "auth", String(u.id), `Gagal login kasir ${u.name} (PIN salah)`, String(u.name));
      throw new Error(isOwner ? "PIN Pemilik atau Kode Pemulihan salah. Silakan coba lagi." : "PIN Kasir salah. Silakan coba lagi.");
    }
  }

  const session: UserSession = {
    id: String(u.id),
    name: String(u.name),
    role: u.role,
  };
  await createAuditLog("LOGIN_SUCCESS", "auth", session.id, `Kasir ${session.name} aktif`, session.name);
  return session;
}

/**
 * Menyelesaikan Setup Awal Aplikasi (Onboarding Wizard F5.1)
 */
export async function completeInitialSetup(data: {
  storeName: string;
  ownerName: string;
  ownerPin: string;
  storeAddress?: string;
  cashierName?: string;
  requireCashierPin?: boolean;
  cashierPin?: string;
  recoveryCode: string;
  syncSecret?: string;
}): Promise<{ ok: boolean; message: string }> {
  await ensureDatabaseSchema();

  const storeName = data.storeName.trim() || "Warung Madura Berkah";
  const ownerName = data.ownerName.trim() || "Pemilik";
  const ownerPin = data.ownerPin.trim();
  const storeAddress = (data.storeAddress || "").trim();
  const cashierName = (data.cashierName || "").trim() || "Kasir 1";
  const requireCashierPin = Boolean(data.requireCashierPin);
  const cashierPin = data.cashierPin?.trim();
  const recoveryCode = data.recoveryCode.trim() || `REC-${Math.floor(1000 + Math.random() * 9000)}-WARUNG`;

  if (!ownerPin || ownerPin.length < 4) {
    throw new Error("PIN Pemilik wajib diisi minimal 4-6 digit angka.");
  }

  // 1. Simpan Owner ke tabel users
  const ownerHash = hashPin(ownerPin);
  const existingOwner = await query<RowDataPacket[]>("SELECT id FROM users WHERE role = 'owner' LIMIT 1");
  if (existingOwner.length > 0) {
    await query("UPDATE users SET name = ?, pin_hash = ?, is_active = TRUE WHERE role = 'owner'", [ownerName, ownerHash]);
  } else {
    await query(
      "INSERT INTO users (id, name, role, pin_hash, is_active) VALUES ('usr-owner-01', ?, 'owner', ?, TRUE)",
      [ownerName, ownerHash]
    );
  }

  // 2. Simpan Kasir Pertama ke tabel users
  const cashierHash = cashierPin ? hashPin(cashierPin) : null;
  const existingCashier = await query<RowDataPacket[]>("SELECT id FROM users WHERE role = 'cashier' LIMIT 1");
  if (existingCashier.length > 0) {
    await query("UPDATE users SET name = ?, pin_hash = ?, is_active = TRUE WHERE id = ?", [cashierName, cashierHash, existingCashier[0].id]);
  } else {
    await query(
      "INSERT INTO users (id, name, role, pin_hash, is_active) VALUES ('usr-cashier-01', ?, 'cashier', ?, TRUE)",
      [cashierName, cashierHash]
    );
  }

  // 3. Simpan setting ke store_settings
  const settingsEntries = [
    ["is_initial_setup_completed", "true"],
    ["require_cashier_pin", requireCashierPin ? "true" : "false"],
    ["owner_pin", ownerPin],
    ["owner_name", ownerName],
    ["owner_recovery_code", recoveryCode],
  ];

  for (const [k, v] of settingsEntries) {
    await query(
      "INSERT INTO store_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [k, v]
    );
  }

  // 4. Update memory runtime process.env
  process.env.STORE_NAME = storeName;
  process.env.OWNER_NAME = ownerName;
  process.env.CASHIER_DEFAULT_NAME = cashierName;
  if (storeAddress) process.env.STORE_ADDRESS = storeAddress;
  if (data.syncSecret?.trim()) process.env.SYNC_SECRET_KEY = data.syncSecret.trim();

  // 5. Update file .env
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

  updateEnvKey("STORE_NAME", storeName);
  updateEnvKey("OWNER_NAME", ownerName);
  updateEnvKey("CASHIER_DEFAULT_NAME", cashierName);
  if (storeAddress) updateEnvKey("STORE_ADDRESS", storeAddress);
  if (data.syncSecret?.trim()) updateEnvKey("SYNC_SECRET_KEY", data.syncSecret.trim());

  try {
    fs.writeFileSync(envPath, content, "utf-8");
  } catch (err: any) {
    console.warn("[completeInitialSetup] Gagal tulis .env:", err.message);
  }

  await createAuditLog(
    "INITIAL_SETUP_COMPLETED",
    "system",
    null,
    `Setup awal toko '${storeName}' selesai oleh Pemilik '${ownerName}'. Kasir awal: '${cashierName}'`,
    ownerName
  );

  return { ok: true, message: `Setup awal toko "${storeName}" berhasil diselesaikan!` };
}
