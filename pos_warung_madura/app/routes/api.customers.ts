import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getCustomersSummary,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteOrDeactivateCustomer,
  getCustomerReceivables,
  getCustomerLedgerHistory,
  payCustomerDebtFIFO,
  verifyOwnerPin,
  generateWhatsAppReminderUrl,
} from "../services/customer.server";
import { getStoreConfig } from "../services/pos.server";

/**
 * GET /api/customers — Pencarian pelanggan, rincian piutang, dan buku besar (ledger)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId") || url.searchParams.get("id");
  const isLedger = url.searchParams.get("ledger") === "true";
  const isReceivables = url.searchParams.get("receivables") === "true";
  const search = url.searchParams.get("q") || "";
  const activeOnly = url.searchParams.get("all") !== "true";

  try {
    if (customerId) {
      if (isLedger) {
        const ledger = await getCustomerLedgerHistory(customerId);
        return Response.json({ ok: true, ledger });
      }

      if (isReceivables) {
        const receivables = await getCustomerReceivables(customerId);
        return Response.json({ ok: true, receivables });
      }

      const customer = await getCustomerById(customerId);
      if (!customer) {
        return Response.json({ ok: false, error: "Pelanggan tidak ditemukan" }, { status: 404 });
      }
      return Response.json({ ok: true, customer });
    }

    const customers = await getCustomersSummary(search, activeOnly);
    return Response.json({ ok: true, customers });
  } catch (err: any) {
    console.error("[api.customers loader error]:", err);
    return Response.json({ ok: false, error: err.message || "Gagal memuat data pelanggan" }, { status: 500 });
  }
}

/**
 * POST /api/customers — Operasi CRUD Pelanggan, Pelunasan FIFO, dan Otorisasi PIN
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Metode tidak diizinkan" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const actionType = body.action || "create";

    // 1. Tambah Pelanggan Baru (PRD F1.1)
    if (actionType === "create") {
      const customer = await createCustomer({
        name: body.name,
        phone: body.phone,
        address: body.address,
        creditLimit: body.creditLimit,
        notes: body.notes,
      });
      return Response.json({ ok: true, message: `Pelanggan "${customer.name}" berhasil ditambahkan`, customer });
    }

    // 2. Update Pelanggan
    if (actionType === "update") {
      if (!body.id) {
        return Response.json({ ok: false, error: "ID pelanggan wajib diisi" }, { status: 400 });
      }
      await updateCustomer(body.id, {
        name: body.name,
        phone: body.phone,
        address: body.address,
        creditLimit: body.creditLimit,
        isActive: body.isActive,
        notes: body.notes,
      });
      return Response.json({ ok: true, message: "Data pelanggan berhasil diperbarui" });
    }

    // 3. Hapus / Nonaktifkan Pelanggan (PRD F1)
    if (actionType === "delete") {
      if (!body.id) {
        return Response.json({ ok: false, error: "ID pelanggan wajib diisi" }, { status: 400 });
      }
      const result = await deleteOrDeactivateCustomer(body.id);
      return Response.json({ ok: true, ...result });
    }

    // 4. Pelunasan Kasbon dengan Algoritma FIFO (PRD F1.5)
    if (actionType === "payDebt") {
      if (!body.customerId || !body.amount) {
        return Response.json({ ok: false, error: "Data customerId dan nominal wajib diisi" }, { status: 400 });
      }
      const result = await payCustomerDebtFIFO({
        customerId: body.customerId,
        amount: Number(body.amount),
        paymentMethod: body.paymentMethod || "Tunai",
        specificReceivableId: body.specificReceivableId || undefined,
        notes: body.notes,
        createdBy: body.cashierName || "Kasir",
      });
      return Response.json({ ok: true, result });
    }

    // 5. Verifikasi PIN Pemilik untuk Kasbon Over-Limit (PRD F1.7)
    if (actionType === "verifyPin") {
      const pin = body.pin || "";
      const valid = await verifyOwnerPin(pin);
      return Response.json({ ok: true, valid });
    }

    // 6. Buat tautan pengingat WhatsApp (PRD F1.9)
    if (actionType === "reminder") {
      const customer = await getCustomerById(body.customerId);
      if (!customer) {
        return Response.json({ ok: false, error: "Pelanggan tidak ditemukan" }, { status: 404 });
      }
      const receivables = await getCustomerReceivables(body.customerId);
      const storeConfig = getStoreConfig();
      const whatsappUrl = generateWhatsAppReminderUrl(customer, storeConfig.storeName, receivables);

      return Response.json({ ok: true, whatsappUrl });
    }

    return Response.json({ ok: false, error: "Aksi tidak dikenali" }, { status: 400 });
  } catch (err: any) {
    console.error("[api.customers action error]:", err);
    return Response.json({ ok: false, error: err.message || "Terjadi kesalahan server" }, { status: 500 });
  }
}
