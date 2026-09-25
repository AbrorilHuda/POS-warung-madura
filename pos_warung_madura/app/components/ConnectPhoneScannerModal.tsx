import React, { useState } from "react";
import {
  Smartphone,
  Wifi,
  X,
  ExternalLink,
  Copy,
  CheckCircle2,
  Sparkles,
  QrCode,
  ShieldAlert,
  Info,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface ConnectPhoneScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPhoneConnected: boolean;
  phoneDeviceName: string | null;
  detectedIp?: string;
}

export const ConnectPhoneScannerModal: React.FC<ConnectPhoneScannerModalProps> = ({
  isOpen,
  onClose,
  isPhoneConnected,
  phoneDeviceName,
  detectedIp,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeIp, setActiveIp] = useState<string>(detectedIp || "192.168.1.12");

  if (!isOpen) return null;

  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
  const port = typeof window !== "undefined" ? window.location.port : "5174";
  const scannerUrl = `${protocol}//${activeIp}${port ? `:${port}` : ""}/scanner`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scannerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
              <Smartphone className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Hubungkan HP sebagai Scanner Barcode
              </h3>
              <p className="text-xs text-slate-500">
                Fitur F12: Scanner Nirkabel Kamera Smartphone via WebSocket
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center text-center space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Status Koneksi WebSocket */}
          <div
            className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border transition ${
              isPhoneConnected
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isPhoneConnected ? "bg-emerald-500 animate-ping" : "bg-amber-500 animate-pulse"
              }`}
            />
            <span>
              {isPhoneConnected
                ? `🟢 HP Terhubung: ${phoneDeviceName || "HP Kasir"}`
                : "Menunggu Scan & Koneksi dari HP..."}
            </span>
          </div>

          {/* REAL, SCANNABLE QR CODE UTAMA */}
          <div className="p-5 bg-white border-2 border-slate-900 rounded-3xl shadow-xl flex flex-col items-center space-y-2">
            <div className="bg-white p-2 rounded-2xl">
              <QRCodeSVG
                value={scannerUrl}
                size={190}
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-slate-900 uppercase tracking-wider pt-1">
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>Arahkan Kamera HP ke QR Code Ini</span>
            </div>
          </div>

          {/* IP Address Switcher & URL Box */}
          <div className="w-full space-y-2 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Alamat URL Scanner di HP:</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400">IP Laptop:</span>
                <input
                  type="text"
                  value={activeIp}
                  onChange={(e) => setActiveIp(e.target.value.trim())}
                  className="font-mono text-[11px] px-2 py-0.5 rounded border border-slate-300 bg-slate-50 w-28 text-center font-bold text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900"
                  title="Ubah jika IP Wi-Fi laptop berubah"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-mono text-xs text-slate-900 flex-1 truncate select-all px-1">
                {scannerUrl}
              </span>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Salin Alamat URL"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Salin</span>
                  </>
                )}
              </button>
              <a
                href={scannerUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                title="Buka di Tab Baru"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Petunjuk Praktis Pemakaian */}
          <div className="w-full text-left p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="w-4 h-4 text-amber-500" />
              <span>Langkah Menghubungkan:</span>
            </div>
            <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
              <li>
                Pastikan HP dan Laptop terhubung ke <strong className="text-slate-800">Wi-Fi atau Hotspot HP yang sama</strong>.
              </li>
              <li>
                Buka kamera bawaan HP / Google Lens, lalu <strong className="text-slate-800">scan QR Code di atas</strong> dan buka link-nya.
              </li>
              <li className="bg-amber-100/70 p-2 rounded-xl text-amber-900 border border-amber-200">
                <strong className="block font-bold">Penting (Sertifikat SSL Lokal):</strong>
                Jika browser HP memunculkan peringatan <em>&quot;Koneksi tidak privat&quot;</em>, cukup klik <strong className="underline">Lanjutan / Advanced</strong> &rarr; pilih <strong className="underline">Lanjutkan ke situs (Aman)</strong>.
              </li>
              <li>
                Setelah halaman terbuka di HP, izinkan akses kamera &rarr; sorot barcode produk &rarr; item <strong className="text-slate-900">langsung masuk otomatis ke keranjang kasir!</strong>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
