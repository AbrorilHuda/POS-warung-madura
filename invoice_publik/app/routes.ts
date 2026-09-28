import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Halaman utama / landing page platform
  index("routes/home.tsx"),

  // Halaman daftar toko baru (SaaS onboarding)
  route("daftar", "routes/daftar.tsx"),

  // Admin panel
  route("admin", "routes/admin._index.tsx"),
  route("admin/login", "routes/admin.login.tsx"),

  // Halaman invoice publik per toko: /{store_slug}/invoice/{invoiceCode}
  route(":storeSlug/invoice/:invoiceCode", "routes/$storeSlug.invoice.$invoiceCode.tsx"),

  // Redirect backward compat: /invoice/:code → cari toko otomatis
  route("invoice/:invoiceCode", "routes/invoice.$invoiceCode.tsx"),

  // API sync (multi-tenant)
  route("api/sync", "routes/api.sync.ts"),
] satisfies RouteConfig;

