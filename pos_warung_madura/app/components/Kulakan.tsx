import React, { useState } from "react";
import {
  Truck,
  PackagePlus,
  Barcode,
  CheckCircle2,
  ArrowDownRight,
  Check,
} from "lucide-react";
import type { Product, ProductUnit, StockMovement } from "../types/pos";

interface KulakanProps {
  products: Product[];
  stockMovements: StockMovement[];
  onAddStockMovement: (
    productId: string,
    unit: ProductUnit,
    unitQty: number,
    costPrice: number,
    supplier: string
  ) => void;
}

export const Kulakan: React.FC<KulakanProps> = ({
  products,
  stockMovements,
  onAddStockMovement,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || "");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [unitQty, setUnitQty] = useState<number>(1);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [supplier, setSupplier] = useState<string>("Agen Grosir Sembako");
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [notification, setNotification] = useState<string>("");

  const currentProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const activeUnit =
    currentProduct?.units.find((u) => u.id === selectedUnitId) ||
    currentProduct?.units[currentProduct.units.length - 1] ||
    currentProduct?.units[0];

  React.useEffect(() => {
    if (activeUnit) {
      setCostPrice(activeUnit.costPrice || 0);
    }
  }, [activeUnit?.id]);

  const handleBarcodeLookup = (barcode: string) => {
    const clean = barcode.trim();
    if (!clean) return;

    for (const p of products) {
      const u = p.units.find((unit) => unit.barcode.toLowerCase() === clean.toLowerCase());
      if (u) {
        setSelectedProductId(p.id);
        setSelectedUnitId(u.id);
        setCostPrice(u.costPrice || 0);
        setBarcodeInput("");
        return;
      }
    }
    alert("Barcode tidak ditemukan di master data!");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct || !activeUnit || unitQty <= 0) return;

    onAddStockMovement(currentProduct.id, activeUnit, unitQty, costPrice, supplier);

    const totalAdded = unitQty * activeUnit.conversionRatio;
    setNotification(
      `Sukses mencatat ${unitQty} ${activeUnit.unitName} (+${totalAdded} ${currentProduct.baseUnit}) ke ledger stok!`
    );
    setTimeout(() => setNotification(""), 4000);
    setUnitQty(1);
  };

  const totalCost = unitQty * costPrice;
  const convertedBaseUnitCount = unitQty * (activeUnit ? activeUnit.conversionRatio : 1);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Pencatatan Kulakan (Stok Masuk)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Catat pembelian stok dari grosir. Otomatis dikonversi ke satuan dasar di ledger stok.
        </p>
      </div>

      {notification && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notification}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Form: 5 Cols */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2 mb-3.5 pb-2.5 border-b border-slate-100">
            <PackagePlus className="w-4 h-4 text-slate-700" />
            <span>Form Input Kulakan</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Scan Barcode
              </label>
              <div className="relative">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && (e.preventDefault(), handleBarcodeLookup(barcodeInput))
                  }
                  placeholder="Scan barcode dus/pack..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Produk</label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setSelectedUnitId("");
                }}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stok: {p.stockInBaseUnit} {p.baseUnit})
                  </option>
                ))}
              </select>
            </div>

            {currentProduct && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kemasan Kulakan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {currentProduct.units.map((u) => {
                    const isSelected = activeUnit?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUnitId(u.id)}
                        className={`p-2 rounded-xl border text-left transition ${
                          isSelected
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="font-bold text-xs block">{u.unitName}</span>
                        <span
                          className={`text-[10px] font-mono ${
                            isSelected ? "text-slate-300" : "text-slate-400"
                          }`}
                        >
                          = {u.conversionRatio} {currentProduct.baseUnit}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jumlah Masuk
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={unitQty}
                  onChange={(e) => setUnitQty(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Harga Modal (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={costPrice || ""}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier / Toko
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Impact */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Konversi Stok:</span>
                <span className="font-mono font-bold text-slate-900">
                  +{convertedBaseUnitCount} {currentProduct?.baseUnit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Modal:</span>
                <span className="font-mono font-bold text-slate-900">
                  Rp {totalCost.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Simpan ke Ledger Stok</span>
            </button>
          </form>
        </div>

        {/* Right Ledger Table: 7 Cols */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-600" />
              <span>Riwayat Mutasi Masuk (Stock Movements)</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {stockMovements.length} Mutasi
            </span>
          </div>

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {stockMovements.map((mov) => (
              <div
                key={mov.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
              >
                <div>
                  <h5 className="font-bold text-slate-900">{mov.productName}</h5>
                  <p className="text-[11px] text-slate-500">
                    {mov.unitQtyUsed} x {mov.unitNameUsed} &bull; {mov.notes}
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">{mov.timestamp}</span>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-slate-900 block">
                    +{mov.quantityInBaseUnit} Base Unit
                  </span>
                  {mov.costPerUnit && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      @ Rp {mov.costPerUnit.toLocaleString("id-ID")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
