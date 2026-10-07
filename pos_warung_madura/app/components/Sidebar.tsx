import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Package,
  Truck,
  ClipboardCheck,
  BarChart3,
  CloudCheck,
  CloudUpload,
  CloudOff,
  RefreshCw,
  Clock,
  Wifi,
  Store,
  Smartphone,
  Monitor,
  Sparkles,
  Info,
  Database,
  Users,
  Printer,
} from "lucide-react";
import type { StoreConfig, CloudTenantInfo } from "../services/pos.server";
import { CloudSaasModal } from "./CloudSaasModal";
import { BackupModal } from "./BackupModal";
import { PrinterSettingsModal } from "./PrinterSettingsModal";

interface SidebarProps {
  activeTab: "kasir" | "katalog" | "kulakan" | "opname" | "kasbon" | "laporan";
  setActiveTab: (tab: "kasir" | "katalog" | "kulakan" | "opname" | "kasbon" | "laporan") => void;
  pendingSyncCount: number;
  onTriggerSync: () => void;
  isSyncing: boolean;
  onOpenPhoneScannerModal?: () => void;
  isPhoneConnected?: boolean;
  dbConnected?: boolean;
  dbMessage?: string;
  cloudConnected?: boolean;
  cloudMessage?: string;
  cloudTenant?: CloudTenantInfo | null;
  storeConfig?: StoreConfig;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingSyncCount,
  onTriggerSync,
  isSyncing,
  onOpenPhoneScannerModal,
  isPhoneConnected = false,
  dbConnected = true,
  dbMessage,
  cloudConnected = false,
  cloudMessage,
  cloudTenant,
  storeConfig,
}) => {
  const [time, setTime] = useState<string>("");
  const [isSaasModalOpen, setIsSaasModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { id: "kasir", label: "Kasir (POS)", icon: ShoppingCart, hotkey: "F2" },
    { id: "katalog", label: "Produk & Satuan", icon: Package, hotkey: "F3" },
    { id: "kulakan", label: "Kulakan Masuk", icon: Truck, hotkey: "F4" },
    { id: "opname", label: "Stok Opname", icon: ClipboardCheck, hotkey: "F5" },
    { id: "kasbon", label: "Kasbon & Pelanggan", icon: Users, hotkey: "F6" },
    { id: "laporan", label: "Laporan & Omzet", icon: BarChart3, hotkey: "F7" },
  ] as const;

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between h-screen sticky top-0 shrink-0 z-30 select-none">
      {/* Top Header */}
      <div>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider">
              {storeConfig?.storeCode?.slice(0, 2) || "WM"}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-bold text-slate-900 text-sm tracking-tight leading-tight truncate max-w-[110px]" title={storeConfig?.storeName}>
                  {storeConfig?.storeName || "Warung Madura"}
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200 shrink-0">
                  {storeConfig?.storeCode || "WM-01"}
                </span>
                {cloudTenant?.valid && cloudTenant.plan === "pro" && (
                  <button
                    onClick={() => setIsSaasModalOpen(true)}
                    className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs hover:bg-amber-200 cursor-pointer"
                    title="Paket Pro SaaS Aktif — Klik untuk detail"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                    PRO
                  </button>
                )}
                {cloudTenant?.valid && cloudTenant.plan === "free" && (
                  <button
                    onClick={() => setIsSaasModalOpen(true)}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 cursor-pointer"
                    title={`Paket Free SaaS (Sisa: ${cloudTenant.quotaRemaining}) — Klik untuk detail`}
                  >
                    FREE
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${dbConnected ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                <span>{dbConnected ? "MySQL Terhubung" : "MySQL Offline"}</span> &bull; {storeConfig?.cashierName || "Cak Mat"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`}
                  />
                  <span>{item.label}</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                    }`}
                >
                  {item.hotkey}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: Sync & Quick Actions */}
      <div className="p-4 border-t border-slate-100 space-y-2 bg-slate-50/50">
        {/* Layar Pelanggan (Monitor Kedua) */}
        <button
          onClick={() => window.open("/display", "_blank", "width=1200,height=800")}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
          title="Buka Layar Pelanggan di monitor kedua"
        >
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            <span>Layar Pelanggan</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-emerald-300">
            Dual Layar
          </span>
        </button>

        {/* Backup & Restore Database Button (PRD T3) */}
        <button
          onClick={() => setIsBackupModalOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
          title="Buka Pusat Backup & Restore Database"
        >
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Backup & Restore</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            MySQL
          </span>
        </button>

        {/* Sync Status Button with Info Trigger */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onTriggerSync}
            disabled={isSyncing}
            title={
              isSyncing
                ? "Sedang menyinkronkan transaksi ke cloud..."
                : pendingSyncCount > 0
                  ? cloudConnected
                    ? `${pendingSyncCount} transaksi tertunda. Klik untuk menyinkronkan ke cloud.`
                    : `${pendingSyncCount} transaksi tertunda. Server cloud offline (${cloudMessage || "periksa koneksi"}).`
                  : cloudConnected
                    ? "Semua transaksi tersinkron ke cloud"
                    : `Server invoice publik offline (${cloudMessage || "klik untuk konfigurasi"})`
            }
            className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
              pendingSyncCount > 0
                ? cloudConnected
                  ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                  : "bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100"
                : cloudConnected
                  ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-2">
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              ) : pendingSyncCount > 0 ? (
                cloudConnected ? (
                  <CloudUpload className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5 text-rose-600" />
                )
              ) : cloudConnected ? (
                <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="text-[11px] font-semibold truncate max-w-[95px]">
                {isSyncing
                  ? "Menyinkron..."
                  : pendingSyncCount > 0
                    ? cloudConnected
                      ? `${pendingSyncCount} Antrean`
                      : `${pendingSyncCount} Offline`
                    : cloudConnected
                      ? cloudTenant?.plan === "pro"
                        ? "Cloud Pro"
                        : "Cloud Sinkron"
                      : "Cloud Off"}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {isSyncing
                ? "..."
                : pendingSyncCount > 0
                  ? "Sync"
                  : cloudConnected
                    ? "OK"
                    : "Off"}
            </span>
          </button>

          <button
            onClick={() => setIsPrinterModalOpen(true)}
            title="Pengaturan Printer Thermal Struk (F9)"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsSaasModalOpen(true)}
            title="Lihat status detail Cloud SaaS & Multi-Tenant"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Wireless HP Scanner Button (PRD F12) */}
        {onOpenPhoneScannerModal && (
          <button
            onClick={onOpenPhoneScannerModal}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition ${isPhoneConnected
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
              }`}
          >
            <div className="flex items-center gap-2">
              <Smartphone
                className={`w-3.5 h-3.5 ${isPhoneConnected ? "text-emerald-600" : "text-amber-500"
                  }`}
              />
              <span>{isPhoneConnected ? "HP Terhubung" : "Hubungkan HP Scanner"}</span>
            </div>
            <span
              className={`w-2 h-2 rounded-full ${isPhoneConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                }`}
            ></span>
          </button>
        )}

        {/* Time & System Mode */}
        <div className="flex items-center justify-between pt-1 px-1 text-[11px] text-slate-400">
          <div className="flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{time || "00:00"} WIB</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`${dbConnected ? "text-emerald-600" : "text-amber-600"} font-medium flex items-center gap-1`}
              title={dbConnected ? "MySQL lokal terhubung" : "MySQL offline"}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dbConnected ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              <span>MySQL</span>
            </span>
            <span className="text-slate-300">&bull;</span>
            <span
              className={`${cloudConnected ? "text-emerald-600" : "text-slate-400"} font-medium flex items-center gap-1`}
              title={cloudConnected ? `Cloud Sync API aktif: ${cloudMessage}` : `Cloud Sync offline: ${cloudMessage}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cloudConnected ? "bg-emerald-500" : "bg-slate-300"}`}></span>
              <span>Cloud</span>
            </span>
          </div>
        </div>
      </div>

      {/* Cloud SaaS Multi-Tenant Modal */}
      <CloudSaasModal
        isOpen={isSaasModalOpen}
        onClose={() => setIsSaasModalOpen(false)}
        cloudConnected={cloudConnected}
        cloudMessage={cloudMessage}
        cloudTenant={cloudTenant}
        storeConfig={storeConfig}
        pendingSyncCount={pendingSyncCount}
        onTriggerSync={onTriggerSync}
        isSyncing={isSyncing}
      />

      {/* Backup & Restore Database Modal (PRD T3) */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />

      {/* Printer Thermal Settings Modal (PRD F9) */}
      <PrinterSettingsModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
      />
    </aside>
  );
};
