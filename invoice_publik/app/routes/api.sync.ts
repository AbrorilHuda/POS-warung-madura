import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  saveInvoiceSnapshot,
  isSupabaseConnected,
  checkSupabaseStatus,
  cleanupExpiredInvoices,
} from "../services/supabase.server";
import { validateSyncSecret, incrementInvoiceCount } from "../services/tenant.server";
import type { SyncPayload } from "../types/invoice";

/**
 * GET /api/sync — Health check: status koneksi cloud, kuota, cleanup
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
  const freeLimit = Number(process.env.FREE_INVOICE_LIMIT) || 50;
  const proPrice = Number(process.env.PRO_PLAN_PRICE) || 25000;

  // Cek tenant info jika x-sync-secret atau query ?secret= disediakan
  const syncSecret = request.headers.get("x-sync-secret") || url.searchParams.get("secret") || "";
  let tenantInfo: Record<string, unknown> | null = null;
  if (syncSecret) {
    const validation = await validateSyncSecret(syncSecret);
    if (validation.valid && validation.tenant) {
      tenantInfo = {
        valid: true,
        id: validation.tenant.id,
        storeName: validation.tenant.store_name,
        storeCode: validation.tenant.store_code,
        storeSlug: validation.tenant.store_slug,
        storeAddress: validation.tenant.store_address,
        ownerEmail: validation.tenant.owner_email,
        contactWa: validation.tenant.contact_wa,
        plan: validation.tenant.plan,
        status: validation.tenant.status,
        invoiceCount: validation.tenant.invoice_count,
        invoiceLimit: validation.tenant.invoice_limit,
        quotaRemaining: validation.quotaRemaining,
      };
    } else {
      tenantInfo = {
        valid: false,
        errorCode: validation.errorCode,
        error: validation.error,
      };
    }
  }

  return Response.json({
    ok: true,
    service: "POS Warung — Cloud Invoice Sync API (Multi-Tenant v2)",
    status: "online",
    retentionHours,
    saas: {
      freePlanLimit: freeLimit,
      proPlanPrice: proPrice,
      resetDay: 1,
    },
    supabase: supabaseStatus,
    cleanup: cleanupResult,
    tenant: tenantInfo,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/sync — Menerima snapshot transaksi dari POS lokal toko
 *
 * Header wajib: x-sync-secret: tok_live_...
 * Body (JSON): SyncPayload
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "Metode tidak diizinkan" },
      { status: 405 }
    );
  }

  try {
    // 1. Baca secret dari header (atau body untuk backward compat)
    const authHeader = request.headers.get("x-sync-secret") || "";
    const body = (await request.json()) as SyncPayload;
    const syncSecret = authHeader || body.secretKey || "";

    // 2. Validasi multi-tenant
    const validation = await validateSyncSecret(syncSecret);

    if (!validation.valid) {
      const statusCode =
        validation.errorCode === "INVALID_SECRET" ? 401 :
        validation.errorCode === "SUSPENDED" ? 403 : 402;

      const response: Record<string, unknown> = {
        ok: false,
        error: validation.error,
        errorCode: validation.errorCode,
      };

      // Tambah info upgrade jika kuota habis
      if (validation.errorCode === "QUOTA_EXCEEDED") {
        const freeLimit = Number(process.env.FREE_INVOICE_LIMIT) || 50;
        const proPrice = Number(process.env.PRO_PLAN_PRICE) || 25000;
        response.upgradeInfo = {
          message: `Upgrade ke Pro (Rp ${proPrice.toLocaleString("id-ID")}/bulan) untuk invoice unlimited.`,
          resetDate: validation.resetDate,
          quotaRemaining: 0,
          freeLimit,
        };
      }

      return Response.json(response, { status: statusCode });
    }

    const tenant = validation.tenant!;

    // 3. Validasi payload invoice
    if (!body.invoice || !body.invoice.id) {
      return Response.json(
        { ok: false, error: "Data invoice tidak lengkap (field 'invoice.id' wajib)" },
        { status: 400 }
      );
    }

    // 4. Keamanan: pastikan store_code di invoice cocok dengan tenant
    const invoiceId = body.invoice.id;
    if (!invoiceId.toUpperCase().startsWith(tenant.store_code.toUpperCase())) {
      return Response.json(
        {
          ok: false,
          error: `Invoice ID (${invoiceId}) tidak cocok dengan kode toko (${tenant.store_code}). Format: ${tenant.store_code}-XXXXXX`,
        },
        { status: 400 }
      );
    }

    // 5. Simpan invoice snapshot (dengan store_slug tenant)
    const enrichedInvoice = {
      ...body.invoice,
      storeName: body.invoice.storeName || tenant.store_name,
      storeAddress: body.invoice.storeAddress || tenant.store_address || "",
      storeSlug: tenant.store_slug,
      storeCode: tenant.store_code,
    };

    const result = await saveInvoiceSnapshot(enrichedInvoice, tenant.store_slug, tenant.store_code);

    if (!result.success) {
      // Jika sudah ada (idempotent), kembalikan 200
      if (result.error?.includes("duplicate") || result.error?.includes("already exists")) {
        const baseUrl = process.env.PUBLIC_BASE_URL || "";
        return Response.json({
          ok: true,
          invoiceId,
          message: `Invoice ${invoiceId} sudah ada di cloud (idempotent)`,
          publicUrl: baseUrl ? `${baseUrl}/${tenant.store_slug}/invoice/${invoiceId}` : null,
          quotaRemaining: validation.quotaRemaining,
        });
      }

      return Response.json(
        { ok: false, error: result.error || "Gagal menyimpan invoice ke cloud" },
        { status: 500 }
      );
    }

    // 6. Increment kuota tenant
    await incrementInvoiceCount(tenant.id);

    // 7. Bangun URL publik invoice
    const baseUrl = process.env.PUBLIC_BASE_URL || "";
    const publicUrl = baseUrl
      ? `${baseUrl}/${tenant.store_slug}/invoice/${invoiceId}`
      : null;

    return Response.json(
      {
        ok: true,
        invoiceId,
        storeCode: tenant.store_code,
        storeSlug: tenant.store_slug,
        message: `Invoice ${invoiceId} berhasil disimpan di cloud`,
        publicUrl,
        quotaRemaining: validation.quotaRemaining! - 1,
        supabaseConnected: isSupabaseConnected(),
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[API Sync Error]", err);
    return Response.json(
      { ok: false, error: err.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
