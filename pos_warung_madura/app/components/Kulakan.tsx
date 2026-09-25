import React, { useState, useEffect, useRef } from "react";
import {
  Truck,
  PackagePlus,
  Barcode,
  CheckCircle2,
  Check,
  Smartphone,
  Search,
  Layers,
  Building2,
  Info,
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
  quickScanTriggerBarcode?: string | null;
  onClearQuickScanTrigger?: () => void;
  onRequestUnknownBarcode?: (barcode: string) => void;
  onOpenPhoneModal?: () => void;
  isPhoneConnected?: boolean;
}

const COMMON_SUPPLIERS = [
  "Agen Grosir Sembako",
  "Grosir Sinar Terang",
  "Distributor Rokok",
  "Sales Minuman / Wings",
  "Pasar Induk",
];

const QUICK_QTY_BUTTONS = [1, 5, 10, 20, 24, 40];

export const Kulakan: React.FC<KulakanProps> = ({
  products,
  stockMovements,
  onAddStockMovement,
  quickScanTriggerBarcode,
  onClearQuickScanTrigger,
  onRequestUnknownBarcode,
  onOpenPhoneModal,
  isPhoneConnected = false,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || "");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [unitQty, setUnitQty] = useState<number>(1);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [supplier, setSupplier] = useState<string>("Agen Grosir Sembako");
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [notification, setNotification] = useState<string>("");
  const [scanFeedback, setScanFeedback] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");

  const selectedProductIdRef = useRef(selectedProductId);
  const selectedUnitIdRef = useRef(selectedUnitId);
  const unitQtyRef = useRef(unitQty);

  useEffect(() => {
    selectedProductIdRef.current = selectedProductId;
  }, [selectedProductId]);

  useEffect(() => {
    selectedUnitIdRef.current = selectedUnitId;
  }, [selectedUnitId]);

  useEffect(() => {
    unitQtyRef.current = unitQty;
  }, [unitQty]);

  const currentProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const activeUnit =
    currentProduct?.units.find((u) => u.id === selectedUnitId) ||
    currentProduct?.units[currentProduct.units.length - 1] ||
    currentProduct?.units[0];

  useEffect(() => {
    if (activeUnit) {
      setCostPrice(activeUnit.costPrice || 0);
    }
  }, [activeUnit?.id]);

  const handleBarcodeLookup = (barcode: string, isFromScanner = false) => {
    const clean = barcode.trim();
    if (!clean) return;

    for (const p of products) {
      const u = p.units.find((unit) => unit.barcode.toLowerCase() === clean.toLowerCase());
      if (u) {
        if (
          isFromScanner &&
          selectedProductIdRef.current === p.id &&
          selectedUnitIdRef.current === u.id
        ) {
          // Scan kardus/produk yang sama berturut-turut: auto-increment +1
          const nextQty = unitQtyRef.current + 1;
          setUnitQty(nextQty);
          setScanFeedback(
            `📱 HP Scan (+1): ${p.name} [${u.unitName}] &bull; Total Masuk: ${nextQty} ${u.unitName}`
          );
        } else {
          setSelectedProductId(p.id);
          setSelectedUnitId(u.id);
          setCostPrice(u.costPrice || 0);
          setUnitQty(1);
          setScanFeedback(`📱 HP Scan: Terpilih ${p.name} kemasan ${u.unitName}`);
        }
        setBarcodeInput("");
        setTimeout(() => setScanFeedback(""), 4000);
        return;
      }
    }

    if (onRequestUnknownBarcode) {
      onRequestUnknownBarcode(clean);
    } else {
      alert(`Barcode "${clean}" belum terdaftar di sistem! Silakan daftarkan di menu Master Barang.`);
    }
  };

  const handleBarcodeLookupRef = useRef(handleBarcodeLookup);
  handleBarcodeLookupRef.current = handleBarcodeLookup;

  // Reaktif terhadap trigger scan dari HP via WebSocket (F12)
  useEffect(() => {
    if (!quickScanTriggerBarcode) return;
    handleBarcodeLookupRef.current(quickScanTriggerBarcode, true);
    onClearQuickScanTrigger?.();
  }, [quickScanTriggerBarcode]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentProduct || !activeUnit || unitQty <= 0) return;

    onAddStockMovement(currentProduct.id, activeUnit, unitQty, costPrice, supplier);

    const totalAdded = unitQty * activeUnit.conversionRatio;
    setNotification(
      `Sukses mencatat ${unitQty} ${activeUnit.unitName} (+${totalAdded} ${currentProduct.baseUnit}) ke ledger stok!`
    );
    setTimeout(() => setNotification(""), 4500);
    setUnitQty(1);
  };

  // Shortcut keyboard Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentProduct, activeUnit, unitQty, costPrice, supplier]);

  const totalCost = unitQty * costPrice;
  const convertedBaseUnitCount = unitQty * (activeUnit ? activeUnit.conversionRatio : 1);

  // Filter riwayat ledger stok
  const filteredMovements = stockMovements.filter((mov) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      mov.productName.toLowerCase().includes(q) ||
      mov.notes?.toLowerCase().includes(q) ||
      mov.unitNameUsed?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Pencatatan Kulakan (Stok Masuk)</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Multi-Unit Konversi
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Bisa scan barcode kardus/dus langsung pakai <strong>Kamera HP</strong> atau scanner USB. Otomatis terkonversi ke stok satuan dasar.
          </p>
        </div>

        {/* Status Scanner HP */}
        <div className="flex items-center gap-2">
          {isPhoneConnected ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>HP Terhubung (Siap Scan Dus)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenPhoneModal}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold transition cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-amber-600" />
              <span>Hubungkan HP Scanner (F12)</span>
            </button>
          )}
        </div>
      </div>

      {/* Realtime Toast / Notifikasi Feedback */}
      {scanFeedback && (
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-between shadow-lg border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span dangerouslySetInnerHTML={{ __html: scanFeedback }} />
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
            Realtime WebSocket
          </span>
        </div>
      )}

      {notification && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Form: 5 Cols */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-slate-700" />
              <span>Form Input Stok Grosir</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Shortcut: Ctrl+Enter</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Barcode Scanner */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                <label>Scan Barcode Dus / Produk</label>
                <span className="text-[10px] text-slate-400">Scanner HP & USB</span>
              </div>
              <div className="relative">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBarcodeLookup(barcodeInput);
                    }
                  }}
                  placeholder="Scan barcode dus/pack dari HP atau ketik..."
                  className="w-full pl-9 pr-20 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleBarcodeLookup(barcodeInput)}
                  className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                >
                  Cari
                </button>
              </div>
            </div>

            {/* Pilih Produk */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Produk</label>
              {products.length === 0 ? (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Belum ada produk di database. Scan barcode dus kulakan pakai Kamera HP atau buat produk baru di menu Master Barang.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedUnitId("");
                  }}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stok Saat Ini: {p.stockInBaseUnit} {p.baseUnit})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Pilihan Kemasan Kulakan (Multi-Unit) */}
            {currentProduct && (
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>Kemasan yang Dibeli (Unit):</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Otomatis cocok via barcode dus
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {currentProduct.units.map((u) => {
                    const isSelected = activeUnit?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUnitId(u.id)}
                        className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${isSelected
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs block">{u.unitName}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <span
                          className={`text-[10px] font-mono mt-0.5 block ${isSelected ? "text-slate-300" : "text-slate-500"
                            }`}
                        >
                          = {u.conversionRatio} {currentProduct.baseUnit}
                        </span>
                        <span
                          className={`text-[10px] font-mono block ${isSelected ? "text-amber-300" : "text-slate-400"
                            }`}
                        >
                          Barcode: {u.barcode}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Input Jumlah Masuk (Unit Qty) & Quick Buttons */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                <label>
                  Jumlah Masuk ({activeUnit?.unitName || "Kemasan"})
                </label>
                <span className="text-[10px] text-slate-400">Scan ulang barcode = +1</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  required
                  value={unitQty}
                  onChange={(e) => setUnitQty(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-center"
                />
              </div>

              {/* Quick Qty Presets (1, 5, 10, 20, 24, 40) */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-slate-400 font-semibold mr-1">Preset:</span>
                {QUICK_QTY_BUTTONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setUnitQty(q)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-semibold transition cursor-pointer ${unitQty === q
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                  >
                    {q}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setUnitQty((prev) => prev + 1)}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition cursor-pointer"
                >
                  +1
                </button>
              </div>
            </div>

            {/* Harga Modal Per Unit */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                <label>Harga Modal per {activeUnit?.unitName || "Unit"} (Rp)</label>
                <span className="text-[10px] text-slate-400">HPP Pembelian</span>
              </div>
              <div className="relative">
                <span className="text-xs font-semibold text-slate-400 absolute left-3 top-2.5">
                  Rp
                </span>
                <input
                  type="number"
                  min={0}
                  required
                  value={costPrice || ""}
                  onChange={(e) => setCostPrice(Math.max(0, Number(e.target.value)))}
                  className="w-full pl-9 pr-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Supplier / Toko */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                <label className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Supplier / Toko Grosir</span>
                </label>
              </div>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Nama agen / supplier..."
              />
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {COMMON_SUPPLIERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSupplier(s)}
                    className={`text-[10px] px-2 py-0.5 rounded-md transition cursor-pointer ${supplier === s
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Ringkasan Konversi & Total Modal */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Konversi Stok Masuk:</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                  +{convertedBaseUnitCount} {currentProduct?.baseUnit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total Modal Keluar:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  Rp {totalCost.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Tombol Simpan */}
            <button
              type="submit"
              disabled={products.length === 0 || !currentProduct}
              className={`w-full py-3 rounded-2xl text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md ${
                products.length === 0 || !currentProduct
                  ? "bg-slate-300 cursor-not-allowed opacity-60"
                  : "bg-slate-900 hover:bg-slate-800 cursor-pointer hover:shadow-lg active:scale-[0.99]"
              }`}
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Simpan ke Ledger Stok (Ctrl+Enter)</span>
            </button>
          </form>
        </div>

        {/* Right Ledger Table: 7 Cols */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-100 mb-3.5 gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-700" />
                <span>Riwayat Mutasi Masuk (Ledger Stok)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Histori barang masuk dan modal pembelian
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari riwayat..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none w-44"
              />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[68vh] overflow-y-auto pr-1 flex-1">
            {filteredMovements.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Belum ada data mutasi kulakan tercatat.
              </div>
            ) : (
              filteredMovements.map((mov) => (
                <div
                  key={mov.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:border-slate-300 transition flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-slate-900 text-xs">{mov.productName}</h5>
                    <p className="text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {mov.unitQtyUsed} x {mov.unitNameUsed}
                      </span>{" "}
                      &bull; {mov.notes || "Kulakan"}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {mov.timestamp}
                    </span>
                  </div>

                  <div className="text-right space-y-0.5">
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 block">
                      +{mov.quantityInBaseUnit} Satuan Dasar
                    </span>
                    {mov.costPerUnit && (
                      <span className="text-[11px] text-slate-600 font-mono font-semibold block">
                        @ Rp {mov.costPerUnit.toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
