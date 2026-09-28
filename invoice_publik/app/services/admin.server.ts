// ============================================================================
// app/services/admin.server.ts — Query data & aksi manajemen untuk admin panel
// ============================================================================
import { getSupabaseClient } from "./supabase.server";
import type { Tenant } from "../types/tenant";

export interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  proTenants: number;
  freeTenants: number;
  suspendedTenants: number;
  totalInvoicesToday: number;
  totalInvoicesThisMonth: number;
  estimatedMonthlyRevenue: number; // jumlah tenant Pro × 25000
}

export interface TenantRow extends Tenant {
  quotaUsedPercent: number;
  quotaRemaining: number;
}

/** Ambil semua tenant untuk tabel admin */
export async function getAllTenants(): Promise<TenantRow[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((t: Tenant) => ({
    ...t,
    quotaRemaining:
      t.plan === "pro" ? 999999 : Math.max(0, t.invoice_limit - t.invoice_count),
    quotaUsedPercent:
      t.plan === "pro" ? 0 : Math.min(100, Math.round((t.invoice_count / t.invoice_limit) * 100)),
  }));
}

/** Statistik dashboard admin */
export async function getAdminStats(): Promise<AdminStats> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      totalTenants: 0,
      activeTenants: 0,
      proTenants: 0,
      freeTenants: 0,
      suspendedTenants: 0,
      totalInvoicesToday: 0,
      totalInvoicesThisMonth: 0,
      estimatedMonthlyRevenue: 0,
    };
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [tenantsRes, todayInvRes, monthInvRes] = await Promise.all([
    client.from("tenants").select("plan, status"),
    client.from("invoices").select("id", { count: "exact", head: true }).gte("created_at", startOfToday),
    client.from("invoices").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
  ]);

  const tenants: Array<{ plan: string; status: string }> = tenantsRes.data || [];
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const proTenants = tenants.filter((t) => t.plan === "pro").length;
  const freeTenants = tenants.filter((t) => t.plan === "free").length;
  const suspendedTenants = tenants.filter((t) => t.status === "suspended").length;

  const proPrice = Number(process.env.PRO_PLAN_PRICE || 25000);

  return {
    totalTenants,
    activeTenants,
    proTenants,
    freeTenants,
    suspendedTenants,
    totalInvoicesToday: todayInvRes.count || 0,
    totalInvoicesThisMonth: monthInvRes.count || 0,
    estimatedMonthlyRevenue: proTenants * proPrice,
  };
}

/** Upgrade toko dari free ke pro */
export async function upgradeTenantToPro(
  tenantId: string
): Promise<{ success: boolean; error?: string; storeName?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Supabase tidak terhubung" };

  const { data, error } = await client
    .from("tenants")
    .update({
      plan: "pro",
      invoice_limit: 999999,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId)
    .select("store_name, store_code")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, storeName: data?.store_name };
}

/** Downgrade toko dari pro ke free */
export async function downgradeTenantToFree(
  tenantId: string
): Promise<{ success: boolean; error?: string; storeName?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Supabase tidak terhubung" };

  const freeLimit = Number(process.env.FREE_INVOICE_LIMIT || 50);

  const { data, error } = await client
    .from("tenants")
    .update({
      plan: "free",
      invoice_limit: freeLimit,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId)
    .select("store_name, store_code")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, storeName: data?.store_name };
}

/** Ubah status toko: active ↔ suspended */
export async function setTenantStatus(
  tenantId: string,
  status: "active" | "suspended"
): Promise<{ success: boolean; error?: string; storeName?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Supabase tidak terhubung" };

  const { data, error } = await client
    .from("tenants")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", tenantId)
    .select("store_name, store_code")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, storeName: data?.store_name };
}

/** Reset kuota invoice_count ke 0 untuk toko tertentu */
export async function resetTenantQuota(
  tenantId: string
): Promise<{ success: boolean; error?: string; storeName?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Supabase tidak terhubung" };

  const { data, error } = await client
    .from("tenants")
    .update({
      invoice_count: 0,
      last_reset_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId)
    .select("store_name, store_code")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, storeName: data?.store_name };
}

/**
 * Reset SEMUA kuota toko ke 0 (biasanya dipakai awal bulan baru)
 */
export async function resetAllTenantsQuota(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) return { success: false, count: 0, error: "Supabase tidak terhubung" };

  const { data, error } = await client
    .from("tenants")
    .update({
      invoice_count: 0,
      last_reset_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .neq("id", "00000000-0000-0000-0000-000000000000") // update semua baris
    .select("id");

  if (error) return { success: false, count: 0, error: error.message };
  return { success: true, count: data?.length || 0 };
}

/**
 * Hapus toko permanen beserta invoice terkait dari Supabase
 */
export async function deleteTenant(
  tenantId: string
): Promise<{ success: boolean; error?: string; storeName?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Supabase tidak terhubung" };

  // 1. Ambil data tenant terlebih dahulu
  const { data: tenant, error: fetchErr } = await client
    .from("tenants")
    .select("id, store_name, store_code, store_slug")
    .eq("id", tenantId)
    .single();

  if (fetchErr || !tenant) {
    return { success: false, error: "Toko tidak ditemukan di database" };
  }

  // 2. Hapus invoice yang terhubung dengan store_slug jika ada
  if (tenant.store_slug) {
    const { data: invoices } = await client
      .from("invoices")
      .select("id")
      .eq("store_slug", tenant.store_slug);

    if (invoices && invoices.length > 0) {
      const invIds = invoices.map((inv) => inv.id);
      await client.from("invoices").delete().in("id", invIds);
    }
  }

  // 3. Hapus baris tenant dari tabel tenants
  const { error: delErr } = await client
    .from("tenants")
    .delete()
    .eq("id", tenantId);

  if (delErr) {
    return { success: false, error: delErr.message };
  }

  return { success: true, storeName: tenant.store_name };
}
