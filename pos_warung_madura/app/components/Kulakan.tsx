import React, { useState, useEffect, useRef } from "react";
import {
  Truck,
  PackagePlus,
  Barcode,
  CheckCircle2,
  Check,
  Smartphone,
  Search,
  Building2,
  Info,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  FileText,
  ChevronRight,
  X,
  Phone,
  MapPin,
  RefreshCw,
  Eye,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type {
  Product,
  ProductUnit,
  StockMovement,
  Supplier,
  PurchaseRecord,
  PurchaseItemInput,
} from "../types/pos";

interface KulakanProps {
  products: Product[];
  stockMovements: StockMovement[];
  onAddStockMovement: (
    productId: string,
    unit: ProductUnit,
    unitQty: number,
    costPrice: number,
    supplier: string,
    batchNo?: string,
    expiryDate?: string | null
  ) => void;
  onRefreshData?: () => void;
  quickScanTriggerBarcode?: string | null;
  onClearQuickScanTrigger?: () => void;
  onRequestUnknownBarcode?: (barcode: string) => void;
  onOpenPhoneModal?: () => void;
  isPhoneConnected?: boolean;
}

const QUICK_QTY_BUTTONS = [1, 5, 10, 20, 24, 40];

function generateDefaultInvoiceNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `PB-${yyyy}${mm}${dd}-${rand}`;
}

function generateDefaultBatchNumber(): string {
  const d = new Date();
  const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `B-${yyyymmdd}-${rand}`;
}

export const Kulakan: React.FC<KulakanProps> = ({
  products,
  stockMovements,
  onAddStockMovement,
  onRefreshData,
  quickScanTriggerBarcode,
  onClearQuickScanTrigger,
  onRequestUnknownBarcode,
  onOpenPhoneModal,
  isPhoneConnected = false,
}) => {
  // Navigation Tab: 'faktur' (Multi-item purchase), 'cepat' (Single item), 'supplier' (Master Supplier), 'riwayat' (Purchases history), 'mutasi' (Stock movements)
  const [activeTab, setActiveTab] = useState<"faktur" | "cepat" | "supplier" | "riwayat" | "mutasi">("faktur");

  // Suppliers & Purchases state from API
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState<boolean>(false);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState<boolean>(false);
  const [notification, setNotification] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [scanFeedback, setScanFeedback] = useState<string>("");

  // ==========================================================================
  // TAB 1: FAKTUR KULAKAN MULTI-ITEM STATE (PRD F8.2 & F8.3)
  // ==========================================================================
  const [invoiceNumber, setInvoiceNumber] = useState<string>(generateDefaultInvoiceNumber);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial" | "unpaid">("paid");
  const [paymentMethod, setPaymentMethod] = useState<"Tunai" | "Transfer" | "Utang">("Tunai");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>("");
  const [invoiceNotes, setInvoiceNotes] = useState<string>("");
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [invoiceShippingCost, setInvoiceShippingCost] = useState<number>(0);
  const [invoiceItems, setInvoiceItems] = useState<PurchaseItemInput[]>([]);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState<boolean>(false);

  // Item Adder in Invoice Form
  const [itemProductId, setItemProductId] = useState<string>(products[0]?.id || "");
  const [itemUnitId, setItemUnitId] = useState<string>("");
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemCostPrice, setItemCostPrice] = useState<number>(0);
  const [itemBatchNo, setItemBatchNo] = useState<string>(generateDefaultBatchNumber);
  const [itemExpiryDate, setItemExpiryDate] = useState<string>("");
  const [itemHasExpiry, setItemHasExpiry] = useState<boolean>(false);
  const [invoiceBarcodeInput, setInvoiceBarcodeInput] = useState<string>("");

  // ==========================================================================
  // TAB 2: INPUT CEPAT 1 BARANG STATE (Existing quick restock)
  // ==========================================================================
  const [quickProductId, setQuickProductId] = useState<string>(products[0]?.id || "");
  const [quickUnitId, setQuickUnitId] = useState<string>("");
  const [quickQty, setQuickQty] = useState<number>(1);
  const [quickCostPrice, setQuickCostPrice] = useState<number>(0);
  const [quickSupplierName, setQuickSupplierName] = useState<string>("Agen Grosir Sembako");
  const [quickBatchNo, setQuickBatchNo] = useState<string>("");
  const [quickExpiryDate, setQuickExpiryDate] = useState<string>("");
  const [quickHasExpiry, setQuickHasExpiry] = useState<boolean>(false);
  const [quickBarcodeInput, setQuickBarcodeInput] = useState<string>("");

  // ==========================================================================
  // TAB 3: MASTER SUPPLIER MODAL STATE (PRD F8.1)
  // ==========================================================================
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierFormData, setSupplierFormData] = useState({
    name: "",
    phone: "",
    address: "",
    defaultPaymentTermDays: 0,
    notes: "",
  });
  const [isSavingSupplier, setIsSavingSupplier] = useState<boolean>(false);
  const [supplierSearchFilter, setSupplierSearchFilter] = useState<string>("");

  // ==========================================================================
  // TAB 4: RIWAYAT NOTA DETAIL MODAL STATE
  // ==========================================================================
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<PurchaseRecord | null>(null);
  const [purchaseSearchFilter, setPurchaseSearchFilter] = useState<string>("");

  // ==========================================================================
  // TAB 5: LEDGER MUTASI FILTER STATE
  // ==========================================================================
  const [ledgerSearchFilter, setLedgerSearchFilter] = useState<string>("");

  // Load suppliers and purchases from backend
  const fetchSuppliers = async () => {
    setIsLoadingSuppliers(true);
    try {
      const res = await fetch("/api/suppliers");
      const data = await res.json();
      if (data.ok && Array.isArray(data.suppliers)) {
        setSuppliers(data.suppliers);
        if (!selectedSupplierId && data.suppliers.length > 0) {
          setSelectedSupplierId(data.suppliers[0].id);
        }
      }
    } catch (err) {
      console.error("Gagal load suppliers:", err);
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  const fetchPurchases = async () => {
    setIsLoadingPurchases(true);
    try {
      const res = await fetch("/api/suppliers?type=purchases&limit=50");
      const data = await res.json();
      if (data.ok && Array.isArray(data.purchases)) {
        setPurchases(data.purchases);
      }
    } catch (err) {
      console.error("Gagal load purchases:", err);
    } finally {
      setIsLoadingPurchases(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchPurchases();
  }, []);

  // Sync selected supplier payment term to due date
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId) || suppliers[0];

  useEffect(() => {
    if (selectedSupplier && (paymentStatus === "unpaid" || paymentStatus === "partial")) {
      const termDays = selectedSupplier.defaultPaymentTermDays || 7;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + termDays);
      setDueDate(targetDate.toISOString().slice(0, 10));
    }
  }, [selectedSupplierId, paymentStatus]);

  // Active product & unit in Invoice Item Adder
  const currentInvoiceProduct = products.find((p) => p.id === itemProductId) || products[0];
  const activeInvoiceUnit =
    currentInvoiceProduct?.units.find((u) => u.id === itemUnitId) ||
    currentInvoiceProduct?.units[currentInvoiceProduct.units.length - 1] ||
    currentInvoiceProduct?.units[0];

  useEffect(() => {
    if (activeInvoiceUnit) {
      setItemCostPrice(activeInvoiceUnit.costPrice || 0);
    }
  }, [activeInvoiceUnit?.id]);

  // Active product & unit in Quick Single-Item Restock
  const currentQuickProduct = products.find((p) => p.id === quickProductId) || products[0];
  const activeQuickUnit =
    currentQuickProduct?.units.find((u) => u.id === quickUnitId) ||
    currentQuickProduct?.units[currentQuickProduct.units.length - 1] ||
    currentQuickProduct?.units[0];

  useEffect(() => {
    if (activeQuickUnit) {
      setQuickCostPrice(activeQuickUnit.costPrice || 0);
    }
  }, [activeQuickUnit?.id]);

  // Handle Barcode Scanner Lookup for Invoice
  const handleInvoiceBarcodeLookup = (barcode: string, isFromScanner = false) => {
    const clean = barcode.trim();
    if (!clean) return;

    for (const p of products) {
      const u = p.units.find((unit) => unit.barcode.toLowerCase() === clean.toLowerCase());
      if (u) {
        setItemProductId(p.id);
        setItemUnitId(u.id);
        setItemCostPrice(u.costPrice || 0);
        setItemQty(1);
        setItemBatchNo(generateDefaultBatchNumber());
        setScanFeedback(`📱 Scan: Terpilih ${p.name} [${u.unitName}]`);
        setInvoiceBarcodeInput("");
        setTimeout(() => setScanFeedback(""), 3500);
        return;
      }
    }

    if (onRequestUnknownBarcode) {
      onRequestUnknownBarcode(clean);
    } else {
      alert(`Barcode "${clean}" belum terdaftar! Silakan daftarkan di menu Master Barang.`);
    }
  };

  // Handle Quick Single-Item Barcode Lookup
  const handleQuickBarcodeLookup = (barcode: string, isFromScanner = false) => {
    const clean = barcode.trim();
    if (!clean) return;

    for (const p of products) {
      const u = p.units.find((unit) => unit.barcode.toLowerCase() === clean.toLowerCase());
      if (u) {
        setQuickProductId(p.id);
        setQuickUnitId(u.id);
        setQuickCostPrice(u.costPrice || 0);
        setQuickQty(1);
        setScanFeedback(`📱 Scan Cepat: Terpilih ${p.name} [${u.unitName}]`);
        setQuickBarcodeInput("");
        setTimeout(() => setScanFeedback(""), 3500);
        return;
      }
    }

    if (onRequestUnknownBarcode) {
      onRequestUnknownBarcode(clean);
    } else {
      alert(`Barcode "${clean}" belum terdaftar!`);
    }
  };

  // Reaktif terhadap trigger scan dari HP via WebSocket (F12)
  useEffect(() => {
    if (!quickScanTriggerBarcode) return;
    if (activeTab === "faktur") {
      handleInvoiceBarcodeLookup(quickScanTriggerBarcode, true);
    } else if (activeTab === "cepat") {
      handleQuickBarcodeLookup(quickScanTriggerBarcode, true);
    }
    onClearQuickScanTrigger?.();
  }, [quickScanTriggerBarcode, activeTab]);

  // ==========================================================================
  // HPP MOVING AVERAGE LIVE SIMULATION (PRD F8.3)
  // Acceptance criteria: Kulakan 24 pcs @ Rp2.000 saat stok 6 pcs dengan HPP Rp2.200
  // menghasilkan HPP rata-rata baru Rp2.040 dan stok 30.
  // ==========================================================================
  const calculateMovingAverageSimulation = (
    product: Product | undefined,
    unit: ProductUnit | undefined,
    qty: number,
    cost: number
  ) => {
    if (!product || !unit) return null;
    const baseUnit = product.units.find((u) => u.isBaseUnit) || product.units[0];
    const currentStockBase = product.stockInBaseUnit || 0;
    const currentBaseCost = baseUnit?.costPrice || 0;

    const incomingBaseQty = qty * unit.conversionRatio;
    const incomingBaseCost = unit.conversionRatio > 0 ? cost / unit.conversionRatio : cost;

    const totalStockBase = currentStockBase + incomingBaseQty;
    let newBaseCost = incomingBaseCost;

    if (currentStockBase > 0 && currentBaseCost > 0 && totalStockBase > 0) {
      newBaseCost =
        (currentStockBase * currentBaseCost + incomingBaseQty * incomingBaseCost) / totalStockBase;
    }
    newBaseCost = Math.round(newBaseCost * 100) / 100;

    return {
      currentStockBase,
      currentBaseCost,
      incomingBaseQty,
      incomingBaseCost,
      totalStockBase,
      newBaseCost,
      baseUnitName: product.baseUnit,
      diff: newBaseCost - currentBaseCost,
    };
  };

  const invoiceItemSim = calculateMovingAverageSimulation(
    currentInvoiceProduct,
    activeInvoiceUnit,
    itemQty,
    itemCostPrice
  );

  const quickItemSim = calculateMovingAverageSimulation(
    currentQuickProduct,
    activeQuickUnit,
    quickQty,
    quickCostPrice
  );

  // ==========================================================================
  // ADD ITEM TO INVOICE CART
  // ==========================================================================
  const handleAddItemToInvoice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentInvoiceProduct || !activeInvoiceUnit || itemQty <= 0) return;

    const subtotal = itemQty * itemCostPrice;
    const newItem: PurchaseItemInput = {
      productId: currentInvoiceProduct.id,
      productName: currentInvoiceProduct.name,
      unitId: activeInvoiceUnit.id,
      unitName: activeInvoiceUnit.unitName,
      quantity: itemQty,
      conversionRatio: activeInvoiceUnit.conversionRatio,
      costPrice: itemCostPrice,
      subtotal,
      batchNo: itemBatchNo.trim() || generateDefaultBatchNumber(),
      expiryDate: itemHasExpiry && itemExpiryDate ? itemExpiryDate : null,
    };

    setInvoiceItems((prev) => [...prev, newItem]);
    setNotification(
      `Ditambahkan: ${itemQty} ${activeInvoiceUnit.unitName} ${currentInvoiceProduct.name} ke nota!`
    );
    setTimeout(() => setNotification(""), 3500);

    // Reset item adder inputs
    setItemQty(1);
    setItemBatchNo(generateDefaultBatchNumber());
    setItemExpiryDate("");
    setItemHasExpiry(false);
  };

  const handleRemoveInvoiceItem = (index: number) => {
    setInvoiceItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculate Invoice Totals
  const invoiceSubtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
  const invoiceGrandTotal = Math.max(0, invoiceSubtotal - invoiceDiscount + invoiceShippingCost);
  const remainingDebt = Math.max(0, invoiceGrandTotal - paidAmount);

  // Auto-sync paidAmount when payment status changes
  useEffect(() => {
    if (paymentStatus === "paid") {
      setPaidAmount(invoiceGrandTotal);
      setPaymentMethod("Tunai");
    } else if (paymentStatus === "unpaid") {
      setPaidAmount(0);
      setPaymentMethod("Utang");
    } else if (paymentStatus === "partial") {
      if (paidAmount >= invoiceGrandTotal) {
        setPaidAmount(Math.round(invoiceGrandTotal / 2));
      }
      setPaymentMethod("Tunai");
    }
  }, [paymentStatus, invoiceGrandTotal]);

  // ==========================================================================
  // SUBMIT FAKTUR KULAKAN (PRD F8.2 & F8.3)
  // ==========================================================================
  const handleSubmitPurchaseInvoice = async () => {
    if (!invoiceNumber.trim()) {
      alert("Mohon masukkan nomor faktur kulakan.");
      return;
    }
    if (!selectedSupplier) {
      alert("Mohon pilih supplier terlebih dahulu.");
      return;
    }
    if (invoiceItems.length === 0) {
      alert("Nota kulakan masih kosong! Masukkan minimal 1 barang belanja.");
      return;
    }

    setIsSubmittingInvoice(true);
    setErrorMessage("");

    try {
      const payload = {
        action: "create_purchase",
        purchase: {
          invoiceNumber: invoiceNumber.trim(),
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
          purchaseDate: purchaseDate || new Date().toISOString().slice(0, 10),
          subtotal: invoiceSubtotal,
          discount: invoiceDiscount,
          shippingCost: invoiceShippingCost,
          totalAmount: invoiceGrandTotal,
          paidAmount: paymentStatus === "paid" ? invoiceGrandTotal : paidAmount,
          paymentMethod: paymentMethod,
          paymentStatus: paymentStatus,
          dueDate: (paymentStatus === "unpaid" || paymentStatus === "partial") && dueDate ? dueDate : null,
          notes: invoiceNotes.trim() || null,
          createdBy: "Kasir",
          items: invoiceItems,
        },
      };

      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal membukukan faktur kulakan");
      }

      setNotification(
        `Nota Kulakan ${invoiceNumber} berhasil dibukukan! Stok barang bertambah dan HPP Moving Average diperbarui.`
      );
      setTimeout(() => setNotification(""), 6000);

      // Reset form
      setInvoiceItems([]);
      setInvoiceNumber(generateDefaultInvoiceNumber());
      setInvoiceDiscount(0);
      setInvoiceShippingCost(0);
      setInvoiceNotes("");
      setPaymentStatus("paid");
      setPaidAmount(0);

      // Refresh data
      await Promise.all([fetchSuppliers(), fetchPurchases()]);
      onRefreshData?.();
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat menyimpan faktur");
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  // Shortcut Keyboard Ctrl+Enter untuk submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (activeTab === "faktur") {
          handleSubmitPurchaseInvoice();
        } else if (activeTab === "cepat") {
          handleQuickSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeTab,
    invoiceNumber,
    selectedSupplier,
    invoiceItems,
    invoiceSubtotal,
    invoiceGrandTotal,
    paidAmount,
    paymentStatus,
    paymentMethod,
    dueDate,
    invoiceNotes,
    currentQuickProduct,
    activeQuickUnit,
    quickQty,
    quickCostPrice,
    quickSupplierName,
    quickBatchNo,
    quickExpiryDate,
    quickHasExpiry,
  ]);

  // ==========================================================================
  // QUICK SINGLE-ITEM RESTOCK SUBMIT
  // ==========================================================================
  const handleQuickSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentQuickProduct || !activeQuickUnit || quickQty <= 0) return;

    onAddStockMovement(
      currentQuickProduct.id,
      activeQuickUnit,
      quickQty,
      quickCostPrice,
      quickSupplierName,
      quickBatchNo.trim() || undefined,
      quickHasExpiry && quickExpiryDate ? quickExpiryDate : null
    );

    const totalAdded = quickQty * activeQuickUnit.conversionRatio;
    setNotification(
      `Sukses mencatat ${quickQty} ${activeQuickUnit.unitName} (+${totalAdded} ${currentQuickProduct.baseUnit}) ke ledger stok!`
    );
    setTimeout(() => setNotification(""), 4500);

    setQuickQty(1);
    setQuickBatchNo("");
    setQuickExpiryDate("");
    setQuickHasExpiry(false);
    onRefreshData?.();
  };

  // ==========================================================================
  // SUPPLIER CRUD HANDLERS (PRD F8.1)
  // ==========================================================================
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierFormData({
      name: "",
      phone: "",
      address: "",
      defaultPaymentTermDays: 7,
      notes: "",
    });
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupplierFormData({
      name: sup.name,
      phone: sup.phone || "",
      address: sup.address || "",
      defaultPaymentTermDays: sup.defaultPaymentTermDays || 0,
      notes: sup.notes || "",
    });
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierFormData.name.trim()) {
      alert("Nama supplier wajib diisi");
      return;
    }

    setIsSavingSupplier(true);
    try {
      const isEdit = !!editingSupplier;
      const payload = isEdit
        ? {
            action: "update_supplier",
            id: editingSupplier.id,
            ...supplierFormData,
          }
        : {
            action: "create_supplier",
            ...supplierFormData,
          };

      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal menyimpan supplier");
      }

      setNotification(isEdit ? "Supplier berhasil diperbarui!" : "Supplier baru berhasil ditambahkan!");
      setTimeout(() => setNotification(""), 4000);
      setIsSupplierModalOpen(false);
      await fetchSuppliers();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan");
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (sup: Supplier) => {
    if (!confirm(`Nonaktifkan supplier "${sup.name}"?`)) return;
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_supplier", id: sup.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotification(`Supplier ${sup.name} telah dinonaktifkan.`);
        setTimeout(() => setNotification(""), 4000);
        await fetchSuppliers();
      }
    } catch (err) {
      alert("Gagal menonaktifkan supplier");
    }
  };

  // Filtered Suppliers for Tab 3
  const filteredSuppliers = suppliers.filter((s) => {
    if (!supplierSearchFilter.trim()) return true;
    const q = supplierSearchFilter.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  });

  const totalOutstandingDebtAllSuppliers = suppliers.reduce((sum, s) => sum + (s.totalDebt || 0), 0);

  // Filtered Purchases for Tab 4
  const filteredPurchases = purchases.filter((p) => {
    if (!purchaseSearchFilter.trim()) return true;
    const q = purchaseSearchFilter.toLowerCase();
    return (
      p.invoiceNumber.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q) ||
      p.paymentStatus.toLowerCase().includes(q)
    );
  });

  // Filtered Stock Movements for Tab 5
  const filteredMovements = stockMovements.filter((mov) => {
    if (!ledgerSearchFilter.trim()) return true;
    const q = ledgerSearchFilter.toLowerCase();
    return (
      mov.productName.toLowerCase().includes(q) ||
      mov.notes?.toLowerCase().includes(q) ||
      mov.unitNameUsed?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* ==================================================================== */}
      {/* HEADER SECTION & SCANNER STATUS */}
      {/* ==================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Supplier & Kulakan Barang
            </h2>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              PRD F8.1–F8.3 Aktif
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              Moving Average HPP
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Input faktur kulakan multi-item, otomatis update stok & HPP rata-rata bergerak, serta kelola utang tempo supplier.
          </p>
        </div>

        {/* Status Scanner HP & Reload */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchSuppliers();
              fetchPurchases();
              onRefreshData?.();
            }}
            title="Muat Ulang Data"
            className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isPhoneConnected ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>HP Scanner Terhubung</span>
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

      {/* Realtime Scan Toast Feedback */}
      {scanFeedback && (
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-between shadow-lg border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{scanFeedback}</span>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
            WebSocket Scanner
          </span>
        </div>
      )}

      {/* Success Notification */}
      {notification && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB NAVIGATION BAR */}
      {/* ==================================================================== */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("faktur")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer whitespace-nowrap ${
            activeTab === "faktur"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
          }`}
        >
          <PackagePlus className="w-4 h-4 text-emerald-400" />
          <span>Faktur Kulakan Baru (Multi-Item)</span>
          {invoiceItems.length > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
              {invoiceItems.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("cepat")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer whitespace-nowrap ${
            activeTab === "cepat"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
          }`}
        >
          <Barcode className="w-4 h-4 text-amber-400" />
          <span>Input Cepat 1 Barang</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("supplier")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer whitespace-nowrap ${
            activeTab === "supplier"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
          }`}
        >
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span>Master Supplier</span>
          <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {suppliers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("riwayat")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer whitespace-nowrap ${
            activeTab === "riwayat"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
          }`}
        >
          <FileText className="w-4 h-4 text-sky-400" />
          <span>Riwayat Nota Kulakan</span>
          <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {purchases.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("mutasi")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer whitespace-nowrap ${
            activeTab === "mutasi"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
          }`}
        >
          <Truck className="w-4 h-4 text-purple-400" />
          <span>Ledger Mutasi Masuk</span>
          <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {stockMovements.length}
          </span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: FAKTUR KULAKAN BARU (MULTI-ITEM) */}
      {/* ==================================================================== */}
      {activeTab === "faktur" && (
        <div className="space-y-5">
          {/* Header Nota Information Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <span>Informasi Faktur & Supplier</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Shortcut Simpan: Ctrl+Enter</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* No Faktur */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Faktur / Nota
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="PB-20261013-001"
                />
              </div>

              {/* Tanggal Kulakan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Pembelian
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Pilih Supplier */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                  <label>Pilih Supplier</label>
                  <button
                    type="button"
                    onClick={handleOpenAddSupplier}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Supplier Baru</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.phone ? `(${s.phone})` : ""} - Tempo {s.defaultPaymentTermDays || 0} Hari
                        {s.totalDebt && s.totalDebt > 0 ? ` [Utang: Rp ${s.totalDebt.toLocaleString("id-ID")}]` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedSupplier && (
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <span>Termin Default: <strong>{selectedSupplier.defaultPaymentTermDays || 0} hari</strong></span>
                    {selectedSupplier.totalDebt && selectedSupplier.totalDebt > 0 ? (
                      <span className="text-rose-600 font-semibold">
                        &bull; Total Utang Berjalan: Rp {selectedSupplier.totalDebt.toLocaleString("id-ID")}
                      </span>
                    ) : null}
                  </p>
                )}
              </div>
            </div>

            {/* Status Pembayaran & Termin */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Pembayaran
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("paid")}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      paymentStatus === "paid"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Lunas
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("unpaid")}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      paymentStatus === "unpaid"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Utang / Tempo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("partial")}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      paymentStatus === "partial"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    DP / Sebagian
                  </button>
                </div>
              </div>

              {/* Metode Pembayaran */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Metode Bayar
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="Tunai">Tunai / Cash</option>
                  <option value="Transfer">Transfer Bank</option>
                  <option value="Utang">Utang Dagang (Tempo)</option>
                </select>
              </div>

              {/* Bayar DP jika Partial */}
              {paymentStatus === "partial" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Bayar (DP)
                  </label>
                  <div className="relative">
                    <span className="text-xs text-slate-400 absolute left-3 top-2 font-mono">Rp</span>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* Tanggal Jatuh Tempo jika Utang / Partial */}
              {(paymentStatus === "unpaid" || paymentStatus === "partial") && (
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Jatuh Tempo Pembayaran</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs font-mono text-amber-900 focus:bg-white focus:outline-none"
                  />
                </div>
              )}

              {/* Catatan Nota */}
              <div className={paymentStatus === "paid" ? "md:col-span-2" : "md:col-span-1"}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Faktur (Opsional)
                </label>
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="Misal: Kulakan mingguan rokok & sembako"
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Form Tambah Item Belanja ke Nota */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Item Adder Input (5 Cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <PackagePlus className="w-4 h-4 text-emerald-600" />
                  <span>Tambah Barang ke Nota</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">Scan Barcode / Cari</span>
              </div>

              {/* Barcode Search Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scan Barcode Dus / Produk
                </label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={invoiceBarcodeInput}
                    onChange={(e) => setInvoiceBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleInvoiceBarcodeLookup(invoiceBarcodeInput);
                      }
                    }}
                    placeholder="Scan barcode dus/pack dari HP atau ketik..."
                    className="w-full pl-9 pr-16 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleInvoiceBarcodeLookup(invoiceBarcodeInput)}
                    className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cari
                  </button>
                </div>
              </div>

              {/* Pilih Produk */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Produk</label>
                <select
                  value={itemProductId}
                  onChange={(e) => {
                    setItemProductId(e.target.value);
                    const prod = products.find((p) => p.id === e.target.value);
                    if (prod && prod.units.length > 0) {
                      setItemUnitId(prod.units[prod.units.length - 1].id);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category}) - Stok: {p.stockInBaseUnit} {p.baseUnit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pilih Satuan Kemasan & Konversi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kemasan Satuan Kulakan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {currentInvoiceProduct?.units.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setItemUnitId(u.id);
                        setItemCostPrice(u.costPrice || 0);
                      }}
                      className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                        activeInvoiceUnit?.id === u.id
                          ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{u.unitName}</span>
                        {activeInvoiceUnit?.id === u.id && (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        1 {u.unitName} = {u.conversionRatio} {currentInvoiceProduct.baseUnit}
                      </div>
                      <div className="text-[11px] font-mono font-semibold text-emerald-700 mt-1">
                        HPP: Rp {(u.costPrice || 0).toLocaleString("id-ID")}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Jumlah Qty & Harga Beli */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah ({activeInvoiceUnit?.unitName || "Unit"})
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={itemQty}
                    onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  {/* Quick Qty Buttons */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {QUICK_QTY_BUTTONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setItemQty(q)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono transition cursor-pointer ${
                          itemQty === q
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        +{q}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Beli per {activeInvoiceUnit?.unitName || "Unit"}
                  </label>
                  <div className="relative">
                    <span className="text-xs text-slate-400 absolute left-3 top-2 font-mono">Rp</span>
                    <input
                      type="number"
                      value={itemCostPrice}
                      onChange={(e) => setItemCostPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-8 pr-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Subtotal: Rp {(itemQty * itemCostPrice).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Batch No & Tanggal Kedaluwarsa (FEFO) */}
              <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="itemHasExpiry"
                      checked={itemHasExpiry}
                      onChange={(e) => setItemHasExpiry(e.target.checked)}
                      className="w-3.5 h-3.5 text-amber-600 rounded-sm cursor-pointer"
                    />
                    <label htmlFor="itemHasExpiry" className="text-xs font-semibold text-amber-900 cursor-pointer">
                      Ada Kedaluwarsa (Exp Date)
                    </label>
                  </div>
                  <span className="text-[10px] text-amber-700 font-mono font-semibold">PRD F7.2 FEFO</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-amber-800 block mb-0.5">
                      Nomor Batch
                    </label>
                    <input
                      type="text"
                      value={itemBatchNo}
                      onChange={(e) => setItemBatchNo(e.target.value)}
                      placeholder="B-20261013-001"
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-amber-200 text-xs font-mono text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-amber-800 block mb-0.5">
                      Exp Date
                    </label>
                    <input
                      type="date"
                      disabled={!itemHasExpiry}
                      value={itemExpiryDate}
                      onChange={(e) => setItemExpiryDate(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl border text-xs font-mono transition focus:outline-none ${
                        itemHasExpiry
                          ? "bg-white border-amber-200 text-slate-800"
                          : "bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* LIVE MOVING AVERAGE HPP SIMULATION CARD (PRD F8.3) */}
              {invoiceItemSim && (
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs space-y-2">
                  <div className="flex items-center justify-between text-blue-900 font-bold">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                      <span>Simulasi HPP Moving Average (F8.3)</span>
                    </span>
                    <span className="text-[10px] bg-blue-200/70 text-blue-800 px-2 py-0.5 rounded-md font-mono">
                      Realtime Formula
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Stok Awal:</span>
                      <span className="font-mono">
                        {invoiceItemSim.currentStockBase} {invoiceItemSim.baseUnitName} @ Rp {invoiceItemSim.currentBaseCost.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Masuk dari Nota:</span>
                      <span className="font-mono text-emerald-700 font-semibold">
                        +{invoiceItemSim.incomingBaseQty} {invoiceItemSim.baseUnitName} @ Rp {Math.round(invoiceItemSim.incomingBaseCost).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-blue-200/60 font-bold text-blue-950">
                      <span>Estimasi HPP Rata-Rata Baru:</span>
                      <span className="font-mono text-sm text-blue-800">
                        Rp {invoiceItemSim.newBaseCost.toLocaleString("id-ID")} / {invoiceItemSim.baseUnitName}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 italic">
                      Total stok pasca simpan: {invoiceItemSim.totalStockBase} {invoiceItemSim.baseUnitName}
                    </div>
                  </div>
                </div>
              )}

              {/* Button Tambahkan ke Nota */}
              <button
                type="button"
                onClick={() => handleAddItemToInvoice()}
                className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
              >
                <Plus className="w-4 h-4" />
                <span>Tambahkan ke Nota Kulakan</span>
              </button>
            </div>

            {/* Right: Items in Invoice Cart Table & Summary (7 Cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <Truck className="w-4 h-4 text-slate-700" />
                    <span>Daftar Barang Belanja ({invoiceItems.length} Macam)</span>
                  </h3>
                  {invoiceItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setInvoiceItems([])}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                    >
                      Kosongkan Nota
                    </button>
                  )}
                </div>

                {/* Items Table */}
                <div className="mt-3 overflow-x-auto max-h-[42vh] overflow-y-auto pr-1">
                  {invoiceItems.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 space-y-2">
                      <PackagePlus className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs">Nota kulakan masih kosong.</p>
                      <p className="text-[11px] text-slate-400">
                        Gunakan form di sebelah kiri atau scan barcode dus untuk menambahkan item belanja.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                          <th className="pb-2">Barang</th>
                          <th className="pb-2 text-center">Satuan</th>
                          <th className="pb-2 text-center">Qty</th>
                          <th className="pb-2 text-right">Harga Beli</th>
                          <th className="pb-2 text-right">Subtotal</th>
                          <th className="pb-2 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoiceItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 font-semibold text-slate-900">
                              <div>{item.productName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Batch: {item.batchNo} {item.expiryDate ? `&bull; Exp: ${item.expiryDate}` : ""}
                              </div>
                            </td>
                            <td className="py-2.5 text-center">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-mono text-[11px] text-slate-700">
                                {item.unitName}
                              </span>
                            </td>
                            <td className="py-2.5 text-center font-mono font-bold text-slate-800">
                              {item.quantity}
                              <span className="text-[10px] text-slate-400 block font-normal">
                                (+{item.quantity * item.conversionRatio})
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-mono text-slate-700">
                              Rp {item.costPrice.toLocaleString("id-ID")}
                            </td>
                            <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                              Rp {item.subtotal.toLocaleString("id-ID")}
                            </td>
                            <td className="py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveInvoiceItem(idx)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                title="Hapus item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Ringkasan & Kalkulasi Grand Total */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Subtotal Belanja</label>
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      Rp {invoiceSubtotal.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Diskon Nota (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={invoiceDiscount}
                      onChange={(e) => setInvoiceDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-2.5 py-1 rounded-xl bg-white border border-slate-200 font-mono text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Ongkir / Lainnya (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={invoiceShippingCost}
                      onChange={(e) => setInvoiceShippingCost(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-2.5 py-1 rounded-xl bg-white border border-slate-200 font-mono text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500">Grand Total Nota:</span>
                    <div className="font-mono font-black text-slate-900 text-lg">
                      Rp {invoiceGrandTotal.toLocaleString("id-ID")}
                    </div>
                  </div>

                  {paymentStatus !== "paid" && (
                    <div className="text-right">
                      <span className="text-amber-800 font-semibold">Sisa Utang Tempo:</span>
                      <div className="font-mono font-bold text-rose-600 text-sm">
                        Rp {remainingDebt.toLocaleString("id-ID")}
                      </div>
                      {dueDate && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Tempo: {dueDate}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Tombol Simpan Faktur Kulakan */}
                <button
                  type="button"
                  disabled={invoiceItems.length === 0 || isSubmittingInvoice}
                  onClick={handleSubmitPurchaseInvoice}
                  className={`w-full py-3 rounded-2xl text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md ${
                    invoiceItems.length === 0 || isSubmittingInvoice
                      ? "bg-slate-300 cursor-not-allowed opacity-60"
                      : "bg-slate-900 hover:bg-slate-800 cursor-pointer hover:shadow-lg active:scale-[0.99]"
                  }`}
                >
                  {isSubmittingInvoice ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Menyimpan ke Ledger & Update HPP...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Bukukan Faktur Kulakan (Ctrl+Enter)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: INPUT CEPAT 1 BARANG */}
      {/* ==================================================================== */}
      {activeTab === "cepat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <Barcode className="w-4 h-4 text-slate-700" />
                <span>Restock Cepat 1 Barang</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Shortcut: Ctrl+Enter</span>
            </div>

            <form onSubmit={handleQuickSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scan Barcode Dus / Produk
                </label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={quickBarcodeInput}
                    onChange={(e) => setQuickBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleQuickBarcodeLookup(quickBarcodeInput);
                      }
                    }}
                    placeholder="Scan barcode dus/pack dari HP atau ketik..."
                    className="w-full pl-9 pr-20 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickBarcodeLookup(quickBarcodeInput)}
                    className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cari
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Produk</label>
                <select
                  value={quickProductId}
                  onChange={(e) => {
                    setQuickProductId(e.target.value);
                    const prod = products.find((p) => p.id === e.target.value);
                    if (prod && prod.units.length > 0) {
                      setQuickUnitId(prod.units[prod.units.length - 1].id);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category}) - Stok: {p.stockInBaseUnit} {p.baseUnit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kemasan Masuk
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {currentQuickProduct?.units.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setQuickUnitId(u.id);
                        setQuickCostPrice(u.costPrice || 0);
                      }}
                      className={`p-2 rounded-2xl border text-left transition cursor-pointer ${
                        activeQuickUnit?.id === u.id
                          ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-slate-900">
                        <span>{u.unitName}</span>
                        {activeQuickUnit?.id === u.id && <Check className="w-3 h-3 text-emerald-600" />}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        1 {u.unitName} = {u.conversionRatio} {currentQuickProduct.baseUnit}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Qty ({activeQuickUnit?.unitName || "Unit"})
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quickQty}
                    onChange={(e) => setQuickQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Modal Beli
                  </label>
                  <div className="relative">
                    <span className="text-xs text-slate-400 absolute left-3 top-2 font-mono">Rp</span>
                    <input
                      type="number"
                      value={quickCostPrice}
                      onChange={(e) => setQuickCostPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-8 pr-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Supplier</label>
                <input
                  type="text"
                  value={quickSupplierName}
                  onChange={(e) => setQuickSupplierName(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Simulation HPP */}
              {quickItemSim && (
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-blue-900 font-bold">
                    <span>Estimasi HPP Bergerak</span>
                    <span className="font-mono text-sm text-blue-800">
                      Rp {quickItemSim.newBaseCost.toLocaleString("id-ID")} / {quickItemSim.baseUnitName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Stok lama: {quickItemSim.currentStockBase} @ Rp {quickItemSim.currentBaseCost.toLocaleString("id-ID")} + Masuk {quickItemSim.incomingBaseQty}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={products.length === 0 || !currentQuickProduct}
                className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Simpan ke Ledger Stok (Ctrl+Enter)</span>
              </button>
            </form>
          </div>

          {/* Mutasi Singkat */}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-xs pb-3 border-b border-slate-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-700" />
              <span>Mutasi Masuk Terbaru</span>
            </h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              {stockMovements.slice(0, 10).map((mov) => (
                <div
                  key={mov.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between"
                >
                  <div>
                    <h5 className="font-bold text-slate-900">{mov.productName}</h5>
                    <p className="text-[11px] text-slate-500">
                      {mov.unitQtyUsed} x {mov.unitNameUsed} &bull; {mov.notes || "Kulakan"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      +{mov.quantityInBaseUnit} Satuan Dasar
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: MASTER SUPPLIER (PRD F8.1) */}
      {/* ==================================================================== */}
      {activeTab === "supplier" && (
        <div className="space-y-5">
          {/* Stat Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-semibold block">Total Supplier Terdaftar</span>
                <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                  {suppliers.length}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-semibold block">Total Utang Berjalan (Tempo)</span>
                <span className="text-2xl font-black text-rose-600 font-mono mt-1 block">
                  Rp {totalOutstandingDebtAllSuppliers.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-semibold block">Aksi Master Supplier</span>
                <button
                  type="button"
                  onClick={handleOpenAddSupplier}
                  className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Supplier Baru</span>
                </button>
              </div>
            </div>
          </div>

          {/* Supplier Table & Search */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <span>Daftar Supplier Aktif</span>
              </h3>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={supplierSearchFilter}
                  onChange={(e) => setSupplierSearchFilter(e.target.value)}
                  placeholder="Cari nama, HP, alamat..."
                  className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="pb-2.5">Nama Supplier</th>
                    <th className="pb-2.5">Kontak / WhatsApp</th>
                    <th className="pb-2.5">Alamat</th>
                    <th className="pb-2.5 text-center">Termin Tempo</th>
                    <th className="pb-2.5 text-right">Utang Berjalan</th>
                    <th className="pb-2.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Tidak ada supplier yang cocok.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((sup) => (
                      <tr key={sup.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 font-bold text-slate-900">
                          <div>{sup.name}</div>
                          {sup.notes && (
                            <div className="text-[11px] text-slate-400 font-normal italic">
                              {sup.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-slate-700 font-mono">
                          {sup.phone ? (
                            <a
                              href={`https://wa.me/${sup.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{sup.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 text-slate-600 max-w-xs truncate">
                          {sup.address || "-"}
                        </td>
                        <td className="py-3 text-center">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 font-semibold text-slate-700">
                            {sup.defaultPaymentTermDays > 0
                              ? `${sup.defaultPaymentTermDays} Hari`
                              : "Tunai / Cash"}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {sup.totalDebt && sup.totalDebt > 0 ? (
                            <span className="font-mono font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
                              Rp {sup.totalDebt.toLocaleString("id-ID")}
                            </span>
                          ) : (
                            <span className="font-mono text-emerald-600 font-semibold">Lunas / Rp 0</span>
                          )}
                        </td>
                        <td className="py-3 text-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSupplier(sup)}
                            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSupplier(sup)}
                            className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: RIWAYAT NOTA KULAKAN */}
      {/* ==================================================================== */}
      {activeTab === "riwayat" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <span>Riwayat Faktur Nota Kulakan ({purchases.length} Transaksi)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Daftar nota belanja barang dagangan warung dari supplier
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={purchaseSearchFilter}
                onChange={(e) => setPurchaseSearchFilter(e.target.value)}
                placeholder="Cari nota, supplier..."
                className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="pb-2.5">No. Faktur</th>
                  <th className="pb-2.5">Tanggal</th>
                  <th className="pb-2.5">Supplier</th>
                  <th className="pb-2.5 text-center">Status Bayar</th>
                  <th className="pb-2.5 text-right">Total Belanja</th>
                  <th className="pb-2.5 text-right">Sisa Utang</th>
                  <th className="pb-2.5 text-center">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Belum ada faktur kulakan tercatat.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((pch) => (
                    <tr key={pch.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 font-mono font-bold text-slate-900">
                        {pch.invoiceNumber}
                      </td>
                      <td className="py-3 text-slate-600 font-mono">
                        {pch.purchaseDate}
                      </td>
                      <td className="py-3 font-semibold text-slate-800">
                        {pch.supplierName}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            pch.paymentStatus === "paid"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : pch.paymentStatus === "partial"
                              ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {pch.paymentStatus === "paid"
                            ? "LUNAS"
                            : pch.paymentStatus === "partial"
                            ? "DP / SEBAGIAN"
                            : "UTANG / TEMPO"}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-slate-900">
                        Rp {pch.totalAmount.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {pch.remainingDebt > 0 ? (
                          <span className="text-rose-600 font-bold">
                            Rp {pch.remainingDebt.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          <span className="text-emerald-600">Rp 0</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedPurchaseDetail(pch)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                          title="Lihat Detail Item"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: LEDGER MUTASI MASUK */}
      {/* ==================================================================== */}
      {activeTab === "mutasi" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-700" />
                <span>Ledger Riwayat Mutasi Stok Masuk</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Audit riwayat seluruh barang masuk ke sistem
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={ledgerSearchFilter}
                onChange={(e) => setLedgerSearchFilter(e.target.value)}
                placeholder="Cari mutasi..."
                className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none w-64"
              />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[68vh] overflow-y-auto pr-1">
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
      )}

      {/* ==================================================================== */}
      {/* MODAL: TAMBAH / EDIT SUPPLIER (PRD F8.1) */}
      {/* ==================================================================== */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>{editingSupplier ? "Edit Data Supplier" : "Tambah Supplier Baru"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Supplier / Agen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                  placeholder="Misal: Agen Sembako Madura Jaya"
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  value={supplierFormData.phone}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                  placeholder="081234567890"
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat / Pasar
                </label>
                <input
                  type="text"
                  value={supplierFormData.address}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                  placeholder="Pasar Induk Blok A No. 12"
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Termin Pembayaran Default (Hari Tempo)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={supplierFormData.defaultPaymentTermDays}
                    onChange={(e) =>
                      setSupplierFormData({
                        ...supplierFormData,
                        defaultPaymentTermDays: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-24 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">
                    Hari (0 = Bayar Tunai Langsung, 7 = Tempo Seminggu, dll.)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Tambahan
                </label>
                <input
                  type="text"
                  value={supplierFormData.notes}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, notes: e.target.value })}
                  placeholder="Sales pengiriman setiap hari Selasa & Jumat"
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="px-5 py-2 rounded-2xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer shadow-xs"
                >
                  {isSavingSupplier ? "Menyimpan..." : "Simpan Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DETAIL ITEM FAKTUR KULAKAN */}
      {/* ==================================================================== */}
      {selectedPurchaseDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Faktur #{selectedPurchaseDetail.invoiceNumber}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Supplier: <strong>{selectedPurchaseDetail.supplierName}</strong> &bull; {selectedPurchaseDetail.purchaseDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchaseDetail(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="pb-2">Barang</th>
                    <th className="pb-2 text-center">Satuan</th>
                    <th className="pb-2 text-center">Qty</th>
                    <th className="pb-2 text-right">Harga Beli</th>
                    <th className="pb-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPurchaseDetail.items?.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2.5 font-bold text-slate-900">
                        <div>{it.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Batch: {it.batchNo || "-"} {it.expiryDate ? `&bull; Exp: ${it.expiryDate}` : ""}
                        </div>
                      </td>
                      <td className="py-2.5 text-center font-mono text-slate-700">
                        {it.unitName}
                      </td>
                      <td className="py-2.5 text-center font-mono font-bold text-slate-800">
                        {it.quantity}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-700">
                        Rp {it.costPrice.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                        Rp {it.subtotal.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Status Pembayaran:</span>
                <span className="ml-2 font-bold uppercase text-slate-900">
                  {selectedPurchaseDetail.paymentStatus} ({selectedPurchaseDetail.paymentMethod})
                </span>
                {selectedPurchaseDetail.dueDate && (
                  <div className="text-[11px] text-amber-700">
                    Jatuh Tempo: {selectedPurchaseDetail.dueDate}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-slate-500">Total Transaksi:</span>
                <div className="font-mono font-black text-slate-900 text-sm">
                  Rp {selectedPurchaseDetail.totalAmount.toLocaleString("id-ID")}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPurchaseDetail(null)}
                className="px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
