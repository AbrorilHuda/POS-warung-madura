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
  ShoppingBag,
  Receipt,
  X,
  AlertTriangle,
  ArrowRight,
  Clock,
  Sparkles,
  FileText,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  sendCustomerDisplayEvent,
  listenKasirRequestState,
} from "../services/customerDisplaySync";
import type { Product, ProductUnit, CartItem, Sale } from "../types/pos";
import type { StoreConfig } from "../services/pos.server";

interface KasirPOSProps {
  products: Product[];
  onAddNewProduct: (newProduct: Product, unit: ProductUnit) => void;
  onRecordSale: (newSale: Sale) => void;
  onRequestUnknownBarcode: (barcode: string) => void;
  quickScanTriggerBarcode: string | null;
  onClearQuickScanTrigger: () => void;
  nextInvoiceSeq?: number;
  storeConfig?: StoreConfig;
}

export const KasirPOS: React.FC<KasirPOSProps> = ({
  products,
  onAddNewProduct,
  onRecordSale,
  onRequestUnknownBarcode,
  quickScanTriggerBarcode,
  onClearQuickScanTrigger,
  nextInvoiceSeq,
  storeConfig,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"Tunai" | "QRIS" | "Hutang">("Tunai");
  const [invoiceSeq, setInvoiceSeq] = useState<number>(nextInvoiceSeq || 141);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paidInputRef = useRef<HTMLInputElement>(null);
  const lastCompletedSaleRef = useRef<Sale | null>(null);

  const storePrefix = storeConfig?.storeCode || "WM01";
  const currentInvoiceCode = `${storePrefix}-${String(invoiceSeq).padStart(6, "0")}`;
  const grandTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const changeAmount = Math.max(0, paidAmount - grandTotal);

  // Simpan nilai terkini di refs agar listener REQUEST_STATE tidak perlu di-bind ulang setiap render
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const grandTotalRef = useRef(grandTotal);
  grandTotalRef.current = grandTotal;
  const currentInvoiceCodeRef = useRef(currentInvoiceCode);
  currentInvoiceCodeRef.current = currentInvoiceCode;

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

  // Kirim update keranjang ke Layar Pelanggan (Customer Display) realtime
  useEffect(() => {
    if (cart.length > 0) {
      sendCustomerDisplayEvent({
        type: "CART_UPDATE",
        invoiceCode: currentInvoiceCode,
        items: cart.map((c) => ({
          productName: c.productName,
          unitName: c.unitName,
          price: c.price,
          qty: c.qty,
          subtotal: c.price * c.qty,
        })),
        totalAmount: grandTotal,
        itemCount: cart.reduce((s, it) => s + it.qty, 0),
        timestamp: Date.now(),
      });
    } else if (!lastCompletedSaleRef.current) {
      // Jika keranjang kosong dan tidak sedang menampilkan nota selesai, kirim STANDBY
      sendCustomerDisplayEvent({
        type: "STANDBY",
        timestamp: Date.now(),
      });
    }
  }, [cart, grandTotal, currentInvoiceCode]);

  // Tanggapi REQUEST_STATE dari layar pelanggan (/display) - DIPASANG 1 KALI SAJA
  useEffect(() => {
    const unsub = listenKasirRequestState(() => {
      const currentCart = cartRef.current;
      const currentTotal = grandTotalRef.current;
      const currentCode = currentInvoiceCodeRef.current;

      if (currentCart.length > 0) {
        sendCustomerDisplayEvent({
          type: "CART_UPDATE",
          invoiceCode: currentCode,
          items: currentCart.map((c) => ({
            productName: c.productName,
            unitName: c.unitName,
            price: c.price,
            qty: c.qty,
            subtotal: c.price * c.qty,
          })),
          totalAmount: currentTotal,
          itemCount: currentCart.reduce((s, it) => s + it.qty, 0),
          timestamp: Date.now(),
        });
      } else if (lastCompletedSaleRef.current) {
        sendCustomerDisplayEvent({
          type: "SALE_COMPLETED",
          sale: lastCompletedSaleRef.current,
          timestamp: Date.now(),
        });
      } else {
        sendCustomerDisplayEvent({
          type: "STANDBY",
          timestamp: Date.now(),
        });
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (quickScanTriggerBarcode) {
      handleBarcodeScan(quickScanTriggerBarcode);
      onClearQuickScanTrigger();
    }
  }, [quickScanTriggerBarcode]);

  // Keyboard shortcut listener untuk kasir (F9 = Bayar, F8 = Fokus Bayar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === "F8") {
        e.preventDefault();
        paidInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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
    lastCompletedSaleRef.current = null; // Mulai transaksi baru, reset nota sebelumnya
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

  const clearCart = (broadcastStandby = true) => {
    setCart([]);
    setPaidAmount(0);
    if (broadcastStandby) {
      lastCompletedSaleRef.current = null;
      sendCustomerDisplayEvent({
        type: "STANDBY",
        timestamp: Date.now(),
      });
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (paidAmount < grandTotal && paymentMethod === "Tunai") {
      alert("Nominal pembayaran belum mencukupi!");
      paidInputRef.current?.focus();
      return;
    }

    try {
      confetti({
        particleCount: 50,
        spread: 60,
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
      cashierName: storeConfig?.cashierName || "Cak Mat",
    };

    onRecordSale(newSale);
    lastCompletedSaleRef.current = newSale;
    sendCustomerDisplayEvent({
      type: "SALE_COMPLETED",
      sale: newSale,
      timestamp: Date.now(),
    });
    setInvoiceSeq((seq) => seq + 1);
    clearCart(false);
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === "Semua" || p.category === selectedCategory;
    const matchQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.units.some((u) => u.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchQuery;
  });

  // Preset Pecahan Rupiah dengan warna visual yang mudah dikenali
  const cashPresets = [
    { label: "Uang Pas", amount: grandTotal, color: "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100" },
    { label: "10 rb", amount: 10000, color: "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100" },
    { label: "20 rb", amount: 20000, color: "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100" },
    { label: "50 rb", amount: 50000, color: "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100" },
    { label: "100 rb", amount: 100000, color: "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100" },
    { label: "200 rb", amount: 200000, color: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100" },
  ];

  // Helper warna badge kategori
  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case "Rokok":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "Mie & Sembako":
        return "bg-orange-50 text-orange-800 border-orange-200";
      case "Minuman Dingin":
        return "bg-sky-50 text-sky-800 border-sky-200";
      case "Jajanan & Kopi":
        return "bg-yellow-50 text-yellow-800 border-yellow-200";
      case "Gas & Galon":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto min-h-screen flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start flex-1">
        {/* ===================================================================== */}
        {/* KOLOM KIRI: KATALOG PRODUK, SEARCH & SATUAN (7 Cols)                  */}
        {/* ===================================================================== */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Header Search & Scan Box */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-3">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Cari nama barang atau scan barcode kemasan... (Enter = Cari)"
                className="w-full pl-10 pr-28 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-24 p-1 text-slate-400 hover:text-slate-700 transition"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="absolute right-3 hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-200/70 border border-slate-300 text-[10px] font-mono font-semibold text-slate-600">
                <Barcode className="w-3 h-3 text-slate-500" />
                <span>Enter = Scan</span>
              </div>
            </div>

            {/* Filter Kategori Modern dengan Counter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => {
                const count =
                  cat === "Semua"
                    ? products.length
                    : products.filter((p) => p.category === cat).length;
                const isSelected = selectedCategory === cat;

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid Kartu Produk Ergonomis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[calc(100vh-210px)] overflow-y-auto pr-1">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
                <ShoppingBag className="w-10 h-10 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-700 text-sm">
                  {products.length === 0 ? "Belum Ada Produk di Database" : "Produk tidak ditemukan"}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {products.length === 0
                    ? "Database masih kosong dan bersih. Silakan daftarkan produk pertama di menu Master Barang atau scan barcode barang dengan HP."
                    : `Tidak ada barang dengan kata kunci "${searchQuery}". Periksa ejaan atau scan barcode baru.`}
                </p>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isOutOfStock = product.stockInBaseUnit <= 0;
                const isLowStock =
                  product.stockInBaseUnit > 0 &&
                  product.stockInBaseUnit <= (product.minStockAlert || 10);

                return (
                  <div
                    key={product.id}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md rounded-2xl p-4 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Baris Atas: Kategori & Status Stok */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getCategoryBadgeClass(
                            product.category
                          )}`}
                        >
                          {product.category}
                        </span>

                        {isOutOfStock ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            Habis
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Sisa {product.stockInBaseUnit} {product.baseUnit}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500">
                            Stok: <strong className="text-slate-700 font-mono">{product.stockInBaseUnit}</strong> {product.baseUnit}
                          </span>
                        )}
                      </div>

                      {/* Nama Produk */}
                      <h4 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-amber-900 transition">
                        {product.name}
                      </h4>
                    </div>

                    {/* Tombol Cepat Satuan Kemasan (Quick Action Tiles) */}
                    <div className="space-y-1.5 pt-3 mt-3 border-t border-slate-100">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Pilih Satuan:
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {product.units.map((unit) => (
                          <button
                            key={unit.id}
                            type="button"
                            onClick={() => addToCart(product, unit)}
                            className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-slate-50 hover:bg-amber-50/80 active:bg-amber-100/90 border border-slate-200/70 hover:border-amber-300 text-left transition-all flex items-center justify-between cursor-pointer group/unit"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover/unit:bg-amber-600 transition" />
                              <span className="font-semibold text-xs text-slate-700 group-hover/unit:text-slate-900">
                                {unit.unitName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-900">
                                Rp {unit.price.toLocaleString("id-ID")}
                              </span>
                              <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-400 group-hover/unit:text-amber-600 group-hover/unit:border-amber-300 flex items-center justify-center text-xs transition">
                                <Plus className="w-3 h-3" />
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* KOLOM KANAN: KERANJANG KASIR & CHECKOUT CEPAT (5 Cols)                */}
        {/* ===================================================================== */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between h-[calc(100vh-100px)] sticky top-4">
          {/* 1. Header Keranjang */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Faktur Penjualan
              </span>
              <h3 className="font-mono font-bold text-slate-900 text-sm tracking-tight">
                {currentInvoiceCode}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  lastCompletedSaleRef.current = null;
                  sendCustomerDisplayEvent({
                    type: "STANDBY",
                    timestamp: Date.now(),
                  });
                }}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 border border-slate-200 hover:border-amber-300 transition cursor-pointer flex items-center gap-1"
                title="Paksa layar pelanggan menampilkan Belum Ada Transaksi"
              >
                <RotateCcw className="w-3 h-3 text-slate-400 hover:text-amber-600" />
                <span>Standby Layar</span>
              </button>

              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-white font-mono">
                {cart.reduce((total, it) => total + it.qty, 0)} Item
              </span>

              {cart.length > 0 && (
                <button
                  onClick={() => {
                    lastCompletedSaleRef.current = null;
                    clearCart(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Kosongkan Keranjang"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Daftar Belanjaan di Keranjang (Scrollable) */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h5 className="font-bold text-slate-700 text-sm">Keranjang Masih Kosong</h5>
                <p className="text-xs text-slate-400 max-w-[220px]">
                  Klik barang di sebelah kiri atau scan barcode untuk menambah belanjaan.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    lastCompletedSaleRef.current = null;
                    clearCart(true);
                  }}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Set Layar Pelanggan Standby</span>
                </button>
              </div>
            ) : (
              cart.map((item) => {
                const parent = products.find((p) => p.id === item.productId);
                const availableUnits = parent ? parent.units : [];

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-slate-900 text-xs leading-snug truncate">
                          {item.productName}
                        </h5>
                        <div className="mt-1 flex items-center gap-1.5">
                          <select
                            value={item.unitId}
                            onChange={(e) => switchCartItemUnit(item.id, e.target.value)}
                            className="text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          >
                            {availableUnits.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.unitName} (Rp {u.price.toLocaleString("id-ID")})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-sm text-slate-900 block">
                          Rp {(item.price * item.qty).toLocaleString("id-ID")}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-600 mt-0.5 transition cursor-pointer p-0.5"
                          title="Hapus barang"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stepper Jumlah Barang Ramah Sentuh */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400 font-mono">
                        @ Rp {item.price.toLocaleString("id-ID")}
                      </span>

                      <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-xl border border-slate-200 shadow-2xs">
                        <button
                          onClick={() => updateCartItemQty(item.id, item.qty - 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 active:scale-95 transition cursor-pointer"
                          title="Kurangi"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) =>
                            updateCartItemQty(item.id, parseInt(e.target.value) || 1)
                          }
                          className="w-10 text-center text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-none"
                        />
                        <button
                          onClick={() => updateCartItemQty(item.id, item.qty + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 active:scale-95 transition cursor-pointer"
                          title="Tambah"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 3. Seksi Pembayaran & Checkout (Sticky di Bagian Bawah) */}
          <div className="pt-3.5 border-t border-slate-100 space-y-3 shrink-0">
            {/* Display Total Belanja Utama */}
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Tagihan:
              </span>
              <span className="font-mono text-3xl font-black text-slate-900 tracking-tight">
                Rp {grandTotal.toLocaleString("id-ID")}
              </span>
            </div>

            {/* Pilihan Metode Bayar Ber-Ikon */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "Tunai", icon: Banknote, label: "Tunai" },
                { id: "QRIS", icon: QrCode, label: "QRIS" },
                { id: "Hutang", icon: FileText, label: "Hutang" },
              ].map(({ id, icon: Icon, label }) => {
                const isSelected = paymentMethod === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(id as any);
                      setPaidAmount(id === "Hutang" ? 0 : grandTotal);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Input Pembayaran Tunai & Preset Uang Pecahan Rupiah */}
            {paymentMethod === "Tunai" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                    Uang Diterima:
                  </span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-xs font-mono font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      ref={paidInputRef}
                      type="number"
                      value={paidAmount || ""}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-black text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                {/* Preset Pecahan Uang Cepat Berwarna */}
                <div className="grid grid-cols-6 gap-1">
                  {cashPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPaidAmount(preset.amount)}
                      className={`py-1.5 rounded-lg text-[10px] font-mono font-bold border transition cursor-pointer text-center ${preset.color}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Indikator Kembalian Jelas */}
                {cart.length > 0 && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                      paidAmount >= grandTotal
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    <span>
                      {paidAmount >= grandTotal ? "Kembalian Pelanggan:" : "Kekurangan Bayar:"}
                    </span>
                    <span className="font-mono text-base font-black">
                      Rp {Math.abs(paidAmount - grandTotal).toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tombol Eksekusi Checkout Utama */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleCheckout}
              className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                cart.length > 0
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.99] shadow-emerald-700/20"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>BAYAR &amp; CETAK STRUK [F9]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
