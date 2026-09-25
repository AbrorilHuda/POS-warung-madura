import React, { useState } from "react";
import {
  Printer,
  CheckCircle2,
  Copy,
  Receipt,
  X,
  PlusCircle,
  ShieldCheck,
  ExternalLink,
  QrCode,
  Share2,
  Check,
  Store,
  Leaf,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Sale } from "../types/pos";

interface ReceiptModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onNewTransaction: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  isOpen,
  onClose,
  onNewTransaction,
}) => {
  const [viewMode, setViewMode] = useState<"barcode" | "digitalInvoice">("barcode");
  const [copied, setCopied] = useState(false);

  if (!isOpen || !sale) return null;

  // URL invoice publik: gunakan hostname laptop (LAN IP/localhost) port 5175 agar bisa dibuka langsung dari HP
  const host =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "localhost";
  const invoicePort = "5175";
  const invoiceUrl = `http://${host}:${invoicePort}/invoice/${sale.invoiceCode}`;

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(invoiceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const waText = encodeURIComponent(
      `*STRUK BELANJA RESMI WARUNG MADURA*\n` +
      `No. Faktur: ${sale.invoiceCode}\n` +
      `Waktu: ${sale.timestamp}\n` +
      `Total Belanja: Rp ${sale.totalAmount.toLocaleString("id-ID")}\n` +
      `Metode Bayar: ${sale.paymentMethod}\n\n` +
      `Lihat rincian nota & daftar belanja lengkap Anda di tautan berikut:\n${invoiceUrl}`
    );
    window.open(`https://wa.me/?text=${waText}`, "_blank");
  };

  const totalItemsCount = sale.items.reduce((sum, it) => sum + (it.qty || 1), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-4 sm:my-6">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm leading-tight">
                Transaksi Berhasil
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {sale.invoiceCode}
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("barcode")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${viewMode === "barcode"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Struk Barcode</span>
            </button>
            <button
              onClick={() => setViewMode("digitalInvoice")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${viewMode === "digitalInvoice"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Tampilan Nota</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 bg-slate-50 flex flex-col items-center max-h-[72vh] overflow-y-auto">
          {viewMode === "barcode" ? (
            /* ========================================================================= */
            /* 1. STRUK FISIK MINIMALIS HEMAT KERTAS (BARCODE & QR CODE AJA)            */
            /* ========================================================================= */
            <div
              id="printable-barcode-receipt"
              className="w-full max-w-xs receipt-paper text-slate-900 rounded-2xl p-5 shadow-xs font-mono text-xs border border-slate-200 bg-white"
            >
              {/* Header Toko */}
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h4 className="font-black text-sm tracking-wider uppercase text-slate-900">
                  WARUNG MADURA BERKAH
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Buka 24 Jam Non-Stop &bull; Sumenep
                </p>
                <p className="text-[9px] text-slate-400">
                  Jl. Raya Warung Madura No. 24
                </p>
              </div>


              {/* AREA QR CODE UTAMA (Scan untuk Buka Nota Lengkap di HP) */}
              <div className="pt-3 text-center flex flex-col items-center">
                <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-2">
                  <QrCode className="w-3 h-3 text-emerald-600" />
                  <span>SCAN UNTUK NOTA LENGKAP</span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-300 shadow-2xs flex flex-col items-center">
                  <QRCodeSVG
                    value={invoiceUrl}
                    size={112}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <p className="text-[9px] text-slate-500 mt-2 max-w-[210px] leading-tight">
                  Arahkan kamera HP ke QR di atas untuk melihat rincian nota belanja lengkap.
                </p>

                <p className="text-[8px] text-slate-400 font-mono mt-1 select-all break-all">
                  {invoiceUrl.replace(/^http:\/\//, "")}
                </p>
              </div>

              {/* Footer Ramah Lingkungan */}
              <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300 text-center space-y-1">
                <div className="flex items-center justify-center gap-1 text-[9px] text-emerald-600 font-semibold">
                  <Leaf className="w-3 h-3 text-emerald-500" />
                  <span>Struk Barcode Ramah Lingkungan</span>
                </div>
                <p className="text-[10px] text-slate-700 font-bold">
                  Matur Sembah Nuwun!
                </p>
                <p className="text-[8px] text-slate-400">
                  Simpan struk ini sebagai bukti pembayaran yang sah
                </p>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 2. TAMPILAN NOTA LENGKAP (SESUAI DESAIN INVOICE PUBLIK)                   */
            /* ========================================================================= */
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-slate-900 font-sans">
              {/* Header Warung Gradient */}
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white p-5 text-center relative">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center mx-auto mb-2 backdrop-blur-xs">
                  <Store className="w-5 h-5 text-emerald-400" />
                </div>

                <h4 className="text-base font-extrabold tracking-tight uppercase">
                  WARUNG MADURA BERKAH
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Jl. Raya Warung Madura No. 24, Buka 24 Jam Non-Stop
                </p>

                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Struk Digital Resmi & Terverifikasi</span>
                </div>
              </div>

              {/* Metadata Transaksi */}
              <div className="p-4 border-b border-dashed border-slate-200 bg-slate-50/70">
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                      No. Faktur
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {sale.invoiceCode}
                      </span>
                      <button
                        onClick={handleCopyLink}
                        className="text-slate-400 hover:text-slate-700 p-0.5"
                        title="Salin Link Nota"
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
                    <span className="inline-block mt-0.5 font-bold px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800">
                      {sale.paymentMethod}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                      Waktu Transaksi
                    </span>
                    <span className="font-mono text-slate-700 mt-0.5 block text-[11px]">
                      {sale.timestamp}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                      Kasir
                    </span>
                    <span className="font-medium text-slate-700 mt-0.5 block text-[11px]">
                      {sale.cashierName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rincian Lengkap Barang Belanjaan */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Daftar Barang</span>
                  <span>Subtotal</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                  {sale.items.map((it, idx) => (
                    <div key={idx} className="py-2 flex items-start justify-between gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 leading-tight">
                          {it.productName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {it.qty} {it.unitName} &times; Rp {it.price.toLocaleString("id-ID")}
                        </div>
                      </div>

                      <div className="text-right font-mono font-bold text-slate-900 shrink-0">
                        Rp {it.subtotal.toLocaleString("id-ID")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Rincian Pembayaran */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Subtotal ({sale.items.length} Macam Barang)</span>
                  <span className="font-mono font-medium">
                    Rp {sale.totalAmount.toLocaleString("id-ID")}
                  </span>
                </div>

                <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Total Belanja</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    Rp {sale.totalAmount.toLocaleString("id-ID")}
                  </span>
                </div>

                {sale.paymentMethod === "Tunai" && sale.paidAmount > 0 && (
                  <div className="pt-1.5 border-t border-slate-200/70 text-xs space-y-0.5 text-slate-600">
                    <div className="flex justify-between">
                      <span>Tunai Diterima:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        Rp {sale.paidAmount.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kembalian:</span>
                      <span className="font-mono font-semibold text-emerald-700">
                        Rp {sale.changeAmount.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Barcode & Aksi Eksternal */}
              <div className="p-4 text-center border-t border-slate-100 bg-white space-y-3">
                <div className="flex items-center justify-center gap-4">
                  <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <QRCodeSVG
                      value={invoiceUrl}
                      size={76}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-left space-y-1">
                    <p className="text-[11px] font-bold text-slate-900">
                      Tersedia di Server Publik
                    </p>
                    <p className="text-[10px] text-slate-500 max-w-[180px] leading-tight">
                      Pelanggan dapat melihat nota ini di HP melalui jaringan lokal / cloud.
                    </p>
                    <span className="inline-block text-[9px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Port {invoicePort} Online
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => window.open(invoiceUrl, "_blank")}
                    className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Nota Publik</span>
                  </button>

                  <button
                    onClick={handleShareWhatsApp}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Kirim WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Struk Barcode</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Link</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(invoiceUrl, "_blank")}
              className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Invoice Web</span>
            </button>

            <button
              onClick={onNewTransaction}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Transaksi Baru</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
