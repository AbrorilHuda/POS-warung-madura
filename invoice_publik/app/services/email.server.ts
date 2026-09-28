async function getResend() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("re_xxx")) {
    return null;
  }
  try {
    const { Resend } = await import("resend");
    return new Resend(apiKey);
  } catch {
    return null;
  }
}

interface CredentialEmailData {
  to: string;
  storeName: string;
  storeSlug: string;
  storeCode: string;
  syncSecret: string;
  invoiceLimit: number;
}

/** Template HTML email kredensial untuk toko baru */
function buildCredentialEmailHtml(data: CredentialEmailData): string {
  const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:5175";
  const syncUrl = `${baseUrl}/api/sync`;
  const invoiceBaseUrl = baseUrl;
  const storePageUrl = `${baseUrl}/${data.storeSlug}`;
  const proPrice = Number(process.env.PRO_PLAN_PRICE || 25000).toLocaleString("id-ID");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Selamat Datang di POS Warung!</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; }
    .wrapper { max-width: 600px; margin: 32px auto; }
    .header { background: linear-gradient(135deg, #f97316, #ea580c); padding: 32px; border-radius: 16px 16px 0 0; text-align: center; }
    .header h1 { color: white; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); margin-top: 6px; font-size: 14px; }
    .body { background: white; padding: 32px; }
    .greeting { font-size: 16px; color: #374151; margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .env-block { background: #111827; border-radius: 10px; padding: 20px; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.8; color: #e5e7eb; overflow-x: auto; }
    .env-comment { color: #6b7280; }
    .env-key { color: #93c5fd; }
    .env-val { color: #86efac; }
    .env-val-secret { color: #fbbf24; }
    .badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge-orange { background: #fff7ed; color: #c2410c; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; }
    .info-value { color: #111827; font-weight: 600; }
    .btn { display: inline-block; background: #f97316; color: white !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 8px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 13px; color: #92400e; }
    .upgrade { background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 12px; padding: 20px; text-align: center; color: white; margin-top: 24px; }
    .upgrade h3 { font-size: 16px; margin-bottom: 8px; }
    .upgrade p { font-size: 13px; opacity: 0.9; }
    .footer { background: #f9fafb; border-radius: 0 0 16px 16px; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; }
    .footer a { color: #f97316; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🏪 Selamat Datang!</h1>
      <p>Toko <strong>${data.storeName}</strong> berhasil terdaftar</p>
    </div>
    <div class="body">
      <p class="greeting">
        Halo, selamat! Toko kamu sudah terdaftar di platform POS Warung.
        Berikut kredensial yang perlu kamu isi di file <code>.env</code> aplikasi POS Electron.
      </p>

      <div class="info-row" style="padding: 8px 0 8px; border-bottom: 1px solid #f3f4f6;">
        <span class="info-label">Kode Toko</span>
        <span class="info-value">${data.storeCode}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Paket</span>
        <span><span class="badge">Free</span> <span style="color:#6b7280;font-size:13px;margin-left:6px;">${data.invoiceLimit} invoice/bulan</span></span>
      </div>
      <div class="info-row">
        <span class="info-label">Halaman Invoice Toko</span>
        <span class="info-value"><a href="${storePageUrl}" style="color:#f97316;">${storePageUrl}</a></span>
      </div>

      <div class="warning" style="margin-top: 20px;">
        ⚠️ <strong>Penting:</strong> <code>SYNC_SECRET_KEY</code> di bawah bersifat rahasia. Jangan bagikan ke siapa pun.
      </div>

      <p class="section-title" style="margin-top: 20px;">Copy-paste ke file <code>pos_warung_madura/.env</code></p>
      <div class="env-block">
<span class="env-comment"># ── Identitas Toko ────────────────────────</span>
<span class="env-key">STORE_CODE</span>=<span class="env-val">${data.storeCode}</span>
<span class="env-key">STORE_NAME</span>=<span class="env-val">${data.storeName}</span>
<br/>
<span class="env-comment"># ── Sinkronisasi Invoice Publik ───────────</span>
<span class="env-key">PUBLIC_INVOICE_SYNC_URL</span>=<span class="env-val">${syncUrl}</span>
<span class="env-key">PUBLIC_INVOICE_BASE_URL</span>=<span class="env-val">${invoiceBaseUrl}</span>
<span class="env-key">SYNC_SECRET_KEY</span>=<span class="env-val-secret">${data.syncSecret}</span>
      </div>

      <div class="upgrade">
        <h3>🚀 Upgrade ke Pro — Rp ${proPrice}/bulan</h3>
        <p>Invoice unlimited tanpa batas kuota bulanan.<br/>Hubungi kami via WhatsApp untuk upgrade.</p>
      </div>
    </div>
    <div class="footer">
      <p>Dikirim otomatis oleh sistem POS Warung &bull; <a href="${baseUrl}">Kunjungi Platform</a></p>
    </div>
  </div>
</body>
</html>`;
}

/** Kirim email kredensial ke pemilik toko baru */
export async function sendCredentialEmail(
  data: CredentialEmailData
): Promise<{ success: boolean; error?: string }> {
  const resend = await getResend();
  const fromEmail = process.env.FROM_EMAIL || "noreply@localhost";

  if (!resend) {
    console.warn("[Email] RESEND_API_KEY belum diatur — email tidak dikirim. Kredensial:");
    console.info({
      to: data.to,
      storeCode: data.storeCode,
      storeSlug: data.storeSlug,
      syncSecret: data.syncSecret,
    });
    return { success: true }; // Tidak error di dev mode
  }

  try {
    const { error } = await resend.emails.send({
      from: `POS Warung <${fromEmail}>`,
      to: [data.to],
      subject: `✅ Toko "${data.storeName}" berhasil terdaftar — Kredensial POS kamu`,
      html: buildCredentialEmailHtml(data),
    });

    if (error) {
      console.error("[Email Error]", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Kredensial terkirim ke ${data.to}`);
    return { success: true };
  } catch (err: any) {
    console.error("[Email Exception]", err);
    return { success: false, error: err.message };
  }
}
