import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, redirect } from "react-router";
import { Lock, Mail, Store, Loader2, ShieldCheck, ArrowRight, Shield } from "lucide-react";
import {
  authenticateAdminWithSupabase,
  createAdminSession,
  getAdminSession,
} from "../services/admin-session.server";

export const meta: MetaFunction = () => [
  { title: "Admin Login — POS Warung SaaS" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const isLoggedOut = url.searchParams.get("logout") === "1";
  if (isLoggedOut) {
    return { loggedOut: true };
  }
  const session = await getAdminSession(request);
  if (session.get("adminLoggedIn")) {
    return redirect("/admin");
  }
  return { loggedOut: false };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const redirectTo = String(formData.get("redirectTo") || "/admin");

  if (!password) {
    return { error: "Password wajib diisi." };
  }

  const defaultEmail = process.env.ADMIN_EMAIL || "admin@poswarung.com";
  const loginEmail = email || defaultEmail;

  const authRes = await authenticateAdminWithSupabase(loginEmail, password);

  if (!authRes.success || !authRes.user) {
    return { error: authRes.error || "Email atau password admin salah." };
  }

  return createAdminSession(redirectTo, authRes.user, authRes.accessToken);
}

export default function AdminLoginPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const defaultEmail = "admin@poswarung.com";

  // Baca redirect param dari URL
  const redirectTo =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("redirect") || "/admin"
      : "/admin";

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Logo / Icon */}
        <div style={s.iconWrap}>
          <Store size={26} color="#f97316" />
        </div>

        <div style={s.badge}>
          <Shield size={12} color="#10b981" />
          <span>Supabase Auth Protected</span>
        </div>

        <h1 style={s.title}>Admin POS Warung</h1>
        <p style={s.subtitle}>Masuk ke panel manajemen tenant &amp; struk cloud</p>

        {loaderData?.loggedOut && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 12,
              padding: "10px 14px",
              color: "#34d399",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            ✓ Anda telah berhasil keluar dari akun admin.
          </div>
        )}

        {actionData?.error && (
          <div style={s.errorBox}>⚠️ {actionData.error}</div>
        )}

        <Form method="post" style={s.form}>
          <input type="hidden" name="redirectTo" value={redirectTo} />

          {/* Email Field */}
          <div style={s.fieldGroup}>
            <label style={s.label} htmlFor="email">Email Admin</label>
            <div style={s.fieldWrap}>
              <Mail size={16} color="#94a3b8" style={s.icon} />
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={defaultEmail}
                placeholder="admin@poswarung.com"
                required
                style={s.input}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={s.fieldGroup}>
            <label style={s.label} htmlFor="password">Password Admin</label>
            <div style={s.fieldWrap}>
              <Lock size={16} color="#94a3b8" style={s.icon} />
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                style={s.input}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              ...s.btn,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Dashboard</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </Form>

        <div style={s.footerInfo}>
          <ShieldCheck size={14} color="#10b981" />
          <span>Sesi terenkripsi &amp; diverifikasi via Supabase Auth</span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input:focus { outline: none; border-color: #f97316 !important; box-shadow: 0 0 0 3px rgba(249,115,22,0.2) !important; }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: "20px",
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 24,
    padding: "40px 32px",
    width: "100%",
    maxWidth: 400,
    textAlign: "center",
    boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    background: "rgba(249, 115, 22, 0.12)",
    border: "1px solid rgba(249, 115, 22, 0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    boxShadow: "0 4px 12px rgba(249, 115, 22, 0.15)",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 11,
    fontWeight: 700,
    color: "#34d399",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: "#f8fafc",
    margin: "0 0 6px",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    margin: "0 0 24px",
    lineHeight: 1.5,
  },
  errorBox: {
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
    padding: "10px 14px",
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 20,
    textAlign: "left",
  },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6, textAlign: "left" },
  label: { fontSize: 12, fontWeight: 700, color: "#cbd5e1" },
  fieldWrap: { position: "relative" },
  icon: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "12px 14px 12px 42px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 12,
    color: "#f8fafc",
    fontSize: 14,
    transition: "all 0.15s ease",
  },
  btn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: "13px",
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    marginTop: 8,
    boxShadow: "0 4px 14px rgba(234, 88, 12, 0.3)",
    transition: "opacity 0.2s, transform 0.1s",
  },
  footerInfo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 11,
    color: "#64748b",
    marginTop: 24,
  },
};
