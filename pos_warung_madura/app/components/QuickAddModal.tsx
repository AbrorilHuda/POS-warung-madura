import React, { useState, useEffect } from "react";
import {
  X,
  PackageCheck,
  Sparkles,
  Truck,
  Plus,
  Layers,
  Link2,
} from "lucide-react";
import type { Product, ProductUnit } from "../types/pos";

interface QuickAddModalProps {
  scannedBarcode: string;
  isOpen: boolean;
  onClose: () => void;
  onSaveAndAddToCart: (newProduct: Product, selectedUnit: ProductUnit) => void;
  onAddUnitToExistingProduct?: (productId: string, newUnit: ProductUnit) => void;
  products?: Product[];
  mode?: "kasir" | "kulakan";
}

const QUICK_UNITS = [
  "Pcs",
  "Bungkus",
  "Sachet",
  "Botol",
  "Kaleng",
  "Renteng",
  "Slop",
  "Dus",
  "Kg",
];

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  scannedBarcode,
  isOpen,
  onClose,
  onSaveAndAddToCart,
  onAddUnitToExistingProduct,
  products = [],
  mode = "kasir",
}) => {
  // Tab: "new_product" or "existing_product_unit"
  const [activeTab, setActiveTab] = useState<"new" | "existing">("new");

  // State untuk Produk Baru
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Product["category"]>("Jajanan & Kopi");
  const [unitName, setUnitName] = useState(mode === "kulakan" ? "Dus" : "Pcs");
  const [conversionRatio, setConversionRatio] = useState<number>(mode === "kulakan" ? 40 : 1);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [initialStock, setInitialStock] = useState<number>(0);

  // State untuk Kemasan Baru dari Produk yang Sudah Ada
  const [selectedExistingProductId, setSelectedExistingProductId] = useState<string>(
    products[0]?.id || ""
  );
  const [existingUnitName, setExistingUnitName] = useState("Dus");
  const [existingConversion, setExistingConversion] = useState<number>(40);
  const [existingCostPrice, setExistingCostPrice] = useState<number>(0);
  const [existingSellPrice, setExistingSellPrice] = useState<number>(0);

  // Reset / sesuaikan default setiap kali modal terbuka
  useEffect(() => {
    if (isOpen) {
      if (mode === "kulakan") {
        setUnitName("Dus");
        setConversionRatio(40);
      } else {
        setUnitName("Pcs");
        setConversionRatio(1);
      }
      setName("");
      setSellPrice(0);
      setCostPrice(0);
      if (products.length > 0 && !selectedExistingProductId) {
        setSelectedExistingProductId(products[0].id);
      }
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const isKulakanMode = mode === "kulakan";

  const handleCategoryChange = (newCat: Product["category"]) => {
    setCategory(newCat);
    if (!isKulakanMode) {
      if (newCat === "Rokok") setUnitName("Bungkus");
      else if (newCat === "Mie & Sembako") setUnitName("Pcs");
      else if (newCat === "Minuman Dingin") setUnitName("Botol");
      else if (newCat === "Jajanan & Kopi") setUnitName("Sachet");
      else if (newCat === "Gas & Galon") setUnitName("Tabung");
      else setUnitName("Pcs");
    }
  };

  // Submit Pendaftaran Produk Baru
  const handleSubmitNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const productId = `prod-${Date.now()}`;
    const mainUnitId = `unit-${Date.now()}`;

    let createdUnits: ProductUnit[] = [];
    let selectedUnit: ProductUnit;

    if (isKulakanMode && conversionRatio > 1) {
      // Otomatis buat 2 level unit: Satuan Dasar (Eceran) & Satuan Dus/Grosir
      const baseUnitId = `unit-base-${Date.now()}`;
      const baseUnitName = category === "Rokok" ? "Bungkus" : "Pcs";
      const baseSellPrice =
        sellPrice > 0
          ? Math.round(sellPrice / conversionRatio)
          : costPrice > 0
            ? Math.round((costPrice * 1.15) / conversionRatio)
            : 0;

      const baseUnit: ProductUnit = {
        id: baseUnitId,
        productId: productId,
        unitName: baseUnitName,
        conversionRatio: 1,
        price: baseSellPrice,
        costPrice: costPrice > 0 ? Math.round(costPrice / conversionRatio) : undefined,
        barcode: `ECER-${Date.now().toString().slice(-6)}`,
        isBaseUnit: true,
      };

      const cartonUnit: ProductUnit = {
        id: mainUnitId,
        productId: productId,
        unitName: unitName.trim(),
        conversionRatio: conversionRatio,
        price: sellPrice > 0 ? sellPrice : costPrice > 0 ? Math.round(costPrice * 1.1) : 0,
        costPrice: costPrice > 0 ? costPrice : undefined,
        barcode: scannedBarcode,
        isBaseUnit: false,
      };

      createdUnits = [baseUnit, cartonUnit];
      selectedUnit = cartonUnit; // Satuan dus yang di-scan langsung dipilih di form kulakan
    } else {
      // Satuan tunggal
      const singleUnit: ProductUnit = {
        id: mainUnitId,
        productId: productId,
        unitName: unitName.trim(),
        conversionRatio: 1,
        price: sellPrice > 0 ? sellPrice : Math.round(costPrice * 1.15),
        costPrice: costPrice > 0 ? costPrice : undefined,
        barcode: scannedBarcode,
        isBaseUnit: true,
      };
      createdUnits = [singleUnit];
      selectedUnit = singleUnit;
    }

    const newProduct: Product = {
      id: productId,
      name: name.trim(),
      category: category,
      baseUnit: createdUnits[0].unitName.toLowerCase(),
      stockInBaseUnit: initialStock,
      units: createdUnits,
    };

    onSaveAndAddToCart(newProduct, selectedUnit);
    setName("");
    setSellPrice(0);
    setCostPrice(0);
    onClose();
  };

  // Submit Penambahan Kemasan Baru ke Produk yang Sudah Ada
  const handleSubmitExistingUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExistingProductId || !onAddUnitToExistingProduct) return;

    const newUnitId = `unit-${Date.now()}`;
    const newUnit: ProductUnit = {
      id: newUnitId,
      productId: selectedExistingProductId,
      unitName: existingUnitName.trim(),
      conversionRatio: Math.max(1, existingConversion),
      price: existingSellPrice > 0 ? existingSellPrice : Math.round(existingCostPrice * 1.1),
      costPrice: existingCostPrice > 0 ? existingCostPrice : undefined,
      barcode: scannedBarcode,
      isBaseUnit: false,
    };

    onAddUnitToExistingProduct(selectedExistingProductId, newUnit);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${isKulakanMode
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-900 text-white"
                }`}
            >
              {isKulakanMode ? (
                <Truck className="w-5 h-5 text-emerald-100" />
              ) : (
                <PackageCheck className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isKulakanMode
                  ? "Daftarkan Barang Baru untuk Kulakan"
                  : "Barang Belum Terdaftar di Kasir"}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Barcode: <span className="font-bold text-slate-900">{scannedBarcode}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher jika ada produk terdaftar & mode Kulakan */}
        {isKulakanMode && products.length > 0 && (
          <div className="grid grid-cols-2 p-1.5 bg-slate-100/80 mx-6 mt-4 rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${activeTab === "new"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Daftar Produk Baru</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("existing")}
              className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${activeTab === "existing"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Kemasan dari Barang Ada</span>
            </button>
          </div>
        )}

        {/* Info Banner Mode Kulakan */}
        {isKulakanMode && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Setelah disimpan, produk ini akan <strong>tetap di halaman Kulakan</strong> dan otomatis terpilih di form untuk langsung Anda catat ke ledger stok.
            </p>
          </div>
        )}

        {/* FORM 1: DAFTAR PRODUK BARU */}
        {activeTab === "new" && (
          <form onSubmit={handleSubmitNewProduct} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Produk <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Indomie Goreng Spesial, Susu Ultra Coklat 250ml..."
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as Product["category"])}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none"
                >
                  <option value="Jajanan & Kopi">Jajanan & Kopi</option>
                  <option value="Minuman Dingin">Minuman Dingin</option>
                  <option value="Mie & Sembako">Mie & Sembako</option>
                  <option value="Rokok">Rokok</option>
                  <option value="Gas & Galon">Gas & Galon</option>
                  <option value="Kebutuhan Harian">Kebutuhan Harian</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isKulakanMode ? "Kemasan Barcode Ini" : "Satuan Produk"}
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    required
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    placeholder="Dus / Pcs..."
                    className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Quick Unit Presets */}
            <div className="flex flex-wrap gap-1">
              {QUICK_UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    setUnitName(u);
                    if (u === "Dus") setConversionRatio(40);
                    else if (u === "Slop") setConversionRatio(10);
                    else if (u === "Renteng") setConversionRatio(10);
                    else if (u === "Pcs" || u === "Bungkus") setConversionRatio(1);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${unitName.toLowerCase() === u.toLowerCase()
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                >
                  {u}
                </button>
              ))}
            </div>

            {/* Konversi Satuan untuk Mode Kulakan (Grosir / Dus) */}
            {isKulakanMode && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>Isi Kemasan (Konversi Satuan Dasar):</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    1 {unitName || "Dus"} = {conversionRatio} Satuan Dasar
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={conversionRatio}
                    onChange={(e) => setConversionRatio(Math.max(1, Number(e.target.value)))}
                    className="w-24 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 text-center"
                  />
                  <span className="text-xs text-slate-500">
                    {category === "Rokok" ? "Bungkus" : "Pcs / Bungkus Eceran"}
                  </span>
                </div>
              </div>
            )}

            {/* Harga Modal & Harga Jual */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Harga Modal ({unitName || "Unit"}){" "}
                  {isKulakanMode && <span className="text-emerald-600 font-bold">*</span>}
                </label>
                <div className="relative">
                  <span className="text-xs text-slate-400 font-semibold absolute left-3 top-2">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={costPrice || ""}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    placeholder="120000"
                    className="w-full pl-9 pr-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Harga Jual ({unitName || "Unit"}){" "}
                  {!isKulakanMode && <span className="text-rose-500">*</span>}
                </label>
                <div className="relative">
                  <span className="text-xs text-slate-400 font-semibold absolute left-3 top-2">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={sellPrice || ""}
                    onChange={(e) => setSellPrice(Number(e.target.value))}
                    placeholder={costPrice > 0 ? String(Math.round(costPrice * 1.15)) : "3000"}
                    className="w-full pl-9 pr-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-2xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className={`px-5 py-2.5 rounded-2xl text-white font-bold text-xs flex items-center gap-2 transition shadow-md active:scale-95 cursor-pointer ${isKulakanMode
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-slate-900 hover:bg-slate-800"
                  }`}
              >
                {isKulakanMode ? (
                  <>
                    <Truck className="w-4 h-4 text-emerald-200" />
                    <span>Simpan & Masuk ke Form Kulakan</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-4 h-4 text-amber-300" />
                    <span>Simpan & Masuk Kasir</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* FORM 2: TAMBAH KEMASAN BARU KE PRODUK YANG SUDAH ADA */}
        {activeTab === "existing" && (
          <form onSubmit={handleSubmitExistingUnit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pilih Produk yang Sudah Ada <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedExistingProductId}
                onChange={(e) => setSelectedExistingProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:bg-white focus:outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.units.map((u) => u.unitName).join(", ")})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Kemasan Baru
                </label>
                <input
                  type="text"
                  required
                  value={existingUnitName}
                  onChange={(e) => setExistingUnitName(e.target.value)}
                  placeholder="Dus / Slop / Pack..."
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Isi (Konversi Satuan Dasar)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={existingConversion}
                  onChange={(e) => setExistingConversion(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono font-bold text-center"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Harga Modal ({existingUnitName})
                </label>
                <input
                  type="number"
                  min={0}
                  value={existingCostPrice || ""}
                  onChange={(e) => setExistingCostPrice(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Harga Jual ({existingUnitName})
                </label>
                <input
                  type="number"
                  min={0}
                  value={existingSellPrice || ""}
                  onChange={(e) => setExistingSellPrice(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-2xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition shadow-md active:scale-95 cursor-pointer"
              >
                <Truck className="w-4 h-4 text-emerald-200" />
                <span>Simpan Kemasan & Pilih di Kulakan</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
