import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Store,
  Search,
  Receipt,
  QrCode,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export function meta() {
  return [
    { title: "Cek Struk Belanja" },
    {
      name: "description",
      content: "Portal cek struk dan invoice digital resmi Warung Madura",
    },
  ];
}

export default function Home() {
  const [invoiceCode, setInvoiceCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = invoiceCode.trim().toUpperCase();

    if (!clean) {
      setErrorMessage("Nomor faktur tidak boleh kosong.");
      return;
    }

    // Validasi alfanumerik, tanda hubung, garis bawah (3-50 karakter)
    const validFormat = /^[A-Za-z0-9_-]{3,50}$/;
    if (!validFormat.test(clean)) {
      setErrorMessage("Format nomor faktur tidak valid. Gunakan kombinasi huruf, angka, atau tanda hubung (-).");
      return;
    }

    setErrorMessage("");
    navigate(`/invoice/${clean}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-6 text-slate-900 font-sans">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto shadow-md">
            <Store className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Warung Madura Berkah
          </h1>
          <p className="text-xs text-slate-500">
            Portal Struk & Invoice Digital Resmi Pelanggan
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 space-y-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <span>Masukkan Nomor Faktur Struk</span>
          </div>

          <form onSubmit={handleSearch} className="space-y-3">
            <div className="relative flex items-center">
              <input
                type="text"
                value={invoiceCode}
                onChange={(e) => {
                  setInvoiceCode(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                maxLength={50}
                placeholder="Contoh: WM01-000141"
                className={`w-full pl-3.5 pr-10 py-3 bg-slate-50 border rounded-xl text-slate-900 placeholder-slate-400 font-mono text-sm uppercase focus:bg-white focus:outline-none focus:ring-2 transition ${
                  errorMessage
                    ? "border-rose-400 focus:ring-rose-500"
                    : "border-slate-200 focus:ring-slate-900"
                }`}
              />
              <button
                type="submit"
                className="absolute right-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white cursor-pointer transition"
                title="Cari Struk"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {errorMessage ? (
              <p className="text-[11px] text-rose-600 font-medium">
                {errorMessage}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">
                Ketik nomor faktur yang tertera pada bagian bawah struk fisik atau scan QR.
              </p>
            )}
          </form>

          {/* Warning Retensi 12 Jam */}
          <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <span>⚠️ Kebijakan Akses Struk (12 Jam)</span>
            </div>
            <p className="text-amber-700/90 leading-relaxed text-[11px]">
              Demi menjaga privasi pelanggan, data faktur belanja online otomatis dihapus dari server dalam <strong>12 jam</strong> sejak waktu pembelian.
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
            <QrCode className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900">Scan QR Cepat</h4>
            <p className="text-[10px] text-slate-500">
              Arahkan kamera HP ke QR di struk kasir untuk buka instan.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900">Bukti Sah</h4>
            <p className="text-[10px] text-slate-500">
              Struk digital resmi dan tersimpan aman di server cloud.
            </p>
          </div>
        </div>
      </div>

      <footer className="text-center text-[11px] text-slate-400 py-4">
        POS Warung Madura © 2026 — Buka 24 Jam Non-Stop
      </footer>
    </div>
  );
}
