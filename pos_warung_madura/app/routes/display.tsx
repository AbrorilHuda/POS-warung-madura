import React, { useState, useEffect } from "react";
import {
  Store,
  Clock,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Maximize2,
  Minimize2,
  ShoppingBag,
  Sparkles,
  Receipt,
  Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  listenCustomerDisplay,
  sendCustomerDisplayEvent,
  type CustomerDisplayState,
} from "../services/customerDisplaySync";

export function meta() {
  return [
    { title: "Layar Pelanggan" },
    {
      name: "description",
      content:
        "Layar sekunder realtime pelanggan menampilkan belanjaan, kembalian, dan barcode nota digital",
    },
  ];
}

export default function CustomerDisplay() {
  const [displayState, setDisplayState] = useState<CustomerDisplayState>({
    type: "STANDBY",
    timestamp: Date.now(),
  });
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState<number>(60);

  // Auto-standby timer saat nota selesai ditampilkan (60 detik)
  useEffect(() => {
    if (displayState.type === "SALE_COMPLETED") {
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            const standbyEv = { type: "STANDBY" as const, timestamp: Date.now() };
            setDisplayState(standbyEv);
            sendCustomerDisplayEvent(standbyEv);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [displayState.type, (displayState as any).sale?.id]);

  // Live Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setCurrentDate(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to events from Kasir in realtime
  useEffect(() => {
    const unsubscribe = listenCustomerDisplay((event) => {
      setDisplayState(event);
    });
    return unsubscribe;
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }
  };

  const handleManualStandby = () => {
    const standbyEv = { type: "STANDBY" as const, timestamp: Date.now() };
    setDisplayState(standbyEv);
    sendCustomerDisplayEvent(standbyEv);
  };

  // Host invoice publik (port 5175)
  const host =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "localhost";
  const invoicePort = "5175";
  const getInvoiceUrl = (code: string) =>
    `http://${host}:${invoicePort}/invoice/${code}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-rose-500 selection:text-white">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER: MINIMALIS, BERSIH & RAPI                                    */}
      {/* ========================================================================= */}
      <header className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        {/* Brand Identitas Warung */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-600 to-rose-700 flex items-center justify-center shadow-md shadow-rose-950/40">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-wide text-white uppercase">
                Warung Madura Berkah
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                24 Jam
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Layar Pelanggan &bull; Nota Digital
            </p>
          </div>
        </div>

        {/* Jam & Layar Penuh */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-base font-bold text-amber-300 tracking-wider">
              {currentTime || "00:00:00"} <span className="text-xs font-sans text-slate-400">WIB</span>
            </div>
            <div className="text-[11px] text-slate-400">{currentDate}</div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
            title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA                                                      */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {/* --------------------------------------------------------------------- */}
        {/* KONDISI 1: BELUM ADA TRANSAKSI (STANDBY - DEFAULT STATE)              */}
        {/* --------------------------------------------------------------------- */}
        {displayState.type !== "CART_UPDATE" && displayState.type !== "SALE_COMPLETED" && (
          <div className="max-w-xl w-full mx-auto text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Minimalist Icon Badge */}
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-center mx-auto text-amber-400">
              <ShoppingBag className="w-10 h-10" />
            </div>

            {/* Headline Bersih & Jelas */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Kasir Siap Melayani
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Belum Ada Transaksi
              </h2>
              <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto">
                Silakan letakkan barang belanjaan Anda di meja kasir. Kami siap melayani Anda.
              </p>
            </div>

            {/* 3 Pill Fitur Ringkas */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-slate-400">
              <span className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800/80 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                Nota Digital Barcode
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800/80 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Tunai &amp; QRIS
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800/80 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                Buka 24 Jam
              </span>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* KONDISI 2: SEDANG MEMINDAI BARANG (CART_UPDATE)                       */}
        {/* --------------------------------------------------------------------- */}
        {displayState.type === "CART_UPDATE" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
            {/* Kolom Kiri: Rincian Daftar Belanja (7 Cols) */}
            <div className="lg:col-span-7 bg-slate-900/80 rounded-3xl p-5 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-sm text-white">
                    Daftar Belanja
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-amber-300">
                  {displayState.itemCount} Item
                </span>
              </div>

              {/* List Barang */}
              <div className="divide-y divide-slate-800/60 max-h-[52vh] overflow-y-auto pr-1">
                {displayState.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="py-2.5 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-100 text-sm truncate">
                        {it.productName}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {it.qty} {it.unitName} &times; Rp {it.price.toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-sm text-white shrink-0">
                      Rp {it.subtotal.toLocaleString("id-ID")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Kolom Kanan: Total Belanja Besar & Jelas (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Belanja
                  </span>
                  <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-400 mt-1 tracking-tight">
                    Rp {displayState.totalAmount.toLocaleString("id-ID")}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-300 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                    <span>Kasir sedang memindai barang...</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Barcode nota digital akan langsung muncul saat pembayaran selesai.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Faktur:</span>
                  <span className="font-bold text-slate-200">{displayState.invoiceCode}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* KONDISI 3: TRANSAKSI SELESAI (SALE_COMPLETED)                         */}
        {/* --------------------------------------------------------------------- */}
        {displayState.type === "SALE_COMPLETED" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in zoom-in-95 duration-200">
            {/* Kolom Kiri: Rincian Pembayaran & Kembalian (6 Cols) */}
            <div className="lg:col-span-6 bg-slate-900/80 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">
                      Pembayaran Berhasil!
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {displayState.sale.invoiceCode} &bull; {displayState.sale.timestamp}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {displayState.sale.paymentMethod}
                </span>
              </div>

              {/* Kartu Ringkasan Bayar & Kembalian */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Total Belanja:</span>
                  <span className="font-mono font-bold text-base text-white">
                    Rp {displayState.sale.totalAmount.toLocaleString("id-ID")}
                  </span>
                </div>

                {displayState.sale.paymentMethod === "Tunai" && (
                  <>
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Uang Diterima:</span>
                      <span className="font-mono text-slate-300">
                        Rp {displayState.sale.paidAmount.toLocaleString("id-ID")}
                      </span>
                    </div>

                    {/* Highlight Kembalian Paling Jelas */}
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-300">Kembalian:</span>
                      <span className="font-mono text-2xl font-black text-emerald-400 bg-emerald-500/10 px-3 py-0.5 rounded-xl border border-emerald-500/20">
                        Rp {displayState.sale.changeAmount.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Rincian Singkat Barang */}
              <div className="divide-y divide-slate-800/60 max-h-36 overflow-y-auto pr-1">
                {displayState.sale.items.map((it, idx) => (
                  <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                    <span className="text-slate-300 truncate max-w-[220px]">
                      {it.productName} ({it.qty} {it.unitName})
                    </span>
                    <span className="font-mono text-slate-300 font-semibold shrink-0">
                      Rp {it.subtotal.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Kolom Kanan: QR Code Nota Digital & Countdown (6 Cols) */}
            <div className="lg:col-span-6 bg-slate-900/90 rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl text-center space-y-4">
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">
                  Nota Belanja Digital
                </h4>
                <p className="text-xs text-slate-400">
                  Scan QR Code di bawah dengan kamera smartphone Anda
                </p>
              </div>

              {/* QR Code Bersih & Mudah Di-scan */}
              <div className="inline-block p-3.5 rounded-2xl bg-white shadow-lg border-2 border-slate-200">
                <QRCodeSVG
                  value={getInvoiceUrl(displayState.sale.invoiceCode)}
                  size={175}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Timer Bar & Tombol Selesai Scan */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 text-[11px] sm:text-xs">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Standby otomatis dalam{" "}
                      <strong className="font-mono text-amber-300 font-bold px-1 py-0.5 rounded bg-amber-400/10">
                        {countdown}s
                      </strong>
                    </span>
                  </div>
                  <button
                    onClick={handleManualStandby}
                    className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-semibold transition cursor-pointer border border-slate-700 shrink-0"
                    title="Kembali ke layar Belum Ada Transaksi"
                  >
                    Selesai Scan
                  </button>
                </div>

                {/* Progress bar timer */}
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, (countdown / 60) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-400 pt-1">
                Mator Sakalangkong! &bull; Simpan struk ini sebagai bukti pembayaran sah.
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 3. BOTTOM FOOTER                                                          */}
      {/* ========================================================================= */}
      <footer className="px-6 py-3 border-t border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Store className="w-3.5 h-3.5 text-amber-400" />
          <span>Warung Madura Berkah POS</span>
        </div>

        <div className="flex items-center gap-3">
          <span>
            Status:{" "}
            <strong className="text-slate-200">
              {displayState.type === "STANDBY"
                ? "Standby (Menunggu Pembeli)"
                : displayState.type === "CART_UPDATE"
                  ? "Sedang Transaksi"
                  : "Nota Siap Di-Scan"}
            </strong>
          </span>
        </div>
      </footer>
    </div>
  );
}
