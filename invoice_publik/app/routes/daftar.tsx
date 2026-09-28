import { useState } from "react";
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, useActionData, useNavigation } from "react-router";
import {
  Store,
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
} from "lucide-react";
import { registerTenant } from "../services/tenant.server";
import { sendCredentialEmail } from "../services/email.server";

export const meta: MetaFunction = () => [
  { title: "Daftar Toko — Platform Invoice Publik SaaS POS Warung" },
  {
    name: "description",
    content:
      "Daftarkan toko gratis dalam 1 menit. Dapatkan Secret Key untuk integrasi 1-klik struk digital publik langsung ke aplikasi POS Warung Madura.",
  },
];

// ─────────────────────────────────────────────────────────────
// Action: POST /daftar — register toko baru
// ─────────────────────────────────────────────────────────────
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const store_name = String(formData.get("store_name") || "").trim();
  const store_address = String(formData.get("store_address") || "").trim();
  const owner_email = String(formData.get("owner_email") || "").trim();
  const contact_wa = String(formData.get("contact_wa") || "").trim();

  // Validasi sederhana
  if (!store_name) return { success: false, error: "Nama toko wajib diisi" };
  if (!owner_email || !owner_email.includes("@"))
    return { success: false, error: "Email pemilik tidak valid (wajib mengandung @)" };

  const result = await registerTenant({ store_name, store_address, owner_email, contact_wa });

  if (!result.success || !result.tenant) {
    return { success: false, error: result.error || "Gagal mendaftarkan toko" };
  }

  const { tenant } = result;
  const freeLimit = Number(process.env.FREE_INVOICE_LIMIT) || 50;
  const baseUrl = (process.env.PUBLIC_BASE_URL || "http://localhost:5175").replace(/\/$/, "");

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
    storeCode: tenant.store_code,
    storeSlug: tenant.store_slug,
    storeAddress: tenant.store_address,
    syncSecret: tenant.sync_secret,
    invoicePageUrl: `${baseUrl}/${tenant.store_slug}/invoice/`,
    syncUrl: `${baseUrl}/api/sync`,
    baseUrl,
    freeLimit,
  };
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function DaftarPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [copied, setCopied] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showManualEnv, setShowManualEnv] = useState(false);

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2500);
    }
  };

  const proPrice = 25000;

  // ── TAMPILAN SUKSES (SESUAI SISTEM 1-KLIK TOKEN TERBARU) ───
  if (actionData?.success) {
    const d = actionData as {
      success: true;
      storeName: string;
      storeCode: string;
      storeSlug: string;
      storeAddress?: string | null;
      syncSecret: string;
      invoicePageUrl: string;
      syncUrl: string;
      baseUrl: string;
      freeLimit: number;
    };

    const envContent = `# ── Konfigurasi Otomatis POS Warung Madura ──────────────
STORE_CODE=${d.storeCode}
STORE_NAME=${d.storeName}
STORE_SLUG=${d.storeSlug}
PUBLIC_INVOICE_SYNC_URL=${d.syncUrl}
PUBLIC_INVOICE_BASE_URL=${d.baseUrl}
SYNC_SECRET_KEY=${d.syncSecret}`;

    return (
      <div style={styles.page}>
        <nav style={styles.nav}>
          <div style={styles.navInner}>
            <a href="/" style={styles.logo}>
              🏪 <span>POS Warung <strong style={{ color: "#f97316" }}>SaaS</strong></span>
            </a>
            <div style={styles.navLinks}>
              <a href="/" style={styles.navLink}>Beranda</a>
              <a href="/admin/login" style={styles.navLink}>Admin</a>
            </div>
          </div>
        </nav>

        <main style={{ ...styles.main, paddingTop: 100 }}>
          <div style={styles.successWrapper}>
            {/* Header Badge & Title */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={styles.successIconBadge}>
                <CheckCircle2 size={44} color="#16a34a" />
              </div>
              <h1 style={styles.successTitle}>Pendaftaran Berhasil! 🎉</h1>
              <p style={styles.successSubtitle}>
                Toko <strong>{d.storeName}</strong> ({d.storeCode}) telah aktif di platform Cloud SaaS.
                <br />
                Gunakan panduan <strong>1-Klik di bawah</strong> untuk menghubungkan langsung ke aplikasi POS.
              </p>
            </div>

            {/* KARTU UTAMA: SECRET KEY TOKEN (SETUP 1-INPUT) */}
            <div style={styles.tokenHeroCard}>
              <div style={styles.tokenCardHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={styles.tokenIconBadge}>
                    <Key size={20} color="#f59e0b" />
                  </div>
                  <div>
                    <span style={styles.tokenHeroLabel}>Secret Key Toko Anda (Token Integrasi)</span>
                    <h3 style={styles.tokenHeroTitle}>{d.storeName} • {d.storeCode}</h3>
                  </div>
                </div>
                <span style={styles.freeBadge}>
                  <Sparkles size={12} color="#15803d" /> Free Tier ({d.freeLimit} Struk/bln)
                </span>
              </div>

              {/* Token Display Bar with 1-Click Copy */}
              <div style={styles.tokenBox}>
                <div style={styles.tokenTextWrap}>
                  <span style={styles.tokenText}>
                    {showSecret ? d.syncSecret : "••••••••••••••••••••••••••••••••••••••••••••••••"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    style={styles.tokenActionBtn}
                    title={showSecret ? "Sembunyikan Secret" : "Tampilkan Secret"}
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
                        <Copy size={16} /> Salin Token
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p style={styles.tokenSecurityHint}>
                🔒 <strong>Penting:</strong> Simpan token ini dengan aman. Kredensial lengkap juga telah dikirimkan ke email Anda.
              </p>
            </div>

            {/* PANDUAN 3 LANGKAH HUBUNGKAN KE POS WARUNG MADURA */}
            <div style={styles.guideCard}>
              <h3 style={styles.guideCardTitle}>
                <Laptop size={20} color="#f97316" />
                Cara Menghubungkan ke POS Warung Madura (Setup 1-Klik)
              </h3>
              <p style={styles.guideCardSubtitle}>
                Tidak perlu lagi mengisi atau mengedit file .env secara manual! Semua identitas toko akan otomatis tersinkron dari cloud.
              </p>

              <div style={styles.stepGrid}>
                {/* Langkah 1 */}
                <div style={styles.stepItem}>
                  <div style={styles.stepNumBadge}>1</div>
                  <div style={styles.stepContent}>
                    <h4 style={styles.stepTitle}>Salin Secret Key</h4>
                    <p style={styles.stepDesc}>
                      Klik tombol <strong>"Salin Token"</strong> di atas untuk menyalin token rahasia ke clipboard Anda.
                    </p>
                  </div>
                </div>

                {/* Langkah 2 */}
                <div style={styles.stepItem}>
                  <div style={styles.stepNumBadge}>2</div>
                  <div style={styles.stepContent}>
                    <h4 style={styles.stepTitle}>Buka POS Warung Madura</h4>
                    <p style={styles.stepDesc}>
                      Buka aplikasi POS di laptop toko Anda. Pada sidebar kiri atas, klik tombol <strong>"Cloud Off"</strong> atau menu <strong>Cloud SaaS</strong>.
                    </p>
                  </div>
                </div>

                {/* Langkah 3 */}
                <div style={styles.stepItem}>
                  <div style={styles.stepNumBadge}>3</div>
                  <div style={styles.stepContent}>
                    <h4 style={styles.stepTitle}>Tempel &amp; Klik Hubungkan</h4>
                    <p style={styles.stepDesc}>
                      Tempelkan Secret Key ke kolom input, lalu klik <strong>"Hubungkan Otomatis"</strong>. Profil toko, nama warung, kode, dan kuota akan otomatis terpasang!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RINGKASAN DATA TOKO & STRUK DIGITAL */}
            <div style={styles.detailsCard}>
              <div style={styles.detailsHeader}>
                <Store size={18} color="#475569" />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                  Ringkasan Akun Toko Cloud
                </span>
              </div>
              <div style={styles.detailsGrid}>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Nama Warung:</span>
                  <span style={styles.detailValue}>{d.storeName}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Kode Toko (Prefix Faktur):</span>
                  <span style={styles.detailCodeBadge}>{d.storeCode}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Slug URL:</span>
                  <span style={styles.detailValue}>/{d.storeSlug}</span>
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
                    <span>{d.baseUrl}/{d.storeSlug}/invoice/{d.storeCode}-XXXXXX</span>
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
                <ChevronDown
                  size={16}
                  style={{
                    transform: showManualEnv ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                />
              </button>

              {showManualEnv && (
                <div style={styles.accordionBody}>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
                    Jika Anda lebih memilih konfigurasi via teks, salin baris berikut dan tempelkan ke file <code>pos_warung_madura/.env</code>:
                  </p>
                  <div style={styles.credBox}>
                    <div style={styles.credHeader}>
                      <span style={styles.credTitle}>
                        pos_warung_madura/.env
                      </span>
                      <button
                        style={styles.copyBtn}
                        onClick={() => handleCopy(envContent, "env")}
                      >
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
            <div style={styles.upgradeBox}>
              <div style={styles.upgradeLeft}>
                <div style={styles.upgradeIcon}>
                  <Zap size={24} color="#f97316" />
                </div>
                <div>
                  <h4 style={styles.upgradeTitle}>Ingin Struk Digital Unlimited Tanpa Batas?</h4>
                  <p style={styles.upgradeDesc}>
                    Upgrade ke <strong>Paket Pro</strong> hanya <strong>Rp {proPrice.toLocaleString("id-ID")}/bulan</strong>. Dapatkan kuota tak terbatas, sinkronisasi prioritas, dan bantuan langsung dari tim support.
                  </p>
                </div>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Halo Admin POS Warung, saya ingin upgrade paket Pro untuk toko: ${d.storeName} (${d.storeCode})`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.waBtn}
              >
                <span>Upgrade ke Pro (Rp 25rb)</span>
                <ArrowRight size={16} />
              </a>
            </div>

            <div style={{ textAlign: "center", marginTop: 32 }}>
              <a href="/" style={styles.backHomeBtn}>
                ← Kembali ke Halaman Utama
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── FORM PENDAFTARAN TOKO BARU ──────────────────────────────
  return (
    <div style={styles.page}>
      {/* Navbar Glassmorphism */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <a href="/" style={styles.logo}>
            🏪 <span>POS Warung <strong style={{ color: "#f97316" }}>SaaS</strong></span>
          </a>
          <div style={styles.navLinks}>
            <a href="/" style={styles.navLink}>Beranda</a>
            <a href="/admin/login" style={styles.navLink}>Login Admin</a>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <section style={styles.hero}>
        <div style={styles.heroBadge}>
          <Sparkles size={14} color="#f97316" />
          <span>Integrasi 1-Klik — Gratis 50 Struk Digital / Bulan</span>
        </div>
        <h1 style={styles.heroTitle}>
          Daftarkan Toko Anda,
          <br />
          <span style={styles.heroGradient}>Aktifkan Struk Publik Cloud</span>
        </h1>
        <p style={styles.heroDesc}>
          Setiap struk kasir POS lokal otomatis dibuatkan halaman web resmi dan QR Code yang dapat dipindai oleh pelanggan Anda 24 jam non-stop.
        </p>

        {/* Feature Pills */}
        <div style={styles.featurePills}>
          {[
            { icon: <Zap size={14} color="#f97316" />, text: "Setup 1-Klik (Input Token di POS)" },
            { icon: <Globe size={14} color="#2563eb" />, text: "Struk Digital Online per Transaksi" },
            { icon: <Shield size={14} color="#16a34a" />, text: "Data Omzet & Stok Tetap Privat" },
            { icon: <Receipt size={14} color="#9333ea" />, text: "Bebas Kertas & Ramah Lingkungan" },
          ].map((f, i) => (
            <div key={i} style={styles.featurePill}>
              {f.icon}
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Main Content Layout: Form + Info Sidebar */}
      <main style={styles.main}>
        <div style={styles.twoCol}>
          {/* Kolom Kiri: Form Pendaftaran */}
          <div style={styles.formCard}>
            <div style={styles.formCardHeader}>
              <div style={styles.formCardIcon}>
                <Store size={22} color="#f97316" />
              </div>
              <div>
                <h2 style={styles.formTitle}>Formulir Registrasi Toko</h2>
                <p style={styles.formSubtitle}>Isi data singkat berikut untuk membuat akun toko dan Secret Key</p>
              </div>
            </div>

            {actionData?.success === false && (
              <div style={styles.errorBox}>
                ⚠️ {(actionData as { success: false; error?: string }).error}
              </div>
            )}

            <Form method="post" style={styles.form}>
              {/* Nama Toko */}
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="store_name">
                  Nama Warung / Toko <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={styles.inputWrap}>
                  <Store size={18} color="#94a3b8" style={styles.inputIcon} />
                  <input
                    id="store_name"
                    name="store_name"
                    type="text"
                    placeholder="Contoh: Warung Madura Berkah"
                    required
                    style={styles.input}
                    disabled={isSubmitting}
                  />
                </div>
                <p style={styles.hint}>
                  Akan menjadi nama resmi di struk digital dan membuat slug URL toko otomatis.
                </p>
              </div>

              {/* Alamat Toko */}
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="store_address">
                  Alamat Lengkap Toko
                </label>
                <div style={styles.inputWrap}>
                  <MapPin size={18} color="#94a3b8" style={styles.inputIcon} />
                  <input
                    id="store_address"
                    name="store_address"
                    type="text"
                    placeholder="Contoh: Jl. Raya Warung Madura No. 24, Buka 24 Jam"
                    style={styles.input}
                    disabled={isSubmitting}
                  />
                </div>
                <p style={styles.hint}>Ditampilkan di bagian header struk digital pelanggan.</p>
              </div>

              {/* Email Pemilik */}
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="owner_email">
                  Email Pemilik Warung <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={styles.inputWrap}>
                  <Mail size={18} color="#94a3b8" style={styles.inputIcon} />
                  <input
                    id="owner_email"
                    name="owner_email"
                    type="email"
                    placeholder="pemilik@warungmadura.com"
                    required
                    style={styles.input}
                    disabled={isSubmitting}
                  />
                </div>
                <p style={styles.hint}>
                  Token Secret Key &amp; kredensial cadangan akan dikirimkan ke email ini.
                </p>
              </div>

              {/* WhatsApp */}
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="contact_wa">
                  Nomor WhatsApp (Kasir / Pemilik)
                </label>
                <div style={styles.inputWrap}>
                  <Phone size={18} color="#94a3b8" style={styles.inputIcon} />
                  <input
                    id="contact_wa"
                    name="contact_wa"
                    type="tel"
                    placeholder="Contoh: 081234567890"
                    style={styles.input}
                    disabled={isSubmitting}
                  />
                </div>
                <p style={styles.hint}>Untuk bantuan teknis cepat dan aktivasi paket Pro.</p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  ...styles.submitBtn,
                  opacity: isSubmitting ? 0.7 : 1,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                    Membuat Akun &amp; Secret Key...
                  </>
                ) : (
                  <>
                    <span>Daftar Sekarang &amp; Dapatkan Token</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div style={styles.securityNotice}>
                <ShieldCheck size={16} color="#16a34a" />
                <span>Pendaftaran instan tanpa kartu kredit. Token langsung dapat digunakan seketika.</span>
              </div>
            </Form>
          </div>

          {/* Kolom Kanan: Perbandingan Paket & FAQ */}
          <div style={styles.pricingCol}>
            {/* Kartu Free */}
            <div style={styles.pricingCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={styles.pricingTitle}>Paket Free</h3>
                <span style={styles.freeBadge}>Pilihan Awal</span>
              </div>
              <div style={styles.pricingPrice}>
                Rp 0 <span style={styles.pricingPeriod}>/ bulan</span>
              </div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
                Cocok untuk warung baru yang ingin mencoba struk digital.
              </p>
              <ul style={styles.featureList}>
                {[
                  "50 struk digital / bulan",
                  "Reset kuota otomatis tiap bulan",
                  "URL halaman struk toko unik",
                  "QR Code per struk transaksi",
                  "Sinkronisasi 1-klik ke POS",
                ].map((f, i) => (
                  <li key={i} style={styles.featureItem}>
                    <CheckCircle size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Kartu Pro Highlight */}
            <div style={{ ...styles.pricingCard, ...styles.proPricingCard }}>
              <div style={styles.popularBadge}>Rekomendasi</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ ...styles.pricingTitle, color: "#9a3412" }}>Paket Pro</h3>
              </div>
              <div style={styles.pricingPrice}>
                Rp {proPrice.toLocaleString("id-ID")} <span style={styles.pricingPeriod}>/ bulan</span>
              </div>
              <p style={{ fontSize: 13, color: "#78350f", marginBottom: 16 }}>
                Untuk warung ramai dengan transaksi intensif non-stop.
              </p>
              <ul style={styles.featureList}>
                {[
                  "Unlimited Struk Digital (Tanpa Batas)",
                  "Semua fitur Paket Free",
                  "Prioritas sinkronisasi cloud",
                  "Bantuan instalasi via WhatsApp",
                ].map((f, i) => (
                  <li key={i} style={{ ...styles.featureItem, color: "#78350f" }}>
                    <CheckCircle size={15} color="#ea580c" style={{ flexShrink: 0 }} />
                    <span><strong>{f}</strong></span>
                  </li>
                ))}
              </ul>
            </div>

            {/* FAQ Card */}
            <div style={styles.faqCard}>
              <h3 style={styles.faqTitle}>
                <HelpCircle size={16} color="#f97316" /> Pertanyaan Populer
              </h3>
              {[
                {
                  q: "Bagaimana cara menyambungkan ke POS?",
                  a: "Cukup salin Secret Key yang Anda dapatkan setelah daftar, lalu tempelkan di menu Cloud SaaS pada aplikasi POS Warung Madura.",
                },
                {
                  q: "Apakah data keuangan toko saya aman?",
                  a: "Sangat aman. Yang dikirim ke cloud hanya snapshot struk belanja untuk dibaca pembeli. Laporan laba, omzet, dan modal tetap tersimpan aman di database lokal Anda.",
                },
                {
                  q: "Kapan kuota free di-reset?",
                  a: "Kuota 50 struk gratis akan di-reset otomatis setiap tanggal 1 setiap bulannya.",
                },
              ].map((item, i) => (
                <div key={i} style={styles.faqItem}>
                  <p style={styles.faqQ}>{item.q}</p>
                  <p style={styles.faqA}>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>© 2026 POS Warung Madura Cloud SaaS — Solusi Struk Digital &amp; Kasir Warung 24 Jam</p>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input:focus { outline: none; border-color: #f97316 !important; box-shadow: 0 0 0 3px rgba(249,115,22,0.15); }
        a { text-decoration: none; }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles: Modern, Premium, Responsive
// ─────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#0f172a",
  },
  nav: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid #e2e8f0",
    zIndex: 50,
    height: 64,
    display: "flex",
    alignItems: "center",
  },
  navInner: {
    maxWidth: 1140,
    margin: "0 auto",
    padding: "0 24px",
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
  },
  navLinks: { display: "flex", gap: 20, alignItems: "center" },
  navLink: { color: "#475569", fontSize: 14, fontWeight: 600, transition: "color 0.15s" },

  hero: {
    maxWidth: 780,
    margin: "0 auto",
    padding: "130px 24px 50px",
    textAlign: "center",
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 999,
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 700,
    color: "#c2410c",
    marginBottom: 20,
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  heroTitle: {
    fontSize: "clamp(30px, 4.5vw, 48px)",
    fontWeight: 900,
    lineHeight: 1.18,
    marginBottom: 18,
    letterSpacing: "-0.02em",
    color: "#0f172a",
  },
  heroGradient: {
    background: "linear-gradient(135deg, #ea580c 0%, #f97316 50%, #f59e0b 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroDesc: {
    fontSize: 16,
    color: "#64748b",
    lineHeight: 1.6,
    marginBottom: 26,
    maxWidth: 640,
    margin: "0 auto 26px",
  },
  featurePills: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  featurePill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 999,
    padding: "7px 16px",
    fontSize: 13,
    color: "#334155",
    fontWeight: 600,
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
  },

  main: {
    maxWidth: 1140,
    margin: "0 auto",
    padding: "0 24px 80px",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 400px",
    gap: 32,
    alignItems: "start",
  },

  formCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: "36px 36px 40px",
    boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.05)",
  },
  formCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: "1px solid #f1f5f9",
  },
  formCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
    lineHeight: 1.2,
  },
  formSubtitle: {
    fontSize: 13,
    color: "#64748b",
    margin: "4px 0 0",
  },
  form: { display: "flex", flexDirection: "column", gap: 20 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: "#334155" },
  inputWrap: { position: "relative" },
  inputIcon: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "12px 14px 12px 42px",
    border: "1.5px solid #cbd5e1",
    borderRadius: 12,
    fontSize: 14,
    color: "#0f172a",
    background: "#ffffff",
    transition: "all 0.15s ease",
  },
  hint: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  submitBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "15px 24px",
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 800,
    width: "100%",
    marginTop: 8,
    boxShadow: "0 4px 14px rgba(234, 88, 12, 0.25)",
    transition: "opacity 0.2s, transform 0.1s",
  },
  securityNotice: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: 12,
    padding: "12px 16px",
    color: "#991b1b",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 20,
  },

  pricingCol: { display: "flex", flexDirection: "column", gap: 20 },
  pricingCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 24,
    position: "relative",
    boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
  },
  proPricingCard: {
    background: "linear-gradient(145deg, #fff7ed 0%, #ffffff 100%)",
    border: "2px solid #fdba74",
    boxShadow: "0 8px 24px rgba(249, 115, 22, 0.1)",
  },
  popularBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    background: "#ea580c",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 800,
    padding: "4px 10px",
    borderRadius: 999,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  freeBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 10px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#15803d",
    fontSize: 11,
    fontWeight: 800,
    border: "1px solid #bbf7d0",
  },
  pricingTitle: { fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 },
  pricingPrice: {
    fontSize: 26,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 6,
    display: "flex",
    alignItems: "baseline",
    gap: 4,
  },
  pricingPeriod: { fontSize: 13, fontWeight: 500, color: "#64748b" },
  featureList: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 },
  featureItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" },

  faqCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 24,
  },
  faqTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 16px",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  faqItem: { marginBottom: 16 },
  faqQ: { fontSize: 13, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" },
  faqA: { fontSize: 12, color: "#64748b", lineHeight: 1.55, margin: 0 },

  // ── Success Page Styles ──────────────────────────────────
  successWrapper: {
    maxWidth: 720,
    margin: "0 auto",
  },
  successIconBadge: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "#dcfce7",
    border: "3px solid #bbf7d0",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    boxShadow: "0 4px 16px rgba(22, 163, 74, 0.15)",
  },
  successTitle: { fontSize: 30, fontWeight: 900, color: "#0f172a", margin: "0 0 10px" },
  successSubtitle: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 1.6,
    maxWidth: 580,
    margin: "0 auto",
  },

  // Token Card
  tokenHeroCard: {
    background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)",
    borderRadius: 24,
    padding: "28px",
    color: "#ffffff",
    boxShadow: "0 12px 36px rgba(15, 23, 42, 0.25)",
    marginBottom: 24,
    border: "1px solid #334155",
  },
  tokenCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    flexWrap: "wrap",
    gap: 12,
  },
  tokenIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: "rgba(245, 158, 11, 0.15)",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tokenHeroLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#fbbf24",
    display: "block",
  },
  tokenHeroTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#ffffff",
    margin: "2px 0 0",
  },
  tokenBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 16,
    padding: "8px 12px 8px 18px",
    marginBottom: 12,
  },
  tokenTextWrap: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
  tokenText: {
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    fontSize: 14,
    fontWeight: 700,
    color: "#34d399",
    letterSpacing: "0.5px",
  },
  tokenActionBtn: {
    background: "rgba(255, 255, 255, 0.1)",
    border: "none",
    color: "#cbd5e1",
    padding: "8px 10px",
    borderRadius: 10,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
  },
  copyBtnPrimary: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#f97316",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    padding: "9px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.15s",
    boxShadow: "0 2px 8px rgba(249, 115, 22, 0.3)",
    whiteSpace: "nowrap",
  },
  copyBtnSuccess: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#16a34a",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    padding: "9px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "default",
    whiteSpace: "nowrap",
  },
  tokenSecurityHint: {
    fontSize: 12,
    color: "#94a3b8",
    margin: 0,
    lineHeight: 1.5,
  },

  // Guide 3 Steps
  guideCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: "28px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
    marginBottom: 24,
  },
  guideCardTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 4px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  guideCardSubtitle: {
    fontSize: 13,
    color: "#64748b",
    margin: "0 0 20px",
    lineHeight: 1.5,
  },
  stepGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  stepItem: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "18px 16px",
    position: "relative",
  },
  stepNumBadge: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#f97316",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  stepContent: {},
  stepTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 6px",
  },
  stepDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.55,
    margin: 0,
  },

  // Details
  detailsCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  },
  detailsHeader: {
    background: "#f8fafc",
    padding: "12px 20px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  detailsGrid: { padding: "4px 20px" },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 13,
    flexWrap: "wrap",
    gap: 8,
  },
  detailLabel: { color: "#64748b", fontWeight: 500 },
  detailValue: { color: "#0f172a", fontWeight: 700 },
  detailCodeBadge: {
    fontFamily: "monospace",
    fontWeight: 800,
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    padding: "2px 8px",
    borderRadius: 6,
    color: "#0f172a",
  },
  detailLink: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    color: "#f97316",
    fontWeight: 600,
  },

  // Accordion
  accordionWrap: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    marginBottom: 24,
    overflow: "hidden",
  },
  accordionHeaderBtn: {
    width: "100%",
    padding: "14px 20px",
    background: "none",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
    cursor: "pointer",
    textAlign: "left",
  },
  accordionBody: {
    padding: "0 20px 20px",
    borderTop: "1px solid #f1f5f9",
    background: "#fafafa",
  },
  credBox: {
    background: "#0f172a",
    borderRadius: 14,
    overflow: "hidden",
  },
  credHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    borderBottom: "1px solid #1e293b",
  },
  credTitle: { fontSize: 12, color: "#94a3b8", fontFamily: "monospace" },
  copyBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "rgba(255,255,255,0.1)",
    border: "none",
    borderRadius: 6,
    padding: "4px 10px",
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  envPre: {
    margin: 0,
    padding: "16px",
    fontFamily: "'SFMono-Regular', Consolas, monospace",
    fontSize: 12,
    lineHeight: 1.7,
    color: "#86efac",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },

  // Upgrade Banner
  upgradeBox: {
    background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
    border: "1.5px solid #fed7aa",
    borderRadius: 20,
    padding: "24px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    boxShadow: "0 4px 16px rgba(249, 115, 22, 0.08)",
  },
  upgradeLeft: { display: "flex", alignItems: "flex-start", gap: 14, flex: 1, minWidth: 260 },
  upgradeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#ea580c",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 2px 8px rgba(234, 88, 12, 0.3)",
  },
  upgradeTitle: { fontSize: 16, fontWeight: 800, color: "#9a3412", margin: "0 0 4px" },
  upgradeDesc: { fontSize: 13, color: "#78350f", lineHeight: 1.5, margin: 0 },
  waBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#ea580c",
    color: "#ffffff",
    padding: "12px 22px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    boxShadow: "0 4px 12px rgba(234, 88, 12, 0.25)",
    whiteSpace: "nowrap",
  },
  backHomeBtn: {
    fontSize: 14,
    fontWeight: 600,
    color: "#64748b",
    transition: "color 0.15s",
  },

  footer: {
    textAlign: "center",
    padding: "28px 24px",
    fontSize: 13,
    color: "#94a3b8",
    borderTop: "1px solid #e2e8f0",
    background: "#ffffff",
  },
};
