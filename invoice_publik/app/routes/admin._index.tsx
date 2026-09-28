import { useState, useEffect, useCallback, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useActionData, useFetcher, Form, Link } from "react-router";
import {
  Store,
  Users,
  Receipt,
  TrendingUp,
  Crown,
  ShieldOff,
  ShieldCheck,
  LogOut,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Loader2,
  Trash2,
  Search,
  Zap,
  Phone,
  ExternalLink,
} from "lucide-react";
import {
  requireAdminAuth,
  destroyAdminSession,
} from "../services/admin-session.server";
import {
  getAllTenants,
  getAdminStats,
  upgradeTenantToPro,
  downgradeTenantToFree,
  setTenantStatus,
  resetTenantQuota,
  resetAllTenantsQuota,
  deleteTenant,
} from "../services/admin.server";
import type { TenantRow } from "../services/admin.server";

export const meta: MetaFunction = () => [
  { title: "Admin Dashboard — POS Warung SaaS" },
];

// ─────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────
export async function loader({ request }: LoaderFunctionArgs) {
  const auth = await requireAdminAuth(request);
  const [tenants, stats] = await Promise.all([getAllTenants(), getAdminStats()]);
  return {
    tenants,
    stats,
    adminEmail: auth.email,
    isSupabaseAuth: auth.isSupabaseAuth,
  };
}

// ─────────────────────────────────────────────────────────────
// Action — handle semua aksi admin (Reset, Hapus, Upgrade, dll)
// ─────────────────────────────────────────────────────────────
export async function action({ request }: ActionFunctionArgs) {
  await requireAdminAuth(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const tenantId = String(formData.get("tenantId") || "");

  if (intent === "logout") {
    return destroyAdminSession(request);
  }

  // 1. Reset SEMUA kuota toko (Bulk Reset)
  if (intent === "reset_all_quotas") {
    const res = await resetAllTenantsQuota();
    if (res.success) {
      return {
        ok: true,
        message: `Berhasil mereset kuota transaksi untuk seluruh toko (${res.count} toko di-reset ke 0).`,
        intent,
      };
    }
    return { ok: false, error: res.error || "Gagal mereset semua kuota.", intent };
  }

  // Aksi yang membutuhkan tenantId spesifik
  if (!tenantId) {
    return { ok: false, error: "ID toko tidak ditemukan.", intent };
  }

  // 2. Hapus Toko Permanen
  if (intent === "delete_tenant") {
    const res = await deleteTenant(tenantId);
    if (res.success) {
      return {
        ok: true,
        message: `Toko "${res.storeName || tenantId}" berhasil dihapus dari platform cloud.`,
        intent,
        tenantId,
      };
    }
    return { ok: false, error: res.error || "Gagal menghapus toko.", intent, tenantId };
  }

  // 3. Reset Kuota Toko Tertentu
  if (intent === "reset_quota") {
    const res = await resetTenantQuota(tenantId);
    if (res.success) {
      return {
        ok: true,
        message: `Kuota toko "${res.storeName || tenantId}" berhasil di-reset kembali ke 0.`,
        intent,
        tenantId,
      };
    }
    return { ok: false, error: res.error || "Gagal mereset kuota toko.", intent, tenantId };
  }

  // 4. Upgrade ke Pro
  if (intent === "upgrade") {
    const res = await upgradeTenantToPro(tenantId);
    if (res.success) {
      return {
        ok: true,
        message: `Toko "${res.storeName || tenantId}" berhasil di-upgrade ke Paket Pro (Unlimited).`,
        intent,
        tenantId,
      };
    }
    return { ok: false, error: res.error || "Gagal upgrade toko ke Pro.", intent, tenantId };
  }

  // 5. Downgrade ke Free
  if (intent === "downgrade") {
    const res = await downgradeTenantToFree(tenantId);
    if (res.success) {
      return {
        ok: true,
        message: `Toko "${res.storeName || tenantId}" dikembalikan ke Paket Free (50 Struk/Bulan).`,
        intent,
        tenantId,
      };
    }
    return { ok: false, error: res.error || "Gagal downgrade toko ke Free.", intent, tenantId };
  }

  // 6. Suspend Toko
  if (intent === "suspend") {
    const res = await setTenantStatus(tenantId, "suspended");
    if (res.success) {
      return {
        ok: true,
        message: `Toko "${res.storeName || tenantId}" berhasil di-suspend (sinkronisasi struk dihentikan).`,
        intent,
        tenantId,
      };
    }
    return { ok: false, error: res.error || "Gagal suspend toko.", intent, tenantId };
  }

  // 7. Aktifkan Toko
  if (intent === "activate") {
    const res = await setTenantStatus(tenantId, "active");
    if (res.success) {
      return {
        ok: true,
        message: `Toko "${res.storeName || tenantId}" berhasil diaktifkan kembali.`,
        intent,
        tenantId,
      };
    }
    return { ok: false, error: res.error || "Gagal mengaktifkan toko.", intent, tenantId };
  }

  return { ok: false, error: `Aksi tidak dikenal: ${intent}`, intent };
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Helper Deterministic Date Formatter
// ─────────────────────────────────────────────────────────────
function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return String(isoString).split("T")[0] || String(isoString);
  }
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { tenants, stats, adminEmail, isSupabaseAuth } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const resetAllFetcher = useFetcher();
  const isResettingAll = resetAllFetcher.state !== "idle";

  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState<"all" | "free" | "pro">("all");

  const showToast = useCallback((ok: boolean, message: string) => {
    setToast({ ok, message });
  }, []);

  // Toast listener for actionData
  useEffect(() => {
    if (actionData) {
      setToast({
        ok: actionData.ok,
        message: actionData.ok
          ? actionData.message || "Aksi berhasil diproses!"
          : actionData.error || "Gagal memproses aksi.",
      });
    }
  }, [actionData]);

  // Toast listener for resetAllFetcher
  useEffect(() => {
    if (resetAllFetcher.data) {
      const data = resetAllFetcher.data as any;
      setToast({
        ok: data.ok,
        message: data.ok ? data.message : data.error || "Gagal mereset semua kuota.",
      });
    }
  }, [resetAllFetcher.data]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const filteredTenants = tenants.filter((t) => {
    const matchQuery =
      t.store_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.store_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.store_slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPlan = filterPlan === "all" || t.plan === filterPlan;
    return matchQuery && matchPlan;
  });

  const proPrice = 25000;

  return (
    <div style={s.page}>
      {/* Sidebar Admin */}
      <aside style={s.sidebar}>
        <div>
          <div style={s.sidebarLogo}>
            <Store size={22} color="#f97316" />
            <span>POS Warung <strong style={{ color: "#f97316" }}>Admin</strong></span>
          </div>

          <div style={s.adminProfile}>
            <div style={s.adminAvatar}>
              {adminEmail.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={s.adminEmail} title={adminEmail}>{adminEmail}</div>
              <div style={s.adminRoleBadge}>
                {isSupabaseAuth ? "Supabase Auth" : "Super Admin"}
              </div>
            </div>
          </div>

          <nav style={s.nav}>
            <div style={s.navItemActive}>
              <Users size={16} />
              <span>Manajemen Toko</span>
            </div>
            <a href="/" target="_blank" rel="noopener noreferrer" style={s.navItem}>
              <ExternalLink size={16} />
              <span>Landing Page SaaS</span>
            </a>
            <a href="/daftar" target="_blank" rel="noopener noreferrer" style={s.navItem}>
              <Store size={16} />
              <span>Formulir Daftar</span>
            </a>
          </nav>
        </div>

        <div style={s.sidebarBottom}>
          <Form method="post" action="/admin" reloadDocument>
            <input type="hidden" name="intent" value="logout" />
            <button type="submit" style={s.logoutBtn}>
              <LogOut size={15} /> Keluar Admin
            </button>
          </Form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={s.main}>
        {/* Header Bar */}
        <div style={s.header}>
          <div>
            <h1 style={s.headerTitle}>Dashboard Manajemen Tenant</h1>
            <p style={s.headerSub}>
              Kelola status toko, paket Pro/Free, reset kuota bulanan, dan hapus toko testing.
            </p>
          </div>

          <div style={s.headerActions}>
            {/* Tombol Reset Semua Kuota */}
            <resetAllFetcher.Form
              method="post"
              action="/admin"
              onSubmit={(e) => {
                if (
                  !confirm(
                    "⚠️ YAKIN INGIN MERESET SEMUA KUOTA TOKO?\n\nSemua hitungan pemakaian invoice toko di database akan di-reset kembali ke 0 (biasanya dilakukan awal bulan baru)."
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="reset_all_quotas" />
              <button
                type="submit"
                disabled={isResettingAll}
                style={{
                  ...s.bulkResetBtn,
                  opacity: isResettingAll ? 0.7 : 1,
                  cursor: isResettingAll ? "not-allowed" : "pointer",
                }}
                title="Reset kuota semua toko kembali ke 0"
              >
                {isResettingAll ? (
                  <>
                    <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                    <span>Mereset Semua...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={15} />
                    <span>Reset Semua Kuota</span>
                  </>
                )}
              </button>
            </resetAllFetcher.Form>

            <div style={s.authStatusBadge}>
              <ShieldCheck size={14} color="#10b981" />
              <span>Supabase Auth</span>
            </div>
          </div>
        </div>

        {/* Toast Notifikasi Feedback */}
        {toast && (
          <div
            style={{
              ...s.toast,
              background: toast.ok ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
              borderColor: toast.ok ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
              color: toast.ok ? "#34d399" : "#fca5a5",
            }}
          >
            {toast.ok ? (
              <>
                <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                <span>{toast.message}</span>
              </>
            ) : (
              <>
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{toast.message}</span>
              </>
            )}
          </div>
        )}

        {/* Stats KPI Grid */}
        <div style={s.statsGrid}>
          <StatCard
            icon={<Users size={20} color="#60a5fa" />}
            label="Total Toko Terdaftar"
            value={stats.totalTenants}
            sub={`${stats.activeTenants} toko aktif`}
            color="#60a5fa"
          />
          <StatCard
            icon={<Crown size={20} color="#f59e0b" />}
            label="Toko Paket Pro"
            value={stats.proTenants}
            sub={`Rp ${(stats.estimatedMonthlyRevenue).toLocaleString("id-ID")}/bln`}
            color="#f59e0b"
          />
          <StatCard
            icon={<Store size={20} color="#a78bfa" />}
            label="Toko Paket Free"
            value={stats.freeTenants}
            sub={`${stats.suspendedTenants} toko suspended`}
            color="#a78bfa"
          />
          <StatCard
            icon={<Receipt size={20} color="#34d399" />}
            label="Invoice Hari Ini"
            value={stats.totalInvoicesToday}
            sub={`${stats.totalInvoicesThisMonth} bulan ini`}
            color="#34d399"
          />
          <StatCard
            icon={<TrendingUp size={20} color="#f97316" />}
            label="Estimasi Revenue Langganan"
            value={`Rp ${stats.estimatedMonthlyRevenue.toLocaleString("id-ID")}`}
            sub={`${stats.proTenants} toko Pro × Rp ${proPrice.toLocaleString("id-ID")}`}
            color="#f97316"
            wide
          />
        </div>

        {/* Toolbar & Filter Tabel */}
        <div style={s.tableToolbar}>
          <div style={s.searchWrap}>
            <Search size={15} color="#64748b" style={s.searchIcon} />
            <input
              type="text"
              placeholder="Cari nama toko, kode prefix, atau slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={s.searchInput}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setFilterPlan("all")}
              style={filterPlan === "all" ? s.filterBtnActive : s.filterBtn}
            >
              Semua ({tenants.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPlan("pro")}
              style={filterPlan === "pro" ? s.filterBtnActive : s.filterBtn}
            >
              Pro ({stats.proTenants})
            </button>
            <button
              type="button"
              onClick={() => setFilterPlan("free")}
              style={filterPlan === "free" ? s.filterBtnActive : s.filterBtn}
            >
              Free ({stats.freeTenants})
            </button>
          </div>
        </div>

        {/* Tabel Data Tenant */}
        <div style={s.tableCard}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Toko / Warung</th>
                <th style={s.th}>Kode Prefix</th>
                <th style={s.th}>Paket</th>
                <th style={s.th}>Penggunaan Kuota</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Terdaftar</th>
                <th style={{ ...s.th, textAlign: "right" }}>Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} style={s.emptyTd}>
                    <Store size={32} color="#475569" style={{ margin: "0 auto 8px" }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Tidak ada toko yang cocok.</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                      Gunakan kata kunci lain atau daftarkan toko baru di /daftar.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <TenantRowItem
                    key={t.id}
                    tenant={t}
                    onFeedback={showToast}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-Komponen: Baris Tenant dengan Aksi Hapus & Reset
// ─────────────────────────────────────────────────────────────
function TenantRowItem({
  tenant: t,
  onFeedback,
}: {
  tenant: TenantRow;
  onFeedback: (ok: boolean, message: string) => void;
}) {
  const fetcher = useFetcher();
  const isBusy = fetcher.state !== "idle";
  const submittingIntent = fetcher.formData?.get("intent");

  const isPro = t.plan === "pro";
  const isSuspended = t.status === "suspended";
  const quotaPercent = t.quotaUsedPercent;

  const lastDataRef = useRef<any>(null);
  useEffect(() => {
    if (fetcher.data && fetcher.data !== lastDataRef.current) {
      lastDataRef.current = fetcher.data;
      const data = fetcher.data as any;
      onFeedback(
        Boolean(data.ok),
        data.ok ? data.message || "Aksi berhasil diproses!" : data.error || "Gagal memproses aksi."
      );
    }
  }, [fetcher.data, onFeedback]);

  return (
    <tr style={{ transition: "background 0.15s" }}>
      {/* Nama Toko */}
      <td style={s.td}>
        <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>
          {t.store_name}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          /{t.store_slug}
        </div>
      </td>

      {/* Kode */}
      <td style={s.td}>
        <span style={s.codeBadge}>{t.store_code}</span>
      </td>

      {/* Plan */}
      <td style={s.td}>
        <span
          style={{
            ...s.planBadge,
            background: isPro ? "rgba(245, 158, 11, 0.15)" : "rgba(148, 163, 184, 0.1)",
            color: isPro ? "#f59e0b" : "#94a3b8",
            border: `1px solid ${isPro ? "rgba(245, 158, 11, 0.3)" : "rgba(148, 163, 184, 0.2)"}`,
          }}
        >
          {isPro ? <Crown size={12} /> : <Store size={12} />}
          <span>{isPro ? "Pro Unlimited" : "Free Tier"}</span>
        </span>
      </td>

      {/* Kuota */}
      <td style={s.td}>
        {isPro ? (
          <span style={{ fontSize: 12, color: "#34d399", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Zap size={13} /> Unlimited (∞)
          </span>
        ) : (
          <div style={{ minWidth: 140 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: "#94a3b8", fontWeight: 600 }}>
                {t.invoice_count} / {t.invoice_limit}
              </span>
              <span style={{ color: quotaPercent >= 80 ? "#f87171" : "#94a3b8", fontWeight: 700 }}>
                {quotaPercent}%
              </span>
            </div>
            <div style={s.progressBg}>
              <div
                style={{
                  ...s.progressBar,
                  width: `${quotaPercent}%`,
                  background: quotaPercent >= 80 ? "#ef4444" : quotaPercent >= 50 ? "#f59e0b" : "#22c55e",
                }}
              />
            </div>
          </div>
        )}
      </td>

      {/* Status */}
      <td style={s.td}>
        <span
          style={{
            ...s.statusBadge,
            background: isSuspended ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
            color: isSuspended ? "#f87171" : "#34d399",
            border: `1px solid ${isSuspended ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
          }}
        >
          {isSuspended ? <ShieldOff size={11} /> : <ShieldCheck size={11} />}
          <span>{isSuspended ? "Suspended" : "Aktif"}</span>
        </span>
      </td>

      {/* Terdaftar */}
      <td style={s.td}>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {formatDate(t.created_at)}
        </span>
      </td>

      {/* Aksi Manajemen */}
      <td style={{ ...s.td, textAlign: "right" }}>
        <div style={{ ...s.actionGroup, justifyContent: "flex-end" }}>
          {/* Upgrade / Downgrade */}
          <fetcher.Form method="post" action="/admin" style={{ display: "inline" }}>
            <input type="hidden" name="intent" value={isPro ? "downgrade" : "upgrade"} />
            <input type="hidden" name="tenantId" value={t.id} />
            <button
              type="submit"
              disabled={isBusy}
              title={isPro ? "Kembalikan ke Paket Free (50 Struk/Bln)" : "Upgrade ke Paket Pro (Unlimited)"}
              style={{
                ...s.actionBtn,
                background: isPro ? "rgba(148, 163, 184, 0.1)" : "rgba(245, 158, 11, 0.15)",
                color: isPro ? "#94a3b8" : "#f59e0b",
                border: `1px solid ${isPro ? "rgba(148, 163, 184, 0.2)" : "rgba(245, 158, 11, 0.3)"}`,
                opacity: isBusy ? 0.6 : 1,
                cursor: isBusy ? "not-allowed" : "pointer",
              }}
            >
              {isBusy && submittingIntent === (isPro ? "downgrade" : "upgrade") ? (
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              ) : isPro ? (
                <ArrowUpRight size={13} style={{ transform: "rotate(180deg)" }} />
              ) : (
                <Crown size={13} />
              )}
              <span>{isPro ? "Free" : "Pro"}</span>
            </button>
          </fetcher.Form>

          {/* Suspend / Aktifkan */}
          <fetcher.Form
            method="post"
            action="/admin"
            style={{ display: "inline" }}
            onSubmit={(e) => {
              const confirmMsg = isSuspended
                ? `Aktifkan kembali toko "${t.store_name}"?`
                : `Suspend toko "${t.store_name}"? Sinkronisasi struk cloud toko ini akan dinonaktifkan sementara.`;
              if (!confirm(confirmMsg)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value={isSuspended ? "activate" : "suspend"} />
            <input type="hidden" name="tenantId" value={t.id} />
            <button
              type="submit"
              disabled={isBusy}
              title={isSuspended ? "Aktifkan kembali toko ini" : "Suspend toko ini"}
              style={{
                ...s.actionBtn,
                background: isSuspended ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                color: isSuspended ? "#4ade80" : "#f87171",
                border: `1px solid ${isSuspended ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                opacity: isBusy ? 0.6 : 1,
                cursor: isBusy ? "not-allowed" : "pointer",
              }}
            >
              {isBusy && submittingIntent === (isSuspended ? "activate" : "suspend") ? (
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              ) : isSuspended ? (
                <ShieldCheck size={13} />
              ) : (
                <ShieldOff size={13} />
              )}
              <span>{isSuspended ? "Aktifkan" : "Suspend"}</span>
            </button>
          </fetcher.Form>

          {/* Reset Kuota Toko Tertentu */}
          <fetcher.Form
            method="post"
            action="/admin"
            style={{ display: "inline" }}
            onSubmit={(e) => {
              if (!confirm(`Reset kuota pemakaian invoice untuk toko "${t.store_name}" kembali ke 0?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="reset_quota" />
            <input type="hidden" name="tenantId" value={t.id} />
            <button
              type="submit"
              disabled={isBusy}
              title="Reset kuota toko ini ke 0"
              style={{
                ...s.actionBtn,
                background: "rgba(96, 165, 250, 0.12)",
                color: "#60a5fa",
                border: "1px solid rgba(96, 165, 250, 0.25)",
                opacity: isBusy ? 0.6 : 1,
                cursor: isBusy ? "not-allowed" : "pointer",
              }}
            >
              {isBusy && submittingIntent === "reset_quota" ? (
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <RotateCcw size={13} />
              )}
              <span>Reset</span>
            </button>
          </fetcher.Form>

          {/* Hapus Toko (Delete Tenant) */}
          <fetcher.Form
            method="post"
            action="/admin"
            style={{ display: "inline" }}
            onSubmit={(e) => {
              if (
                !confirm(
                  `⚠️ PERINGATAN HAPUS TOKO:\n\nYakin ingin menghapus toko "${t.store_name}" (${t.store_code}) secara permanen?\nSemua riwayat struk publik cloud toko ini akan dihapus.`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="delete_tenant" />
            <input type="hidden" name="tenantId" value={t.id} />
            <button
              type="submit"
              disabled={isBusy}
              title="Hapus toko permanen dari cloud"
              style={{
                ...s.actionBtn,
                background: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                opacity: isBusy ? 0.6 : 1,
                cursor: isBusy ? "not-allowed" : "pointer",
              }}
            >
              {isBusy && submittingIntent === "delete_tenant" ? (
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Trash2 size={13} />
              )}
              <span>Hapus</span>
            </button>
          </fetcher.Form>

          {/* WA Pemilik */}
          {t.contact_wa && (
            <a
              href={`https://wa.me/${t.contact_wa}?text=Halo, perihal toko ${t.store_name} (${t.store_code})`}
              target="_blank"
              rel="noopener noreferrer"
              title="Hubungi pemilik via WhatsApp"
              style={{
                ...s.actionBtn,
                background: "rgba(37, 211, 102, 0.12)",
                color: "#25d366",
                border: "1px solid rgba(37, 211, 102, 0.25)",
                textDecoration: "none",
              }}
            >
              <Phone size={12} />
              <span>WA</span>
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  color: string;
  wide?: boolean;
}) {
  return (
    <div style={{ ...s.statCard, gridColumn: wide ? "span 2" : "span 1" }}>
      <div style={{ ...s.statIcon, background: `${color}20`, border: `1px solid ${color}30` }}>
        {icon}
      </div>
      <div>
        <p style={s.statLabel}>{label}</p>
        <p style={{ ...s.statValue, color }}>{value}</p>
        <p style={s.statSub}>{sub}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#090d16",
    display: "flex",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#f8fafc",
  },
  sidebar: {
    width: 260,
    background: "#0f172a",
    borderRight: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "24px 18px",
    position: "sticky",
    top: 0,
    height: "100vh",
    flexShrink: 0,
  },
  sidebarLogo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 16,
    fontWeight: 800,
    color: "#f8fafc",
    marginBottom: 24,
    padding: "0 6px",
  },
  adminProfile: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 14,
    padding: "10px 12px",
    marginBottom: 24,
  },
  adminAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 12,
    flexShrink: 0,
  },
  adminEmail: {
    fontSize: 12,
    fontWeight: 700,
    color: "#f1f5f9",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  adminRoleBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "#10b981",
    marginTop: 2,
  },
  nav: { display: "flex", flexDirection: "column", gap: 6 },
  navItemActive: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 12,
    background: "#f97316",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 700,
    cursor: "default",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 12,
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    transition: "all 0.15s",
  },
  sidebarBottom: { borderTop: "1px solid #1e293b", paddingTop: 16 },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "10px 14px",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: 10,
    color: "#f87171",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.15s",
  },

  main: { flex: 1, padding: "28px 36px", overflowY: "auto", minWidth: 0 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
    flexWrap: "wrap",
    gap: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: 900, color: "#f8fafc", margin: "0 0 4px" },
  headerSub: { fontSize: 13, color: "#64748b", margin: 0 },
  headerActions: { display: "flex", alignItems: "center", gap: 12 },
  bulkResetBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 16px",
    background: "rgba(96, 165, 250, 0.15)",
    border: "1px solid rgba(96, 165, 250, 0.35)",
    borderRadius: 10,
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.15s",
  },
  authStatusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    borderRadius: 10,
    padding: "9px 14px",
    fontSize: 12,
    fontWeight: 700,
    color: "#34d399",
  },

  toast: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 18px",
    borderRadius: 14,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 24,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 18,
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statLabel: { fontSize: 12, color: "#64748b", margin: 0, fontWeight: 600 },
  statValue: { fontSize: 22, fontWeight: 900, margin: "4px 0 2px" },
  statSub: { fontSize: 11, color: "#94a3b8", margin: 0 },

  tableToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  searchWrap: { position: "relative", width: 340 },
  searchIcon: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" },
  searchInput: {
    width: "100%",
    padding: "10px 14px 10px 38px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    color: "#f8fafc",
    fontSize: 13,
  },
  filterBtn: {
    padding: "8px 14px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 10,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  filterBtnActive: {
    padding: "8px 14px",
    background: "#f97316",
    border: "1px solid #f97316",
    borderRadius: 10,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },

  tableCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 20,
    overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  th: {
    padding: "14px 18px",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    background: "#090d16",
    borderBottom: "1px solid #1e293b",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "16px 18px",
    borderBottom: "1px solid #1e293b",
    verticalAlign: "middle",
    fontSize: 13,
  },
  emptyTd: { padding: "48px 24px", textAlign: "center", color: "#94a3b8" },
  codeBadge: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "4px 10px",
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: 800,
    color: "#e2e8f0",
  },
  planBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 800,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 12px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 700,
  },
  progressBg: {
    background: "#1e293b",
    borderRadius: 99,
    height: 6,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 99,
    transition: "width 0.3s",
  },
  actionGroup: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  actionBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "opacity 0.15s, transform 0.05s",
  },
};
