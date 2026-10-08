import { useState } from "react";
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, useActionData, useNavigation } from "react-router";
import {
  Store,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Receipt,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Key,
  Sparkles,
  Laptop,
  CheckCircle,
  ExternalLink,
  HelpCircle,
  ShieldCheck,
  Layers,
  Star,
  MessageCircle,
  BadgeCheck,
  Lock,
  Clock,
  ArrowDown,
  CheckSquare,
  Square,
  Sparkle,
  Menu,
  X,
  AlertTriangle,
  PartyPopper,
  ArrowLeft,
  Download,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { registerTenant } from "../services/tenant.server";
import { sendCredentialEmail } from "../services/email.server";

// URL Resmi Download Aplikasi Kasir Desktop POS Warung Madura (GitHub Releases)
const POS_DOWNLOAD_URL = "https://github.com/AbrorilHuda/POS-warung-madura/releases";

// Global Responsive CSS Component
function ResponsiveStyles() {
  return (
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeInDown {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      input:focus {
        outline: none;
        border-color: #ea580c !important;
        box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.15) !important;
      }
      a { text-decoration: none; color: inherit; }
      button { background: none; border: none; font-family: inherit; }

      /* Desktop vs Mobile Nav */
      .mobile-nav-actions { display: none !important; }
      .mobile-menu-drawer { display: none; }

      /* Tablet & Mobile Styles (< 960px) */
      @media (max-width: 960px) {
        .hero-grid {
          grid-template-columns: 1fr !important;
          gap: 36px !important;
        }
        .form-layout-grid {
          grid-template-columns: 1fr !important;
          gap: 28px !important;
        }
      }

      /* Mobile Screens (< 768px) */
      @media (max-width: 768px) {
        .desktop-nav {
          display: none !important;
        }
        .mobile-nav-actions {
          display: flex !important;
        }
        .mobile-menu-drawer {
          display: flex !important;
          position: absolute;
          top: 68px;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid #e2e8f0;
          padding: 14px 18px 20px;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.08);
          animation: fadeInDown 0.2s ease-out;
          z-index: 70;
        }
        .mobile-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          background: #f8fafc;
          text-align: left;
          width: 100%;
          cursor: pointer;
          transition: background 0.15s;
        }
        .mobile-menu-item:active {
          background: #f1f5f9;
        }
        .hero-section {
          padding: 92px 16px 44px !important;
        }
        .hero-title {
          font-size: 27px !important;
          line-height: 1.25 !important;
        }
        .hero-subtitle {
          font-size: 14px !important;
        }
        .hero-action-row {
          flex-direction: column !important;
          width: 100% !important;
          gap: 10px !important;
        }
        .hero-action-row > button {
          width: 100% !important;
          justify-content: center !important;
          padding: 13px 20px !important;
        }
        .form-card {
          padding: 24px 16px !important;
          border-radius: 20px !important;
        }
        .form-header-title {
          font-size: 18px !important;
        }
        .text-input {
          font-size: 16px !important; /* Mencegah auto-zoom di iOS safari */
          padding-left: 38px !important;
        }
        .pricing-grid {
          grid-template-columns: 1fr !important;
          gap: 20px !important;
        }
        .steps-card-grid {
          grid-template-columns: 1fr !important;
          gap: 16px !important;
        }
        .testimonials-grid {
          grid-template-columns: 1fr !important;
          gap: 16px !important;
        }
        .footer-grid {
          grid-template-columns: 1fr !important;
          gap: 32px !important;
        }
        .footer-bottom-row {
          flex-direction: column !important;
          text-align: center !important;
          gap: 12px !important;
        }
        .section-light, .section-white, .section-form {
          padding: 48px 16px !important;
        }
        .section-title {
          font-size: 24px !important;
        }

        /* Success Page Mobile */
        .success-title {
          font-size: 22px !important;
        }
        .token-box {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 12px !important;
          padding: 14px !important;
        }
        .token-text-wrap {
          text-align: center !important;
        }
        .token-text {
          font-size: 12px !important;
          word-break: break-all !important;
          white-space: normal !important;
        }
        .token-action-btns {
          display: flex !important;
          width: 100% !important;
          gap: 8px !important;
        }
        .token-action-btns > button:last-child {
          flex: 1 !important;
          justify-content: center !important;
        }
        .step-grid {
          grid-template-columns: 1fr !important;
        }
        .upgrade-box {
          flex-direction: column !important;
          align-items: stretch !important;
          text-align: center !important;
          padding: 18px !important;
        }
        .upgrade-left {
          flex-direction: column !important;
          text-align: center !important;
          align-items: center !important;
        }
        .floating-wa-text {
          display: none !important;
        }
        .floating-wa-button {
          padding: 12px !important;
          bottom: 16px !important;
          right: 16px !important;
          border-radius: 999px !important;
        }
        .receipt-card {
          padding: 18px 14px !important;
        }
        .receipt-qr-section {
          flex-direction: column !important;
          text-align: center !important;
          gap: 10px !important;
        }
        .receipt-qr-section .qr-text-col {
          align-items: center !important;
        }
        .download-app-banner {
          flex-direction: column !important;
          align-items: stretch !important;
          text-align: center !important;
          padding: 20px 16px !important;
        }
        .download-app-banner-left {
          flex-direction: column !important;
          align-items: center !important;
          text-align: center !important;
        }
        .download-banner-btn {
          width: 100% !important;
          justify-content: center !important;
        }
      }
    `}</style>
  );
}

export const meta: MetaFunction = () => [
  { title: "Daftar Struk Online Toko — POS Warung Madura Cloud SaaS" },
  {
    name: "description",
    content:
      "Struk kasir warung jadi online dalam 1 menit. Pelanggan cukup scan QR. Gratis 50 struk/bulan tanpa kartu kredit, data omzet tetap privat di komputer lokal.",
  },
];

// Helper slug generator
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─────────────────────────────────────────────────────────────
// Action: POST /daftar — register toko baru
// ─────────────────────────────────────────────────────────────
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const store_name = String(formData.get("store_name") || "").trim();
  const owner_name = String(formData.get("owner_name") || "").trim();
  const store_address = String(formData.get("store_address") || "").trim();
  const owner_email = String(formData.get("owner_email") || "").trim();
  const contact_wa = String(formData.get("contact_wa") || "").trim();

  // Validasi sederhana
  if (!store_name) return { success: false, error: "Nama warung / toko wajib diisi" };
  if (!owner_name) return { success: false, error: "Nama pemilik toko wajib diisi" };
  if (!owner_email || !owner_email.includes("@"))
    return { success: false, error: "Email pemilik tidak valid (wajib mengandung tanda @)" };

  const result = await registerTenant({ store_name, owner_name, store_address, owner_email, contact_wa });

  if (!result.success || !result.tenant) {
    return { success: false, error: result.error || "Gagal mendaftarkan toko" };
  }

  const { tenant } = result;
  const freeLimit = Number(process.env.FREE_INVOICE_LIMIT) || 50;
  const baseUrl = (process.env.PUBLIC_BASE_URL || "https://pos-warung-madura-theta.vercel.app").replace(/\/$/, "");

  // Kirim email kredensial (asynchronous / best-effort)
  try {
    await sendCredentialEmail({
      to: owner_email,
      storeName: tenant.store_name,
      storeSlug: tenant.store_slug,
      storeCode: tenant.store_code,
      syncSecret: tenant.sync_secret,
      invoiceLimit: freeLimit,
    });
  } catch (err) {
    console.warn("[Email Resend] Gagal kirim email selamat datang:", err);
  }

  return {
    success: true,
    storeName: tenant.store_name,
    ownerName: tenant.owner_name || owner_name || null,
    storeCode: tenant.store_code,
    storeSlug: tenant.store_slug,
    storeAddress: tenant.store_address,
    syncSecret: tenant.sync_secret,
    syncUrl: `${baseUrl}/api/sync`,
    baseUrl,
    freeLimit,
  };
}

export default function DaftarPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // State form lokal
  const [storeNameInput, setStoreNameInput] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showManualEnv, setShowManualEnv] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0); // Default open first FAQ
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const proPrice = 25000;
  const activeSlug = storeNameInput ? generateSlug(storeNameInput) : "warung-berkah";

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2500);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // ── VIEW SUKSES SETELAH PENDAFTARAN ─────────────────────────
  if (actionData && (actionData as any).success) {
    const d = actionData as {
      success: true;
      storeName: string;
      ownerName: string | null;
      storeCode: string;
      storeSlug: string;
      storeAddress?: string;
      syncSecret: string;
      syncUrl: string;
      baseUrl: string;
      freeLimit: number;
    };

    const envContent = `# ── Konfigurasi Otomatis POS Warung Madura ──────────────
STORE_CODE=${d.storeCode}
STORE_NAME=${d.storeName}
STORE_SLUG=${d.storeSlug}
OWNER_NAME=${d.ownerName || ""}
PUBLIC_INVOICE_SYNC_URL=${d.syncUrl}
PUBLIC_INVOICE_BASE_URL=${d.baseUrl}
SYNC_SECRET_KEY=${d.syncSecret}`;

    return (
      <div style={styles.page}>
        <ResponsiveStyles />

        {/* Navbar Sukses */}
        <header style={styles.nav}>
          <div style={styles.navInner}>
            <a href="/" style={styles.logo}>
              <Store size={22} color="#ea580c" style={{ flexShrink: 0 }} />
              <span>
                POS Warung <strong style={{ color: "#f97316" }}>Online</strong>
              </span>
            </a>
            <div style={styles.navLinks}>
              <a
                href={POS_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.navBtnDownload}
                title="Unduh file rilis aplikasi kasir (.exe) dari GitHub"
              >
                <Download size={14} /> Download POS
              </a>
              <a href="/" style={styles.navLink}>
                Beranda
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Halo Admin POS Warung Madura, saya sudah daftar toko ${d.storeName} (${d.storeCode}) dan ingin panduan integrasi.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.navBtnSecondary}
              >
                <Phone size={14} /> Bantuan WhatsApp
              </a>
            </div>
          </div>
        </header>

        <main style={{ ...styles.main, paddingTop: 100 }}>
          <div style={styles.successWrapper}>
            {/* Header Badge & Title */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={styles.successIconBadge}>
                <CheckCircle2 size={46} color="#16a34a" />
              </div>
              <h1 className="success-title" style={styles.successTitle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  Pendaftaran Berhasil! <PartyPopper size={30} color="#16a34a" style={{ flexShrink: 0 }} />
                </span>
              </h1>
              <p style={styles.successSubtitle}>
                Toko <strong>{d.storeName}</strong> ({d.storeCode}) telah terdaftar resmi di platform Cloud SaaS.
                <br />
                Salin <strong>Kode Aktivasi</strong> di bawah untuk mengaktifkan struk digital otomatis pada laptop kasir POS Anda.
              </p>
            </div>

            {/* KARTU UTAMA: SECRET KEY TOKEN (KODE AKTIVASI) */}
            <div style={styles.tokenHeroCard}>
              <div style={styles.tokenCardHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={styles.tokenIconBadge}>
                    <Key size={22} color="#f59e0b" />
                  </div>
                  <div>
                    <span style={styles.tokenHeroLabel}>Kode Aktivasi Toko Anda</span>
                    <h3 style={styles.tokenHeroTitle}>
                      {d.storeName} • <span style={{ color: "#f97316" }}>{d.storeCode}</span>
                    </h3>
                  </div>
                </div>
                <span style={styles.freeBadge}>
                  <Sparkles size={12} color="#15803d" /> Free Tier ({d.freeLimit} Struk / Bln)
                </span>
              </div>

              {/* Token Display Bar with 1-Click Copy */}
              <div className="token-box" style={styles.tokenBox}>
                <div className="token-text-wrap" style={styles.tokenTextWrap}>
                  <span className="token-text" style={styles.tokenText}>
                    {showSecret ? d.syncSecret : "••••••••••••••••••••••••••••••••••••••••••••••••"}
                  </span>
                </div>
                <div className="token-action-btns" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    style={styles.tokenActionBtn}
                    title={showSecret ? "Sembunyikan Kode" : "Tampilkan Kode"}
                  >
                    {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(d.syncSecret, "token")}
                    style={copied === "token" ? styles.copyBtnSuccess : styles.copyBtnPrimary}
                  >
                    {copied === "token" ? (
                      <>
                        <Check size={16} /> Tersalin!
                      </>
                    ) : (
                      <>
                        <Copy size={16} /> Salin Kode
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div style={styles.tokenSecurityHint}>
                <ShieldCheck size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Data Aman:</strong> Salinan kode aktivasi juga telah otomatis dikirimkan ke email Anda. Cek folder Inbox atau Spam jika diperlukan.
                </span>
              </div>
            </div>

            {/* PANDUAN 3 LANGKAH HUBUNGKAN KE POS WARUNG MADURA */}
            <div style={styles.guideCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Laptop size={22} color="#f97316" />
                <h3 style={styles.guideCardTitle}>Cara Memasang di Aplikasi POS Warung (Dalam 1 Menit)</h3>
              </div>
              <p style={styles.guideCardSubtitle}>
                Aplikasi POS kasir akan otomatis mengimpor <strong>Nama Warung</strong>, <strong>Alamat</strong>, dan <strong>Profil Pemilik</strong> tanpa perlu ketik ulang!
              </p>

              <div className="step-grid" style={styles.stepGrid}>
                {/* Langkah 1 */}
                <div style={styles.stepItem}>
                  <div style={styles.stepNumBadge}>1</div>
                  <div style={styles.stepContent}>
                    <h4 style={styles.stepTitle}>Salin Kode Aktivasi</h4>
                    <p style={styles.stepDesc}>
                      Klik tombol <strong>"Salin Kode"</strong> warna oranye di kartu atas.
                    </p>
                  </div>
                </div>

                {/* Langkah 2 */}
                <div style={styles.stepItem}>
                  <div style={styles.stepNumBadge}>2</div>
                  <div style={styles.stepContent}>
                    <h4 style={styles.stepTitle}>Buka POS Warung Madura</h4>
                    <p style={styles.stepDesc}>
                      Buka aplikasi kasir di laptop toko Anda. Pada wizard awal atau menu <strong>Cloud SaaS</strong> di kanan atas, klik <strong>Integrasi Struk Online</strong>.
                    </p>
                    <div style={{ marginTop: 8 }}>
                      <a
                        href={POS_DOWNLOAD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#2563eb",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          padding: "4px 8px",
                          borderRadius: 6,
                          textDecoration: "none",
                        }}
                      >
                        <Download size={12} />
                        <span>Belum punya aplikasi? Unduh di sini</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Langkah 3 */}
                <div style={styles.stepItem}>
                  <div style={styles.stepNumBadge}>3</div>
                  <div style={styles.stepContent}>
                    <h4 style={styles.stepTitle}>Tempel &amp; Otomatis Aktif</h4>
                    <p style={styles.stepDesc}>
                      Tempelkan Kode Aktivasi. Nama toko &amp; akun kasir Pemilik langsung terisi otomatis. Struk kasir siap punya QR Code!
                    </p>
                  </div>
                </div>
              </div>

              {/* Callout Unduh Aplikasi POS */}
              <div
                style={{
                  marginTop: 18,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 14,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Laptop size={22} color="#15803d" style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: 13, color: "#166534", display: "block" }}>
                      Belum Memasang Aplikasi Kasir di Laptop Warung?
                    </strong>
                    <span style={{ fontSize: 11, color: "#15803d" }}>
                      Unduh installer resmi (.exe untuk Windows) gratis versi terbaru langsung dari GitHub Releases.
                    </span>
                  </div>
                </div>
                <a
                  href={POS_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    background: "#16a34a",
                    color: "#ffffff",
                    padding: "8px 16px",
                    borderRadius: 10,
                    textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(22, 163, 74, 0.25)",
                  }}
                >
                  <Download size={14} />
                  <span>Download Aplikasi Kasir</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* RINGKASAN DATA TOKO & STRUK DIGITAL */}
            <div style={styles.detailsCard}>
              <div style={styles.detailsHeader}>
                <Store size={18} color="#f97316" />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                  Ringkasan Profil Toko Terdaftar
                </span>
              </div>
              <div style={styles.detailsGrid}>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Nama Warung:</span>
                  <span style={{ ...styles.detailValue, fontWeight: 700 }}>{d.storeName}</span>
                </div>
                {d.ownerName && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Nama Pemilik (Owner):</span>
                    <span style={{ ...styles.detailValue, fontWeight: 700, color: "#0f172a" }}>
                      {d.ownerName}
                    </span>
                  </div>
                )}
                {d.storeAddress && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Alamat Toko:</span>
                    <span style={styles.detailValue}>{d.storeAddress}</span>
                  </div>
                )}
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Kode Toko (Prefix Faktur):</span>
                  <span style={styles.detailCodeBadge}>{d.storeCode}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Tautan Halaman Toko:</span>
                  <span style={styles.detailValue}>
                    {d.baseUrl}/{d.storeSlug}
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Paket Langganan:</span>
                  <span style={{ ...styles.detailValue, color: "#15803d", fontWeight: 700 }}>
                    Free Tier ({d.freeLimit} Struk Digital / Bulan)
                  </span>
                </div>
                <div style={{ ...styles.detailRow, borderBottom: "none" }}>
                  <span style={styles.detailLabel}>Format Tautan Struk Pelanggan:</span>
                  <a
                    href={`${d.baseUrl}/${d.storeSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.detailLink}
                  >
                    <span>
                      {d.baseUrl}/{d.storeSlug}/invoice/{d.storeCode}-XXXXXX
                    </span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </div>

            {/* OPSI MANUAL VIA .ENV (ACCORDION COLLAPSIBLE UNTUK DEVELOPER) */}
            <div style={styles.accordionWrap}>
              <button
                type="button"
                onClick={() => setShowManualEnv(!showManualEnv)}
                style={styles.accordionHeaderBtn}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Layers size={16} color="#64748b" />
                  <span>Opsi Lanjutan: Konfigurasi Manual via File .env</span>
                </div>
                {showManualEnv ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showManualEnv && (
                <div style={styles.accordionBody}>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
                    Jika Anda lebih memilih konfigurasi via teks, salin konfigurasi berikut ke file <code>pos_warung_madura/.env</code>:
                  </p>
                  <div style={styles.credBox}>
                    <div style={styles.credHeader}>
                      <span style={styles.credTitle}>pos_warung_madura/.env</span>
                      <button style={styles.copyBtn} onClick={() => handleCopy(envContent, "env")}>
                        {copied === "env" ? (
                          <>
                            <Check size={14} /> Tersalin!
                          </>
                        ) : (
                          <>
                            <Copy size={14} /> Salin Semua .env
                          </>
                        )}
                      </button>
                    </div>
                    <pre style={styles.envPre}>{envContent}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* BANNER UPGRADE PRO */}
            <div className="upgrade-box" style={styles.upgradeBox}>
              <div className="upgrade-left" style={styles.upgradeLeft}>
                <div style={styles.upgradeIcon}>
                  <Zap size={24} color="#f97316" />
                </div>
                <div>
                  <h4 style={styles.upgradeTitle}>Butuh Struk Online Unlimited Tanpa Batas?</h4>
                  <p style={styles.upgradeDesc}>
                    Upgrade ke <strong>Paket Pro</strong> hanya <strong>Rp {proPrice.toLocaleString("id-ID")}/bulan</strong> (≈ Rp 830/hari). Dapatkan kuota tanpa batas dan bantuan langsung dari tim teknis.
                  </p>
                </div>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Halo Admin POS Warung Madura, saya ingin upgrade paket Pro untuk toko: ${d.storeName} (${d.storeCode})`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.waBtn}
              >
                <Phone size={15} />
                <span>Upgrade via WhatsApp (Rp 25rb)</span>
                <ArrowRight size={16} />
              </a>
            </div>

            <div style={{ textAlign: "center", marginTop: 32 }}>
              <a href="/" style={styles.backHomeBtn}>
                <ArrowLeft size={16} />
                <span>Kembali ke Halaman Utama</span>
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── HALAMAN UTAMA REDESIGN /DAFTAR ──────────────────────────
  return (
    <div style={styles.page}>
      <ResponsiveStyles />

      {/* 1. NAVBAR STICKY DENGAN RESPONSIVE MOBILE DRAWER */}
      <header style={styles.nav}>
        <div style={styles.navInner}>
          <a href="/" style={styles.logo}>
            <Store size={22} color="#ea580c" style={{ flexShrink: 0 }} />
            <span>
              POS Warung <strong style={{ color: "#f97316" }}>Online</strong>
            </span>
          </a>

          {/* Navigasi Desktop */}
          <div className="desktop-nav" style={styles.navLinks}>
            <button type="button" onClick={() => scrollToSection("cara-kerja")} style={styles.navLinkBtn}>
              Cara Kerja
            </button>
            <button type="button" onClick={() => scrollToSection("harga")} style={styles.navLinkBtn}>
              Harga
            </button>
            <button type="button" onClick={() => scrollToSection("keunggulan")} style={styles.navLinkBtn}>
              Keunggulan
            </button>
            <button type="button" onClick={() => scrollToSection("faq")} style={styles.navLinkBtn}>
              FAQ
            </button>
            <a
              href={POS_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.navBtnDownload}
              title="Unduh file rilis aplikasi kasir (.exe) dari GitHub"
            >
              <Download size={14} />
              <span>Download POS</span>
            </a>
            <button
              type="button"
              onClick={() => scrollToSection("form-section")}
              style={styles.navCtaBtn}
            >
              <span>Daftar Gratis</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Navigasi Aksi Mobile (Daftar Cepat + Hamburger Toggle) */}
          <div className="mobile-nav-actions" style={{ display: "none", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => scrollToSection("form-section")}
              style={{ ...styles.navCtaBtn, padding: "7px 12px", fontSize: 12 }}
            >
              <span>Daftar</span>
              <ArrowRight size={12} />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#f1f5f9",
                color: "#0f172a",
                cursor: "pointer",
              }}
              aria-label="Menu Navigasi"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-menu-drawer">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                scrollToSection("cara-kerja");
              }}
              className="mobile-menu-item"
            >
              Cara Kerja
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                scrollToSection("harga");
              }}
              className="mobile-menu-item"
            >
              Harga &amp; Paket
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                scrollToSection("keunggulan");
              }}
              className="mobile-menu-item"
            >
              Keunggulan
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                scrollToSection("faq");
              }}
              className="mobile-menu-item"
            >
              Tanya Jawab (FAQ)
            </button>
            <a
              href={POS_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-menu-item"
              style={{ color: "#2563eb", fontWeight: 700 }}
            >
              <Download size={15} /> Download Aplikasi POS (Windows)
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                "Halo Admin POS Warung Madura, saya butuh panduan pendaftaran struk online."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-menu-item"
              style={{ color: "#16a34a", fontWeight: 700 }}
            >
              <Phone size={15} /> Bantuan WhatsApp
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                scrollToSection("form-section");
              }}
              style={{ ...styles.navCtaBtn, width: "100%", justifyContent: "center", padding: "12px", marginTop: 6 }}
            >
              <span>Daftar Toko Gratis Sekarang</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION DENGAN BENEFIT JELAS & PREVIEW MOCKUP STRUK */}
      <section className="hero-section" style={styles.heroSection}>
        <div style={styles.heroContainer}>
          <div className="hero-grid" style={styles.heroGrid}>
            {/* Kolom Kiri: Headline, Value Proposition, Action CTA */}
            <div style={styles.heroTextCol}>
              <div style={styles.heroBadge}>
                <Sparkles size={14} color="#ea580c" />
                <span>Gratis 50 Struk / Bulan • Tanpa Kartu Kredit</span>
              </div>

              <h1 className="hero-title" style={styles.heroTitle}>
                Struk Kasir Warung Jadi Online,{" "}
                <span style={styles.heroGradient}>Pelanggan Cukup Scan QR</span>
              </h1>

              <p className="hero-subtitle" style={styles.heroSubtitle}>
                Hemat kertas struk, pembukuan tetap aman di komputer lokal. Pasang di aplikasi POS dalam 1 menit tanpa instalasi rumit.
              </p>

              {/* Action Buttons */}
              <div className="hero-action-row" style={styles.heroActionRow}>
                <button
                  type="button"
                  onClick={() => scrollToSection("form-section")}
                  style={styles.heroPrimaryBtn}
                >
                  <span>Daftar Toko Gratis Sekarang</span>
                  <ArrowRight size={18} />
                </button>
                <a
                  href={POS_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.heroDownloadBtn}
                >
                  <Download size={16} />
                  <span>Download Aplikasi Kasir</span>
                </a>
                <button
                  type="button"
                  onClick={() => scrollToSection("cara-kerja")}
                  style={styles.heroSecondaryBtn}
                >
                  <HelpCircle size={16} />
                  <span>Pelajari Cara Kerja</span>
                </button>
              </div>

              {/* Trust Micro Badges */}
              <div style={styles.trustPillRow}>
                <div style={styles.trustPill}>
                  <Zap size={14} color="#ea580c" />
                  <span>Pasang di POS 1 Menit</span>
                </div>
                <div style={styles.trustPill}>
                  <ShieldCheck size={14} color="#16a34a" />
                  <span>Data Omzet 100% Privat</span>
                </div>
                <div style={styles.trustPill}>
                  <Laptop size={14} color="#2563eb" />
                  <span>Offline First (Anti-Macet)</span>
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Mockup Interaktif Struk Digital Warung Madura */}
            <div style={styles.heroMockupCol}>
              <div style={styles.mockupWrapper}>
                <div style={styles.mockupGlow} />
                <div className="receipt-card" style={styles.receiptCard}>
                  {/* Bagian Atas Struk (Thermal Header) */}
                  <div style={styles.receiptHeader}>
                    <div style={styles.receiptBrandBadge}>CONTOH STRUK DIGITAL</div>
                    <h3 style={styles.receiptStoreName}>WARUNG MADURA BERKAH</h3>
                    <p style={styles.receiptStoreMeta}>Jl. Raya Warung Madura 24 Jam (Depan SPBU)</p>
                    <p style={styles.receiptStoreMeta}>WhatsApp: 0812-3456-7890</p>
                    <div style={styles.receiptDividerDashed} />
                    <div style={styles.receiptMetaRow}>
                      <span>No: WM01-004281</span>
                      <span>08 Okt 2026 14:32</span>
                    </div>
                    <div style={styles.receiptMetaRow}>
                      <span>Kasir: Cak Mat</span>
                      <span>Pelanggan: Umum</span>
                    </div>
                  </div>

                  <div style={styles.receiptDividerSolid} />

                  {/* Item Belanja */}
                  <div style={styles.receiptItemList}>
                    <div style={styles.receiptItem}>
                      <div>
                        <div style={styles.receiptItemTitle}>Rokok Surya 16</div>
                        <div style={styles.receiptItemSubtitle}>1 Bungkus x Rp 35.000</div>
                      </div>
                      <div style={styles.receiptItemPrice}>Rp 35.000</div>
                    </div>

                    <div style={styles.receiptItem}>
                      <div>
                        <div style={styles.receiptItemTitle}>Indomie Goreng Jumbo</div>
                        <div style={styles.receiptItemSubtitle}>2 Pcs x Rp 4.000</div>
                      </div>
                      <div style={styles.receiptItemPrice}>Rp 8.000</div>
                    </div>

                    <div style={styles.receiptItem}>
                      <div>
                        <div style={styles.receiptItemTitle}>Bensin Pertalite 1 Liter</div>
                        <div style={styles.receiptItemSubtitle}>1 Botol x Rp 12.000</div>
                      </div>
                      <div style={styles.receiptItemPrice}>Rp 12.000</div>
                    </div>

                    <div style={styles.receiptItem}>
                      <div>
                        <div style={styles.receiptItemTitle}>Es Teh Manis Jumbo</div>
                        <div style={styles.receiptItemSubtitle}>1 Cup x Rp 5.000</div>
                      </div>
                      <div style={styles.receiptItemPrice}>Rp 5.000</div>
                    </div>
                  </div>

                  <div style={styles.receiptDividerSolid} />

                  {/* Total & Pembayaran */}
                  <div style={styles.receiptSummary}>
                    <div style={styles.receiptSummaryRow}>
                      <span>Subtotal (4 Item):</span>
                      <span>Rp 60.000</span>
                    </div>
                    <div style={{ ...styles.receiptSummaryRow, fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
                      <span>TOTAL:</span>
                      <span>Rp 60.000</span>
                    </div>
                    <div style={styles.receiptSummaryRow}>
                      <span>Bayar (Tunai):</span>
                      <span>Rp 100.000</span>
                    </div>
                    <div style={styles.receiptSummaryRow}>
                      <span>Kembali:</span>
                      <span>Rp 40.000</span>
                    </div>
                  </div>

                  <div style={styles.receiptDividerDashed} />

                  {/* QR Code & Scan Notice */}
                  <div className="receipt-qr-section" style={styles.receiptQrSection}>
                    <div style={styles.qrBox}>
                      <QRCodeSVG
                        value="https://pos-warung-madura-theta.vercel.app/warung-berkah/invoice/WM01-004281"
                        size={84}
                        level="M"
                      />
                    </div>
                    <div className="qr-text-col" style={styles.qrTextCol}>
                      <div style={styles.qrTitle}>Scan untuk Buka di HP</div>
                      <div style={styles.qrSubtitle}>Pelanggan dapat menyimpan struk, bukti garansi, atau cek rincian belanja kapan saja.</div>
                      <div style={styles.qrPill}>
                        <CheckCircle size={11} color="#15803d" />
                        <span>Tersimpan di Cloud</span>
                      </div>
                    </div>
                  </div>

                  {/* Efek Gerigi Kertas Kasir Bawah */}
                  <div style={styles.receiptJaggedEdge} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SECTION CARA KERJA (3 LANGKAH VISUAL) */}
      <section id="cara-kerja" className="section-light" style={styles.sectionLight}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTag}>SANGAT MUDAH &amp; CEPAT</span>
            <h2 className="section-title" style={styles.sectionTitle}>3 Langkah Menghubungkan ke POS Kasir</h2>
            <p style={styles.sectionSubtitle}>
              Tidak membutuhkan keahlian teknis. Dari pendaftaran hingga struk ber-QR Code selesai dalam waktu kurang dari 1 menit.
            </p>
          </div>

          <div className="steps-card-grid" style={styles.stepsCardGrid}>
            {/* Langkah 1 */}
            <div style={styles.stepCard}>
              <div style={styles.stepCardNumber}>01</div>
              <div style={styles.stepIconWrap}>
                <Store size={26} color="#ea580c" />
              </div>
              <h3 style={styles.stepCardTitle}>Daftarkan Toko</h3>
              <p style={styles.stepCardDesc}>
                Isi nama warung dan nama pemilik di formulir bawah ini. Akun langsung aktif seketika tanpa perlu verifikasi kartu kredit.
              </p>
            </div>

            {/* Langkah 2 */}
            <div style={styles.stepCard}>
              <div style={styles.stepCardNumber}>02</div>
              <div style={styles.stepIconWrap}>
                <Key size={26} color="#ea580c" />
              </div>
              <h3 style={styles.stepCardTitle}>Salin Kode Aktivasi</h3>
              <p style={styles.stepCardDesc}>
                Salin Kode Aktivasi yang muncul di layar, lalu buka aplikasi POS Warung Madura dan tempelkan di menu <strong>Cloud SaaS</strong>.
              </p>
              <div style={{ marginTop: 12 }}>
                <a
                  href={POS_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#2563eb",
                    textDecoration: "underline",
                  }}
                >
                  <Download size={14} /> Belum ada aplikasi? Unduh di sini
                </a>
              </div>
            </div>

            {/* Langkah 3 */}
            <div style={styles.stepCard}>
              <div style={styles.stepCardNumber}>03</div>
              <div style={styles.stepIconWrap}>
                <Receipt size={26} color="#ea580c" />
              </div>
              <h3 style={styles.stepCardTitle}>Struk Otomatis Ber-QR</h3>
              <p style={styles.stepCardDesc}>
                Setiap transaksi kasir otomatis membuatkan halaman struk online dan mencetak QR Code untuk dipindai pelanggan toko Anda.
              </p>
            </div>
          </div>

          {/* Download App Banner */}
          <div className="download-app-banner" style={styles.downloadAppBanner}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={styles.downloadIconWrap}>
                <Download size={26} color="#2563eb" />
              </div>
              <div>
                <h3 style={styles.downloadBannerTitle}>Belum Memasang Aplikasi POS Warung Madura di Komputer / Laptop?</h3>
                <p style={styles.downloadBannerDesc}>
                  Aplikasi POS kasir offline siap pakai untuk warung &amp; toko kelontong. Unduh gratis versi terbaru untuk Windows langsung dari GitHub Releases.
                </p>
              </div>
            </div>
            <a
              href={POS_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="download-banner-btn"
              style={styles.downloadBannerBtn}
            >
              <Download size={16} />
              <span>Download Aplikasi POS (Windows)</span>
            </a>
          </div>
        </div>
      </section>

      {/* 4. FORMULIR PENDAFTARAN & PREVIEW LIVE SLUG TOKO */}
      <section id="form-section" className="section-form" style={styles.sectionForm}>
        <div style={styles.sectionContainer}>
          <div className="form-layout-grid" style={styles.formLayoutGrid}>
            {/* Kolom Kiri: Form Registrasi */}
            <div className="form-card" style={styles.formCard}>
              <div style={styles.formHeader}>
                <div style={styles.formHeaderIcon}>
                  <Store size={24} color="#ea580c" />
                </div>
                <div>
                  <h2 className="form-header-title" style={styles.formHeaderTitle}>Formulir Pendaftaran Toko</h2>
                  <p style={styles.formHeaderSubtitle}>
                    Mulai gratis 50 struk digital / bulan. Hubungkan ke kasir warung sekarang.
                  </p>
                </div>
              </div>

              {actionData?.success === false && (
                <div style={styles.errorAlert}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                    <span>{(actionData as { success: false; error?: string }).error}</span>
                  </div>
                </div>
              )}

              <Form method="post" style={styles.formBody}>
                {/* 1. Nama Warung / Toko */}
                <div style={styles.inputGroup}>
                  <label htmlFor="store_name" style={styles.inputLabel}>
                    Nama Warung / Toko <span style={styles.requiredStar}>*</span>
                  </label>
                  <div style={styles.inputBox}>
                    <Store size={18} color="#94a3b8" style={styles.boxIcon} />
                    <input
                      id="store_name"
                      name="store_name"
                      type="text"
                      placeholder="Contoh: Warung Madura Berkah"
                      required
                      value={storeNameInput}
                      onChange={(e) => setStoreNameInput(e.target.value)}
                      className="text-input"
                      style={styles.textInput}
                      disabled={isSubmitting}
                    />
                  </div>
                  {/* Live Slug Preview */}
                  <div style={styles.slugPreviewBox}>
                    <Globe size={13} color="#ea580c" />
                    <span>
                      Alamat Struk Anda:{" "}
                      <strong style={{ color: "#0f172a" }}>
                        pos-warung.vercel.app/{activeSlug}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* 2. Nama Pemilik Toko (Wajib) */}
                <div style={styles.inputGroup}>
                  <label htmlFor="owner_name" style={styles.inputLabel}>
                    Nama Pemilik Warung (Owner) <span style={styles.requiredStar}>*</span>
                  </label>
                  <div style={styles.inputBox}>
                    <User size={18} color="#94a3b8" style={styles.boxIcon} />
                    <input
                      id="owner_name"
                      name="owner_name"
                      type="text"
                      placeholder="Contoh: Cak Huda"
                      required
                      className="text-input"
                      style={styles.textInput}
                      disabled={isSubmitting}
                    />
                  </div>
                  <p style={styles.inputHint}>
                    Akan dijadikan nama profil Pemilik di aplikasi POS. Karyawan kasir lainnya bisa ditambahkan langsung di laptop warung.
                  </p>
                </div>

                {/* 3. Email Pemilik */}
                <div style={styles.inputGroup}>
                  <label htmlFor="owner_email" style={styles.inputLabel}>
                    Email Pemilik <span style={styles.requiredStar}>*</span>
                  </label>
                  <div style={styles.inputBox}>
                    <Mail size={18} color="#94a3b8" style={styles.boxIcon} />
                    <input
                      id="owner_email"
                      name="owner_email"
                      type="email"
                      placeholder="pemilik@warungmadura.com"
                      required
                      className="text-input"
                      style={styles.textInput}
                      disabled={isSubmitting}
                    />
                  </div>
                  <p style={styles.inputHint}>
                    Kode Aktivasi cadangan dan pemberitahuan layanan akan dikirimkan ke email ini.
                  </p>
                </div>

                {/* 4. WhatsApp Pemilik / Kasir */}
                <div style={styles.inputGroup}>
                  <label htmlFor="contact_wa" style={styles.inputLabel}>
                    Nomor WhatsApp (Opsional)
                  </label>
                  <div style={styles.inputBox}>
                    <Phone size={18} color="#94a3b8" style={styles.boxIcon} />
                    <input
                      id="contact_wa"
                      name="contact_wa"
                      type="tel"
                      placeholder="Contoh: 081234567890"
                      className="text-input"
                      style={styles.textInput}
                      disabled={isSubmitting}
                    />
                  </div>
                  <p style={styles.inputHint}>
                    Untuk bantuan setup cepat jika kesulitan memasang di aplikasi POS.
                  </p>
                </div>

                {/* 5. Alamat Toko */}
                <div style={styles.inputGroup}>
                  <label htmlFor="store_address" style={styles.inputLabel}>
                    Alamat Lengkap Toko (Opsional)
                  </label>
                  <div style={styles.inputBox}>
                    <MapPin size={18} color="#94a3b8" style={styles.boxIcon} />
                    <input
                      id="store_address"
                      name="store_address"
                      type="text"
                      placeholder="Contoh: Jl. Raya Warung Madura No. 24, Buka 24 Jam"
                      className="text-input"
                      style={styles.textInput}
                      disabled={isSubmitting}
                    />
                  </div>
                  <p style={styles.inputHint}>
                    Ditampilkan pada bagian kepala struk digital belanjaan pembeli.
                  </p>
                </div>

                {/* Terms Agreement Checkbox */}
                <div
                  style={styles.agreementRow}
                  onClick={() => setAgreedTerms(!agreedTerms)}
                >
                  <div style={{ color: agreedTerms ? "#ea580c" : "#94a3b8", display: "flex", alignItems: "center" }}>
                    {agreedTerms ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <span style={styles.agreementText}>
                    Saya menyetujui Syarat Layanan &amp; Kebijakan Privasi POS Warung Madura. Data omzet dan stok toko tetap aman di komputer lokal.
                  </span>
                </div>

                {/* Tombol Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting || !agreedTerms}
                  style={{
                    ...styles.submitButton,
                    opacity: isSubmitting || !agreedTerms ? 0.6 : 1,
                    cursor: isSubmitting || !agreedTerms ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                      <span>Sedang Mendaftarkan Toko...</span>
                    </>
                  ) : (
                    <>
                      <span>Daftar Toko &amp; Buat Kode Aktivasi</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <div style={styles.securityTrustRow}>
                  <ShieldCheck size={16} color="#16a34a" />
                  <span>Pendaftaran instan tanpa kartu kredit • Langsung aktif seketika</span>
                </div>
              </Form>
            </div>

            {/* Kolom Kanan: Ringkasan Manfaat & Komparasi Paket Mini */}
            <div style={styles.sidebarCol}>
              {/* Kartu Ringkasan Paket Free */}
              <div style={styles.sidebarCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={styles.sidebarCardTitle}>Paket Free (Gratis)</h3>
                  <span style={styles.freeBadgeSolid}>Langsung Aktif</span>
                </div>
                <div style={styles.priceRow}>
                  <span style={styles.priceAmount}>Rp 0</span>
                  <span style={styles.pricePeriod}>/ bulan</span>
                </div>
                <p style={styles.priceSubtitle}>
                  Dirancang khusus agar pemilik warung dapat mencoba tanpa risiko apa pun.
                </p>

                <div style={styles.featureList}>
                  <div style={styles.featureListItem}>
                    <CheckCircle size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span><strong>50 struk digital</strong> setiap bulan</span>
                  </div>
                  <div style={styles.featureListItem}>
                    <CheckCircle size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span>Reset kuota otomatis tiap tanggal 1</span>
                  </div>
                  <div style={styles.featureListItem}>
                    <CheckCircle size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span>QR Code unik per nota transaksi</span>
                  </div>
                  <div style={styles.featureListItem}>
                    <CheckCircle size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span>URL struk publik khusus toko Anda</span>
                  </div>
                  <div style={styles.featureListItem}>
                    <CheckCircle size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span>Pasang di POS hanya dalam 1 menit</span>
                  </div>
                </div>
              </div>

              {/* Jaminan Aman Warung */}
              <div style={styles.guaranteeBox}>
                <div style={{ display: "flex", gap: 12 }}>
                  <ShieldCheck size={28} color="#15803d" style={{ flexShrink: 0 }} />
                  <div>
                    <h4 style={styles.guaranteeTitle}>Jaminan Keamanan Warung</h4>
                    <p style={styles.guaranteeText}>
                      Hanya nota belanja pembeli yang ditampilkan online. Data pembukuan laba, omzet penjualan, dan harga kulakan tersimpan 100% aman di database komputer warung Anda.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SECTION HARGA & PERBANDINGAN TRANSPARAN */}
      <section id="harga" className="section-light" style={styles.sectionLight}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTag}>TRANSPARAN TANPA BIAYA TERSEMBUNYI</span>
            <h2 className="section-title" style={styles.sectionTitle}>Pilihan Paket Sederhana</h2>
            <p style={styles.sectionSubtitle}>
              Mulai gratis sekarang. Upgrade ke Pro kapan saja jika transaksi warung Anda semakin ramai.
            </p>
          </div>

          <div className="pricing-grid" style={styles.pricingGrid}>
            {/* Kartu Free */}
            <div style={styles.pricingTierCard}>
              <div style={styles.tierHeader}>
                <h3 style={styles.tierName}>Paket Free</h3>
                <span style={styles.tierBadgeFree}>Gratis Selamanya</span>
              </div>
              <div style={styles.tierPriceRow}>
                <span style={styles.tierPriceBig}>Rp 0</span>
                <span style={styles.tierPricePeriod}>/ bulan</span>
              </div>
              <p style={styles.tierDesc}>Cocok untuk warung baru atau yang baru ingin mencoba struk QR Code.</p>

              <div style={styles.tierFeatureList}>
                <div style={styles.tierFeatureItem}>
                  <CheckCircle size={16} color="#16a34a" />
                  <span><strong>50 struk digital</strong> per bulan</span>
                </div>
                <div style={styles.tierFeatureItem}>
                  <CheckCircle size={16} color="#16a34a" />
                  <span>Reset kuota otomatis tiap tanggal 1</span>
                </div>
                <div style={styles.tierFeatureItem}>
                  <CheckCircle size={16} color="#16a34a" />
                  <span>Alamat URL toko khusus</span>
                </div>
                <div style={styles.tierFeatureItem}>
                  <CheckCircle size={16} color="#16a34a" />
                  <span>Bantuan instalasi via panduan</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => scrollToSection("form-section")}
                style={styles.tierBtnSecondary}
              >
                Mulai Gratis Sekarang
              </button>
            </div>

            {/* Kartu Pro */}
            <div style={styles.pricingTierCardPro}>
              <div style={styles.proRibbon}>REKOMENDASI WARUNG RAMAI</div>
              <div style={styles.tierHeader}>
                <h3 style={{ ...styles.tierName, color: "#9a3412" }}>Paket Pro</h3>
                <span style={styles.tierBadgePro}>Unlimited</span>
              </div>
              <div style={styles.tierPriceRow}>
                <span style={{ ...styles.tierPriceBig, color: "#9a3412" }}>
                  Rp {proPrice.toLocaleString("id-ID")}
                </span>
                <span style={styles.tierPricePeriod}>/ bulan</span>
              </div>
              <p style={{ ...styles.tierDesc, color: "#78350f" }}>
                Hanya <strong>≈ Rp 830 / hari</strong> untuk transaksi tanpa batas kuota 24 jam non-stop.
              </p>

              <div style={styles.tierFeatureList}>
                <div style={styles.tierFeatureItem}>
                  <CheckCircle size={16} color="#ea580c" />
                  <span><strong>Unlimited Struk Digital</strong> (Tanpa Batas Kuota)</span>
                </div>
                <div style={styles.tierFeatureItem}>
                  <CheckCircle size={16} color="#ea580c" />
                  <span>Semua fitur Paket Free</span>
                </div>
                <div style={styles.tierFeatureItem}>
                  <CheckCircle size={16} color="#ea580c" />
                  <span>Pengiriman struk prioritas super cepat</span>
                </div>
                <div style={styles.tierFeatureItem}>
                  <CheckCircle size={16} color="#ea580c" />
                  <span>Bantuan teknis langsung via WhatsApp</span>
                </div>
                <div style={styles.tierFeatureItem}>
                  <CheckCircle size={16} color="#ea580c" />
                  <span>Bebas watermark promosi</span>
                </div>
              </div>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  "Halo Admin POS Warung Madura, saya ingin konsultasi atau upgrade ke Paket Pro Unlimited."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.tierBtnPro}
              >
                <Phone size={16} />
                <span>Upgrade via WhatsApp (Rp 25rb)</span>
              </a>
            </div>
          </div>

          {/* Penjelasan Transparan Kuota Habis */}
          <div style={styles.quotaNoticeBox}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={styles.quotaIconWrap}>
                <HelpCircle size={22} color="#f97316" />
              </div>
              <div>
                <h4 style={styles.quotaNoticeTitle}>Apa yang terjadi jika kuota Free 50 struk habis sebelum akhir bulan?</h4>
                <p style={styles.quotaNoticeText}>
                  Aplikasi kasir di warung Anda <strong>tetap mencetak struk fisik lokal secara normal tanpa terganggu sama sekali</strong>. Fitur struk online pelanggan hanya akan dijeda sementara hingga kuota otomatis diperbarui pada tanggal 1 bulan berikutnya, atau Anda bisa upgrade ke Paket Pro seharga Rp 25.000/bulan untuk kuota tanpa batas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION SOCIAL PROOF & TESTIMONI */}
      <section id="keunggulan" className="section-white" style={styles.sectionWhite}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTag}>DIPERCAYA PEMILIK WARUNG</span>
            <h2 className="section-title" style={styles.sectionTitle}>Kata Pemilik Warung Madura</h2>
            <p style={styles.sectionSubtitle}>
              Solusi yang dirancang khusus untuk ritme kerja warung kelontong Indonesia.
            </p>
          </div>

          <div className="testimonials-grid" style={styles.testimonialsGrid}>
            {/* Testimoni 1 */}
            <div style={styles.testimonialCard}>
              <div style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={15} color="#f59e0b" fill="#f59e0b" />
                ))}
              </div>
              <p style={styles.testimonialQuote}>
                "Pelanggan anak muda sekarang seneng banget ada struk QR online. Hemat kertas roll kasir dan pembukuan toko tetap rapi."
              </p>
              <div style={styles.testimonialAuthorRow}>
                <div style={styles.authorAvatar}>CS</div>
                <div>
                  <div style={styles.authorName}>Cak Syakur</div>
                  <div style={styles.authorStore}>Warung Madura 24 Jam Kemang, Jaksel</div>
                </div>
              </div>
            </div>

            {/* Testimoni 2 */}
            <div style={styles.testimonialCard}>
              <div style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={15} color="#f59e0b" fill="#f59e0b" />
                ))}
              </div>
              <p style={styles.testimonialQuote}>
                "Setup-nya beneran gampang cuma tempel kode ke POS, kasir anak saya langsung bisa pakai tanpa perlu diajarin lama."
              </p>
              <div style={styles.testimonialAuthorRow}>
                <div style={styles.authorAvatar}>BA</div>
                <div>
                  <div style={styles.authorName}>Bu Siti Aminah</div>
                  <div style={styles.authorStore}>Warung Madura Barokah Tebet, Jaksel</div>
                </div>
              </div>
            </div>

            {/* Testimoni 3 */}
            <div style={styles.testimonialCard}>
              <div style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={15} color="#f59e0b" fill="#f59e0b" />
                ))}
              </div>
              <p style={styles.testimonialQuote}>
                "Awalnya takut data omzet toko bocor, ternyata cuma nota pembeli aja yang online. Rahasia keuangan warung tetap aman di laptop toko."
              </p>
              <div style={styles.testimonialAuthorRow}>
                <div style={styles.authorAvatar}>CR</div>
                <div>
                  <div style={styles.authorName}>Cak Rohim</div>
                  <div style={styles.authorStore}>Warung Sembako 24 Jam Senen, Jakpus</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SECTION FAQ AKORDEON (7 PERTANYAAN LENGKAP) */}
      <section id="faq" className="section-light" style={styles.sectionLight}>
        <div style={styles.sectionContainerNarrow}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTag}>FAQ</span>
            <h2 className="section-title" style={styles.sectionTitle}>Pertanyaan yang Sering Diajukan</h2>
            <p style={styles.sectionSubtitle}>
              Semua yang perlu Anda ketahui tentang layanan Struk Online POS Warung Madura.
            </p>
          </div>

          <div style={styles.faqAccordionList}>
            {[
              {
                q: "Bagaimana cara menyambungkan layanan ini ke aplikasi POS di laptop toko?",
                a: "Cukup salin Kode Aktivasi yang Anda dapatkan setelah mendaftar di web ini, lalu buka aplikasi POS Warung Madura dan tempelkan kodenya di menu 'Cloud SaaS' atau wizard setup awal. Semua identitas toko dan profil pemilik akan langsung terhubung otomatis dalam hitungan detik tanpa perlu ketik ulang.",
              },
              {
                q: "Apa yang terjadi kalau kuota 50 struk gratis habis sebelum akhir bulan?",
                a: "Aplikasi kasir POS di warung Anda tetap berjalan normal 100% dan nota kasir fisik tetap tercetak seperti biasa. Struk online pelanggan hanya akan dijeda sementara hingga kuota otomatis diperbarui pada tanggal 1 bulan berikutnya, atau Anda bisa upgrade ke Paket Pro seharga Rp 25.000/bulan.",
              },
              {
                q: "Bagaimana kalau koneksi internet di warung sedang mati atau sinyal buruk?",
                a: "Aplikasi POS Warung Madura dirancang dengan arsitektur Local-First (Offline First). Transaksi kasir tetap berjalan lancar tanpa internet. Begitu koneksi internet toko kembali online, nota transaksi akan otomatis disinkronkan ke cloud di latar belakang.",
              },
              {
                q: "Siapa saja yang bisa melihat struk online? Apakah data keuangan toko saya aman?",
                a: "Sangat aman. Struk online hanya bisa dibuka oleh orang yang memiliki tautan unik nota tersebut (atau yang memindai QR code pada kertas struk). Data sensitif toko seperti total omzet harian, keuntungan/laba, modal kulakan, dan data kas laci TIDAK PERNAH dikirim ke cloud dan tersimpan aman di database lokal komputer Anda.",
              },
              {
                q: "Bagaimana cara upgrade ke Paket Pro dan apa saja metode pembayarannya?",
                a: "Anda dapat menghubungi admin resmi kami melalui tombol WhatsApp yang tersedia di halaman ini. Kami menerima pembayaran mudah melalui QRIS (Gopay, OVO, Dana, ShopeePay, Mobile Banking) maupun transfer bank lokal.",
              },
              {
                q: "Apakah kasir karyawan saya harus mendaftar akun di web ini juga?",
                a: "Tidak perlu. Pendaftaran di web ini khusus untuk Pemilik Toko (Owner). Akun kasir karyawan harian ditambahkan dan dikelola langsung di dalam aplikasi POS warung melalui menu 'Shift & Kasir'. Pergantian kasir shift berlangsung instan di laptop warung.",
              },
              {
                q: "Siapa yang bisa saya hubungi jika saya mengalami kendala teknis?",
                a: "Tim kami siap membantu Anda setiap hari melalui kontak WhatsApp resmi yang tersedia di tombol bantuan halaman ini. Kami siap mendampingi panduan pemasangan kode hingga aplikasi kasir berjalan sempurna.",
              },
            ].map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} style={styles.faqCardNew}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    style={styles.faqQuestionBtn}
                  >
                    <span style={styles.faqQuestionText}>{faq.q}</span>
                    <span style={styles.faqChevronWrap}>
                      {isOpen ? <ChevronUp size={18} color="#ea580c" /> : <ChevronDown size={18} color="#64748b" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div style={styles.faqAnswerWrap}>
                      <p style={styles.faqAnswerText}>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. FOOTER LENGKAP */}
      <footer style={styles.footerWrap}>
        <div style={styles.footerContainer}>
          <div className="footer-grid" style={styles.footerGrid}>
            {/* Kolom 1: Brand & Info */}
            <div style={styles.footerBrandCol}>
              <a href="/" style={styles.footerLogo}>
                <Store size={22} color="#ea580c" style={{ flexShrink: 0 }} />
                <span>
                  POS Warung <strong style={{ color: "#f97316" }}>Madura</strong>
                </span>
              </a>
              <p style={styles.footerBrandDesc}>
                Layanan Struk Online &amp; Sinkronisasi Cloud untuk warung kelontong 24 jam dan UMKM Indonesia. Menghubungkan kasir offline dengan struk digital modern.
              </p>
              <div style={styles.footerBadgeGroup}>
                <span style={styles.footerMiniBadge}>Local-First Architecture</span>
                <span style={styles.footerMiniBadge}>Privasi Terjamin</span>
              </div>
            </div>

            {/* Kolom 2: Navigasi Cepat */}
            <div style={styles.footerLinkCol}>
              <h4 style={styles.footerColTitle}>Navigasi</h4>
              <ul style={styles.footerLinkList}>
                <li>
                  <button type="button" onClick={() => scrollToSection("cara-kerja")} style={styles.footerLinkBtn}>
                    Cara Kerja
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("harga")} style={styles.footerLinkBtn}>
                    Harga &amp; Paket
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("keunggulan")} style={styles.footerLinkBtn}>
                    Keunggulan &amp; Testimoni
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("faq")} style={styles.footerLinkBtn}>
                    Tanya Jawab (FAQ)
                  </button>
                </li>
              </ul>
            </div>

            {/* Kolom 3: Kebijakan & Keamanan */}
            <div style={styles.footerLinkCol}>
              <h4 style={styles.footerColTitle}>Kebijakan &amp; Legal</h4>
              <ul style={styles.footerLinkList}>
                <li style={styles.footerLinkText}>Kebijakan Privasi Data Lokal</li>
                <li style={styles.footerLinkText}>Syarat &amp; Ketentuan Layanan</li>
                <li style={styles.footerLinkText}>Keamanan Struk Digital</li>
                <li style={styles.footerLinkText}>SOP Pergantian Kasir Shift</li>
              </ul>
            </div>

            {/* Kolom 4: Hubungi Kami & Unduhan */}
            <div style={styles.footerLinkCol}>
              <h4 style={styles.footerColTitle}>Bantuan &amp; Unduhan</h4>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12 }}>
                Unduh aplikasi kasir desktop Windows atau konsultasi via WhatsApp:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a
                  href={POS_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(37, 99, 235, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.4)",
                    color: "#93c5fd",
                    padding: "9px 14px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  <Download size={15} />
                  <span>Download POS (Windows)</span>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    "Halo Admin POS Warung Madura, saya butuh panduan untuk aktivasi toko dan struk digital."
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.footerWaBtn}
                >
                  <Phone size={14} />
                  <span>Chat WhatsApp Admin</span>
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom-row" style={styles.footerBottomRow}>
            <p style={styles.copyrightText}>
              © 2026 POS Warung Madura Cloud SaaS. Seluruh Hak Cipta Dilindungi.
            </p>
            <a href="/admin/login" style={styles.adminLoginLink}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Login Admin Internal <ArrowRight size={13} />
              </span>
            </a>
          </div>
        </div>
      </footer>

      {/* 9. FLOATING WHATSAPP BUTTON UNTUK BANTUAN CEPAT */}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(
          "Halo Admin POS Warung Madura, saya ingin bertanya seputar pendaftaran toko dan struk digital."
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-wa-button"
        style={styles.floatingWaButton}
        title="Chat Bantuan WhatsApp"
      >
        <MessageCircle size={22} color="#ffffff" />
        <span className="floating-wa-text" style={styles.floatingWaText}>Bantuan WhatsApp</span>
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles: Curated Warm Warung Palette, Premium Glass, Responsive
// ─────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#0f172a",
    overflowX: "hidden",
  },

  // Navbar
  nav: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    background: "rgba(255, 255, 255, 0.94)",
    backdropFilter: "blur(14px)",
    borderBottom: "1px solid #e2e8f0",
    zIndex: 60,
    height: 68,
    display: "flex",
    alignItems: "center",
  },
  navInner: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "0 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  logo: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
  },
  navLinks: {
    display: "flex",
    gap: 16,
    alignItems: "center",
  },
  navLinkBtn: {
    color: "#475569",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    padding: "6px 10px",
    borderRadius: 8,
    transition: "color 0.15s",
  },
  navCtaBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 18px",
    background: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
    color: "#ffffff",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(234, 88, 12, 0.25)",
  },
  navBtnSecondary: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    background: "#f1f5f9",
    color: "#334155",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
  },
  navBtnDownload: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.15s",
    textDecoration: "none",
  },

  // Hero Section
  heroSection: {
    padding: "120px 20px 70px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    borderBottom: "1px solid #e2e8f0",
  },
  heroContainer: {
    maxWidth: 1180,
    margin: "0 auto",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 48,
    alignItems: "center",
  },
  heroTextCol: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 700,
    color: "#c2410c",
    width: "fit-content",
  },
  heroTitle: {
    fontSize: "clamp(30px, 4.5vw, 46px)",
    fontWeight: 900,
    lineHeight: 1.15,
    color: "#0f172a",
    letterSpacing: "-0.025em",
    margin: 0,
  },
  heroGradient: {
    background: "linear-gradient(135deg, #ea580c 0%, #f97316 50%, #f59e0b 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 1.6,
    color: "#475569",
    margin: 0,
    maxWidth: 540,
  },
  heroActionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  heroPrimaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 26px",
    background: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
    color: "#ffffff",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(234, 88, 12, 0.3)",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  heroSecondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "14px 22px",
    background: "#ffffff",
    border: "1.5px solid #cbd5e1",
    color: "#334155",
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  heroDownloadBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "14px 22px",
    background: "#f0fdf4",
    border: "1.5px solid #86efac",
    color: "#15803d",
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
    boxShadow: "0 2px 8px rgba(34, 197, 94, 0.12)",
    transition: "transform 0.15s, background 0.15s",
  },
  trustPillRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  trustPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "#334155",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },

  // Mockup Struk Digital
  heroMockupCol: {
    display: "flex",
    justifyContent: "center",
  },
  mockupWrapper: {
    position: "relative",
    width: "100%",
    maxWidth: 380,
  },
  mockupGlow: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    background: "radial-gradient(circle, rgba(249, 115, 22, 0.18) 0%, rgba(249, 115, 22, 0) 70%)",
    filter: "blur(24px)",
    zIndex: 0,
  },
  receiptCard: {
    position: "relative",
    zIndex: 1,
    background: "#ffffff",
    borderRadius: 20,
    boxShadow: "0 16px 40px -12px rgba(0, 0, 0, 0.12)",
    border: "1px solid #e2e8f0",
    padding: "24px 22px",
    fontFamily: "'Courier New', Courier, monospace",
  },
  receiptHeader: {
    textAlign: "center",
  },
  receiptBrandBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 800,
    background: "#f1f5f9",
    color: "#64748b",
    padding: "2px 8px",
    borderRadius: 6,
    marginBottom: 8,
    fontFamily: "inherit",
    letterSpacing: "0.05em",
  },
  receiptStoreName: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
    margin: "0 0 4px",
    letterSpacing: "-0.01em",
  },
  receiptStoreMeta: {
    fontSize: 11,
    color: "#64748b",
    margin: "1px 0",
  },
  receiptDividerDashed: {
    borderTop: "1px dashed #cbd5e1",
    margin: "12px 0",
  },
  receiptDividerSolid: {
    borderTop: "1.5px solid #0f172a",
    margin: "12px 0",
  },
  receiptMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#475569",
    margin: "2px 0",
  },
  receiptItemList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  receiptItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    fontSize: 12,
  },
  receiptItemTitle: {
    fontWeight: 700,
    color: "#0f172a",
  },
  receiptItemSubtitle: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 1,
  },
  receiptItemPrice: {
    fontWeight: 700,
    color: "#0f172a",
  },
  receiptSummary: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 12,
    color: "#334155",
  },
  receiptSummaryRow: {
    display: "flex",
    justifyContent: "space-between",
  },
  receiptQrSection: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "#f8fafc",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
  },
  qrBox: {
    background: "#ffffff",
    padding: 6,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  qrTextCol: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  qrTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: "#0f172a",
  },
  qrSubtitle: {
    fontSize: 10,
    color: "#64748b",
    lineHeight: 1.35,
  },
  qrPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 9,
    fontWeight: 700,
    color: "#15803d",
    background: "#dcfce7",
    padding: "2px 6px",
    borderRadius: 4,
    width: "fit-content",
    marginTop: 2,
  },
  receiptJaggedEdge: {
    marginTop: 16,
    height: 6,
    background: "repeating-linear-gradient(-45deg, #e2e8f0 0, #e2e8f0 4px, transparent 0, transparent 8px)",
  },

  // Sections Common
  sectionLight: {
    padding: "70px 20px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },
  sectionWhite: {
    padding: "70px 20px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
  },
  sectionForm: {
    padding: "70px 20px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
  },
  sectionContainer: {
    maxWidth: 1180,
    margin: "0 auto",
  },
  sectionContainerNarrow: {
    maxWidth: 780,
    margin: "0 auto",
  },
  sectionHeader: {
    textAlign: "center",
    marginBottom: 44,
  },
  sectionTag: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 800,
    color: "#ea580c",
    letterSpacing: "0.08em",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: "clamp(24px, 3.5vw, 34px)",
    fontWeight: 900,
    color: "#0f172a",
    margin: "0 0 10px",
    letterSpacing: "-0.02em",
  },
  sectionSubtitle: {
    fontSize: 15,
    color: "#64748b",
    maxWidth: 580,
    margin: "0 auto",
    lineHeight: 1.55,
  },

  // Steps Grid
  stepsCardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 24,
  },
  stepCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: "32px 24px",
    position: "relative",
    boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
  },
  stepCardNumber: {
    position: "absolute",
    top: 20,
    right: 24,
    fontSize: 28,
    fontWeight: 900,
    color: "#f1f5f9",
  },
  stepIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  stepCardTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 8px",
  },
  stepCardDesc: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.6,
    margin: 0,
  },
  downloadAppBanner: {
    marginTop: 32,
    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    border: "1.5px solid #bfdbfe",
    borderRadius: 22,
    padding: "24px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 18,
    boxShadow: "0 6px 20px rgba(37, 99, 235, 0.08)",
  },
  downloadIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 2px 6px rgba(37, 99, 235, 0.1)",
  },
  downloadBannerTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#1e3a8a",
    margin: "0 0 4px",
  },
  downloadBannerDesc: {
    fontSize: 13,
    color: "#1e40af",
    lineHeight: 1.5,
    margin: 0,
    maxWidth: 600,
  },
  downloadBannerBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "13px 22px",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
    transition: "background 0.15s, transform 0.15s",
  },

  // Form Layout Grid
  formLayoutGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 380px",
    gap: 36,
    alignItems: "start",
  },
  formCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: "36px 32px",
    boxShadow: "0 10px 30px -10px rgba(0,0,0,0.05)",
  },
  formHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    paddingBottom: 20,
    borderBottom: "1px solid #f1f5f9",
    marginBottom: 24,
  },
  formHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  formHeaderTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  },
  formHeaderSubtitle: {
    fontSize: 13,
    color: "#64748b",
    margin: "3px 0 0",
  },
  errorAlert: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: 12,
    padding: "12px 16px",
    color: "#991b1b",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 20,
  },
  formBody: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
  },
  requiredStar: {
    color: "#ef4444",
  },
  inputBox: {
    position: "relative",
  },
  boxIcon: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
  },
  textInput: {
    width: "100%",
    height: 48,
    padding: "0 14px 0 42px",
    border: "1.5px solid #cbd5e1",
    borderRadius: 12,
    fontSize: 14,
    color: "#0f172a",
    background: "#ffffff",
    transition: "border-color 0.15s",
  },
  slugPreviewBox: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 11,
    color: "#7c2d12",
    marginTop: 4,
  },
  inputHint: {
    fontSize: 11,
    color: "#64748b",
    margin: "2px 0 0",
    lineHeight: 1.4,
  },
  agreementRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    cursor: "pointer",
    padding: "6px 0",
    userSelect: "none",
  },
  agreementText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 1.45,
  },
  submitButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    background: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 800,
    width: "100%",
    marginTop: 6,
    boxShadow: "0 4px 14px rgba(234, 88, 12, 0.28)",
  },
  securityTrustRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },

  // Sidebar Col
  sidebarCol: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  sidebarCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: "24px 22px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
  },
  sidebarCardTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  },
  freeBadgeSolid: {
    fontSize: 11,
    fontWeight: 700,
    background: "#dcfce7",
    color: "#15803d",
    padding: "3px 8px",
    borderRadius: 6,
  },
  priceRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    margin: "12px 0 4px",
  },
  priceAmount: {
    fontSize: 28,
    fontWeight: 900,
    color: "#0f172a",
  },
  pricePeriod: {
    fontSize: 13,
    color: "#64748b",
  },
  priceSubtitle: {
    fontSize: 12,
    color: "#64748b",
    margin: "0 0 16px",
    lineHeight: 1.4,
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    borderTop: "1px solid #f1f5f9",
    paddingTop: 14,
  },
  featureListItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#334155",
  },
  guaranteeBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 18,
    padding: "18px 18px",
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#166534",
    margin: "0 0 4px",
  },
  guaranteeText: {
    fontSize: 11,
    color: "#15803d",
    lineHeight: 1.5,
    margin: 0,
  },

  // Pricing Grid
  pricingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 28,
    marginBottom: 32,
  },
  pricingTierCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 32,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
  },
  pricingTierCardPro: {
    background: "linear-gradient(160deg, #fff7ed 0%, #ffffff 100%)",
    border: "2px solid #ea580c",
    borderRadius: 22,
    padding: 32,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    boxShadow: "0 10px 30px rgba(234, 88, 12, 0.12)",
  },
  proRibbon: {
    position: "absolute",
    top: -12,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#ea580c",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 12px",
    borderRadius: 999,
    letterSpacing: "0.06em",
  },
  tierHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  tierName: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  },
  tierBadgeFree: {
    fontSize: 11,
    fontWeight: 700,
    background: "#f1f5f9",
    color: "#475569",
    padding: "3px 8px",
    borderRadius: 6,
  },
  tierBadgePro: {
    fontSize: 11,
    fontWeight: 700,
    background: "#ffedd5",
    color: "#c2410c",
    padding: "3px 8px",
    borderRadius: 6,
  },
  tierPriceRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    margin: "8px 0 4px",
  },
  tierPriceBig: {
    fontSize: 32,
    fontWeight: 900,
    color: "#0f172a",
  },
  tierPricePeriod: {
    fontSize: 13,
    color: "#64748b",
  },
  tierDesc: {
    fontSize: 13,
    color: "#64748b",
    margin: "0 0 20px",
    lineHeight: 1.45,
  },
  tierFeatureList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    borderTop: "1px solid #f1f5f9",
    paddingTop: 18,
    marginBottom: 24,
    flex: 1,
  },
  tierFeatureItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "#334155",
  },
  tierBtnSecondary: {
    width: "100%",
    padding: "13px 20px",
    background: "#f1f5f9",
    color: "#0f172a",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "center",
    transition: "background 0.15s",
  },
  tierBtnPro: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: "13px 20px",
    background: "#ea580c",
    color: "#ffffff",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
    boxShadow: "0 4px 12px rgba(234, 88, 12, 0.3)",
  },

  // Quota Notice Box
  quotaNoticeBox: {
    background: "#ffffff",
    border: "1px solid #fed7aa",
    borderRadius: 18,
    padding: "20px 24px",
    boxShadow: "0 4px 12px rgba(249, 115, 22, 0.05)",
  },
  quotaIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "#fff7ed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  quotaNoticeTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#9a3412",
    margin: "0 0 4px",
  },
  quotaNoticeText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.55,
    margin: 0,
  },

  // Testimonials Grid
  testimonialsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 24,
  },
  testimonialCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 26,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  starRow: {
    display: "flex",
    gap: 3,
    marginBottom: 12,
  },
  testimonialQuote: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#334155",
    fontStyle: "italic",
    margin: "0 0 18px",
    flex: 1,
  },
  testimonialAuthorRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 14,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    background: "#ffedd5",
    color: "#ea580c",
    fontSize: 13,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  authorName: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },
  authorStore: {
    fontSize: 11,
    color: "#64748b",
  },

  // FAQ Accordion
  faqAccordionList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  faqCardNew: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
  },
  faqQuestionBtn: {
    width: "100%",
    padding: "18px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    cursor: "pointer",
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.4,
  },
  faqChevronWrap: {
    flexShrink: 0,
  },
  faqAnswerWrap: {
    padding: "0 20px 18px",
    borderTop: "1px solid #f8fafc",
  },
  faqAnswerText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.6,
    margin: 0,
  },

  // Footer
  footerWrap: {
    background: "#0f172a",
    color: "#ffffff",
    padding: "70px 20px 30px",
  },
  footerContainer: {
    maxWidth: 1180,
    margin: "0 auto",
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 40,
    marginBottom: 50,
  },
  footerBrandCol: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  footerLogo: {
    fontSize: 18,
    fontWeight: 800,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  footerBrandDesc: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.6,
    margin: 0,
  },
  footerBadgeGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  footerMiniBadge: {
    fontSize: 10,
    background: "#1e293b",
    color: "#cbd5e1",
    padding: "3px 8px",
    borderRadius: 6,
    fontWeight: 600,
  },
  footerLinkCol: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  footerColTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#ffffff",
    margin: "0 0 6px",
  },
  footerLinkList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  footerLinkBtn: {
    color: "#94a3b8",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
    transition: "color 0.15s",
  },
  footerLinkText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  footerWaBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#22c55e",
    color: "#ffffff",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    width: "fit-content",
  },
  footerBottomRow: {
    borderTop: "1px solid #1e293b",
    paddingTop: 24,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  copyrightText: {
    fontSize: 12,
    color: "#64748b",
    margin: 0,
  },
  adminLoginLink: {
    fontSize: 12,
    color: "#64748b",
    transition: "color 0.15s",
  },

  // Floating WhatsApp Button
  floatingWaButton: {
    position: "fixed",
    bottom: 24,
    right: 24,
    background: "#25D366",
    color: "#ffffff",
    borderRadius: 999,
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 6px 20px rgba(37, 211, 102, 0.4)",
    zIndex: 99,
    fontWeight: 700,
    fontSize: 13,
    transition: "transform 0.15s",
  },
  floatingWaText: {
    color: "#ffffff",
  },

  // Success Screen Styles
  main: {
    maxWidth: 1140,
    margin: "0 auto",
    padding: "0 20px 80px",
  },
  successWrapper: {
    maxWidth: 780,
    margin: "0 auto",
  },
  successIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 999,
    background: "#dcfce7",
    border: "2px solid #86efac",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  successTitle: {
    fontSize: 30,
    fontWeight: 900,
    color: "#0f172a",
    margin: "0 0 8px",
  },
  successSubtitle: {
    fontSize: 15,
    color: "#64748b",
    lineHeight: 1.5,
    margin: 0,
  },
  tokenHeroCard: {
    background: "#ffffff",
    border: "2px solid #ea580c",
    borderRadius: 22,
    padding: "28px 24px",
    marginBottom: 24,
    boxShadow: "0 8px 30px rgba(234, 88, 12, 0.1)",
  },
  tokenCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  tokenIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#fff7ed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tokenHeroLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },
  tokenHeroTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    margin: "2px 0 0",
  },
  freeBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 700,
    background: "#dcfce7",
    color: "#15803d",
    padding: "4px 10px",
    borderRadius: 8,
  },
  tokenBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "#0f172a",
    borderRadius: 14,
    padding: "14px 18px",
    marginBottom: 14,
  },
  tokenTextWrap: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tokenText: {
    fontFamily: "monospace",
    fontSize: 15,
    fontWeight: 700,
    color: "#f8fafc",
    letterSpacing: "0.08em",
  },
  tokenActionBtn: {
    padding: 8,
    color: "#94a3b8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  copyBtnPrimary: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    background: "#ea580c",
    color: "#ffffff",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  copyBtnSuccess: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    background: "#16a34a",
    color: "#ffffff",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  tokenSecurityHint: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#475569",
    background: "#f8fafc",
    padding: "10px 14px",
    borderRadius: 10,
    lineHeight: 1.45,
  },
  guideCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  guideCardTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  },
  guideCardSubtitle: {
    fontSize: 13,
    color: "#64748b",
    margin: "0 0 18px",
    lineHeight: 1.45,
  },
  stepGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  stepItem: {
    background: "#f8fafc",
    borderRadius: 14,
    padding: 16,
    display: "flex",
    gap: 12,
  },
  stepNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: "#ea580c",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepContent: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  },
  stepDesc: {
    fontSize: 12,
    color: "#64748b",
    margin: 0,
    lineHeight: 1.4,
  },
  detailsCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  detailsHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  detailsGrid: {
    display: "flex",
    flexDirection: "column",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 13,
  },
  detailLabel: {
    color: "#64748b",
  },
  detailValue: {
    color: "#0f172a",
    fontWeight: 600,
  },
  detailCodeBadge: {
    fontFamily: "monospace",
    fontWeight: 700,
    color: "#ea580c",
    background: "#fff7ed",
    padding: "2px 8px",
    borderRadius: 6,
  },
  detailLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    color: "#ea580c",
    fontWeight: 600,
    textDecoration: "underline",
  },
  accordionWrap: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  },
  accordionHeaderBtn: {
    width: "100%",
    padding: "14px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
  },
  accordionBody: {
    padding: "0 20px 20px",
    borderTop: "1px solid #f8fafc",
  },
  credBox: {
    background: "#0f172a",
    borderRadius: 12,
    overflow: "hidden",
  },
  credHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "#1e293b",
  },
  credTitle: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#94a3b8",
  },
  copyBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "#ffffff",
    cursor: "pointer",
  },
  envPre: {
    margin: 0,
    padding: 14,
    fontSize: 12,
    fontFamily: "monospace",
    color: "#f8fafc",
    overflowX: "auto",
    lineHeight: 1.5,
  },
  upgradeBox: {
    background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
    border: "1px solid #fed7aa",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  upgradeLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    maxWidth: 520,
  },
  upgradeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  upgradeTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#9a3412",
    margin: "0 0 3px",
  },
  upgradeDesc: {
    fontSize: 12,
    color: "#78350f",
    lineHeight: 1.45,
    margin: 0,
  },
  waBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 20px",
    background: "#ea580c",
    color: "#ffffff",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
  },
  backHomeBtn: {
    fontSize: 13,
    fontWeight: 700,
    color: "#64748b",
  },
};
