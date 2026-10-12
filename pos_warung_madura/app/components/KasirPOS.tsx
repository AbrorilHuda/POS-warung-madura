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
  RotateCcw,
  ShoppingBag,
  X,
  AlertTriangle,
  FileText,
  Users,
  Lock,
  Layers,
  Tag,
  Sparkles,
  Upload,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";

import {
  sendCustomerDisplayEvent,
  listenKasirRequestState,
} from "../services/customerDisplaySync";
import type { Product, ProductUnit, CartItem, Sale, CustomerSummary, CustomerGroupType } from "../types/pos";
import type { StoreConfig } from "../services/pos.server";
import { calculateTieredPrice, getNextTierUpsell } from "../services/pricing";


interface KasirPOSProps {
  products: Product[];
  onAddNewProduct: (newProduct: Product, unit: ProductUnit) => void;
  onRecordSale: (newSale: Sale) => void;
  onRequestUnknownBarcode: (barcode: string) => void;
  quickScanTriggerBarcode: string | null;
  onClearQuickScanTrigger: () => void;
  nextInvoiceSeq?: number;
  storeConfig?: StoreConfig;
  activeShift?: any;
  onRequireOpenShift?: () => void;
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
  activeShift,
  onRequireOpenShift,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"Tunai" | "QRIS" | "Hutang" | "Campuran">("Tunai");
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [isPinApproved, setIsPinApproved] = useState<boolean>(false);

  // Split Payment & QRIS States (PRD F4)
  const [showQrisModal, setShowQrisModal] = useState<boolean>(false);
  const [qrisRefNo, setQrisRefNo] = useState<string>("");
  const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
  const [splitNonCashAmount, setSplitNonCashAmount] = useState<number>(0);
  const [splitNonCashMethod, setSplitNonCashMethod] = useState<"QRIS" | "Transfer">("QRIS");
  const [splitRefNo, setSplitRefNo] = useState<string>("");
  const [customQrisImage, setCustomQrisImage] = useState<string | null>(null);
  const qrisFileInputRef = useRef<HTMLInputElement>(null);

  const [invoiceSeq, setInvoiceSeq] = useState<number>(nextInvoiceSeq || 141);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paidInputRef = useRef<HTMLInputElement>(null);
  const lastCompletedSaleRef = useRef<Sale | null>(null);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.customers) setCustomers(d.customers);
      })
      .catch(() => { });
  }, []);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const activeCustomerGroup: CustomerGroupType = (selectedCustomer?.customerGroup as CustomerGroupType) || "umum";

  const storePrefix = storeConfig?.storeCode || "WM01";
  const currentInvoiceCode = `${storePrefix}-${String(invoiceSeq).padStart(6, "0")}`;
  const grandTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const changeAmount = Math.max(0, paidAmount - grandTotal);

  // Inisialisasi gambar stiker QRIS dari localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedImg = localStorage.getItem("pos_qris_custom_image");
      if (savedImg) {
        setCustomQrisImage(savedImg);
      }
    }
  }, []);

  const handleUploadQrisImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCustomQrisImage(dataUrl);
        try {
          localStorage.setItem("pos_qris_custom_image", dataUrl);
        } catch (err) {
          console.warn("Penyimpanan lokal penuh atau gagal menyimpan gambar QRIS:", err);
        }
        if (showQrisModal) {
          sendCustomerDisplayEvent({
            type: "SHOW_QRIS",
            amount: paymentMethod === "Campuran" ? splitNonCashAmount : grandTotal,
            invoiceCode: currentInvoiceCode,
            storeName: storeConfig?.storeName || "Warung Madura Berkah",
            customQrisImage: dataUrl,
            items: cart.map((c) => ({
              productName: c.productName,
              unitName: c.unitName,
              price: c.price,
              qty: c.qty,
              subtotal: c.price * c.qty,
            })),
            itemCount: cart.reduce((s, it) => s + it.qty, 0),
            timestamp: Date.now(),
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomQrisImage = () => {
    setCustomQrisImage(null);
    try {
      localStorage.removeItem("pos_qris_custom_image");
    } catch { }
    if (showQrisModal) {
      sendCustomerDisplayEvent({
        type: "SHOW_QRIS",
        amount: paymentMethod === "Campuran" ? splitNonCashAmount : grandTotal,
        invoiceCode: currentInvoiceCode,
        storeName: storeConfig?.storeName || "Warung Madura Berkah",
        customQrisImage: null,
        items: cart.map((c) => ({
          productName: c.productName,
          unitName: c.unitName,
          price: c.price,
          qty: c.qty,
          subtotal: c.price * c.qty,
        })),
        itemCount: cart.reduce((s, it) => s + it.qty, 0),
        timestamp: Date.now(),
      });
    }
  };

  const handleOpenQrisModal = (amount: number) => {
    setShowQrisModal(true);
    const effectiveImg = customQrisImage || (typeof window !== "undefined" ? localStorage.getItem("pos_qris_custom_image") : null);
    sendCustomerDisplayEvent({
      type: "SHOW_QRIS",
      amount,
      invoiceCode: currentInvoiceCode,
      storeName: storeConfig?.storeName || "Warung Madura Berkah",
      customQrisImage: effectiveImg,
      items: cart.map((item) => ({
        productName: item.productName,
        unitName: item.unitName,
        price: item.price,
        qty: item.qty,
        subtotal: item.price * item.qty,
      })),
      itemCount: cart.reduce((acc, it) => acc + it.qty, 0),
      timestamp: Date.now(),
    });
  };

  const handleCloseQrisModal = () => {
    setShowQrisModal(false);
    if (cart.length > 0) {
      sendCustomerDisplayEvent({
        type: "CART_UPDATE",
        invoiceCode: currentInvoiceCode,
        items: cart.map((item) => ({
          productName: item.productName,
          unitName: item.unitName,
          price: item.price,
          qty: item.qty,
          subtotal: item.price * item.qty,
        })),
        totalAmount: grandTotal,
        itemCount: cart.reduce((acc, it) => acc + it.qty, 0),
        timestamp: Date.now(),
      });
    } else {
      sendCustomerDisplayEvent({
        type: "STANDBY",
        timestamp: Date.now(),
      });
    }
  };

  const handleConfirmQrisPayment = () => {
    if (paymentMethod === "QRIS") {
      setPaidAmount(grandTotal);
    }
    handleCloseQrisModal();
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch { }
  };

  useEffect(() => {
    if (!showQrisModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseQrisModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showQrisModal, cart, currentInvoiceCode, grandTotal]);

  // Sinkronisasi ulang harga bertingkat keranjang saat pelanggan atau produk berubah (PRD F3.3)
  useEffect(() => {
    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart;
      let hasChange = false;
      const updated = prevCart.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const unit = prod?.units.find((u) => u.id === item.unitId);
        if (!unit) return item;

        const tierCalc = calculateTieredPrice({
          unit,
          qty: item.qty,
          customerGroup: activeCustomerGroup,
        });

        if (
          item.price !== tierCalc.price ||
          item.basePrice !== tierCalc.basePrice ||
          item.appliedTierName !== tierCalc.appliedTierName ||
          item.isWholesalePrice !== tierCalc.isWholesalePrice
        ) {
          hasChange = true;
          return {
            ...item,
            price: tierCalc.price,
            basePrice: tierCalc.basePrice,
            appliedTierName: tierCalc.appliedTierName,
            isWholesalePrice: tierCalc.isWholesalePrice,
          };
        }
        return item;
      });
      return hasChange ? updated : prevCart;
    });
  }, [selectedCustomerId, activeCustomerGroup, products]);


  // Simpan nilai terkini di refs agar listener REQUEST_STATE tidak perlu di-bind ulang setiap render
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const grandTotalRef = useRef(grandTotal);
  grandTotalRef.current = grandTotal;
  const currentInvoiceCodeRef = useRef(currentInvoiceCode);
  currentInvoiceCodeRef.current = currentInvoiceCode;
  const showQrisModalRef = useRef(showQrisModal);
  showQrisModalRef.current = showQrisModal;
  const customQrisImageRef = useRef(customQrisImage);
  customQrisImageRef.current = customQrisImage;
  const paymentMethodRef = useRef(paymentMethod);
  paymentMethodRef.current = paymentMethod;
  const splitNonCashAmountRef = useRef(splitNonCashAmount);
  splitNonCashAmountRef.current = splitNonCashAmount;

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
    if (showQrisModal) {
      // Jika modal QRIS sedang dibuka, JANGAN menimpa tampilan layar pelanggan dengan CART_UPDATE
      return;
    }

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
  }, [cart, grandTotal, currentInvoiceCode, showQrisModal]);

  // Tanggapi REQUEST_STATE dari layar pelanggan (/display) - DIPASANG 1 KALI SAJA
  useEffect(() => {
    const unsub = listenKasirRequestState(() => {
      const currentCart = cartRef.current;
      const currentTotal = grandTotalRef.current;
      const currentCode = currentInvoiceCodeRef.current;

      // Jika modal QRIS sedang aktif, balas langsung dengan status SHOW_QRIS
      if (showQrisModalRef.current) {
        const qrisAmount = paymentMethodRef.current === "Campuran"
          ? splitNonCashAmountRef.current
          : currentTotal;
        const effectiveImg = customQrisImageRef.current || (typeof window !== "undefined" ? localStorage.getItem("pos_qris_custom_image") : null);
        sendCustomerDisplayEvent({
          type: "SHOW_QRIS",
          amount: qrisAmount,
          invoiceCode: currentCode,
          storeName: storeConfig?.storeName || "Warung Madura Berkah",
          customQrisImage: effectiveImg,
          items: currentCart.map((c) => ({
            productName: c.productName,
            unitName: c.unitName,
            price: c.price,
            qty: c.qty,
            subtotal: c.price * c.qty,
          })),
          itemCount: currentCart.reduce((s, it) => s + it.qty, 0),
          timestamp: Date.now(),
        });
        return;
      }

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
  }, [storeConfig?.storeName]);

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
        const targetItem = updated[existingIndex];
        const newQty = targetItem.qty + qtyToAdd;
        const tierCalc = calculateTieredPrice({
          unit,
          qty: newQty,
          customerGroup: activeCustomerGroup,
        });

        updated[existingIndex] = {
          ...targetItem,
          qty: newQty,
          price: tierCalc.price,
          basePrice: tierCalc.basePrice,
          appliedTierName: tierCalc.appliedTierName,
          isWholesalePrice: tierCalc.isWholesalePrice,
        };
        return updated;
      } else {
        const tierCalc = calculateTieredPrice({
          unit,
          qty: qtyToAdd,
          customerGroup: activeCustomerGroup,
        });

        const newItem: CartItem = {
          id: `cart-${product.id}-${unit.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          unitId: unit.id,
          unitName: unit.unitName,
          conversionRatio: unit.conversionRatio,
          price: tierCalc.price,
          basePrice: tierCalc.basePrice,
          appliedTierName: tierCalc.appliedTierName,
          isWholesalePrice: tierCalc.isWholesalePrice,
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
      prev.map((item) => {
        if (item.id !== cartId) return item;
        const parent = products.find((p) => p.id === item.productId);
        const unit = parent?.units.find((u) => u.id === item.unitId);
        if (!unit) return { ...item, qty: newQty };

        const tierCalc = calculateTieredPrice({
          unit,
          qty: newQty,
          customerGroup: activeCustomerGroup,
        });

        return {
          ...item,
          qty: newQty,
          price: tierCalc.price,
          basePrice: tierCalc.basePrice,
          appliedTierName: tierCalc.appliedTierName,
          isWholesalePrice: tierCalc.isWholesalePrice,
        };
      })
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

        const tierCalc = calculateTieredPrice({
          unit: newUnit,
          qty: item.qty,
          customerGroup: activeCustomerGroup,
        });

        return {
          ...item,
          unitId: newUnit.id,
          unitName: newUnit.unitName,
          conversionRatio: newUnit.conversionRatio,
          price: tierCalc.price,
          basePrice: tierCalc.basePrice,
          appliedTierName: tierCalc.appliedTierName,
          isWholesalePrice: tierCalc.isWholesalePrice,
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
    if (!activeShift) {
      if (onRequireOpenShift) onRequireOpenShift();
      alert("Laci kasir belum dibuka! Silakan masukkan modal awal shift kasir terlebih dahulu.");
      return;
    }
    if (paidAmount < grandTotal && paymentMethod === "Tunai") {
      alert("Nominal pembayaran belum mencukupi!");
      paidInputRef.current?.focus();
      return;
    }

    const isKasbon = paymentMethod === "Hutang";
    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
    const kasbonDebtPortion = Math.max(0, grandTotal - (paidAmount || 0));

    if (isKasbon) {
      if (!selectedCustomerId) {
        alert("Transaksi Kasbon wajib memilih data pelanggan!");
        return;
      }

      const isOverLimit =
        selectedCustomer &&
        selectedCustomer.creditLimit > 0 &&
        selectedCustomer.totalDebt + kasbonDebtPortion > selectedCustomer.creditLimit;

      if (isOverLimit && !isPinApproved) {
        setShowPinModal(true);
        return;
      }
    }

    if (paymentMethod === "Campuran") {
      const totalSplitPaid = splitCashAmount + splitNonCashAmount;
      if (totalSplitPaid < grandTotal) {
        alert(`Total pembayaran campuran (Rp ${totalSplitPaid.toLocaleString("id-ID")}) belum mencukupi tagihan (Rp ${grandTotal.toLocaleString("id-ID")})!`);
        return;
      }
    }

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (e) { }

    let actualPaid = paymentMethod === "Tunai" ? paidAmount : isKasbon ? (paidAmount || 0) : grandTotal;
    let actualChange = paymentMethod === "Tunai" ? changeAmount : 0;
    let splitPaymentsList: Sale["splitPayments"] = undefined;

    if (paymentMethod === "Campuran") {
      const splitChange = Math.max(0, (splitCashAmount + splitNonCashAmount) - grandTotal);
      actualPaid = splitCashAmount + splitNonCashAmount;
      actualChange = splitChange;
      splitPaymentsList = [
        {
          method: splitNonCashMethod,
          amount: splitNonCashAmount,
          referenceNo: splitRefNo || undefined,
        },
        {
          method: "Tunai",
          amount: splitCashAmount - splitChange,
        },
      ];
    } else if (paymentMethod === "QRIS") {
      splitPaymentsList = [
        {
          method: "QRIS",
          amount: grandTotal,
          referenceNo: qrisRefNo || undefined,
        },
      ];
    }

    const debtRemainder = isKasbon ? Math.max(0, grandTotal - actualPaid) : 0;

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
        basePrice: c.basePrice,
        appliedTierName: c.appliedTierName,
        isWholesalePrice: c.isWholesalePrice,
      })),
      totalAmount: grandTotal,
      paidAmount: actualPaid,
      changeAmount: actualChange,
      paymentMethod: isKasbon ? "Kasbon" : paymentMethod,
      splitPayments: splitPaymentsList,
      customerId: selectedCustomerId || undefined,
      customerName: selectedCustomer?.name || undefined,
      customerDebtRemaining: isKasbon ? (selectedCustomer?.totalDebt || 0) + debtRemainder : undefined,

      syncStatus: "pending",
      cashierName: activeShift?.cashierName || storeConfig?.cashierName || "Cak Mat",
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
    setSelectedCustomerId("");
    setIsPinApproved(false);
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${isSelected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected
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

          {/* 1.1 Bilah Pilihan Pelanggan / Reseller (PRD F3.3 & F1.2) */}
          <div className="mt-2.5 p-2 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-600 shrink-0">Pelanggan:</span>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setIsPinApproved(false);
                }}
                className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-2 py-1 text-slate-800 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="">Umum (Bukan Reseller / Non-Member)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.customerGroup && c.customerGroup !== "umum" ? `[${c.customerGroup.toUpperCase()}]` : ""} {c.totalDebt > 0 ? `(Utang Rp ${c.totalDebt.toLocaleString("id-ID")})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    selectedCustomer.customerGroup === "reseller"
                      ? "bg-purple-100 text-purple-800 border border-purple-300"
                      : selectedCustomer.customerGroup === "langganan"
                      ? "bg-blue-100 text-blue-800 border border-blue-300"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {selectedCustomer.customerGroup || "Umum"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId("")}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                  title="Reset ke Pelanggan Umum"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Peringatan Shift Kasir Belum Dibuka (PRD F5.3) */}
          {!activeShift && (
            <button
              type="button"
              onClick={onRequireOpenShift}
              className="mt-2.5 p-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-semibold text-xs flex items-center justify-between transition cursor-pointer text-left"
              title="Klik untuk membuka shift kasir dan input modal awal"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold text-[11px] leading-tight">Laci Kasir Belum Dibuka</p>
                  <p className="text-[10px] text-amber-700">Klik untuk input modal awal laci kasir</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-amber-200/80 font-bold text-[10px] text-amber-900 shrink-0">
                Buka Shift
              </span>
            </button>
          )}

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
                const currentUnit = availableUnits.find((u) => u.id === item.unitId);
                const upsell = currentUnit
                  ? getNextTierUpsell({
                      unit: currentUnit,
                      qty: item.qty,
                      customerGroup: activeCustomerGroup,
                    })
                  : null;

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h5 className="font-bold text-slate-900 text-xs leading-snug truncate">
                            {item.productName}
                          </h5>
                          {item.isWholesalePrice && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-md">
                              <Tag className="w-2.5 h-2.5 text-emerald-600" />
                              <span>{item.appliedTierName || "Harga Grosir"}</span>
                            </span>
                          )}
                        </div>

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
                        {item.isWholesalePrice && item.basePrice && item.basePrice > item.price && (
                          <span className="text-[10px] font-semibold text-emerald-600 font-mono block">
                            Hemat Rp {((item.basePrice - item.price) * item.qty).toLocaleString("id-ID")}
                          </span>
                        )}
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
                      <div className="flex items-center gap-1.5">
                        {item.isWholesalePrice && item.basePrice && item.basePrice > item.price ? (
                          <div className="text-[10px] font-mono">
                            <span className="line-through text-slate-400 mr-1">
                              Rp {item.basePrice.toLocaleString("id-ID")}
                            </span>
                            <span className="font-bold text-emerald-700">
                              @ Rp {item.price.toLocaleString("id-ID")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            @ Rp {item.price.toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>

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

                    {/* Rekomendasi Upsell Tier Berikutnya (PRD F3.3) */}
                    {upsell && (
                      <div className="mt-1.5 p-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1 min-w-0">
                          <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">{upsell.message}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(item.id, item.qty + upsell.qtyNeeded)}
                          className="px-2 py-0.5 rounded-lg bg-amber-200/90 hover:bg-amber-300 text-amber-950 font-bold text-[10px] transition cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                          title={`Tambah ${upsell.qtyNeeded} lagi untuk dapat diskon grosir`}
                        >
                          +{upsell.qtyNeeded} {item.unitName}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 3. Seksi Pembayaran & Checkout (Sticky di Bagian Bawah) */}
          <div className="pt-3.5 border-t border-slate-100 space-y-3 shrink-0">
            {/* Display Total Belanja Utama */}
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Total Tagihan:
                </span>
                {(() => {
                  const totalSavings = cart.reduce((sum, item) => {
                    if (item.isWholesalePrice && item.basePrice && item.basePrice > item.price) {
                      return sum + (item.basePrice - item.price) * item.qty;
                    }
                    return sum;
                  }, 0);
                  if (totalSavings > 0) {
                    return (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded mt-0.5">
                        <Tag className="w-2.5 h-2.5" />
                        Hemat Grosir: Rp {totalSavings.toLocaleString("id-ID")}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <span className="font-mono text-3xl font-black text-slate-900 tracking-tight">
                Rp {grandTotal.toLocaleString("id-ID")}
              </span>
            </div>

            {/* Pilihan Metode Bayar Ber-Ikon (PRD F4.1) */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "Tunai", icon: Banknote, label: "Tunai" },
                { id: "QRIS", icon: QrCode, label: "QRIS" },
                { id: "Hutang", icon: FileText, label: "Kasbon" },
                { id: "Campuran", icon: Layers, label: "Split" },
              ].map(({ id, icon: Icon, label }) => {

                const isSelected = paymentMethod === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(id as any);
                      if (id === "Hutang") {
                        setPaidAmount(0);
                      } else if (id === "Campuran") {
                        setSplitCashAmount(0);
                        setSplitNonCashAmount(grandTotal);
                      } else {
                        setPaidAmount(grandTotal);
                      }
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1 cursor-pointer ${isSelected
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

            {/* Input Pembayaran QRIS Statis (PRD F4.3) */}
            {paymentMethod === "QRIS" && (
              <div className="space-y-2 p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-950 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-blue-700" />
                    <span>Pembayaran QRIS Statis Toko</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenQrisModal(grandTotal)}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition cursor-pointer"
                  >
                    Tampilkan QRIS
                  </button>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-blue-200/60">
                  <span className="text-[11px] text-blue-900 font-medium whitespace-nowrap">
                    No. Ref / RRN:
                  </span>
                  <input
                    type="text"
                    value={qrisRefNo}
                    onChange={(e) => setQrisRefNo(e.target.value)}
                    placeholder="Opsional (Contoh: RRN-9921)"
                    className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-blue-300 font-mono text-[11px] outline-none"
                  />
                </div>
              </div>
            )}

            {/* Input Pembayaran Campuran / Split Payment (PRD F4.2) */}
            {paymentMethod === "Campuran" && (
              <div className="space-y-2 p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-xs">
                <div className="flex items-center justify-between pb-1 border-b border-indigo-200/60">
                  <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-700" />
                    <span>Pembayaran Campuran (Split Payment)</span>
                  </span>
                  <span className="text-[10px] text-indigo-700 font-mono">2 Metode Bayar</span>
                </div>

                {/* Bagian Non-Tunai */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700">1. Porsi Non-Tunai:</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={splitNonCashMethod}
                        onChange={(e) => setSplitNonCashMethod(e.target.value as any)}
                        className="px-2 py-0.5 rounded-lg bg-white border border-indigo-300 font-semibold text-[10px] outline-none"
                      >
                        <option value="QRIS">QRIS Toko</option>
                        <option value="Transfer">Transfer Bank</option>
                      </select>
                      {splitNonCashMethod === "QRIS" && (
                        <button
                          type="button"
                          onClick={() => handleOpenQrisModal(splitNonCashAmount)}
                          className="px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>Tampilkan QRIS</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-slate-400 font-mono font-bold text-[11px]">Rp</span>
                    <input
                      type="number"
                      min={0}
                      max={grandTotal}
                      value={splitNonCashAmount || ""}
                      onChange={(e) => setSplitNonCashAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full pl-8 pr-2 py-1 rounded-lg bg-white border border-indigo-300 font-mono font-bold text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Bagian Tunai */}
                <div className="space-y-1 pt-1 border-t border-indigo-200/60">
                  <span className="text-[11px] font-semibold text-slate-700">2. Porsi Uang Tunai Diterima:</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-slate-400 font-mono font-bold text-[11px]">Rp</span>
                    <input
                      type="number"
                      min={0}
                      value={splitCashAmount || ""}
                      onChange={(e) => setSplitCashAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full pl-8 pr-2 py-1 rounded-lg bg-white border border-indigo-300 font-mono font-bold text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Hasil Kalkulasi Split */}
                {(() => {
                  const totalPaid = splitCashAmount + splitNonCashAmount;
                  const diff = totalPaid - grandTotal;
                  return (
                    <div
                      className={`p-2 rounded-xl border flex items-center justify-between font-bold text-[11px] ${diff >= 0
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-rose-50 border-rose-300 text-rose-900"
                        }`}
                    >
                      <span>{diff >= 0 ? "Kembalian Tunai:" : "Kurang Bayar:"}</span>
                      <span className="font-mono text-sm">
                        Rp {Math.abs(diff).toLocaleString("id-ID")}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

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
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${paidAmount >= grandTotal
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

            {/* Pilihan Pelanggan & Pembayaran Sebagian Kasbon (PRD F1.2 & F1.3) */}
            {paymentMethod === "Hutang" && (
              <div className="space-y-2 p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-amber-700" />
                    Pilih Pelanggan Kasbon:
                  </span>
                  {selectedCustomerId && (
                    <span className="text-[10px] font-mono font-semibold text-amber-800">
                      Utang: Rp {customers.find((c) => c.id === selectedCustomerId)?.totalDebt.toLocaleString("id-ID") || 0}
                    </span>
                  )}
                </div>

                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setIsPinApproved(false);
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl text-slate-800 font-semibold focus:outline-none"
                >
                  <option value="">-- Pilih Nama Pelanggan (Wajib) --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""} — Sisa Utang: Rp {c.totalDebt.toLocaleString("id-ID")}{c.creditLimit > 0 ? ` | Limit: Rp ${c.creditLimit.toLocaleString("id-ID")}` : ""}
                    </option>
                  ))}
                </select>

                {/* Split Payment: Bayar sebagian tunai (PRD F1.3) */}
                <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                  <span className="text-[11px] font-medium text-amber-900 whitespace-nowrap">
                    Bayar Tunai Dimuka:
                  </span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1.5 text-[10px] font-mono text-slate-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      max={grandTotal}
                      value={paidAmount || ""}
                      onChange={(e) => setPaidAmount(Math.min(grandTotal, Number(e.target.value)))}
                      placeholder="0 (Semua kasbon)"
                      className="w-full pl-7 pr-2 py-1 text-xs bg-white border border-amber-300 rounded-lg font-mono font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-amber-950 font-medium">
                  <span>Sisa Masuk Kasbon:</span>
                  <span className="font-mono font-bold text-rose-600">
                    Rp {Math.max(0, grandTotal - (paidAmount || 0)).toLocaleString("id-ID")}
                  </span>
                </div>

                {/* Peringatan Limit Kasbon (PRD F1.7) */}
                {(() => {
                  const cust = customers.find((c) => c.id === selectedCustomerId);
                  const kasbonDebt = Math.max(0, grandTotal - (paidAmount || 0));
                  const isOver = cust && cust.creditLimit > 0 && cust.totalDebt + kasbonDebt > cust.creditLimit;

                  if (isOver) {
                    return (
                      <div className="p-2 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-[11px] space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Kasbon melebihi limit kredit!</span>
                        </div>
                        <div className="text-[10px] text-rose-700">
                          Limit: Rp {cust.creditLimit.toLocaleString("id-ID")} | Total Baru: Rp {(cust.totalDebt + kasbonDebt).toLocaleString("id-ID")}
                        </div>
                        {isPinApproved ? (
                          <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Disetujui dengan PIN Pemilik
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowPinModal(true)}
                            className="w-full mt-1 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition cursor-pointer"
                          >
                            Masukkan PIN Pemilik untuk Menyetujui
                          </button>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Tombol Eksekusi Checkout Utama */}
            <button
              type="button"
              disabled={cart.length === 0 || (paymentMethod === "Hutang" && !selectedCustomerId)}
              onClick={handleCheckout}
              className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${cart.length > 0 && !(paymentMethod === "Hutang" && !selectedCustomerId)
                ? "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.99] shadow-emerald-700/20"
                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {paymentMethod === "Hutang"
                  ? selectedCustomerId
                    ? "SIMPAN TRANSAKSI KASBON [F9]"
                    : "PILIH PELANGGAN TERLEBIH DAHULU"
                  : "BAYAR & CETAK STRUK [F9]"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Otorisasi PIN Pemilik untuk Kasbon Over Limit (PRD F1.7) */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xs bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 text-slate-900 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <Lock className="w-4 h-4" />
                <span>Otorisasi PIN Pemilik</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  setPinInput("");
                  setPinError("");
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Transaksi ini melebihi limit kasbon pelanggan. Masukkan PIN Pemilik atau Kode Pemulihan Darurat (REC-XXXX-XXXX) untuk melanjutkan.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPinError("");
                try {
                  const res = await fetch("/api/customers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "verifyPin", pin: pinInput }),
                  });
                  const d = await res.json();
                  if (d.ok && d.valid) {
                    setIsPinApproved(true);
                    setShowPinModal(false);
                    setPinInput("");
                  } else {
                    setPinError("PIN Pemilik atau Kode Pemulihan tidak tepat!");
                  }
                } catch {
                  setPinError("Gagal memvalidasi PIN");
                }
              }}
              className="space-y-3"
            >
              <input
                type="password"
                autoFocus
                maxLength={20}
                placeholder="PIN Pemilik atau REC-XXXX-XXXX..."
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center tracking-wider text-base font-mono font-bold py-2 border border-slate-300 rounded-xl focus:border-rose-500 focus:outline-none"
              />

              {pinError && (
                <div className="text-[11px] font-semibold text-rose-600 text-center">
                  {pinError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput("");
                    setPinError("");
                  }}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!pinInput.trim()}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40"
                >
                  Verifikasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL QRIS STATIS TOKO (PRD F4.3)                                         */}
      {/* ========================================================================= */}
      {showQrisModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm sm:max-w-md w-full border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Header Resmi QRIS */}
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-5 py-3.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-red-100 leading-none">
                    QRIS Standar Nasional
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white tracking-wide mt-0.5">
                    PEMBAYARAN QRIS TOKO
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseQrisModal}
                className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
                title="Tutup (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Isi Konten Modal */}
            <div className="p-4 sm:p-5 space-y-3.5">
              {/* Info Toko & Faktur */}
              <div className="text-center pb-2 border-b border-slate-100">
                <h4 className="font-black text-base sm:text-lg text-slate-800 tracking-tight uppercase">
                  {storeConfig?.storeName || "WARUNG MADURA BERKAH"}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {storeConfig?.storeAddress || storeConfig?.storeCity || "Toko Kelontong Madura 24 Jam"}
                </p>
                <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-mono text-slate-600 font-semibold">
                  <span>No. Faktur: {currentInvoiceCode}</span>
                </div>
              </div>

              {/* Nominal Tagihan */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-blue-200/80 rounded-2xl p-3 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Tagihan Yang Harus Dibayar
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 tracking-tight mt-0.5">
                  Rp {(paymentMethod === "Campuran" ? splitNonCashAmount : grandTotal).toLocaleString("id-ID")}
                </div>
                {paymentMethod === "Campuran" && (
                  <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                    (Porsi Non-Tunai Split Payment)
                  </div>
                )}
              </div>

              {/* Area Barcode / Stiker QRIS */}
              <div className="p-3 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
                {customQrisImage ? (
                  <div className="w-full flex flex-col items-center">
                    <div className="relative group max-w-[240px] w-full flex items-center justify-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <img
                        src={customQrisImage}
                        alt="Stiker QRIS Toko"
                        className="w-full max-h-[220px] object-contain rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => qrisFileInputRef.current?.click()}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Ganti Stiker</span>
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleRemoveCustomQrisImage}
                        className="text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center">
                    <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
                      <QRCodeSVG
                        value={`${storeConfig?.storeName || "WARUNG MADURA"}|QRIS|INV:${currentInvoiceCode}|TOTAL:${paymentMethod === "Campuran" ? splitNonCashAmount : grandTotal}`}
                        size={180}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 text-center">
                      QR Barcode otomatis sistem kasir
                    </p>
                    <button
                      type="button"
                      onClick={() => qrisFileInputRef.current?.click()}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer border border-blue-200"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah Stiker QRIS Toko (Foto / Scan)</span>
                    </button>
                  </div>
                )}
                <input
                  ref={qrisFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadQrisImage}
                />
              </div>

              {/* Logo Bank & E-Wallet Yang Didukung */}
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 text-center font-medium">
                  Menerima pembayaran dari seluruh aplikasi:
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {["BCA", "Mandiri", "BRI", "BNI", "GoPay", "OVO", "DANA", "ShopeePay"].map((bank) => (
                    <span
                      key={bank}
                      className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[9px] border border-slate-200"
                    >
                      {bank}
                    </span>
                  ))}
                </div>
              </div>

              {/* Input Nomor Referensi / RRN */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">
                    No. Referensi / RRN Bukti Transfer:
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">Opsional</span>
                </div>
                <input
                  type="text"
                  value={paymentMethod === "Campuran" ? splitRefNo : qrisRefNo}
                  onChange={(e) => {
                    if (paymentMethod === "Campuran") {
                      setSplitRefNo(e.target.value);
                    } else {
                      setQrisRefNo(e.target.value);
                    }
                  }}
                  placeholder="Contoh: RRN-9921 / 4 digit akhir transaksi"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 font-mono text-xs outline-none focus:border-blue-500"
                />
              </div>

              {/* Tombol Aksi */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCloseQrisModal}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleConfirmQrisPayment}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Konfirmasi Diterima</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
