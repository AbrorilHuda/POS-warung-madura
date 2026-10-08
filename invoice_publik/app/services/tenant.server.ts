import crypto from "crypto";
import { getSupabaseClient } from "./supabase.server";
import type {
  Tenant,
  RegisterTenantInput,
  RegisterTenantResult,
  SyncValidationResult,
} from "../types/tenant";


export function generateSlug(storeName: string): string {
  return storeName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function generateStoreCode(storeName: string): string {
  const words = storeName.trim().toUpperCase().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 4).padEnd(4, "X");
  }
  const initials = words.map((w) => w[0] ?? "").join("").slice(0, 4).padEnd(4, "X");
  return initials;
}

function generateSyncSecret(): string {
  const secret = crypto.randomBytes(32).toString("hex");
  return `tok_live_${secret}`;
}


async function resolveUniqueStoreCode(baseCode: string): Promise<string> {
  const client = getSupabaseClient();
  if (!client) return baseCode + "01";

  let code = baseCode;
  let suffix = 1;
  while (true) {
    const { data } = await client
      .from("tenants")
      .select("store_code")
      .eq("store_code", code)
      .single();

    if (!data) return code; // tidak ada konflik
    code = baseCode.slice(0, 2) + String(suffix).padStart(2, "0");
    suffix++;
    if (suffix > 99) break;
  }
  return baseCode + Date.now().toString().slice(-4);
}


async function resolveUniqueSlug(baseSlug: string): Promise<string> {
  const client = getSupabaseClient();
  if (!client) return baseSlug;

  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const { data } = await client
      .from("tenants")
      .select("store_slug")
      .eq("store_slug", slug)
      .single();

    if (!data) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
    if (suffix > 99) break;
  }
  return `${baseSlug}-${Date.now()}`;
}


function shouldResetQuota(tenant: Tenant): boolean {
  const now = new Date();
  const lastReset = new Date(tenant.last_reset_at);
  return (
    now.getFullYear() !== lastReset.getFullYear() ||
    now.getMonth() !== lastReset.getMonth()
  );
}


export async function validateSyncSecret(
  syncSecret: string
): Promise<SyncValidationResult> {
  if (!syncSecret || typeof syncSecret !== "string" || syncSecret.length < 10) {
    return { valid: false, error: "Secret tidak valid", errorCode: "INVALID_SECRET" };
  }

  const client = getSupabaseClient();

  if (!client) {
    const envSecret = process.env.SYNC_SECRET_KEY || "";
    if (envSecret && syncSecret === envSecret) {
      const mockTenant: Tenant = {
        id: "mock-tenant",
        store_code: "WM01",
        store_slug: "warung-madura-berkah",
        store_name: process.env.DEFAULT_STORE_NAME || "Warung Madura Berkah",
        store_address: process.env.DEFAULT_STORE_ADDRESS || null,
        owner_email: null,
        contact_wa: null,
        sync_secret: syncSecret,
        plan: "pro",
        invoice_count: 0,
        invoice_limit: 999999,
        status: "active",
        last_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return { valid: true, tenant: mockTenant, quotaRemaining: 999999 };
    }
    return { valid: false, error: "Secret tidak ditemukan (mode mock)", errorCode: "INVALID_SECRET" };
  }

  // Query ke Supabase
  const { data: tenant, error } = await client
    .from("tenants")
    .select("*")
    .eq("sync_secret", syncSecret)
    .single();

  if (error || !tenant) {
    return { valid: false, error: "Autentikasi gagal: sync_secret tidak dikenali", errorCode: "INVALID_SECRET" };
  }

  if (tenant.status === "suspended") {
    return { valid: false, error: "Akun toko ini ditangguhkan. Hubungi admin.", errorCode: "SUSPENDED" };
  }
  if (tenant.status === "pending") {
    return { valid: false, error: "Akun toko masih pending verifikasi.", errorCode: "SUSPENDED" };
  }


  let currentCount = tenant.invoice_count;
  if (shouldResetQuota(tenant as Tenant)) {
    await client
      .from("tenants")
      .update({ invoice_count: 0, last_reset_at: new Date().toISOString() })
      .eq("id", tenant.id);
    currentCount = 0;
  }


  if (tenant.plan === "free" && currentCount >= tenant.invoice_limit) {
    const now = new Date();
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      valid: false,
      error: `Kuota ${tenant.invoice_limit} invoice/bulan untuk paket Free telah habis.`,
      errorCode: "QUOTA_EXCEEDED",
      quotaRemaining: 0,
      resetDate: nextReset.toISOString(),
    };
  }

  const quotaRemaining =
    tenant.plan === "pro"
      ? 999999
      : Math.max(0, tenant.invoice_limit - currentCount);

  return {
    valid: true,
    tenant: { ...tenant, invoice_count: currentCount } as Tenant,
    quotaRemaining,
  };
}


export async function incrementInvoiceCount(tenantId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data } = await client
      .from("tenants")
      .select("invoice_count")
      .eq("id", tenantId)
      .single();

    if (data) {
      await client
        .from("tenants")
        .update({ invoice_count: (data.invoice_count || 0) + 1 })
        .eq("id", tenantId);
    }
  } catch (err) {
    console.warn("[incrementInvoiceCount] Gagal increment:", err);
  }
}


export async function registerTenant(
  input: RegisterTenantInput
): Promise<RegisterTenantResult> {
  const { store_name, owner_name, store_address, owner_email, contact_wa } = input;

  if (!store_name?.trim()) {
    return { success: false, error: "Nama toko wajib diisi" };
  }
  if (!owner_email?.trim() || !owner_email.includes("@")) {
    return { success: false, error: "Email tidak valid" };
  }

  const baseSlug = generateSlug(store_name);
  const baseCode = generateStoreCode(store_name);

  const [store_slug, store_code, sync_secret] = await Promise.all([
    resolveUniqueSlug(baseSlug),
    resolveUniqueStoreCode(baseCode),
    Promise.resolve(generateSyncSecret()),
  ]);

  const client = getSupabaseClient();

  if (!client) {
    return {
      success: true,
      tenant: {
        store_code,
        store_slug,
        store_name: store_name.trim(),
        owner_name: owner_name?.trim() || null,
        store_address: store_address?.trim() || null,
        plan: "free",
        sync_secret,
      },
    };
  }

  const { data, error } = await client
    .from("tenants")
    .insert({
      store_code,
      store_slug,
      store_name: store_name.trim(),
      owner_name: owner_name?.trim() || null,
      store_address: store_address?.trim() || null,
      owner_email: owner_email.trim().toLowerCase(),
      contact_wa: contact_wa?.replace(/\D/g, "") || null,
      sync_secret,
      plan: "free",
      invoice_count: 0,
      invoice_limit: Number(process.env.FREE_INVOICE_LIMIT) || 50,
      status: "active",
    })
    .select("store_code, store_slug, store_name, owner_name, store_address, plan")
    .single();

  if (error || !data) {
    console.error("[Register Tenant Error]", error);
    if (error?.code === "23505") {
      return { success: false, error: "Email atau nama toko sudah terdaftar. Coba dengan nama berbeda." };
    }
    return { success: false, error: "Gagal mendaftarkan toko. Coba lagi." };
  }

  return {
    success: true,
    tenant: {
      store_code: data.store_code,
      store_slug: data.store_slug,
      store_name: data.store_name,
      owner_name: data.owner_name,
      store_address: data.store_address,
      plan: data.plan,
      sync_secret,
    },
  };
}


export async function getTenantBySlug(slug: string): Promise<{
  store_code: string;
  store_slug: string;
  store_name: string;
  store_address: string | null;
} | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from("tenants")
    .select("store_code, store_slug, store_name, store_address")
    .eq("store_slug", slug)
    .eq("status", "active")
    .single();

  if (error || !data) return null;
  return data;
}
