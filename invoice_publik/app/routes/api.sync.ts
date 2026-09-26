import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  saveInvoiceSnapshot,
  isSupabaseConnected,
  checkSupabaseStatus,
  cleanupExpiredInvoices,
} from "../services/supabase.server";
import type { SyncPayload } from "../types/invoice";

/**
 * GET /api/sync - Health check status koneksi cloud, retensi, & trigger pembersihan
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const doCleanup = url.searchParams.get("cleanup") === "true";

  let cleanupResult = null;
  if (doCleanup) {
    cleanupResult = await cleanupExpiredInvoices();
  }

  const supabaseStatus = await checkSupabaseStatus();
  const retentionHours = Number(process.env.INVOICE_RETENTION_HOURS) || 12;

  return Response.json({
    ok: true,
    service: "POS Warung Madura — Cloud Invoice Sync API",
    status: "online",
    retentionHours,
    supabase: supabaseStatus,
    cleanup: cleanupResult,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/sync - Menerima snapshot transaksi dari Laptop POS Warung
 */
export async function action({ request }: ActionFunctionArgs) {
  // Hanya menerima metode POST
  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "Metode tidak diizinkan" },
      { status: 405 }
    );
  }

  try {
    const authHeader = request.headers.get("x-sync-secret") || "";
    const body = (await request.json()) as SyncPayload;

    const expectedSecret = process.env.SYNC_SECRET_KEY || "warung_madura_sync_secret_2026";
    const providedSecret = body.secretKey || authHeader;
    if (providedSecret !== expectedSecret) {
      return Response.json(
        { ok: false, error: "Autentikasi gagal: Secret Key tidak cocok" },
        { status: 401 }
      );
    }

    if (!body.invoice || !body.invoice.id) {
      return Response.json(
        { ok: false, error: "Data invoice tidak lengkap" },
        { status: 400 }
      );
    }

    const result = await saveInvoiceSnapshot(body.invoice);
    if (!result.success) {
      return Response.json(
        { ok: false, error: result.error || "Gagal menyimpan invoice ke Supabase" },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      invoiceId: body.invoice.id,
      message: `Invoice ${body.invoice.id} berhasil disimpan di cloud`,
      supabaseConnected: isSupabaseConnected(),
    });
  } catch (err: any) {
    console.error("[API Sync Error]", err);
    return Response.json(
      { ok: false, error: err.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
