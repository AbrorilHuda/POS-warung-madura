// ============================================================================
// app/types/tenant.ts — Type definitions untuk multi-tenant SaaS
// ============================================================================

export interface Tenant {
  id: string;
  store_code: string;
  store_slug: string;
  store_name: string;
  owner_name?: string | null;
  store_address: string | null;
  owner_email: string | null;
  contact_wa: string | null;
  sync_secret: string;
  plan: "free" | "pro";
  invoice_count: number;
  invoice_limit: number;
  status: "active" | "suspended" | "pending";
  last_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface TenantPublicInfo {
  store_code: string;
  store_slug: string;
  store_name: string;
  owner_name?: string | null;
  store_address: string | null;
  plan: "free" | "pro";
}

export interface RegisterTenantInput {
  store_name: string;
  owner_name?: string;
  store_address: string;
  owner_email: string;
  contact_wa: string;
}

export interface RegisterTenantResult {
  success: boolean;
  tenant?: TenantPublicInfo & {
    sync_secret: string;
    store_code: string;
  };
  error?: string;
}

export interface SyncValidationResult {
  valid: boolean;
  tenant?: Tenant;
  error?: string;
  errorCode?: "INVALID_SECRET" | "SUSPENDED" | "QUOTA_EXCEEDED";
  quotaRemaining?: number;
  resetDate?: string;
}
