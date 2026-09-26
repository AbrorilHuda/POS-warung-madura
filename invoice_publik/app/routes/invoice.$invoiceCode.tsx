import React, { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import {
  CheckCircle2,
  Clock,
  Printer,
  Share2,
  Store,
  Receipt,
  Copy,
  Check,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Phone,
  MapPin,
  QrCode,
  AlertTriangle,
  Download,
  AlertCircle,
  CalendarX2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { queryInvoiceWithStatus, isSupabaseConnected } from "../services/supabase.server";
import type { PublicInvoice } from "../types/invoice";

export function meta({ data }: { data?: { invoice: PublicInvoice | null; invoiceCode: string } }) {
  if (!data?.invoice) {
    return [
      { title: `Invoice ${data?.invoiceCode || ""} — POS Warung Madura` },
      { name: "description", content: "Struk belanja digital resmi Warung Madura" },
    ];
  }

  return [
    { title: `Struk Belanja ${data.invoice.id} — ${data.invoice.storeName}` },
    {
      name: "description",
      content: `Total belanja Rp ${data.invoice.totalAmount.toLocaleString("id-ID")} di ${data.invoice.storeName}`,
    },
  ];
}

export async function loader({ params }: LoaderFunctionArgs) {
  const invoiceCode = params.invoiceCode || "";
  const queryResult = await queryInvoiceWithStatus(invoiceCode);
  const supabaseConnected = isSupabaseConnected();

  return {
    invoice: queryResult.invoice,
    status: queryResult.status,
    message: queryResult.message,
    retentionHours: queryResult.retentionHours,
    invoiceCode,
    supabaseConnected,
  };
}

export default function PublicInvoicePage() {
  const { invoice, status, message, retentionHours, invoiceCode, supabaseConnected } =
    useLoaderData<typeof loader>();
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://warungku.my.id/invoice/${invoiceCode}`;

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share && invoice) {
      try {
        await navigator.share({
          title: `Struk Belanja ${invoice.id}`,
          text: `Struk belanja resmi ${invoice.storeName} sebesar Rp ${invoice.totalAmount.toLocaleString("id-ID")}`,
          url: currentUrl,
        });
        return;
      } catch (e) {}
    }

    // Fallback share ke WhatsApp
    if (invoice) {
      const waText = encodeURIComponent(
        `*STRUK BELANJA RESMI*\n${invoice.storeName}\nNo. Invoice: ${invoice.id}\nTotal: Rp ${invoice.totalAmount.toLocaleString("id-ID")}\nLihat struk digital (berlaku ${retentionHours} jam): ${currentUrl}`
      );
      window.open(`https://wa.me/?text=${waText}`, "_blank");
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  // =========================================================================
  // 1. KASUS: NOMOR FAKTUR TIDAK VALID (KEAMANAN INPUT)
  // =========================================================================
  if (status === "invalid_code") {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-6 text-slate-900 font-sans">
        <div className="max-w-md w-full mx-auto my-auto">
          <div className="mb-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Beranda</span>
            </Link>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Nomor Faktur Tidak Valid
              </h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Nomor faktur <span className="font-mono font-semibold text-slate-800 break-all">{invoiceCode}</span> tidak sesuai format sistem. Gunakan kombinasi huruf, angka, dan tanda hubung (misal: <span className="font-mono font-bold">WM01-000141</span>).
              </p>
            </div>

            <Link
              to="/"
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>Periksa Nomor Faktur Lain</span>
            </Link>
          </div>
        </div>

        <footer className="text-center text-[11px] text-slate-400 py-4">
          POS Warung Madura © 2026 — Keamanan Data Pelanggan
        </footer>
      </div>
    );
  }

  // =========================================================================
  // 2. KASUS: INVOICE SUDAH KEDALUWARSA (LEWAT DARI 12 JAM)
  // =========================================================================
  if (status === "expired") {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-6 text-slate-900 font-sans">
        <div className="max-w-md w-full mx-auto my-auto">
          <div className="mb-4 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </Link>
            <span className="text-[11px] font-mono text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-200">
              {invoiceCode}
            </span>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <CalendarX2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Struk Belanja Telah Kedaluwarsa
              </h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Sesuai kebijakan keamanan & privasi data warung, struk digital online untuk transaksi <span className="font-mono font-semibold text-slate-800">{invoiceCode}</span> otomatis <strong>dihapus setelah {retentionHours} jam</strong> dari waktu pembelian.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-left text-xs space-y-1.5 text-amber-900">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <Store className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Butuh Salinan Struk?</span>
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Jika Anda memerlukan bukti transaksi fisik untuk keperluan arsip atau pembukuan, silakan hubungi kasir warung di tempat transaksi Anda.
              </p>
            </div>

            <Link
              to="/"
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>Kembali ke Halaman Utama</span>
            </Link>
          </div>
        </div>

        <footer className="text-center text-[11px] text-slate-400 py-4">
          POS Warung Madura © 2026 — Kebijakan Retensi Data 12 Jam
        </footer>
      </div>
    );
  }

  // =========================================================================
  // 3. KASUS: INVOICE BELUM TERSEDIA (BELUM TERSINKRON DARI LAPTOP KASIR)
  // =========================================================================
  if (!invoice || status === "not_found") {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-6 text-slate-900 font-sans">
        <div className="max-w-md w-full mx-auto my-auto">
          {/* Header Back */}
          <div className="mb-4 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Cari Nota Lain</span>
            </Link>
            <span className="text-[11px] font-mono text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-200">
              {invoiceCode}
            </span>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 animate-pulse">
              <Clock className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Struk Sedang Dalam Proses
              </h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Nomor transaksi <span className="font-mono font-semibold text-slate-800">{invoiceCode}</span> baru saja dicatat di kasir warung dan sedang dalam antrean sinkronisasi ke cloud.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Warung Madura Berkah</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Sistem kasir warung menggunakan mode offline-first. Begitu laptop kasir mendeteksi koneksi internet, data struk akan otomatis tampil lengkap di sini.
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Memeriksa Data..." : "Periksa Ulang Sekarang"}</span>
            </button>
          </div>
        </div>

        <footer className="text-center text-[11px] text-slate-400 py-4">
          POS Warung Madura © 2026 — Struk Digital Mandiri
        </footer>
      </div>
    );
  }

  // =========================================================================
  // 4. TAMPILAN INVOICE DIGITAL RESMI (MOBILE FIRST, MODERN THERMAL-HYBRID)
  // =========================================================================
  const remainingHours = invoice.remainingMinutes ? Math.floor(invoice.remainingMinutes / 60) : 0;
  const remainingMins = invoice.remainingMinutes ? invoice.remainingMinutes % 60 : 0;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-3 sm:p-6 text-slate-900 font-sans print:p-0 print:bg-white">
      {/* Top Navbar Actions */}
      <div className="max-w-md w-full mx-auto mb-3 flex items-center justify-between print:hidden">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="p-2 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
            title="Unduh / Cetak Struk (Simpan PDF)"
          >
            <Download className="w-4 h-4" />
            <span>Unduh / Cetak</span>
          </button>
          <button
            onClick={handleShare}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1"
            title="Bagikan Struk"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Bagikan</span>
          </button>
        </div>
      </div>

      {/* Main Digital Receipt Card */}
      <div className="max-w-md w-full mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Banner Peringatan Retensi 12 Jam & Ajakan Unduh */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-orange-500/10 border-b border-amber-200 p-4 text-slate-800 print:hidden">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Penting: Segera Simpan / Unduh Faktur Ini!
                </span>
                {invoice.remainingMinutes !== undefined && (
                  <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                    Sisa {remainingHours}j {remainingMins}m
                  </span>
                )}
              </div>
              <p className="text-[11px] text-amber-900/90 mt-1 leading-relaxed">
                Kami menghapus data faktur digital dari server dalam <strong>{invoice.retentionHours || 12} jam</strong> sejak pembelian demi menjaga privasi belanjaan Anda.
              </p>
              <div className="mt-2.5">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Sekarang (Simpan PDF / Cetak)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Header Warung */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white p-6 text-center relative overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center mx-auto mb-3 backdrop-blur-xs">
            <Store className="w-6 h-6 text-emerald-400" />
          </div>

          <h1 className="text-xl font-extrabold tracking-tight uppercase">
            {invoice.storeName}
          </h1>
          <p className="text-[11px] text-slate-300 mt-1 max-w-xs mx-auto leading-relaxed">
            {invoice.storeAddress}
          </p>

          <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Struk Digital Resmi & Terverifikasi</span>
          </div>

          {invoice.isDemoMock && (
            <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-400/20 px-2 py-0.5 rounded-full inline-block">
              Simulasi Offline (Belum Terhubung Supabase Cloud)
            </div>
          )}
        </div>

        {/* Transaction Metadata */}
        <div className="p-5 border-b border-dashed border-slate-200 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                No. Faktur
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {invoice.id}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  title="Salin Tautan"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                Metode Bayar
              </span>
              <span className="inline-block mt-0.5 font-bold px-2 py-0.5 rounded-md text-[11px] bg-slate-200 text-slate-800">
                {invoice.paymentMethod}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                Waktu Transaksi
              </span>
              <span className="font-mono text-slate-700 mt-0.5 block text-[11px]">
                {invoice.createdAt ? new Date(invoice.createdAt).toLocaleString("id-ID") : "-"}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                Kasir
              </span>
              <span className="font-medium text-slate-700 mt-0.5 block text-[11px]">
                {invoice.cashierName}
              </span>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Daftar Barang</span>
            <span>Subtotal</span>
          </div>

          <div className="divide-y divide-slate-100">
            {invoice.items.map((it, idx) => (
              <div key={idx} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 leading-tight">
                    {it.productName}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {it.quantity} {it.unitName} × Rp {it.price.toLocaleString("id-ID")}
                  </div>
                </div>

                <div className="text-right font-mono font-bold text-slate-900 shrink-0">
                  Rp {it.subtotal.toLocaleString("id-ID")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total & Summary Breakdown */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Subtotal ({invoice.items.length} Macam Barang)</span>
            <span className="font-mono font-medium">
              Rp {invoice.totalAmount.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">Total Belanja</span>
            <span className="text-lg font-black text-slate-900 font-mono">
              Rp {invoice.totalAmount.toLocaleString("id-ID")}
            </span>
          </div>

          {invoice.paymentMethod === "Tunai" && invoice.paidAmount > 0 && (
            <div className="pt-2 border-t border-slate-200/80 text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Tunai Diterima:</span>
                <span className="font-mono font-semibold text-slate-800">
                  Rp {invoice.paidAmount.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Kembalian:</span>
                <span className="font-mono font-semibold text-emerald-700">
                  Rp {invoice.changeAmount.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Barcode 1D & QR Code & Footer Thank You */}
        <div className="p-6 text-center border-t border-slate-100 space-y-4">

          <div className="inline-block p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <QRCodeSVG
              value={currentUrl}
              size={96}
              level="M"
              includeMargin={false}
            />
          </div>

          <div>
            <p className="text-xs font-bold text-slate-800">
              Mator Sakalangkong!
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Simpan struk digital ini sebagai bukti belanja yang sah.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1 text-[10px] text-slate-400 font-mono">
            <span>Scan QR untuk membuka struk ini kapan saja</span>
          </div>
        </div>
      </div>

      <footer className="text-center text-[11px] text-slate-400 py-4 print:hidden">
        Sistem Kasir POS Warung Madura © 2026 — Buka 24 Jam
      </footer>
    </div>
  );
}
