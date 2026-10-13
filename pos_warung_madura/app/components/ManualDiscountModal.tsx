import React, { useState, useEffect } from "react";
import {
  X,
  Percent,
  DollarSign,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Tag,
  ArrowRight,
} from "lucide-react";

interface ManualDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "item" | "transaction";
  title?: string;
  originalPrice: number; // Harga total item (price * qty) atau grand total transaksi
  unitPrice?: number;    // Harga satuan barang jika targetType === 'item'
  qty?: number;
  costPrice?: number;    // HPP barang jika ada
  maxCashierPercent?: number; // default 10%
  onApplyDiscount: (result: {
    discountType: "percentage" | "fixed_amount";
    discountValue: number;
    discountAmount: number;
    reason?: string;
    isSupervisorApproved: boolean;
  }) => void;
}

export const ManualDiscountModal: React.FC<ManualDiscountModalProps> = ({
  isOpen,
  onClose,
  targetType,
  title,
  originalPrice,
  unitPrice,
  qty = 1,
  costPrice,
  maxCashierPercent = 10,
  onApplyDiscount,
}) => {
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [inputValue, setInputValue] = useState<number>(5);
  const [reason, setReason] = useState<string>("Pelanggan Langganan");
  const [ownerPin, setOwnerPin] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(5);
      setOwnerPin("");
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Hitung besaran potongan diskon
  let calculatedDiscountAmount = 0;
  let calculatedPercent = 0;

  if (discountType === "percentage") {
    calculatedPercent = Math.min(100, Math.max(0, inputValue));
    calculatedDiscountAmount = Math.round((originalPrice * calculatedPercent) / 100);
  } else {
    calculatedDiscountAmount = Math.min(originalPrice, Math.max(0, inputValue));
    calculatedPercent = originalPrice > 0 ? (calculatedDiscountAmount / originalPrice) * 100 : 0;
  }

  const finalPrice = Math.max(0, originalPrice - calculatedDiscountAmount);

  // Periksa apakah harga jual satuan jatuh di bawah HPP
  const finalUnitPrice = qty > 0 ? finalPrice / qty : finalPrice;
  const isBelowCostPrice =
    targetType === "item" && costPrice !== undefined && costPrice > 0 && finalUnitPrice < costPrice;

  // Periksa apakah diskon melampaui limit wewenang kasir
  const exceedsCashierLimit = calculatedPercent > maxCashierPercent;
  const requiresOwnerAuth = exceedsCashierLimit || isBelowCostPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (calculatedDiscountAmount <= 0) {
      setErrorMessage("Masukkan nilai diskon yang valid.");
      return;
    }

    if (requiresOwnerAuth) {
      if (!ownerPin.trim()) {
        setErrorMessage("PIN Pemilik wajib diisi untuk otorisasi diskon ini.");
        return;
      }

      setIsVerifying(true);
      try {
        const res = await fetch("/api/promotions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "authorize_discount",
            ownerPin: ownerPin.trim(),
            discountType: discountType === "percentage" ? `${calculatedPercent}%` : `Rp ${calculatedDiscountAmount}`,
            amount: calculatedDiscountAmount,
            target: title || (targetType === "item" ? "Baris Item" : "Nota Transaksi"),
            reason: reason.trim() || (isBelowCostPrice ? "Di Bawah HPP" : "Di Atas Limit Kasir"),
          }),
        });
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Server tidak mengembalikan format JSON yang valid");
        }
        const json = await res.json();
        if (!json.ok) {
          throw new Error(json.error || "PIN Pemilik tidak valid.");
        }

        onApplyDiscount({
          discountType,
          discountValue: inputValue,
          discountAmount: calculatedDiscountAmount,
          reason: reason.trim(),
          isSupervisorApproved: true,
        });
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || "Gagal memverifikasi PIN Pemilik.");
      } finally {
        setIsVerifying(false);
      }
    } else {
      // Diskon dalam batas wewenang kasir, langsung terapkan
      onApplyDiscount({
        discountType,
        discountValue: inputValue,
        discountAmount: calculatedDiscountAmount,
        reason: reason.trim(),
        isSupervisorApproved: false,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                <Tag className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-bold">
                  {targetType === "item" ? "Diskon Manual Item" : "Diskon Transaksi (Nota)"}
                </h2>
                <p className="text-xs text-indigo-200/80 truncate max-w-[240px]">
                  {title || (targetType === "item" ? "Potongan per produk" : "Potongan total nota")}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Switch: Persen atau Nominal */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setDiscountType("percentage");
                setInputValue(5);
              }}
              className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                discountType === "percentage"
                  ? "bg-white text-indigo-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Persentase (%)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDiscountType("fixed_amount");
                setInputValue(1000);
              }}
              className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                discountType === "fixed_amount"
                  ? "bg-white text-indigo-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Nominal Rupiah</span>
            </button>
          </div>

          {/* Input Nilai Diskon */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700">
              {discountType === "percentage" ? "Besar Diskon (%):" : "Nominal Potongan (Rp):"}
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={discountType === "percentage" ? 100 : originalPrice}
                value={inputValue}
                onChange={(e) => setInputValue(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 font-mono text-base font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <span className="absolute right-4 top-3 font-bold text-slate-400">
                {discountType === "percentage" ? "%" : "IDR"}
              </span>
            </div>

            {/* Tombol Preset Cepat */}
            <div className="flex items-center gap-1.5 pt-1">
              {discountType === "percentage"
                ? [5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setInputValue(pct)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        inputValue === pct
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                          : "border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))
                : [1000, 2000, 5000, 10000].map((nom) => (
                    <button
                      key={nom}
                      type="button"
                      onClick={() => setInputValue(nom)}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-mono font-bold transition cursor-pointer ${
                        inputValue === nom
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                          : "border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {nom >= 1000 ? `${nom / 1000}k` : nom}
                    </button>
                  ))}
            </div>
          </div>

          {/* Rincian Kalkulasi Preview */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-slate-600">
              <span>Harga Normal:</span>
              <span className="font-mono">Rp {originalPrice.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex items-center justify-between text-rose-600 font-bold">
              <span>Potongan Diskon:</span>
              <span className="font-mono">- Rp {calculatedDiscountAmount.toLocaleString("id-ID")}</span>
            </div>
            <div className="pt-1.5 border-t border-dashed border-slate-200 flex items-center justify-between font-black text-slate-900 text-sm">
              <span>Harga Setelah Diskon:</span>
              <span className="font-mono text-indigo-700">Rp {finalPrice.toLocaleString("id-ID")}</span>
            </div>

            {costPrice !== undefined && costPrice > 0 && targetType === "item" && (
              <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
                <span>HPP Satuan: Rp {costPrice.toLocaleString("id-ID")}</span>
                <span>Jual: Rp {Math.round(finalUnitPrice).toLocaleString("id-ID")}</span>
              </div>
            )}
          </div>

          {/* Peringatan & Otorisasi Pemilik (Supervisor Override) */}
          {requiresOwnerAuth && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <Shield className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-900 text-xs">
                    Memerlukan Otorisasi PIN Pemilik
                  </h4>
                  <p className="text-[11px] text-amber-800/90 mt-0.5">
                    {isBelowCostPrice
                      ? "Harga jual setelah diskon berada DI BAWAH HPP (modal beli)!"
                      : `Diskon (${Math.round(calculatedPercent)}%) melebihi batas wewenang kasir (${maxCashierPercent}%).`}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-amber-900 uppercase">
                  Alasan Diskon:
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Pembeli partai banyak / Langganan dekat"
                  className="w-full px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-amber-900 uppercase">
                  Masukkan PIN Pemilik (Owner):
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={6}
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value)}
                    placeholder="PIN 4–6 digit"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-amber-400 bg-white font-mono text-center tracking-widest text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-amber-600 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isVerifying}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <span>{isVerifying ? "Memverifikasi..." : "Terapkan Diskon"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
