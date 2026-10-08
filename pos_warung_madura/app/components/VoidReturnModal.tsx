import React, { useState, useEffect } from "react";
import {
  X,
  RotateCcw,
  Ban,
  Shield,
  Search,
  AlertCircle,
  CheckCircle2,
  Lock,
  Package,
} from "lucide-react";
import type { SaleDetailWithItems } from "../services/returns.server";

interface VoidReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInvoiceCode?: string;
  onSuccess?: () => void;
}

export const VoidReturnModal: React.FC<VoidReturnModalProps> = ({
  isOpen,
  onClose,
  initialInvoiceCode = "",
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"void" | "return">("return");
  const [searchInvoice, setSearchInvoice] = useState(initialInvoiceCode);
  const [saleDetail, setSaleDetail] = useState<SaleDetailWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State Void
  const [voidReason, setVoidReason] = useState("");
  const [voidOwnerPin, setVoidOwnerPin] = useState("");

  // Form State Retur
  const [returnItemsState, setReturnItemsState] = useState<
    Record<
      string,
      {
        selected: boolean;
        qty: number;
        isRestockable: boolean;
        conditionNotes: string;
      }
    >
  >({});
  const [refundMethod, setRefundMethod] = useState<"Tunai" | "Kasbon_Dipotong" | "Kredit_Toko">("Tunai");
  const [returnReason, setReturnReason] = useState("");
  const [returnOwnerPin, setReturnOwnerPin] = useState("");

  useEffect(() => {
    if (initialInvoiceCode) {
      setSearchInvoice(initialInvoiceCode);
      handleSearch(initialInvoiceCode);
    }
  }, [initialInvoiceCode]);

  if (!isOpen) return null;

  const handleSearch = async (codeToSearch?: string) => {
    const code = (codeToSearch || searchInvoice).trim();
    if (!code) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/returns?invoiceCode=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setSaleDetail(data.sale);

      // Inisialisasi item retur
      const initialMap: typeof returnItemsState = {};
      data.sale.items.forEach((it: any) => {
        const available = it.quantity - it.returnedQuantity;
        initialMap[it.id] = {
          selected: false,
          qty: available > 0 ? 1 : 0,
          isRestockable: true,
          conditionNotes: "Kondisi Baik",
        };
      });
      setReturnItemsState(initialMap);
    } catch (err: any) {
      setErrorMsg(err.message || "Nota penjualan tidak ditemukan");
      setSaleDetail(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleDetail) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "void",
          saleId: saleDetail.id,
          reason: voidReason,
          ownerPin: voidOwnerPin,
          approvedBy: "Pemilik",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setSuccessMsg(`Nota ${data.invoiceCode} berhasil dibatalkan (VOID)! Stok barang telah dikembalikan.`);
      setSaleDetail((prev) => (prev ? { ...prev, isVoid: true, voidReason } : null));
      setVoidReason("");
      setVoidOwnerPin("");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membatalkan transaksi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleDetail) return;

    const itemsToSubmit = Object.entries(returnItemsState)
      .filter(([_, val]) => val.selected && val.qty > 0)
      .map(([saleItemId, val]) => {
        const originalItem = saleDetail.items.find((i) => i.id === saleItemId);
        return {
          saleItemId,
          productId: originalItem?.productId || "",
          quantity: val.qty,
          refundPrice: originalItem?.price || 0,
          isRestockable: val.isRestockable,
          conditionNotes: val.conditionNotes,
        };
      });

    if (itemsToSubmit.length === 0) {
      setErrorMsg("Pilih minimal 1 item barang yang akan diretur.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "return",
          saleId: saleDetail.id,
          items: itemsToSubmit,
          refundMethod,
          reason: returnReason,
          ownerPin: returnOwnerPin,
          approvedBy: "Pemilik",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setSuccessMsg(`Retur berhasil diproses (${data.returnCode})! Total pengembalian: Rp ${data.totalRefund.toLocaleString("id-ID")}`);
      setReturnReason("");
      setReturnOwnerPin("");
      handleSearch(); // Refresh data nota
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses retur");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 p-5 sm:p-6 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                <Shield className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold">
                  Retur Barang & Pembatalan (Void) Nota
                </h2>
                <p className="text-xs text-rose-200/80">
                  Memerlukan otorisasi PIN Pemilik Warung (PRD F6)
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

          {/* Search Nota */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Cari nomor nota (Contoh: WM01-0001)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/15 border border-white/20 text-white placeholder-rose-200/60 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
              <Search className="w-4 h-4 text-rose-300 absolute left-3 top-2.5" />
            </div>

            <button
              onClick={() => handleSearch()}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
            >
              {isLoading ? "Mencari..." : "Cari Nota"}
            </button>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("return")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                activeTab === "return"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retur Item Barang</span>
            </button>

            <button
              onClick={() => setActiveTab("void")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                activeTab === "void"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Void Nota Penuh</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {saleDetail ? (
            <div className="space-y-4">
              {/* Ringkasan Nota */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {saleDetail.invoiceCode}
                    </span>
                    {saleDetail.isVoid && (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                        SUDAH VOID
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    {saleDetail.createdAt} &bull; Kasir: {saleDetail.cashierName} &bull; Pelanggan: {saleDetail.customerName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">Total Transaksi:</p>
                  <p className="font-mono font-bold text-sm text-slate-900">
                    Rp {saleDetail.totalAmount.toLocaleString("id-ID")}
                  </p>
                </div>
              </div>

              {/* Form Tab 1: RETUR ITEM */}
              {activeTab === "return" && (
                <form onSubmit={handleReturnSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-2">
                      Pilih Item yang Dikembalikan:
                    </label>

                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {saleDetail.items.map((item) => {
                        const remaining = item.quantity - item.returnedQuantity;
                        const st = returnItemsState[item.id] || {
                          selected: false,
                          qty: 1,
                          isRestockable: true,
                          conditionNotes: "",
                        };

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border transition ${
                              st.selected
                                ? "bg-rose-50/50 border-rose-200"
                                : "bg-white border-slate-200/80"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={remaining <= 0 || saleDetail.isVoid}
                                  checked={st.selected}
                                  onChange={(e) =>
                                    setReturnItemsState((prev) => ({
                                      ...prev,
                                      [item.id]: { ...st, selected: e.target.checked },
                                    }))
                                  }
                                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                                />
                                <div>
                                  <p className="font-bold text-slate-900">{item.productName}</p>
                                  <p className="text-[10px] text-slate-500">
                                    Dibeli: {item.quantity} {item.unitName} &bull; Sisa retur:{" "}
                                    <span className="font-semibold text-slate-700">{remaining}</span> &bull; Rp {item.price.toLocaleString("id-ID")}
                                  </p>
                                </div>
                              </label>

                              {st.selected && (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500">Qty:</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={remaining}
                                      value={st.qty}
                                      onChange={(e) =>
                                        setReturnItemsState((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            ...st,
                                            qty: Math.min(
                                              remaining,
                                              Math.max(1, Number(e.target.value))
                                            ),
                                          },
                                        }))
                                      }
                                      className="w-14 px-2 py-1 rounded-lg border border-slate-300 font-mono text-center font-bold"
                                    />
                                  </div>

                                  <select
                                    value={st.isRestockable ? "restock" : "waste"}
                                    onChange={(e) =>
                                      setReturnItemsState((prev) => ({
                                        ...prev,
                                        [item.id]: {
                                          ...st,
                                          isRestockable: e.target.value === "restock",
                                        },
                                      }))
                                    }
                                    className="px-2 py-1 rounded-lg border border-slate-300 text-[10px] font-semibold"
                                  >
                                    <option value="restock">Layak Jual (+Stok)</option>
                                    <option value="waste">Rusak (Tidak Restock)</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Metode Pengembalian Uang:
                      </label>
                      <select
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                      >
                        <option value="Tunai">Kembalikan Tunai</option>
                        <option value="Kasbon_Dipotong">Potong Sisa Kasbon</option>
                        <option value="Kredit_Toko">Kredit Toko / Saldo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        PIN Pemilik atau Kode Reset:
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={20}
                        value={returnOwnerPin}
                        onChange={(e) => setReturnOwnerPin(e.target.value)}
                        placeholder="PIN atau REC-XXXX-XXXX..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Alasan Retur:
                    </label>
                    <input
                      type="text"
                      required
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Contoh: Barang salah beli, kemasan cacat pabrik..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || saleDetail.isVoid}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isLoading ? "Memproses..." : "Konfirmasi Retur Barang"}</span>
                  </button>
                </form>
              )}

              {/* Form Tab 2: VOID NOTA PENUH */}
              {activeTab === "void" && (
                <form onSubmit={handleVoidSubmit} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Ban className="w-4 h-4 text-rose-600" />
                      <span>Perhatian: Tindakan Tidak Dapat Dibatalkan</span>
                    </p>
                    <p className="text-[11px] leading-relaxed text-rose-700">
                      Void akan membatalkan seluruh transaksi nota, mengembalikan semua stok barang ke sistem,
                      dan menghapus tagihan kasbon jika transaksi menggunakan kasbon.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Alasan Pembatalan Transaksi:
                    </label>
                    <input
                      type="text"
                      required
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="Contoh: Kasir salah input item, pembeli batal bayar..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Otorisasi PIN Pemilik / Kode Reset:
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={20}
                      value={voidOwnerPin}
                      onChange={(e) => setVoidOwnerPin(e.target.value)}
                      placeholder="PIN Pemilik atau REC-XXXX-XXXX..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold text-center"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || saleDetail.isVoid}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{isLoading ? "Membatalkan..." : "Konfirmasi Void Transaksi"}</span>
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              Ketikkan nomor nota di atas lalu klik &ldquo;Cari Nota&rdquo; untuk memulai retur atau void.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
