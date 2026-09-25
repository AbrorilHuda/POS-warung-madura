import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Banknote,
  QrCode,
  CreditCard,
  RotateCcw,
  Zap,
} from "lucide-react";
import confetti from "canvas-confetti";
import type { Product, ProductUnit, CartItem, Sale } from "../types/pos";

interface KasirPOSProps {
  products: Product[];
  onAddNewProduct: (newProduct: Product, unit: ProductUnit) => void;
  onRecordSale: (newSale: Sale) => void;
  onRequestUnknownBarcode: (barcode: string) => void;
  quickScanTriggerBarcode: string | null;
  onClearQuickScanTrigger: () => void;
  nextInvoiceSeq?: number;
}

export const KasirPOS: React.FC<KasirPOSProps> = ({
  products,
  onAddNewProduct,
  onRecordSale,
  onRequestUnknownBarcode,
  quickScanTriggerBarcode,
  onClearQuickScanTrigger,
  nextInvoiceSeq,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"Tunai" | "QRIS" | "Hutang">("Tunai");
  const [invoiceSeq, setInvoiceSeq] = useState<number>(nextInvoiceSeq || 141);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nextInvoiceSeq && nextInvoiceSeq > invoiceSeq) {
      setInvoiceSeq(nextInvoiceSeq);
    }
  }, [nextInvoiceSeq]);

  const categories = [
    "Semua",
    "Rokok",
    "Mie & Sembako",
    "Minuman Dingin",
    "Jajanan & Kopi",
    "Gas & Galon",
  ];

  const currentInvoiceCode = `WM01-${String(invoiceSeq).padStart(6, "0")}`;

  useEffect(() => {
    if (quickScanTriggerBarcode) {
      handleBarcodeScan(quickScanTriggerBarcode);
      onClearQuickScanTrigger();
    }
  }, [quickScanTriggerBarcode]);

  const handleBarcodeScan = (barcode: string) => {
    const cleanCode = barcode.trim();
    if (!cleanCode) return;

    let matchedProduct: Product | undefined;
    let matchedUnit: ProductUnit | undefined;

    for (const prod of products) {
      const u = prod.units.find((unit) => unit.barcode.toLowerCase() === cleanCode.toLowerCase());
      if (u) {
        matchedProduct = prod;
        matchedUnit = u;
        break;
      }
    }

    if (matchedProduct && matchedUnit) {
      addToCart(matchedProduct, matchedUnit);
      setSearchQuery("");
    } else {
      onRequestUnknownBarcode(cleanCode);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBarcodeScan(searchQuery);
    }
  };

  const addToCart = (product: Product, unit: ProductUnit, qtyToAdd = 1) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.productId === product.id && item.unitId === unit.id
      );

      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].qty += qtyToAdd;
        return updated;
      } else {
        const newItem: CartItem = {
          id: `cart-${product.id}-${unit.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          unitId: unit.id,
          unitName: unit.unitName,
          conversionRatio: unit.conversionRatio,
          price: unit.price,
          qty: qtyToAdd,
          barcode: unit.barcode,
          costPrice: unit.costPrice,
        };
        return [...prevCart, newItem];
      }
    });
  };

  const updateCartItemQty = (cartId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(cartId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === cartId ? { ...item, qty: newQty } : item))
    );
  };

  const removeFromCart = (cartId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartId));
  };

  const switchCartItemUnit = (cartId: string, newUnitId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartId) return item;
        const parentProduct = products.find((p) => p.id === item.productId);
        if (!parentProduct) return item;
        const newUnit = parentProduct.units.find((u) => u.id === newUnitId);
        if (!newUnit) return item;

        return {
          ...item,
          unitId: newUnit.id,
          unitName: newUnit.unitName,
          conversionRatio: newUnit.conversionRatio,
          price: newUnit.price,
          costPrice: newUnit.costPrice,
          barcode: newUnit.barcode,
        };
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    setPaidAmount(0);
  };

  const grandTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const changeAmount = Math.max(0, paidAmount - grandTotal);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (paidAmount < grandTotal && paymentMethod === "Tunai") {
      alert("Nominal pembayaran belum mencukupi!");
      return;
    }

    try {
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.8 },
      });
    } catch (e) {}

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      invoiceCode: currentInvoiceCode,
      timestamp: new Date().toLocaleString("id-ID"),
      items: cart.map((c) => ({
        productId: c.productId,
        productName: c.productName,
        unitName: c.unitName,
        conversionRatio: c.conversionRatio,
        price: c.price,
        qty: c.qty,
        subtotal: c.price * c.qty,
        costPrice: c.costPrice,
      })),
      totalAmount: grandTotal,
      paidAmount: paymentMethod === "Tunai" ? paidAmount : grandTotal,
      changeAmount: paymentMethod === "Tunai" ? changeAmount : 0,
      paymentMethod: paymentMethod,
      syncStatus: "pending",
      cashierName: "Cak Mat",
    };

    onRecordSale(newSale);
    setInvoiceSeq((seq) => seq + 1);
    clearCart();
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === "Semua" || p.category === selectedCategory;
    const matchQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.units.some((u) => u.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchQuery;
  });

  const cashPresets = [
    { label: "Pas", amount: grandTotal },
    { label: "10k", amount: 10000 },
    { label: "20k", amount: 20000 },
    { label: "50k", amount: 50000 },
    { label: "100k", amount: 100000 },
    { label: "200k", amount: 200000 },
  ];

  return (
    <div className="p-6 h-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Search, Filters & Product Grid (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Minimalist Search & Barcode Bar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Cari nama barang atau scan barcode... (Enter)"
                className="w-full pl-10 pr-24 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
              <span className="absolute right-3 text-[10px] font-mono text-slate-400">
                Enter = Scan
              </span>
            </div>

            {/* Subtle Quick Simulator Pills */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <span className="text-slate-400 text-[10px] font-semibold whitespace-nowrap flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                Uji Barcode:
              </span>
              <button
                onClick={() => handleBarcodeScan("899238812039")}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition"
              >
                + A Mild
              </button>
              <button
                onClick={() => handleBarcodeScan("089686010999")}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition"
              >
                + Indomie Dus
              </button>
              <button
                onClick={() => handleBarcodeScan("899600141401")}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition"
              >
                + Le Minerale
              </button>
              <button
                onClick={() => handleBarcodeScan("899888999111")}
                className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-mono border border-rose-200 transition"
              >
                + Barcode Baru
              </button>
            </div>
          </div>

          {/* Minimal Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Clean Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[64vh] overflow-y-auto pr-1">
            {filteredProducts.map((product) => {
              const isLowStock = product.stockInBaseUnit <= (product.minStockAlert || 10);

              return (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 shadow-xs transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-bold text-slate-900 text-xs leading-snug">
                        {product.name}
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium whitespace-nowrap">
                        {product.category}
                      </span>
                    </div>

                    <div className="mb-3">
                      {product.stockInBaseUnit <= 0 ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          ⚠️ Stok Habis (0 {product.baseUnit})
                        </span>
                      ) : product.stockInBaseUnit <= (product.minStockAlert || 10) ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          ⚠️ Stok Menipis: {product.stockInBaseUnit} {product.baseUnit}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                          Stok: {product.stockInBaseUnit} {product.baseUnit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clean Unit Buttons */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    {product.units.map((unit) => (
                      <button
                        key={unit.id}
                        onClick={() => addToCart(product, unit)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-left transition group cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-slate-900 transition"></span>
                          <span className="font-medium text-xs text-slate-700 group-hover:text-slate-900">
                            {unit.unitName}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-xs text-slate-900">
                          Rp {unit.price.toLocaleString("id-ID")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Minimalist Cart & Checkout (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between min-h-[78vh]">
          <div>
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Nomor Struk
                </span>
                <h3 className="font-mono font-bold text-slate-900 text-xs">{currentInvoiceCode}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  {cart.reduce((total, it) => total + it.qty, 0)} Item
                </span>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="p-1 text-slate-400 hover:text-rose-600 transition"
                    title="Kosongkan Keranjang"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                  <Barcode className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Keranjang Kosong</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pilih barang dari katalog atau scan barcode.
                  </p>
                </div>
              ) : (
                cart.map((item) => {
                  const parent = products.find((p) => p.id === item.productId);
                  const availableUnits = parent ? parent.units : [];

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col gap-1.5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-2">
                          <h5 className="font-bold text-slate-900 text-xs leading-snug">
                            {item.productName}
                          </h5>
                          <div className="mt-1 flex items-center gap-1 text-[11px]">
                            <select
                              value={item.unitId}
                              onChange={(e) => switchCartItemUnit(item.id, e.target.value)}
                              className="text-[11px] font-medium bg-white text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none"
                            >
                              {availableUnits.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.unitName} (Rp {u.price.toLocaleString("id-ID")})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-bold text-xs text-slate-900 block">
                            Rp {(item.price * item.qty).toLocaleString("id-ID")}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-slate-400 hover:text-rose-600 mt-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                        <span className="text-[10px] text-slate-400 font-mono">
                          @ Rp {item.price.toLocaleString("id-ID")}
                        </span>
                        <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                          <button
                            onClick={() => updateCartItemQty(item.id, item.qty - 1)}
                            className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-900"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(e) =>
                              updateCartItemQty(item.id, parseInt(e.target.value) || 1)
                            }
                            className="w-8 text-center text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-none"
                          />
                          <button
                            onClick={() => updateCartItemQty(item.id, item.qty + 1)}
                            className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-900"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Minimalist Payment Section */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            {/* Total */}
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold text-slate-500">Total Tagihan:</span>
              <span className="font-mono text-2xl font-black text-slate-900">
                Rp {grandTotal.toLocaleString("id-ID")}
              </span>
            </div>

            {/* Methods */}
            <div className="grid grid-cols-3 gap-1.5">
              {(["Tunai", "QRIS", "Hutang"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m);
                    setPaidAmount(m === "Hutang" ? 0 : grandTotal);
                  }}
                  className={`py-1.5 rounded-xl text-xs font-semibold border transition ${
                    paymentMethod === m
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {paymentMethod === "Tunai" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                    Diterima:
                  </span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs font-mono text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={paidAmount || ""}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-1">
                  {cashPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPaidAmount(preset.amount)}
                      className="py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono font-medium transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {cart.length > 0 && (
                  <div
                    className={`p-2 rounded-xl border text-xs font-medium flex items-center justify-between ${
                      paidAmount >= grandTotal
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    <span>{paidAmount >= grandTotal ? "Kembalian:" : "Kurang:"}</span>
                    <span className="font-mono font-bold">
                      Rp {Math.abs(paidAmount - grandTotal).toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Checkout Action */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleCheckout}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                cart.length > 0
                  ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Selesaikan & Cetak Struk [F9]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
