import React, { useState } from "react";
import {
  Smartphone,
  Wifi,
  X,
  ExternalLink,
  Copy,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface ConnectPhoneScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPhoneConnected: boolean;
  phoneDeviceName: string | null;
}

export const ConnectPhoneScannerModal: React.FC<ConnectPhoneScannerModalProps> = ({
  isOpen,
  onClose,
  isPhoneConnected,
  phoneDeviceName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
  const port = typeof window !== "undefined" ? window.location.port : "5174";
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
  // If viewing on localhost on the laptop, target the LAN IP so phone can connect
  const targetHost = hostname === "localhost" || hostname === "127.0.0.1" ? "192.168.1.12" : hostname;
  const scannerUrl = `https://${targetHost}${port ? `:${port}` : ""}/scanner`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scannerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Hubungkan Scanner HP</h3>
              <p className="text-[11px] text-slate-500">Fitur PRD F12: Scanner Nirkabel WebSocket</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          {/* Status Badge */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
              isPhoneConnected
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPhoneConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            ></span>
            <span>
              {isPhoneConnected
                ? `🟢 Terhubung: ${phoneDeviceName || "HP Kasir"}`
                : "Menunggu Koneksi dari HP..."}
            </span>
          </div>

          {/* QR Code Graphic pointing to /scanner URL */}
          <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-sm flex flex-col items-center">
            {/* SVG Visual QR Mock */}
            <div className="w-36 h-36 bg-slate-900 rounded p-1.5 flex items-center justify-center">
              <div className="w-full h-full bg-white p-1 grid grid-cols-7 grid-rows-7 gap-0.5">
                <div className="col-span-2 row-span-2 bg-black"></div>
                <div className="bg-black"></div>
                <div className="bg-transparent"></div>
                <div className="col-span-2 row-span-2 bg-black"></div>
                <div className="bg-black"></div>
                <div className="bg-transparent"></div>
                <div className="bg-black"></div>
                <div className="bg-transparent"></div>
                <div className="bg-black"></div>
                <div className="col-span-3 bg-black"></div>
                <div className="col-span-2 bg-black"></div>
                <div className="bg-black"></div>
                <div className="col-span-2 row-span-2 bg-black"></div>
                <div className="col-span-2 bg-black"></div>
                <div className="col-span-2 row-span-2 bg-black"></div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-500 font-semibold mt-1.5">
              SCAN DENGAN HP KASIR
            </span>
          </div>

          {/* URL Box */}
          <div className="w-full space-y-1">
            <span className="text-xs text-slate-500">Atau buka alamat ini di browser HP:</span>
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-mono text-xs text-slate-900 flex-1 truncate text-left select-all">
                {scannerUrl}
              </span>
              <button
                onClick={handleCopy}
                className="p-1 text-slate-500 hover:text-slate-900"
                title="Salin Alamat"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={scannerUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-slate-500 hover:text-slate-900"
                title="Buka di Tab Baru"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Instructions */}
          <div className="w-full text-left p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-800">Petunjuk Pemakaian:</p>
            <ol className="list-decimal pl-4 space-y-1 text-[11px]">
              <li>Pastikan HP terhubung ke Wi-Fi / Hotspot yang sama dengan laptop.</li>
              <li>Buka alamat HTTPS di atas di browser HP Anda.</li>
              <li>
                <strong className="text-slate-800">Catatan Sertifikat SSL:</strong> Jika muncul peringatan &quot;Koneksi tidak privat&quot;, klik <strong>Lanjutan (Advanced)</strong> &rarr; pilih <strong>Lanjutkan ke situs (Aman)</strong>.
              </li>
              <li>Izinkan akses kamera di HP &rarr; sorot barcode barang &rarr; otomatis masuk ke keranjang laptop!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
