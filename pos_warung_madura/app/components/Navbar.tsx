import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Package,
  Truck,
  ClipboardCheck,
  BarChart3,
  Wifi,
  WifiOff,
  CloudCheck,
  CloudUpload,
  RefreshCw,
  Store,
  Clock,
  Sparkles,
  Monitor,
} from "lucide-react";

interface NavbarProps {
  activeTab: "kasir" | "katalog" | "kulakan" | "opname" | "laporan";
  setActiveTab: (tab: "kasir" | "katalog" | "kulakan" | "opname" | "laporan") => void;
  pendingSyncCount: number;
  onTriggerSync: () => void;
  isSyncing: boolean;
  onOpenQuickScan: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingSyncCount,
  onTriggerSync,
  isSyncing,
  onOpenQuickScan,
}) => {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: "kasir", label: "Kasir (POS)", icon: ShoppingCart, hotkey: "F2" },
    { id: "katalog", label: "Produk & Satuan", icon: Package, hotkey: "F3" },
    { id: "kulakan", label: "Kulakan Masuk", icon: Truck, hotkey: "F4" },
    { id: "opname", label: "Stok Opname", icon: ClipboardCheck, hotkey: "F5" },
    { id: "laporan", label: "Laporan & Margin", icon: BarChart3, hotkey: "F6" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Store Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/30">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-amber-200 via-rose-100 to-white bg-clip-text text-transparent">
                  WARUNG MADURA BERKAH
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  WM-01
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Buka 24 Jam Nonstop &bull; Kasir: Cak Mat
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md shadow-rose-600/30 font-bold"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-800 text-slate-400 border border-slate-700/60"
                    }`}
                  >
                    {item.hotkey}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right Info & Status */}
          <div className="flex items-center gap-3">
            {/* Live Clock */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/50 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-xs font-medium tracking-wide text-amber-300 tabular-nums">
                {time || "00:00:00"} WIB
              </span>
            </div>

            {/* Offline-First & Cloud Sync Badge */}
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium"
                title="Sistem berjalan offline-first di laptop warung"
              >
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Offline Siap</span>
              </div>

              {/* Sync Status Button */}
              <button
                onClick={onTriggerSync}
                disabled={isSyncing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  pendingSyncCount > 0
                    ? "bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/60 cursor-pointer animate-pulse-subtle"
                    : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200"
                }`}
                title="Klik untuk sinkronisasi transaksi offline ke server cloud"
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                ) : pendingSyncCount > 0 ? (
                  <CloudUpload className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>
                  {isSyncing
                    ? "Menyinkronkan..."
                    : pendingSyncCount > 0
                    ? `${pendingSyncCount} Antrean Sync`
                    : "Cloud Tersinkron"}
                </span>
              </button>
            </div>

            {/* Quick Scan Simulator Trigger */}
            <button
              onClick={onOpenQuickScan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 text-white font-medium text-xs shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-rose-600 transition"
              title="Simulasi scan barcode barang atau uji scanner"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simulasi Barcode</span>
            </button>

            {/* Layar Pelanggan (Customer Facing Dual Screen) */}
            <button
              onClick={() => window.open("/display", "_blank", "width=1200,height=800")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 font-medium text-xs transition cursor-pointer"
              title="Buka Layar Pelanggan (Layar Kedua / Dual Monitor)"
            >
              <Monitor className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Layar Pelanggan</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="lg:hidden flex items-center justify-around py-2 border-t border-slate-800 overflow-x-auto gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap ${
                  isActive
                    ? "bg-rose-600 text-white font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
