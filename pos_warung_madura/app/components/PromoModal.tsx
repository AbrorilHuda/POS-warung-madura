import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Tag,
  Gift,
  Layers,
  Calendar,
  Percent,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Shield,
  ShoppingBag,
} from "lucide-react";
import type { Product, Promotion, PromoType } from "../types/pos";

interface PromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onPromoUpdated?: () => void;
}

export const PromoModal: React.FC<PromoModalProps> = ({
  isOpen,
  onClose,
  products,
  onPromoUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State Promo Baru
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [promoType, setPromoType] = useState<PromoType>("product_discount");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );

  // Type 1: product_discount
  const [selectedProductId, setSelectedProductId] = useState("");
  const [minQty, setMinQty] = useState(1);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [discountValue, setDiscountValue] = useState(10);

  // Type 2: buy_x_get_y
  const [buyProductId, setBuyProductId] = useState("");
  const [buyQty, setBuyQty] = useState(2);
  const [getProductId, setGetProductId] = useState("");
  const [getQty, setGetQty] = useState(1);

  // Type 3: bundle
  const [bundlePrice, setBundlePrice] = useState(10000);
  const [bundleItemsList, setBundleItemsList] = useState<
    Array<{ productId: string; qty: number }>
  >([
    { productId: "", qty: 1 },
    { productId: "", qty: 1 },
  ]);

  useEffect(() => {
    if (isOpen) {
      loadPromotions();
      if (products.length > 0 && !selectedProductId) {
        setSelectedProductId(products[0].id);
        setBuyProductId(products[0].id);
        setGetProductId(products[0].id);
      }
    }
  }, [isOpen, products]);

  if (!isOpen) return null;

  const loadPromotions = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/promotions");
      if (!res.ok) {
        throw new Error(`Server merespons kode status ${res.status}`);
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server tidak mengembalikan respons JSON. Pastikan rute API terdaftar.");
      }
      const json = await res.json();
      if (json.ok) {
        setPromotions(json.promotions || []);
      } else {
        setErrorMsg(json.error || "Gagal memuat daftar promosi");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghubungi server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePromo = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          id,
          isActive: !currentActive,
        }),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) {
        setPromotions((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: !currentActive } : p))
        );
        if (onPromoUpdated) onPromoUpdated();
      }
    } catch { }
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm("Hapus program promo ini?")) return;
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) {
        setPromotions((prev) => prev.filter((p) => p.id !== id));
        setSuccessMsg("Promosi berhasil dihapus");
        setTimeout(() => setSuccessMsg(null), 3000);
        if (onPromoUpdated) onPromoUpdated();
      }
    } catch { }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Nama promo wajib diisi");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const promoPayload: Partial<Promotion> = {
      name: name.trim(),
      description: description.trim() || undefined,
      promoType,
      startDate,
      endDate,
      isActive: true,
    };

    if (promoType === "product_discount") {
      if (!selectedProductId) {
        setErrorMsg("Pilih produk yang mendapatkan diskon");
        setIsLoading(false);
        return;
      }
      promoPayload.productId = selectedProductId;
      promoPayload.minQty = Number(minQty) || 1;
      promoPayload.discountType = discountType;
      promoPayload.discountValue = Number(discountValue) || 0;
    } else if (promoType === "buy_x_get_y") {
      if (!buyProductId) {
        setErrorMsg("Pilih produk utama yang dibeli");
        setIsLoading(false);
        return;
      }
      promoPayload.buyProductId = buyProductId;
      promoPayload.buyQty = Number(buyQty) || 1;
      promoPayload.getProductId = getProductId || buyProductId;
      promoPayload.getQty = Number(getQty) || 1;
      promoPayload.getDiscountPercent = 100; // Gratis 100%
    } else if (promoType === "bundle") {
      const validItems = bundleItemsList.filter((it) => it.productId);
      if (validItems.length < 2) {
        setErrorMsg("Paket bundling minimal terdiri dari 2 produk berbeda");
        setIsLoading(false);
        return;
      }
      promoPayload.bundlePrice = Number(bundlePrice) || 0;
      promoPayload.bundleItems = validItems;
    }

    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", data: promoPayload }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server tidak mengembalikan format JSON");
      }
      const json = await res.json();
      if (json.ok) {
        setSuccessMsg(`Promo "${name}" berhasil diaktifkan!`);
        setName("");
        setDescription("");
        setActiveTab("list");
        loadPromotions();
        if (onPromoUpdated) onPromoUpdated();
      } else {
        setErrorMsg(json.error || "Gagal membuat promosi");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengirim data promo");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 p-5 sm:p-6 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
                <Gift className="w-5 h-5 text-amber-200" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold">
                  Program Diskon & Promo Otomatis
                </h2>
                <p className="text-xs text-amber-100/80">
                  Otomatis terpotong di keranjang kasir
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

          {/* Tab Selector */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${activeTab === "list"
                ? "bg-white text-slate-900 shadow-xs"
                : "bg-white/15 text-white hover:bg-white/25"
                }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Daftar Promo ({promotions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("create")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${activeTab === "create"
                ? "bg-white text-slate-900 shadow-xs"
                : "bg-white/15 text-white hover:bg-white/25"
                }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Promo Baru</span>
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

          {/* TAB 1: DAFTAR PROMO */}
          {activeTab === "list" && (
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <Sparkles className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                  <span>Memuat promosi...</span>
                </div>
              ) : promotions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Gift className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                  <p className="font-semibold text-slate-600">Belum Ada Program Promo</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Buat promo diskon produk, promo beli X gratis Y, atau bundling harga hemat untuk meningkatkan omzet warung.
                  </p>
                  <button
                    onClick={() => setActiveTab("create")}
                    className="mt-3 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition cursor-pointer"
                  >
                    + Buat Promo Pertama
                  </button>
                </div>
              ) : (
                promotions.map((promo) => (
                  <div
                    key={promo.id}
                    className={`p-4 rounded-2xl border transition flex items-start justify-between gap-3 ${promo.isActive
                      ? "bg-white border-amber-200 shadow-2xs hover:border-amber-300"
                      : "bg-slate-50 border-slate-200 opacity-70"
                      }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{promo.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${promo.promoType === "product_discount"
                            ? "bg-rose-100 text-rose-800"
                            : promo.promoType === "buy_x_get_y"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-purple-100 text-purple-800"
                            }`}
                        >
                          {promo.promoType === "product_discount"
                            ? "Diskon Produk"
                            : promo.promoType === "buy_x_get_y"
                              ? "Beli X Gratis Y"
                              : "Paket Bundling"}
                        </span>
                        {promo.isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                            ● Aktif
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px]">
                            Non-Aktif
                          </span>
                        )}
                      </div>

                      <p className="text-slate-600 text-xs">
                        {promo.promoType === "product_discount" && (
                          <span>
                            Produk: <strong>{promo.productName || "Produk"}</strong> &bull; Min:{" "}
                            {promo.minQty} unit &bull; Potongan:{" "}
                            {promo.discountType === "percentage"
                              ? `${promo.discountValue}%`
                              : `Rp ${Number(promo.discountValue).toLocaleString("id-ID")}`}
                          </span>
                        )}
                        {promo.promoType === "buy_x_get_y" && (
                          <span>
                            Beli <strong>{promo.buyQty}x {promo.buyProductName || "Produk"}</strong> &rarr; Gratis{" "}
                            <strong>{promo.getQty}x {promo.getProductName || promo.buyProductName || "Bonus"}</strong>
                          </span>
                        )}
                        {promo.promoType === "bundle" && (
                          <span>
                            Paket Hemat:{" "}
                            <strong>Rp {Number(promo.bundlePrice).toLocaleString("id-ID")}</strong>{" "}
                            ({promo.bundleItems?.length || 0} macam item)
                          </span>
                        )}
                      </p>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>
                          Periode: {promo.startDate} s/d {promo.endDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleTogglePromo(promo.id, promo.isActive)}
                        title={promo.isActive ? "Nonaktifkan Promo" : "Aktifkan Promo"}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                      >
                        {promo.isActive ? (
                          <ToggleRight className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-400" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDeletePromo(promo.id)}
                        title="Hapus Promo"
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: BUAT PROMO BARU */}
          {activeTab === "create" && (
            <form onSubmit={handleCreatePromo} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Nama Program Promosi:
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Diskon Merdeka Kopi Kapal Api / Beli 2 Susu Gratis 1"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Pilihan Jenis Promo */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  Jenis Promosi:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPromoType("product_discount")}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${promoType === "product_discount"
                      ? "border-amber-500 bg-amber-50/70 text-amber-950 font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                  >
                    <Percent className="w-4 h-4 mb-1 text-amber-600" />
                    <div className="text-xs">Diskon Produk</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Potongan % / nominal
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPromoType("buy_x_get_y")}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${promoType === "buy_x_get_y"
                      ? "border-amber-500 bg-amber-50/70 text-amber-950 font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                  >
                    <Gift className="w-4 h-4 mb-1 text-emerald-600" />
                    <div className="text-xs">Beli X Gratis Y</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Bonus barang gratis
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPromoType("bundle")}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${promoType === "bundle"
                      ? "border-amber-500 bg-amber-50/70 text-amber-950 font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                  >
                    <Layers className="w-4 h-4 mb-1 text-purple-600" />
                    <div className="text-xs">Paket Bundling</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Harga paket hemat
                    </div>
                  </button>
                </div>
              </div>

              {/* Form Input Sesuai Jenis Promo */}
              {promoType === "product_discount" && (
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">Pilih Produk:</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Min. Kuantiti:</label>
                      <input
                        type="number"
                        min={1}
                        value={minQty}
                        onChange={(e) => setMinQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Tipe Diskon:</label>
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                      >
                        <option value="percentage">Persentase (%)</option>
                        <option value="fixed_amount">Nominal (Rp)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        {discountType === "percentage" ? "Besar Diskon (%):" : "Potongan (Rp):"}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-mono font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {promoType === "buy_x_get_y" && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Produk yang Dibeli:
                      </label>
                      <select
                        value={buyProductId}
                        onChange={(e) => setBuyProductId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Jumlah Beli (X):
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={buyQty}
                        onChange={(e) => setBuyQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-mono font-bold focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Produk Hadiah / Gratis (Y):
                      </label>
                      <select
                        value={getProductId}
                        onChange={(e) => setGetProductId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                      >
                        <option value="">(Sama dengan produk dibeli)</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Jumlah Gratis (Y):
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={getQty}
                        onChange={(e) => setGetQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-mono font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {promoType === "bundle" && (
                <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700">
                      Item dalam Paket Bundling:
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setBundleItemsList((prev) => [
                          ...prev,
                          { productId: products[0]?.id || "", qty: 1 },
                        ])
                      }
                      className="text-[10px] font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
                    >
                      + Tambah Produk
                    </button>
                  </div>

                  {bundleItemsList.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBundleItemsList((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, productId: val } : it))
                          );
                        }}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                      >
                        <option value="">Pilih Produk...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => {
                          const q = parseInt(e.target.value) || 1;
                          setBundleItemsList((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, qty: q } : it))
                          );
                        }}
                        className="w-16 px-2 py-2 rounded-xl border border-slate-300 text-xs text-center font-bold bg-white focus:outline-none"
                      />

                      {bundleItemsList.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setBundleItemsList((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="space-y-1 pt-2 border-t border-purple-200">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Harga Spesial Paket Bundling (Rp):
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={bundlePrice}
                      onChange={(e) => setBundlePrice(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-mono font-bold focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Tanggal Periode Promo */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Tanggal Mulai:
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Tanggal Berakhir:
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Tombol Simpan */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("list")}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition cursor-pointer shadow-md"
                >
                  {isLoading ? "Menyimpan..." : "Aktifkan Promo"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
