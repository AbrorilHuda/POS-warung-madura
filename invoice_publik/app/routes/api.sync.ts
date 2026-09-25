import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { saveInvoiceSnapshot, isSupabaseConnected } from "../services/supabase.server";
import type { SyncPayload } from "../types/invoice";

const EXPECTED_SECRET = process.env.SYNC_SECRET_KEY || "warung_madura_sync_secret_2026";

/**
 * GET /api/sync - Health check status koneksi cloud
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return Response.json({
    ok: true,
    service: "POS Warung Madura — Cloud Invoice Sync API",
    status: "online",
    supabaseConnected: isSupabaseConnected(),
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

    const providedSecret = body.secretKey || authHeader;
    if (providedSecret !== EXPECTED_SECRET) {
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
