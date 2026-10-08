import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getActiveShift,
  openShift,
  closeShift,
  recordCashMovement,
  getShiftMovements,
  getRecentAuditLogs,
  loginWithPin,
  getActiveUsers,
  getShiftSecuritySettings,
  getAllUsersDetailed,
  createCashier,
  updateCashier,
  toggleRequireCashierPin,
  updateOwnerPin,
  loginOrSelectCashier,
  completeInitialSetup,
  verifyOwnerPin,
  switchActiveCashier,
} from "../services/shift.server";

/**
 * GET /api/shift
 * Mengembalikan informasi shift yang aktif saat ini, kas movements, pengguna, dan pengaturan keamanan.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const getAudit = url.searchParams.get("audit") === "true";
  const getUsers = url.searchParams.get("users") === "true";
  const getAllUsers = url.searchParams.get("all_users") === "true";
  const getSettings = url.searchParams.get("settings") === "true";

  try {
    if (getSettings) {
      const settings = await getShiftSecuritySettings();
      return Response.json({ ok: true, settings });
    }

    if (getAllUsers) {
      const users = await getAllUsersDetailed();
      const settings = await getShiftSecuritySettings();
      return Response.json({ ok: true, users, settings });
    }

    if (getUsers) {
      const users = await getActiveUsers();
      const settings = await getShiftSecuritySettings();
      return Response.json({ ok: true, users, settings });
    }

    if (getAudit) {
      const auditLogs = await getRecentAuditLogs(50);
      return Response.json({ ok: true, auditLogs });
    }

    const activeShift = await getActiveShift();
    const settings = await getShiftSecuritySettings();
    let movements: any[] = [];
    if (activeShift) {
      movements = await getShiftMovements(activeShift.id);
    }

    return Response.json({
      ok: true,
      activeShift,
      movements,
      settings,
    });
  } catch (err: any) {
    console.error("[api.shift loader error]:", err);
    return Response.json({ ok: false, error: err.message || "Gagal memuat data shift" }, { status: 500 });
  }
}

/**
 * POST /api/shift
 * Menangani Buka Shift, Tutup Shift, Kas Laci, Manajemen Kasir, Setup Awal, dan PIN.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Metode tidak diizinkan" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const actionType = body.action;

    switch (actionType) {
      case "login": {
        const pin = String(body.pin || "").trim();
        if (!pin) {
          return Response.json({ ok: false, error: "PIN wajib diisi" }, { status: 400 });
        }
        const user = await loginWithPin(pin);
        if (!user) {
          return Response.json({ ok: false, error: "PIN salah atau akun tidak aktif" }, { status: 401 });
        }
        return Response.json({ ok: true, user });
      }

      case "select_cashier": {
        const cashierId = String(body.cashierId || "");
        const pin = body.pin ? String(body.pin).trim() : undefined;
        if (!cashierId) {
          return Response.json({ ok: false, error: "Pilih kasir terlebih dahulu" }, { status: 400 });
        }
        const user = await loginOrSelectCashier(cashierId, pin);
        return Response.json({ ok: true, user });
      }

      case "verify_owner_pin": {
        const pin = String(body.pin || "").trim();
        if (!pin) {
          return Response.json({ ok: false, error: "PIN Pemilik wajib diisi" }, { status: 400 });
        }
        const valid = await verifyOwnerPin(pin);
        if (!valid) {
          return Response.json({ ok: false, error: "PIN Pemilik salah" }, { status: 401 });
        }
        return Response.json({ ok: true, message: "Otorisasi Pemilik Berhasil" });
      }

      case "open": {
        const cashierId = String(body.cashierId || "usr-cashier-01");
        const cashierName = String(body.cashierName || "Kasir");
        const startingCash = Number(body.startingCash || 0);
        const pin = body.pin ? String(body.pin).trim() : undefined;

        const newShift = await openShift(cashierId, cashierName, startingCash, pin);
        return Response.json({ ok: true, shift: newShift });
      }

      case "close": {
        const shiftId = String(body.shiftId || "");
        const actualCash = Number(body.actualCash || 0);
        const notes = String(body.notes || "");

        if (!shiftId) {
          return Response.json({ ok: false, error: "ID Shift wajib disertakan" }, { status: 400 });
        }

        const closedShift = await closeShift(shiftId, actualCash, notes);
        return Response.json({ ok: true, shift: closedShift });
      }

      case "switch_cashier": {
        const shiftId = String(body.shiftId || "");
        const cashierId = String(body.cashierId || "");
        const cashierName = String(body.cashierName || "");
        const pin = body.pin ? String(body.pin).trim() : undefined;

        if (!shiftId || !cashierId) {
          return Response.json({ ok: false, error: "ID Shift dan ID Kasir wajib disertakan" }, { status: 400 });
        }

        const shift = await switchActiveCashier(shiftId, cashierId, cashierName, pin);
        return Response.json({ ok: true, shift });
      }

      case "cash_movement": {
        const shiftId = String(body.shiftId || "");
        const type = body.type as "cash_in" | "cash_out";
        const amount = Number(body.amount || 0);
        const reason = String(body.reason || "");
        const createdBy = String(body.createdBy || "Kasir");

        if (!shiftId || !type || amount <= 0 || !reason) {
          return Response.json({ ok: false, error: "Data pergerakan kas tidak lengkap" }, { status: 400 });
        }

        const movement = await recordCashMovement(shiftId, type, amount, reason, createdBy);
        return Response.json({ ok: true, movement });
      }

      case "create_cashier": {
        const name = String(body.name || "").trim();
        const pin = body.pin ? String(body.pin).trim() : undefined;
        const newCashier = await createCashier(name, pin);
        const allUsers = await getAllUsersDetailed();
        return Response.json({ ok: true, cashier: newCashier, users: allUsers });
      }

      case "update_cashier": {
        const id = String(body.id || "");
        const name = String(body.name || "").trim();
        const isActive = Boolean(body.isActive);
        const pin = body.pin ? String(body.pin).trim() : undefined;
        await updateCashier(id, name, isActive, pin);
        const allUsers = await getAllUsersDetailed();
        return Response.json({ ok: true, users: allUsers });
      }

      case "toggle_cashier_pin": {
        const required = Boolean(body.required);
        const result = await toggleRequireCashierPin(required);
        return Response.json({ ok: true, requireCashierPin: result });
      }

      case "update_owner_pin": {
        const oldPin = String(body.oldPin || "").trim();
        const newPin = String(body.newPin || "").trim();
        await updateOwnerPin(oldPin, newPin);
        return Response.json({ ok: true, message: "PIN Pemilik berhasil diubah" });
      }

      case "initial_setup": {
        const res = await completeInitialSetup(body);
        const settings = await getShiftSecuritySettings();
        return Response.json({ ok: true, ...res, settings });
      }

      default:
        return Response.json({ ok: false, error: "Aksi tidak dikenali" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[api.shift action error]:", err);
    return Response.json({ ok: false, error: err.message || "Gagal memproses aksi shift" }, { status: 400 });
  }
}
