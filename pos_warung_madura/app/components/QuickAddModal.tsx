import React, { useState } from "react";
import { X, PackageCheck, Sparkles } from "lucide-react";
import type { Product, ProductUnit } from "../types/pos";

interface QuickAddModalProps {
  scannedBarcode: string;
  isOpen: boolean;
  onClose: () => void;
  onSaveAndAddToCart: (newProduct: Product, selectedUnit: ProductUnit) => void;
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
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Product["category"]>("Jajanan & Kopi");
  const [unitName, setUnitName] = useState("Pcs");
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [initialStock, setInitialStock] = useState<number>(20);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: Product["category"]) => {
    setCategory(newCat);
    // Auto-suggest unit based on category
    if (newCat === "Rokok") setUnitName("Bungkus");
    else if (newCat === "Mie & Sembako") setUnitName("Pcs");
    else if (newCat === "Minuman Dingin") setUnitName("Botol");
    else if (newCat === "Jajanan & Kopi") setUnitName("Sachet");
    else if (newCat === "Gas & Galon") setUnitName("Tabung");
    else setUnitName("Pcs");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || sellPrice <= 0) return;

    const productId = `prod-${Date.now()}`;
    const unitId = `unit-${Date.now()}`;

    const newUnit: ProductUnit = {
      id: unitId,
      productId: productId,
      unitName: unitName.trim(),
      conversionRatio: 1,
      price: sellPrice,
      costPrice: costPrice > 0 ? costPrice : undefined,
      barcode: scannedBarcode,
      isBaseUnit: true,
    };

    const newProduct: Product = {
      id: productId,
      name: name.trim(),
      category: category,
      baseUnit: unitName.toLowerCase().trim(),
      stockInBaseUnit: initialStock,
      units: [newUnit],
    };

    onSaveAndAddToCart(newProduct, newUnit);
    setName("");
    setSellPrice(0);
    setCostPrice(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Barang Belum Terdaftar</h3>
            <p className="text-[11px] text-slate-500 font-mono">
              Barcode: <span className="font-semibold text-slate-900">{scannedBarcode}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Isi nama dan harga. Klik pilihan satuan cepat di bawah tanpa perlu mengetik manual.
            </p>
          </div>

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
              placeholder="Contoh: Roti Aoka Coklat, Kopi ABC Moka..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as Product["category"])}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stok Awal</label>
              <input
                type="number"
                min={0}
                value={initialStock}
                onChange={(e) => setInitialStock(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono font-bold"
              />
            </div>
          </div>

          {/* Quick Unit Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Satuan Jual</label>
              <span className="text-[10px] text-slate-400">Klik pilihan cepat:</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {QUICK_UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnitName(u)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${unitName.toLowerCase() === u.toLowerCase()
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                >
                  {u}
                </button>
              ))}
            </div>
            <input
              type="text"
              required
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="Atau ketik satuan lain..."
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Harga Jual (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={100}
                value={sellPrice || ""}
                onChange={(e) => setSellPrice(Number(e.target.value))}
                placeholder="3000"
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Harga Modal (Opsional)
              </label>
              <input
                type="number"
                min={0}
                value={costPrice || ""}
                onChange={(e) => setCostPrice(Number(e.target.value))}
                placeholder="2200"
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Simpan & Masuk Kasir</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
