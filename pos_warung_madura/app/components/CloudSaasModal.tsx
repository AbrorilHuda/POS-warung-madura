import React, { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import {
  Cloud,
  CloudCheck,
  CloudOff,
  Sparkles,
  ExternalLink,
  RefreshCw,
  X,
  Check,
  Copy,
  Store,
  Key,
  AlertTriangle,
  Eye,
  EyeOff,
  ClipboardPaste,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Unlink,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { StoreConfig, CloudTenantInfo } from "../services/pos.server";

interface CloudSaasModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudConnected: boolean;
  cloudMessage?: string;
  cloudTenant?: CloudTenantInfo | null;
  storeConfig?: StoreConfig;
  pendingSyncCount: number;
  onTriggerSync: () => void;
  isSyncing: boolean;
}

export const CloudSaasModal: React.FC<CloudSaasModalProps> = ({
  isOpen,
  onClose,
  cloudConnected,
  cloudMessage,
  cloudTenant,
  storeConfig,
  pendingSyncCount,
  onTriggerSync,
  isSyncing,
}) => {
  const fetcher = useFetcher();

  const [inputToken, setInputToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isSwitchingToken, setIsSwitchingToken] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pengaturan lanjutan (opsional)
  const defaultSyncUrl =
    storeConfig?.publicInvoiceSyncUrl && !storeConfig.publicInvoiceSyncUrl.includes("5175")
      ? storeConfig.publicInvoiceSyncUrl
      : "https://pos-warung-madura-theta.vercel.app/api/sync";
  const [syncApiUrl, setSyncApiUrl] = useState(defaultSyncUrl);
  const [publicBaseUrl, setPublicBaseUrl] = useState(storeConfig?.publicInvoiceBaseUrl || "");

  // Status feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isConnected = Boolean(cloudTenant && cloudTenant.valid);

  // Reset form saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setActionError(null);
      setActionSuccess(null);
      setIsSwitchingToken(false);
      setInputToken(storeConfig?.syncSecretKey || "");
      if (storeConfig?.publicInvoiceSyncUrl && !storeConfig.publicInvoiceSyncUrl.includes("5175")) {
        setSyncApiUrl(storeConfig.publicInvoiceSyncUrl);
      } else {
        setSyncApiUrl("https://pos-warung-madura-theta.vercel.app/api/sync");
      }
      if (storeConfig?.publicInvoiceBaseUrl !== undefined) {
        setPublicBaseUrl(storeConfig.publicInvoiceBaseUrl);
      }
    }
  }, [
    isOpen,
    storeConfig?.syncSecretKey,
    storeConfig?.publicInvoiceSyncUrl,
    storeConfig?.publicInvoiceBaseUrl,
  ]);

  // Handle feedback dari fetcher (Connect / Disconnect)
  useEffect(() => {
    if (fetcher.data) {
      const data = fetcher.data as any;
      if (data.intent === "save_cloud_config") {
        if (data.ok) {
          setActionSuccess(data.message || "Toko berhasil dihubungkan!");
          setActionError(null);
          setIsSwitchingToken(false);
          const timer = setTimeout(() => setActionSuccess(null), 4000);
          return () => clearTimeout(timer);
        } else {
          setActionError(data.message || "Gagal menghubungkan toko. Periksa kembali Secret Key Anda.");
          setActionSuccess(null);
        }
      }

      if (data.intent === "disconnect_cloud") {
        if (data.ok) {
          setActionSuccess("Koneksi cloud toko berhasil diputuskan.");
          setActionError(null);
          setIsSwitchingToken(false);
          setInputToken("");
          const timer = setTimeout(() => setActionSuccess(null), 3000);
          return () => clearTimeout(timer);
        } else {
          setActionError(data.message || "Gagal memutuskan sambungan.");
          setActionSuccess(null);
        }
      }
    }
  }, [fetcher.data]);

  if (!isOpen) return null;

  const isPro = cloudTenant?.plan === "pro";
  const isFree = cloudTenant?.plan === "free";

  const host =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "localhost";

  let fallbackBaseUrl = `http://${host}:5175`;
  const candidateSync = syncApiUrl || storeConfig?.publicInvoiceSyncUrl;
  if (candidateSync && !candidateSync.includes("127.0.0.1") && !candidateSync.includes("localhost")) {
    try {
      fallbackBaseUrl = new URL(candidateSync).origin;
    } catch (e) {}
  }

  const effectiveBaseUrl = (publicBaseUrl || storeConfig?.publicInvoiceBaseUrl || fallbackBaseUrl).replace(/\/$/, "");
  const effectiveSlug = cloudTenant?.storeSlug || storeConfig?.storeSlug || "warung-madura-berkah";
  const effectiveCode = cloudTenant?.storeCode || storeConfig?.storeCode || "WM01";
  const exampleInvoiceUrl = `${effectiveBaseUrl}/${effectiveSlug}/invoice/${effectiveCode}-000001`;

  const handlePaste = async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInputToken(text.trim());
          setActionError(null);
        }
      }
    } catch (err) {
      console.warn("Gagal membaca clipboard:", err);
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) {
      setActionError("Masukkan Secret Key toko terlebih dahulu.");
      return;
    }

    setActionError(null);

    // Dapatkan URL sync yang benar:
    let targetSyncUrl = (syncApiUrl || "").trim();
    const envSyncUrl = storeConfig?.publicInvoiceSyncUrl?.trim();
    if (!targetSyncUrl || (targetSyncUrl.includes("5175") && envSyncUrl && !envSyncUrl.includes("5175"))) {
      targetSyncUrl = envSyncUrl || "https://pos-warung-madura-theta.vercel.app/api/sync";
    }

    let targetBaseUrl = (publicBaseUrl || "").trim();
    if (!targetBaseUrl && storeConfig?.publicInvoiceBaseUrl) {
      targetBaseUrl = storeConfig.publicInvoiceBaseUrl.trim();
    } else if (!targetBaseUrl) {
      try {
        targetBaseUrl = new URL(targetSyncUrl).origin;
      } catch (err) {
        targetBaseUrl = "https://pos-warung-madura-theta.vercel.app";
      }
    }

    fetcher.submit(
      {
        intent: "save_cloud_config",
        sync_secret_key: inputToken.trim(),
        sync_api_url: targetSyncUrl,
        public_base_url: targetBaseUrl,
      },
      { method: "POST" }
    );
  };

  const handleDisconnect = () => {
    if (confirm("Yakin ingin memutuskan koneksi Cloud SaaS untuk toko ini?")) {
      fetcher.submit({ intent: "disconnect_cloud" }, { method: "POST" });
    }
  };

  const handleCopyExampleUrl = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(exampleInvoiceUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const isSubmitting = fetcher.state === "submitting";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-4 sm:my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/15">
              <Cloud className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-tight">
                  Cloud Invoice SaaS Multi-Tenant
                </h3>
                {isConnected && isPro && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-xs">
                    <Sparkles className="w-3 h-3" />
                    PRO
                  </span>
                )}
                {isConnected && isFree && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-200 border border-slate-600">
                    FREE TIER
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Setup 1-Klik: Identitas toko otomatis tersinkron dari cloud
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Notification Banners */}
          {actionSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{actionError}</p>
                <p className="text-[10px] font-normal text-rose-600 mt-0.5">
                  Pastikan endpoint sync dapat dijangkau dan Secret Key yang Anda masukkan benar.
                </p>
              </div>
            </div>
          )}

          {/* KONDISI 1: TOKO SUDAH TERHUBUNG & VALID (Kecuali sedang klik "Ganti Token") */}
          {isConnected && !isSwitchingToken ? (
            <div className="space-y-4">
              {/* Kartu Profil Toko Terhubung (Resmi dari Cloud) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-slate-50 border border-emerald-200 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-emerald-100/70">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-xs shrink-0">
                      {cloudTenant?.storeCode?.slice(0, 2) || "WM"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                          {cloudTenant?.storeName || storeConfig?.storeName}
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 shrink-0">
                          {cloudTenant?.storeCode || storeConfig?.storeCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap min-w-0">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {cloudTenant?.storeAddress || storeConfig?.storeAddress || "Alamat warung terdaftar"}
                          </span>
                        </span>
                        {(cloudTenant?.ownerName || storeConfig?.ownerName) && (
                          <span className="text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                            Pemilik: <strong className="text-slate-800">{cloudTenant?.ownerName || storeConfig?.ownerName}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 self-start sm:self-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs whitespace-nowrap">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Terverifikasi</span>
                    </span>
                  </div>
                </div>

                {/* Grid Status Kuota & Paket */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/80 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-medium block">
                      Paket Langganan
                    </span>
                    <span className="font-bold text-slate-900 text-sm mt-0.5 block flex items-center gap-1">
                      {isPro ? (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span className="text-amber-800">Pro Unlimited</span>
                        </>
                      ) : (
                        <span>Free Tier</span>
                      )}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-medium block">
                      Sisa Kuota Bulan Ini
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                      {isPro ? "Unlimited (∞)" : `${cloudTenant?.quotaRemaining ?? 50} Struk`}
                    </span>
                  </div>
                </div>

                {/* URL Struk Publik */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Alamat Struk Digital Pelanggan:
                  </span>
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-600">
                    <span className="truncate pr-2">{exampleInvoiceUrl}</span>
                    <button
                      onClick={handleCopyExampleUrl}
                      className="text-slate-400 hover:text-slate-800 transition p-1 shrink-0 cursor-pointer"
                      title="Salin contoh tautan struk"
                    >
                      {copiedUrl ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Antrean Sinkronisasi & Tombol Sync */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Antrean Transaksi POS Lokal
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {pendingSyncCount > 0
                      ? `${pendingSyncCount} transaksi menunggu sinkronisasi`
                      : "Semua transaksi di database lokal sudah sinkron ke cloud"}
                  </span>
                </div>

                <button
                  onClick={onTriggerSync}
                  disabled={isSyncing || !cloudConnected}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Menyinkron..." : "Sync Sekarang"}</span>
                </button>
              </div>

              {/* Opsi Ganti Token / Putuskan */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsSwitchingToken(true)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition flex items-center gap-1 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ganti Secret Key / Toko Lain</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isSubmitting}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Unlink className="w-3.5 h-3.5 shrink-0" />
                  <span>{isSubmitting ? "Memutuskan..." : "Putuskan Sambungan"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* KONDISI 2: BELUM TERHUBUNG / SEDANG INPUT SECRET KEY BARU */
            <form onSubmit={handleConnect} className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-b from-indigo-50/50 via-white to-slate-50 border border-slate-200 shadow-2xs space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-500" />
                    <span>Masukkan Secret Key Toko</span>
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Tempel token rahasia yang Anda dapatkan saat mendaftar toko di platform SaaS. 
                    <strong> Semua identitas toko (Nama, Kode, Alamat, dan Kuota) akan otomatis diunduh dan dipasang!</strong>
                  </p>
                </div>

                {/* Single Token Input Bar */}
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"}
                      value={inputToken}
                      onChange={(e) => {
                        setInputToken(e.target.value);
                        setActionError(null);
                      }}
                      placeholder="tok_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                      required
                      className="w-full pl-3 pr-20 py-2.5 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition shadow-inner"
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                        title={showSecret ? "Sembunyikan secret" : "Tampilkan secret"}
                      >
                        {showSecret ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handlePaste}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer border border-slate-200"
                        title="Tempel token dari clipboard"
                      >
                        <ClipboardPaste className="w-3 h-3" />
                        <span>Tempel</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tombol Hubungkan Otomatis */}
                <button
                  type="submit"
                  disabled={isSubmitting || !inputToken.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi & Mengunduh Data Toko...</span>
                    </>
                  ) : (
                    <>
                      <span>Hubungkan Toko Otomatis</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {isConnected && isSwitchingToken && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setIsSwitchingToken(false)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Batal, kembali ke profil toko aktif
                    </button>
                  </div>
                )}
              </div>

              {/* Bantuan Bagi yang Belum Punya Token */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">
                    Belum punya Secret Key?
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Daftar toko baru untuk mendapatkan token (Gratis 50 struk/bulan).
                  </span>
                </div>

                <a
                  href={`${effectiveBaseUrl}/daftar`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition shrink-0"
                >
                  <span>Daftar Sekarang</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Accordion: Pengaturan Lanjutan (Opsional) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between text-slate-700 font-semibold cursor-pointer"
                >
                  <span>Pengaturan Lanjutan (Server URL & Domain)</span>
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Endpoint API Sync Cloud
                      </label>
                      <input
                        type="text"
                        value={syncApiUrl}
                        onChange={(e) => setSyncApiUrl(e.target.value)}
                        placeholder="https://pos-warung-madura-theta.vercel.app/api/sync"
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Domain Struk Publik (Opsional)
                      </label>
                      <input
                        type="text"
                        value={publicBaseUrl}
                        onChange={(e) => setPublicBaseUrl(e.target.value)}
                        placeholder="https://pos-warung-madura-theta.vercel.app"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Kosongkan jika masih diuji di localhost / jaringan lokal.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Links */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <a
            href={effectiveBaseUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition"
          >
            <span>Buka Portal SaaS Cloud</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <a
            href={`${effectiveBaseUrl}/daftar`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 transition"
          >
            <span>Pendaftaran Toko</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
