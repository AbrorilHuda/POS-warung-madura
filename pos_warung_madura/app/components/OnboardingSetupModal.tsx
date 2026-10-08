import React, { useState } from "react";
import {
  Sparkles,
  Key,
  Shield,
  ShieldCheck,
  Store,
  User,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Layers,
} from "lucide-react";
import type { ShiftSecuritySettings } from "../types/pos";

interface OnboardingSetupModalProps {
  isOpen: boolean;
  onCompleted: (settings: ShiftSecuritySettings) => void;
  defaultStoreName?: string;
  defaultStoreAddress?: string;
}

export const OnboardingSetupModal: React.FC<OnboardingSetupModalProps> = ({
  isOpen,
  onCompleted,
  defaultStoreName = "Warung Madura Berkah",
  defaultStoreAddress = "Jl. Raya Warung Madura No. 24, Buka 24 Jam Non-Stop",
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Cloud & Identitas Toko
  const [hasCloudSecret, setHasCloudSecret] = useState(false);
  const [syncSecretInput, setSyncSecretInput] = useState("");
  const [isVerifyingCloud, setIsVerifyingCloud] = useState(false);
  const [cloudVerifiedMsg, setCloudVerifiedMsg] = useState<string | null>(null);
  const [storeName, setStoreName] = useState(defaultStoreName);
  const [storeAddress, setStoreAddress] = useState(defaultStoreAddress);
  const [ownerName, setOwnerName] = useState("Cak Huda (Pemilik)");

  // Step 2: Keamanan Pemilik (Owner PIN & Recovery Code)
  const [ownerPin, setOwnerPin] = useState("");
  const [ownerPinConfirm, setOwnerPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [recoveryCode] = useState(() => {
    const r1 = Math.floor(1000 + Math.random() * 9000);
    const r2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REC-${r1}-${r2}`;
  });
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  // Step 3: Pengaturan Kasir Pertama & Shift
  const [cashierName, setCashierName] = useState("Kasir 1");
  const [requireCashierPin, setRequireCashierPin] = useState(false);
  const [cashierPin, setCashierPin] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Verifikasi Secret Key dari invoice_publik
  const handleVerifyCloudSecret = async () => {
    if (!syncSecretInput.trim()) {
      setErrorMsg("Masukkan Secret Key dari invoice_publik terlebih dahulu.");
      return;
    }

    setIsVerifyingCloud(true);
    setErrorMsg(null);
    setCloudVerifiedMsg(null);

    try {
      const formData = new FormData();
      formData.append("intent", "verify_cloud_secret");
      formData.append("secret_key", syncSecretInput.trim());

      const res = await fetch("/", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data && data.ok && data.tenant) {
        setCloudVerifiedMsg(`Terhubung: Toko "${data.tenant.storeName}" (${data.tenant.storeCode})`);
        if (data.tenant.storeName) setStoreName(data.tenant.storeName);
        if (data.tenant.storeAddress) setStoreAddress(data.tenant.storeAddress);
        if (data.tenant.ownerName) setOwnerName(data.tenant.ownerName);
      } else {
        setErrorMsg(data?.message || "Secret Key tidak valid atau server cloud tidak dapat dihubungi.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghubungi server cloud.");
    } finally {
      setIsVerifyingCloud(false);
    }
  };

  const handleCopyRecovery = () => {
    navigator.clipboard.writeText(recoveryCode);
    setCopiedRecovery(true);
    setTimeout(() => setCopiedRecovery(false), 3000);
  };

  const handleNextStep1 = () => {
    setErrorMsg(null);
    if (!storeName.trim()) {
      setErrorMsg("Nama warung/toko wajib diisi.");
      return;
    }
    if (!ownerName.trim()) {
      setErrorMsg("Nama pemilik wajib diisi.");
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = () => {
    setErrorMsg(null);
    if (!ownerPin || ownerPin.length < 4 || ownerPin.length > 6) {
      setErrorMsg("PIN Pemilik wajib 4–6 digit angka.");
      return;
    }
    if (!/^\d+$/.test(ownerPin)) {
      setErrorMsg("PIN Pemilik harus berupa angka saja.");
      return;
    }
    if (ownerPin !== ownerPinConfirm) {
      setErrorMsg("Konfirmasi PIN tidak cocok dengan PIN yang dibuat.");
      return;
    }
    setStep(3);
  };

  const handleFinishSetup = async () => {
    setErrorMsg(null);
    if (!cashierName.trim()) {
      setErrorMsg("Nama kasir awal wajib diisi.");
      return;
    }
    if (requireCashierPin) {
      if (!cashierPin || cashierPin.length !== 4 || !/^\d+$/.test(cashierPin)) {
        setErrorMsg("Karena PIN Kasir diwajibkan, masukkan 4 digit angka PIN untuk kasir.");
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initial_setup",
          storeName: storeName.trim(),
          ownerName: ownerName.trim(),
          ownerPin: ownerPin.trim(),
          storeAddress: storeAddress.trim(),
          cashierName: cashierName.trim(),
          requireCashierPin,
          cashierPin: requireCashierPin ? cashierPin.trim() : undefined,
          recoveryCode,
          syncSecret: hasCloudSecret ? syncSecretInput.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (data && data.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          onCompleted(data.settings);
        }, 1200);
      } else {
        setErrorMsg(data?.error || "Gagal menyelesaikan setup awal.");
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat menyimpan setup.");
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
        <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">Setup Berhasil Disimpan!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Selamat datang di <strong>{storeName}</strong>. Sistem kasir siap digunakan.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-left text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Pemilik:</span>
              <strong className="text-slate-900">{ownerName}</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Kasir Pertama:</span>
              <strong className="text-slate-900">{cashierName}</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Mode Kasir:</span>
              <strong className="text-slate-900">{requireCashierPin ? "Wajib PIN 4 Digit" : "Mode Cepat (Tanpa PIN)"}</strong>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-center gap-2 pt-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Memuat aplikasi kasir...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Onboarding */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                Setup Awal POS Warung Madura
              </h3>
              <p className="text-xs text-slate-300">
                Langkah {step} dari 3: {step === 1 ? "Identitas Toko & Pemilik" : step === 2 ? "Keamanan PIN Pemilik" : "Kasir Pertama & Mode Shift"}
              </p>
            </div>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  step === s ? "w-6 bg-orange-400" : step > s ? "bg-emerald-400" : "bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: IDENTITAS TOKO & CLOUD */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200/80">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-950">
                    <Key className="w-4 h-4 text-orange-600" />
                    <span>Sudah Mendaftar di Invoice Publik Cloud?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasCloudSecret(!hasCloudSecret)}
                    className="text-[11px] font-bold text-orange-700 hover:text-orange-950 underline cursor-pointer"
                  >
                    {hasCloudSecret ? "Isi Manual Saja" : "Punya Secret Key"}
                  </button>
                </div>

                {hasCloudSecret && (
                  <div className="mt-3 pt-3 border-t border-orange-200/80 space-y-2">
                    <p className="text-[11px] text-orange-800">
                      Tempelkan Secret Key (dimulai dengan <code className="font-mono font-bold">tok_live_...</code>). Nama toko, alamat, dan pemilik akan terisi otomatis:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={syncSecretInput}
                        onChange={(e) => setSyncSecretInput(e.target.value)}
                        placeholder="tok_live_xxxxxxxxxxxxxxxx..."
                        className="flex-1 px-3 py-2 rounded-xl bg-white border border-orange-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyCloudSecret}
                        disabled={isVerifyingCloud}
                        className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {isVerifyingCloud ? "Memeriksa..." : "Muat Data"}
                      </button>
                    </div>
                    {cloudVerifiedMsg && (
                      <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {cloudVerifiedMsg}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Form Input Toko & Pemilik */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Warung / Toko <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Contoh: Warung Madura Berkah"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap Pemilik (Owner) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Contoh: Cak Huda (Pemilik)"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Akun ini memegang hak akses penuh, persetujuan void/retur, dan laporan laba.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Lengkap Toko (Untuk Header Struk)
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      placeholder="Jl. Raya Warung Madura No. 24, Buka 24 Jam Non-Stop"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: KEAMANAN PIN PEMILIK */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 text-xs text-indigo-950">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Kunci Otoritas Pemilik (Supervisor)</span>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  PIN ini digunakan saat melihat Laporan Laba/Rugi, mengubah harga produk, serta memberikan persetujuan saat kasir melakukan pembatalan nota (Void) atau retur barang.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Buat PIN Pemilik (4–6 Angka) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPin ? "text" : "password"}
                      maxLength={6}
                      value={ownerPin}
                      onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Contoh: 123456"
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Konfirmasi Ulang PIN <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPin ? "text" : "password"}
                      maxLength={6}
                      value={ownerPinConfirm}
                      onChange={(e) => setOwnerPinConfirm(e.target.value.replace(/\D/g, ""))}
                      placeholder="Ketik ulang PIN"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Recovery Code */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-amber-600" />
                    Kode Pemulihan Darurat (Simpan/Catat)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRecovery}
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedRecovery ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedRecovery ? "Tersalin!" : "Salin Kode"}
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-center font-mono font-extrabold text-amber-900 text-sm tracking-wider select-all">
                  {recoveryCode}
                </div>
                <p className="text-[10px] text-amber-800">
                  Gunakan kode ini jika suatu saat Anda lupa PIN Pemilik untuk mereset kata sandi toko.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: KASIR PERTAMA & MODE KEAMANAN SHIFT */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Kasir Pertama / Penjaga Shift Awal <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    placeholder="Contoh: Cak Mat atau Kasir 1"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Anda dapat menambah kasir lain kapan saja melalui menu Pengaturan Kasir.
                </p>
              </div>

              {/* Toggle Mode PIN Kasir */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">
                      Wajibkan PIN 4 Digit untuk Kasir?
                    </h5>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      {requireCashierPin
                        ? "Kasir wajib memasukkan 4 angka PIN saat buka shift/ganti shift agar uang laci tidak tertukar."
                        : "Mode Cepat Warung: Kasir cukup klik namanya dari daftar saat ganti shift tanpa sandi apa pun."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRequireCashierPin(!requireCashierPin)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      requireCashierPin ? "bg-orange-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        requireCashierPin ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {requireCashierPin && (
                  <div className="pt-3 border-t border-slate-200 animate-in fade-in duration-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Buat PIN 4 Digit untuk {cashierName} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cashierPin}
                      onChange={(e) => setCashierPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="0000"
                      className="w-40 px-3 py-2 rounded-xl border border-slate-300 text-center font-mono font-bold tracking-widest text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as 1 | 2)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-bold cursor-pointer"
            >
              ← Kembali
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={step === 1 ? handleNextStep1 : handleNextStep2}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>Lanjut</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishSetup}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isLoading ? "Menyimpan..." : "Selesaikan & Mulai Kasir"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
