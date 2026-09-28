/**
 * Route: /:storeSlug/invoice/:invoiceCode
 *
 * Format URL baru untuk multi-tenant.
 * Contoh: /warung-madura-berkah/invoice/WM01-000123
 *
 * Re-export semua dari route invoice.$invoiceCode.tsx agar
 * UI dan logika tidak duplikat.
 */
import type { LoaderFunctionArgs } from "react-router";
import { queryInvoiceWithStatus, isSupabaseConnected } from "../services/supabase.server";
import { getTenantBySlug } from "../services/tenant.server";

export { meta, default } from "./invoice.$invoiceCode";

export async function loader({ params }: LoaderFunctionArgs) {
  const storeSlug = params.storeSlug || "";
  const invoiceCode = params.invoiceCode || "";

  const [queryResult, tenant] = await Promise.all([
    queryInvoiceWithStatus(invoiceCode),
    getTenantBySlug(storeSlug),
  ]);

  const supabaseConnected = isSupabaseConnected();

  return {
    invoice: queryResult.invoice,
    status: queryResult.status,
    message: queryResult.message,
    retentionHours: queryResult.retentionHours,
    invoiceCode,
    supabaseConnected,
    // Info toko dari tenant (untuk future branding)
    storeName: tenant?.store_name ?? queryResult.invoice?.storeName ?? null,
    storeSlug,
  };
}
