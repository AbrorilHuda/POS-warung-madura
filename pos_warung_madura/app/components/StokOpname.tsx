import React, { useState, useEffect, useRef } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  Save,
  AlertTriangle,
  Calendar,
  Clock,
  Search,
  Barcode,
  ShoppingBag,
  Copy,
  Check,
  FileText,
  RefreshCw,
  Sliders,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  History,
  X,
  ShieldAlert,
} from "lucide-react";
import type {
  Product,
  StockOpnameItem,
  StockBatch,
  StockCardEntry,
  ReorderRecommendation,
  StockOpnameSessionRecord,
  StockAdjustmentReason,
} from "../types/pos";

interface StokOpnameProps {
  products: Product[];
  onApplyOpnameAdjustment: (items: StockOpnameItem[]) => void;
  onRefreshProducts?: () => void;
}

type TabType = "opname" | "fefo" | "reorder" | "adjustment" | "kartu_stok" | "min_stok";

export const StokOpname: React.FC<StokOpnameProps> = ({
  products,
  onApplyOpnameAdjustment,
  onRefreshProducts,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<TabType>("opname");

  // =========================================================================
  // STATE: TAB 1 - STOK OPNAME & SCANNER
  // =========================================================================
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [opnameBarcodeScan, setOpnameBarcodeScan] = useState<string>("");
  const [scanNotice, setScanNotice] = useState<string>("");
  const [physicalCounts, setPhysicalCounts] = useState<{ [productId: string]: number }>(() => {
    const initial: { [key: string]: number } = {};
    products.forEach((p) => {
      initial[p.id] = p.stockInBaseUnit;
    });
    return initial;
  });
  const [notes, setNotes] = useState<{ [productId: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showOpnameHistoryModal, setShowOpnameHistoryModal] = useState<boolean>(false);
  const [opnameHistory, setOpnameHistory] = useState<StockOpnameSessionRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Sync physical counts jika props products berubah
  useEffect(() => {
    setPhysicalCounts((prev) => {
      const updated = { ...prev };
      products.forEach((p) => {
        if (updated[p.id] === undefined) {
          updated[p.id] = p.stockInBaseUnit;
        }
      });
      return updated;
    });
  }, [products]);

  // Filter produk opname berdasarkan kategori
  const filteredOpnameProducts = products.filter((p) => {
    if (selectedCategory === "Semua") return true;
    return p.category === selectedCategory;
  });

  const handlePhysicalChange = (productId: string, val: number) => {
    setPhysicalCounts((prev) => ({
      ...prev,
      [productId]: Math.max(0, val),
    }));
  };

  const handleNotesChange = (productId: string, val: string) => {
    setNotes((prev) => ({
      ...prev,
      [productId]: val,
    }));
  };

  // Quick scanner barcode counting
  const handleBarcodeScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = opnameBarcodeScan.trim().toLowerCase();
    if (!clean) return;

    for (const p of products) {
      const matchedUnit = p.units.find((u) => u.barcode.toLowerCase() === clean);
      if (matchedUnit) {
        const addAmount = matchedUnit.conversionRatio || 1;
        setPhysicalCounts((prev) => {
          const current = prev[p.id] ?? p.stockInBaseUnit;
          const next = current + addAmount;
          return { ...prev, [p.id]: next };
        });
        setScanNotice(`📱 Scan +${addAmount} ${p.baseUnit} untuk ${p.name}`);
        setOpnameBarcodeScan("");
        setTimeout(() => setScanNotice(""), 3500);
        return;
      }
    }

    setScanNotice(`⚠️ Barcode "${clean}" tidak ditemukan di master barang.`);
    setTimeout(() => setScanNotice(""), 3500);
  };

  // Hitung selisih fisik & nilai rupiah
  const opnameItems: StockOpnameItem[] = filteredOpnameProducts.map((p) => {
    const physical = physicalCounts[p.id] ?? p.stockInBaseUnit;
    const baseUnitCost = p.units.find((u) => u.isBaseUnit)?.costPrice || p.units[0]?.costPrice || 0;
    const diff = physical - p.stockInBaseUnit;
    return {
      productId: p.id,
      productName: p.name,
      baseUnit: p.baseUnit,
      systemStock: p.stockInBaseUnit,
      physicalStock: physical,
      difference: diff,
      costPrice: baseUnitCost,
      financialDiff: diff * baseUnitCost,
      notes: notes[p.id] || "",
    };
  });

  const totalDifferences = opnameItems.filter((it) => it.difference !== 0);
  const totalFinancialDiscrepancy = opnameItems.reduce((sum, it) => sum + (it.financialDiff || 0), 0);

  const handleFinalizeOpname = async () => {
    const sessionCode = `OPN-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-4)}`;
    try {
      // Simpan via API dedicated agar financial discrepancy & audit log tersimpan lengkap
      await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "opname",
          sessionCode,
          items: opnameItems,
          categoryFilter: selectedCategory === "Semua" ? null : selectedCategory,
          approvedBy: "Pemilik",
          notes: `Stok Opname ${selectedCategory} oleh Pemilik`,
        }),
      });

      // Panggil callback parent untuk sinkronisasi state lokal
      onApplyOpnameAdjustment(opnameItems);

      setSuccessMessage(
        `Sukses merekonsiliasi stok! Disimpan ${totalDifferences.length} barang selisih (Total: Rp ${Math.round(totalFinancialDiscrepancy).toLocaleString("id-ID")}).`
      );
      const resetCounts: { [key: string]: number } = {};
      opnameItems.forEach((it) => {
        resetCounts[it.productId] = it.physicalStock;
      });
      setPhysicalCounts(resetCounts);
      setNotes({});
      setTimeout(() => setSuccessMessage(""), 4500);
    } catch (err: any) {
      alert("Gagal menyimpan opname: " + err.message);
    }
  };

  const loadOpnameHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/stock?action=opnames");
      const data = await res.json();
      if (data.ok) {
        setOpnameHistory(data.opnameHistory || []);
      }
    } catch (e) {
      console.warn("Gagal memuat histori opname:", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // =========================================================================
  // STATE: TAB 2 - BATCH & KEDALUWARSA (FEFO)
  // =========================================================================
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(false);
  const [batchStatusFilter, setBatchStatusFilter] = useState<string>("all");
  const [batchSearch, setBatchSearch] = useState<string>("");

  const loadBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const res = await fetch("/api/stock?action=batches");
      const data = await res.json();
      if (data.ok) {
        setBatches(data.batches || []);
      }
    } catch (e) {
      console.warn("Gagal memuat batch:", e);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "fefo") {
      loadBatches();
    }
  }, [activeSubTab]);

  const filteredBatches = batches.filter((b) => {
    if (batchStatusFilter !== "all" && b.expiryStatus !== batchStatusFilter) {
      return false;
    }
    if (!batchSearch.trim()) return true;
    const q = batchSearch.toLowerCase();
    return (
      b.batchNo.toLowerCase().includes(q) ||
      (b.productName && b.productName.toLowerCase().includes(q))
    );
  });

  const expiredCount = batches.filter((b) => b.expiryStatus === "expired").length;
  const warning7Count = batches.filter((b) => b.expiryStatus === "warning_7").length;
  const warning30Count = batches.filter((b) => b.expiryStatus === "warning_30").length;

  // =========================================================================
  // STATE: TAB 3 - REKOMENDASI KULAKAN
  // =========================================================================
  const [reorderList, setReorderList] = useState<ReorderRecommendation[]>([]);
  const [isLoadingReorder, setIsLoadingReorder] = useState<boolean>(false);
  const [reorderFilter, setReorderFilter] = useState<"all" | "critical" | "warning">("all");
  const [isCopiedWa, setIsCopiedWa] = useState<boolean>(false);

  const loadReorderRecommendations = async () => {
    setIsLoadingReorder(true);
    try {
      const res = await fetch("/api/stock?action=reorder");
      const data = await res.json();
      if (data.ok) {
        setReorderList(data.recommendations || []);
      }
    } catch (e) {
      console.warn("Gagal memuat rekomendasi kulakan:", e);
    } finally {
      setIsLoadingReorder(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "reorder") {
      loadReorderRecommendations();
    }
  }, [activeSubTab]);

  const filteredReorderList = reorderList.filter((item) => {
    if (reorderFilter === "critical") return item.urgency === "critical";
    if (reorderFilter === "warning") return item.urgency === "warning" || item.urgency === "critical";
    return true;
  });

  const handleCopyWhatsAppList = () => {
    const itemsToOrder = reorderList.filter((r) => r.suggestedOrderQty > 0);
    if (itemsToOrder.length === 0) {
      alert("Tidak ada item yang perlu dikulak saat ini.");
      return;
    }

    let text = `📦 *DAFTAR KULAKAN / BELANJA WARUNG*\n`;
    text += `Tanggal: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}\n`;
    text += `--------------------------------------\n`;

    let totalEst = 0;
    itemsToOrder.forEach((it, idx) => {
      const urgencyIcon = it.urgency === "critical" ? "🚨" : "⚠️";
      text += `${idx + 1}. ${urgencyIcon} *${it.productName}*\n`;
      text += `   - Pesan: *${it.suggestedOrderQty} ${it.baseUnit}* (Sisa stok: ${it.currentStock} ${it.baseUnit})\n`;
      if (it.lastCostPrice > 0) {
        text += `   - Estimasi: Rp ${(it.suggestedOrderQty * it.lastCostPrice).toLocaleString("id-ID")}\n`;
        totalEst += it.suggestedOrderQty * it.lastCostPrice;
      }
    });

    text += `--------------------------------------\n`;
    text += `*Total Estimasi Anggaran:* Rp ${Math.round(totalEst).toLocaleString("id-ID")}\n`;
    text += `_Dibuat otomatis oleh Sistem POS Warung Madura_`;

    navigator.clipboard.writeText(text);
    setIsCopiedWa(true);
    setTimeout(() => setIsCopiedWa(false), 3000);
  };

  // =========================================================================
  // STATE: TAB 4 - PENYESUAIAN STOK MANUAL
  // =========================================================================
  const [adjProductId, setAdjProductId] = useState<string>(products[0]?.id || "");
  const [adjActionType, setAdjActionType] = useState<"kurang" | "tambah">("kurang");
  const [adjQty, setAdjQty] = useState<number>(1);
  const [adjReason, setAdjReason] = useState<StockAdjustmentReason>("rusak");
  const [adjNotes, setAdjNotes] = useState<string>("");
  const [adjBatchId, setAdjBatchId] = useState<string>("");
  const [isSubmittingAdj, setIsSubmittingAdj] = useState<boolean>(false);
  const [adjSuccessMsg, setAdjSuccessMsg] = useState<string>("");

  const currentAdjProduct = products.find((p) => p.id === adjProductId) || products[0];

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjProductId || adjQty <= 0) return;

    setIsSubmittingAdj(true);
    try {
      const qtyDiff = adjActionType === "kurang" ? -adjQty : adjQty;
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual_adjustment",
          productId: adjProductId,
          qtyDiff,
          reasonCategory: adjReason,
          notes: adjNotes,
          batchId: adjBatchId || undefined,
          approvedBy: "Pemilik",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setAdjSuccessMsg(
        `Berhasil menyesuaikan stok ${currentAdjProduct?.name}: ${qtyDiff > 0 ? "+" : ""}${qtyDiff} ${currentAdjProduct?.baseUnit} (${adjReason})`
      );
      setAdjQty(1);
      setAdjNotes("");
      setAdjBatchId("");
      onRefreshProducts?.();
      setTimeout(() => setAdjSuccessMsg(""), 4000);
    } catch (err: any) {
      alert("Gagal melakukan penyesuaian: " + err.message);
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  // =========================================================================
  // STATE: TAB 5 - KARTU STOK (LEDGER MUTASI)
  // =========================================================================
  const [cardProductId, setCardProductId] = useState<string>(products[0]?.id || "");
  const [cardEntries, setCardEntries] = useState<StockCardEntry[]>([]);
  const [isLoadingCard, setIsLoadingCard] = useState<boolean>(false);

  const loadStockCard = async (prodId: string) => {
    if (!prodId) return;
    setIsLoadingCard(true);
    try {
      const res = await fetch(`/api/stock?action=stock_card&productId=${prodId}`);
      const data = await res.json();
      if (data.ok) {
        setCardEntries(data.cardEntries || []);
      }
    } catch (e) {
      console.warn("Gagal memuat kartu stok:", e);
    } finally {
      setIsLoadingCard(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "kartu_stok" && cardProductId) {
      loadStockCard(cardProductId);
    }
  }, [activeSubTab, cardProductId]);

  const currentCardProduct = products.find((p) => p.id === cardProductId) || products[0];

  // =========================================================================
  // STATE: TAB 6 - ALERT STOK MENIPIS
  // =========================================================================
  const lowStockProducts = products.filter((p) => p.stockInBaseUnit <= (p.minStockAlert || 5));

  return (
    <div className="p-6 space-y-6">
      {/* Header Hub Manajemen Stok */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Manajemen Stok Lanjutan
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Sistem terintegrasi: Opname scanner fisik, FEFO berbasis batch kedaluwarsa, rekomendasi kulakan cerdas, penyesuaian manual & kartu stok.
          </p>
        </div>

        {/* Action quick buttons */}
        <div className="flex items-center gap-2">
          {activeSubTab === "opname" && (
            <button
              onClick={() => {
                setShowOpnameHistoryModal(true);
                loadOpnameHistory();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Opname</span>
            </button>
          )}

          {activeSubTab === "reorder" && (
            <button
              onClick={handleCopyWhatsAppList}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              {isCopiedWa ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopiedWa ? "Tersalin ke WA!" : "Salin Daftar Kulakan (WA)"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl overflow-x-auto text-xs font-semibold select-none">
        <button
          onClick={() => setActiveSubTab("opname")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0 ${activeSubTab === "opname"
            ? "bg-white text-slate-900 shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
        >
          <ClipboardCheck className="w-4 h-4 text-indigo-600" />
          <span>1. Stok Opname & Scanner</span>
          {totalDifferences.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("fefo")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0 ${activeSubTab === "fefo"
            ? "bg-white text-slate-900 shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
        >
          <Calendar className="w-4 h-4 text-amber-600" />
          <span>2. Batch & Kedaluwarsa (FEFO)</span>
          {(expiredCount > 0 || warning7Count > 0) && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
              {expiredCount + warning7Count}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("reorder")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0 ${activeSubTab === "reorder"
            ? "bg-white text-slate-900 shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
        >
          <ShoppingBag className="w-4 h-4 text-emerald-600" />
          <span>3. Rekomendasi Kulakan</span>
        </button>

        <button
          onClick={() => setActiveSubTab("adjustment")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0 ${activeSubTab === "adjustment"
            ? "bg-white text-slate-900 shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
        >
          <Sliders className="w-4 h-4 text-rose-600" />
          <span>4. Penyesuaian Manual</span>
        </button>

        <button
          onClick={() => setActiveSubTab("kartu_stok")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0 ${activeSubTab === "kartu_stok"
            ? "bg-white text-slate-900 shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
        >
          <FileText className="w-4 h-4 text-sky-600" />
          <span>5. Kartu Stok Ledger</span>
        </button>

        <button
          onClick={() => setActiveSubTab("min_stok")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0 ${activeSubTab === "min_stok"
            ? "bg-white text-slate-900 shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>6. Alert Stok Menipis</span>
          {lowStockProducts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
              {lowStockProducts.length}
            </span>
          )}
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: STOK OPNAME & SCANNER BARCODE */}
      {/* =================================================================== */}
      {activeSubTab === "opname" && (
        <div className="space-y-5">
          {/* Barcode Quick Scanner Form & Filter Kategori */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <form onSubmit={handleBarcodeScanSubmit} className="flex-1 w-full flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Scan barcode kardus / bungkus untuk +1 hitungan fisik..."
                  value={opnameBarcodeScan}
                  onChange={(e) => setOpnameBarcodeScan(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer shrink-0"
              >
                Tambah
              </button>
            </form>

            {/* Filter Kategori */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-semibold text-slate-500 shrink-0">Kategori:</span>
              <div className="flex items-center gap-1">
                {["Semua", "Rokok", "Mie & Sembako", "Minuman Dingin", "Jajanan & Kopi", "Gas & Galon"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-xs px-2.5 py-1 rounded-xl transition cursor-pointer whitespace-nowrap ${selectedCategory === cat
                      ? "bg-slate-900 text-white font-semibold"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {scanNotice && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2 animate-fadeIn">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{scanNotice}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Metric Cards Opname */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">SKU Terjadwal</span>
              <p className="text-2xl font-bold text-slate-900 font-mono mt-1">
                {filteredOpnameProducts.length} <span className="text-xs font-sans text-slate-400">Barang</span>
              </p>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Stok Cocok</span>
              <p className="text-2xl font-bold text-emerald-600 font-mono mt-1">
                {opnameItems.filter((i) => i.difference === 0).length}{" "}
                <span className="text-xs font-sans text-emerald-500">Sesuai</span>
              </p>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Barang Selisih</span>
              <p className="text-2xl font-bold text-rose-600 font-mono mt-1">
                {totalDifferences.length} <span className="text-xs font-sans text-rose-400">Selisih</span>
              </p>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Selisih Nilai (HPP)</span>
              <p className={`text-xl font-bold font-mono mt-1 ${totalFinancialDiscrepancy < 0 ? "text-rose-600" : totalFinancialDiscrepancy > 0 ? "text-cyan-600" : "text-slate-900"}`}>
                Rp {Math.round(totalFinancialDiscrepancy).toLocaleString("id-ID")}
              </p>
            </div>
          </div>

          {/* Table Opname */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs overflow-x-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <span className="text-xs font-bold text-slate-800">
                Daftar Pengecekan Fisik ({filteredOpnameProducts.length} Produk)
              </span>
              {totalDifferences.length > 0 && (
                <button
                  onClick={handleFinalizeOpname}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Setujui & Simpan ({totalDifferences.length} Selisih)</span>
                </button>
              )}
            </div>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                  <th className="pb-3 pl-1">Produk & Satuan Dasar</th>
                  <th className="pb-3 text-center">Stok Sistem</th>
                  <th className="pb-3 text-center">Hitungan Fisik</th>
                  <th className="pb-3 text-center">Selisih Fisik</th>
                  <th className="pb-3 text-right">Selisih Nilai (HPP)</th>
                  <th className="pb-3 pl-4">Catatan / Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {opnameItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      Tidak ada produk dalam kategori yang dipilih.
                    </td>
                  </tr>
                ) : (
                  opnameItems.map((item) => {
                    const hasDiff = item.difference !== 0;
                    const isNegative = item.difference < 0;

                    return (
                      <tr key={item.productId} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 pl-1">
                          <span className="font-bold text-slate-900 text-xs block">{item.productName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Base: {item.baseUnit} | HPP: Rp {(item.costPrice || 0).toLocaleString("id-ID")}
                          </span>
                        </td>

                        <td className="py-3 text-center font-mono font-bold text-slate-700">
                          {item.systemStock} {item.baseUnit}
                        </td>

                        <td className="py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={item.physicalStock}
                            onChange={(e) =>
                              handlePhysicalChange(item.productId, parseInt(e.target.value) || 0)
                            }
                            className="w-20 text-center py-1.5 px-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </td>

                        <td className="py-3 text-center">
                          {!hasDiff ? (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Cocok
                            </span>
                          ) : isNegative ? (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-50 text-rose-700 font-mono border border-rose-200">
                              {item.difference} {item.baseUnit}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-cyan-50 text-cyan-700 font-mono border border-cyan-200">
                              +{item.difference} {item.baseUnit}
                            </span>
                          )}
                        </td>

                        <td className="py-3 text-right font-mono font-semibold">
                          {item.financialDiff === 0 ? (
                            <span className="text-slate-400">Rp 0</span>
                          ) : item.financialDiff! < 0 ? (
                            <span className="text-rose-600">
                              -Rp {Math.abs(Math.round(item.financialDiff!)).toLocaleString("id-ID")}
                            </span>
                          ) : (
                            <span className="text-cyan-600">
                              +Rp {Math.round(item.financialDiff!).toLocaleString("id-ID")}
                            </span>
                          )}
                        </td>

                        <td className="py-3 pl-4">
                          <input
                            type="text"
                            placeholder="Keterangan fisik..."
                            value={item.notes}
                            onChange={(e) => handleNotesChange(item.productId, e.target.value)}
                            className="w-full py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: BATCH & KEDALUWARSA (FEFO) */}
      {/* =================================================================== */}
      {activeSubTab === "fefo" && (
        <div className="space-y-5">
          {/* KPI Alerts Kedaluwarsa */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 shadow-xs">
              <span className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Expired (Kedaluwarsa)</span>
              </span>
              <p className="text-2xl font-bold text-rose-700 font-mono mt-1">
                {expiredCount} <span className="text-xs font-sans text-rose-500">Batch</span>
              </p>
            </div>

            <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 shadow-xs">
              <span className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Waspada H-7 Hari</span>
              </span>
              <p className="text-2xl font-bold text-amber-800 font-mono mt-1">
                {warning7Count} <span className="text-xs font-sans text-amber-600">Batch</span>
              </p>
            </div>

            <div className="p-4 rounded-3xl bg-yellow-50 border border-yellow-200 shadow-xs">
              <span className="text-xs text-yellow-800 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Waspada H-30 Hari</span>
              </span>
              <p className="text-2xl font-bold text-yellow-900 font-mono mt-1">
                {warning30Count} <span className="text-xs font-sans text-yellow-700">Batch</span>
              </p>
            </div>

            <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-xs">
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Batch Aman</span>
              </span>
              <p className="text-2xl font-bold text-emerald-800 font-mono mt-1">
                {batches.filter((b) => b.expiryStatus === "safe").length}{" "}
                <span className="text-xs font-sans text-emerald-600">Batch</span>
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nomor batch atau nama barang..."
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              <button
                onClick={() => setBatchStatusFilter("all")}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${batchStatusFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
              >
                Semua ({batches.length})
              </button>
              <button
                onClick={() => setBatchStatusFilter("expired")}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${batchStatusFilter === "expired" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
              >
                Expired ({expiredCount})
              </button>
              <button
                onClick={() => setBatchStatusFilter("warning_7")}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${batchStatusFilter === "warning_7" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                  }`}
              >
                H-7 ({warning7Count})
              </button>
              <button
                onClick={() => setBatchStatusFilter("warning_30")}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${batchStatusFilter === "warning_30" ? "bg-yellow-600 text-white" : "bg-yellow-50 text-yellow-900 hover:bg-yellow-100"
                  }`}
              >
                H-30 ({warning30Count})
              </button>
            </div>
          </div>

          {/* Batch Table */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs overflow-x-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800">
                  Antrean Batch FEFO (First Expired, First Out)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Batch dengan tanggal kedaluwarsa terdekat akan otomatis terpotong lebih dulu saat penjualan di kasir.
                </p>
              </div>
              <button
                onClick={loadBatches}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                title="Muat Ulang"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBatches ? "animate-spin" : ""}`} />
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                  <th className="pb-3 pl-1">No. Batch</th>
                  <th className="pb-3">Nama Produk</th>
                  <th className="pb-3 text-center">Sisa Stok</th>
                  <th className="pb-3 text-center">Tgl Kedaluwarsa</th>
                  <th className="pb-3 text-center">Sisa Hari</th>
                  <th className="pb-3 text-center">Status FEFO</th>
                  <th className="pb-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      {isLoadingBatches ? "Memuat data batch..." : "Tidak ada batch stok yang sesuai filter."}
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => {
                    const isExp = b.expiryStatus === "expired";
                    const isW7 = b.expiryStatus === "warning_7";
                    const isW30 = b.expiryStatus === "warning_30";

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 pl-1 font-mono font-bold text-slate-800">
                          {b.batchNo}
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-slate-900 block">{b.productName}</span>
                          <span className="text-[10px] text-slate-400">{b.category}</span>
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-slate-800">
                          {b.qtyBase} {b.baseUnit}
                        </td>
                        <td className="py-3 text-center font-mono text-slate-600">
                          {b.expiryDate ? b.expiryDate : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="py-3 text-center font-mono">
                          {b.daysUntilExpiry !== null && b.daysUntilExpiry !== undefined ? (
                            b.daysUntilExpiry < 0 ? (
                              <span className="text-rose-600 font-bold">Lewat {Math.abs(b.daysUntilExpiry)} hari</span>
                            ) : (
                              <span className={isW7 ? "text-amber-600 font-bold" : "text-slate-700"}>
                                {b.daysUntilExpiry} hari lagi
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">Tanpa Exp</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          {isExp ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              EXPIRED
                            </span>
                          ) : isW7 ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              H-7 Segera Jual
                            </span>
                          ) : isW30 ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                              H-30
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Aman
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-[11px] text-slate-500">
                          {b.notes || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: REKOMENDASI KULAKAN */}
      {/* =================================================================== */}
      {activeSubTab === "reorder" && (
        <div className="space-y-5">
          {/* Header Info */}
          <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-3xl flex items-start gap-3">
            <div className="p-2 rounded-2xl bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="text-xs text-emerald-950">
              <span className="font-bold block text-sm">Algoritma Rekomendasi Kulakan Otomatis</span>
              <p className="mt-0.5 text-emerald-800">
                Sistem menghitung rata-rata kecepatan penjualan (sales velocity) selama 30 hari terakhir, sisa stok riil, serta lead time pemesanan 7 hari untuk menghasilkan estimasi belanja yang optimal.
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setReorderFilter("all")}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${reorderFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
              >
                Semua Produk ({reorderList.length})
              </button>
              <button
                onClick={() => setReorderFilter("critical")}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${reorderFilter === "critical" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
              >
                🚨 Kritis Segera Kulak ({reorderList.filter((r) => r.urgency === "critical").length})
              </button>
              <button
                onClick={() => setReorderFilter("warning")}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${reorderFilter === "warning" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                  }`}
              >
                ⚠️ Waspada / Menipis ({reorderList.filter((r) => r.urgency === "warning" || r.urgency === "critical").length})
              </button>
            </div>

            <button
              onClick={loadReorderRecommendations}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition cursor-pointer"
              title="Perbarui Rekomendasi"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReorder ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Table Reorder */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                  <th className="pb-3 pl-1">Produk & Kategori</th>
                  <th className="pb-3 text-center">Stok Saat Ini</th>
                  <th className="pb-3 text-center">Rata2 Jual/Hari</th>
                  <th className="pb-3 text-center">Sisa Hari Habis</th>
                  <th className="pb-3 text-center">Rekomendasi Order</th>
                  <th className="pb-3 text-right">Estimasi Anggaran</th>
                  <th className="pb-3 text-center">Urgensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReorderList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      {isLoadingReorder ? "Menghitung kecepatan penjualan..." : "Tidak ada rekomendasi kulakan saat ini."}
                    </td>
                  </tr>
                ) : (
                  filteredReorderList.map((item) => (
                    <tr key={item.productId} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 pl-1">
                        <span className="font-bold text-slate-900 block">{item.productName}</span>
                        <span className="text-[10px] text-slate-400">{item.category} (Min: {item.minStock} {item.baseUnit})</span>
                      </td>

                      <td className="py-3 text-center font-mono font-bold text-slate-800">
                        {item.currentStock} {item.baseUnit}
                      </td>

                      <td className="py-3 text-center font-mono text-slate-700">
                        {item.avgDailySales} {item.baseUnit}/hari
                      </td>

                      <td className="py-3 text-center font-mono">
                        {item.daysOfStockLeft >= 999 ? (
                          <span className="text-slate-400">Stok Cukup</span>
                        ) : item.daysOfStockLeft <= 2 ? (
                          <span className="text-rose-600 font-bold">{item.daysOfStockLeft} hari lagi!</span>
                        ) : item.daysOfStockLeft <= 7 ? (
                          <span className="text-amber-600 font-bold">{item.daysOfStockLeft} hari</span>
                        ) : (
                          <span className="text-slate-600">{item.daysOfStockLeft} hari</span>
                        )}
                      </td>

                      <td className="py-3 text-center">
                        {item.suggestedOrderQty > 0 ? (
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            +{item.suggestedOrderQty} {item.baseUnit}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>

                      <td className="py-3 text-right font-mono font-semibold text-slate-800">
                        Rp {Math.round(item.estimatedTotalCost).toLocaleString("id-ID")}
                      </td>

                      <td className="py-3 text-center">
                        {item.urgency === "critical" ? (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            KRITIS
                          </span>
                        ) : item.urgency === "warning" ? (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            WASPADA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600">
                            NORMAL
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: PENYESUAIAN STOK MANUAL */}
      {/* =================================================================== */}
      {activeSubTab === "adjustment" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Penyesuaian */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Form Penyesuaian Stok Manual
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Semua penyesuaian wajib menyertakan alasan kategori dan akan tercatat permanen di jejak audit (Audit Log).
              </p>
            </div>

            {adjSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{adjSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAdjustment} className="space-y-4 text-xs">
              {/* Pilih Produk */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pilih Produk:</label>
                <select
                  value={adjProductId}
                  onChange={(e) => setAdjProductId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stok Saat Ini: {p.stockInBaseUnit} {p.baseUnit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipe Penyesuaian & Jumlah */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Aksi Penyesuaian:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjActionType("kurang")}
                      className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${adjActionType === "kurang"
                        ? "bg-rose-50 border-rose-300 text-rose-700 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                      <span>Kurangi Stok (-)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjActionType("tambah")}
                      className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${adjActionType === "tambah"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tambah Stok (+)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Jumlah Satuan ({currentAdjProduct?.baseUnit}):
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={adjQty}
                    onChange={(e) => setAdjQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Alasan Wajib (PRD F7.4) */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Alasan Penyesuaian <span className="text-rose-500">*Wajib</span>:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "rusak", label: "Rusak / Pecah / Bocor" },
                    { id: "kedaluwarsa", label: "Basi / Kedaluwarsa" },
                    { id: "hilang", label: "Hilang / Selisih Fisik" },
                    { id: "konsumsi_sendiri", label: "Konsumsi Sendiri / Toko" },
                    { id: "koreksi", label: "Koreksi Sistem Manual" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setAdjReason(r.id as StockAdjustmentReason)}
                      className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold text-left transition border cursor-pointer ${adjReason === r.id
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rincian Catatan */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Catatan Tambahan:</label>
                <input
                  type="text"
                  placeholder="Contoh: Pecah saat bongkar muatan kardus..."
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAdj}
                className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmittingAdj ? "Menyimpan..." : "Simpan Penyesuaian & Catat di Audit Log"}</span>
              </button>
            </form>
          </div>

          {/* Info Sidebox PRD Rule */}
          <div className="bg-slate-100/70 p-5 rounded-3xl border border-slate-200/80 space-y-3 text-xs text-slate-600">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Standar Keamanan Stok Warung</span>
            </h4>
            <p>
              Setiap kali Anda mengurangi stok karena <strong>rusak</strong>, <strong>basi/expired</strong>, <strong>hilang</strong>, atau <strong>konsumsi pribadi</strong>:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              <li>Nilai persediaan barang di neraca modal otomatis disesuaikan.</li>
              <li>Tercatat di menu Laporan Keuangan dan Audit Log dengan timestamp & nama akun penanggung jawab.</li>
              <li>Jika produk memiliki batch aktif, sistem otomatis memotong kuantiti batch terdekat.</li>
            </ul>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: KARTU STOK (LEDGER MUTASI) */}
      {/* =================================================================== */}
      {activeSubTab === "kartu_stok" && (
        <div className="space-y-5">
          {/* Pilih Produk */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-600 shrink-0">Pilih Produk:</span>
              <select
                value={cardProductId}
                onChange={(e) => setCardProductId(e.target.value)}
                className="px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Saldo Riil Saat Ini:</span>
              <span className="font-mono font-bold text-slate-900 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200">
                {currentCardProduct?.stockInBaseUnit} {currentCardProduct?.baseUnit}
              </span>
            </div>
          </div>

          {/* Table Kartu Stok */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs overflow-x-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Kartu Mutasi Stok: {currentCardProduct?.name}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Buku besar saldo berjalan (running balance) riil berdasarkan kronologis mutasi.
                </p>
              </div>
              <button
                onClick={() => loadStockCard(cardProductId)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                title="Muat Ulang"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCard ? "animate-spin" : ""}`} />
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                  <th className="pb-3 pl-1">Waktu Transaksi</th>
                  <th className="pb-3 text-center">Tipe Mutasi</th>
                  <th className="pb-3 text-center">Satuan Diinput</th>
                  <th className="pb-3 text-center">Kuantitas Base</th>
                  <th className="pb-3 text-center">Saldo Berjalan</th>
                  <th className="pb-3">Keterangan / Referensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cardEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      {isLoadingCard ? "Memuat mutasi..." : "Belum ada catatan mutasi untuk produk ini."}
                    </td>
                  </tr>
                ) : (
                  cardEntries.map((c) => {
                    const isPositive = c.qtyChange > 0;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 pl-1 font-mono text-slate-500 text-[11px]">
                          {c.date}
                        </td>

                        <td className="py-3 text-center">
                          {c.type === "in" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              KULAKAN MASUK
                            </span>
                          ) : c.type === "out" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                              PENJUALAN
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              PENYESUAIAN
                            </span>
                          )}
                        </td>

                        <td className="py-3 text-center font-mono text-slate-700">
                          {c.unitQtyUsed} {c.unitNameUsed}
                        </td>

                        <td className="py-3 text-center font-mono font-bold">
                          {isPositive ? (
                            <span className="text-emerald-600">+{c.qtyChange} {currentCardProduct?.baseUnit}</span>
                          ) : (
                            <span className="text-rose-600">{c.qtyChange} {currentCardProduct?.baseUnit}</span>
                          )}
                        </td>

                        <td className="py-3 text-center font-mono font-bold text-slate-900 bg-slate-50/50">
                          {c.runningBalance} {currentCardProduct?.baseUnit}
                        </td>

                        <td className="py-3 text-slate-600">
                          <span>{c.notes}</span>
                          {c.batchNo && (
                            <span className="block text-[10px] text-slate-400 font-mono">
                              Batch: {c.batchNo}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: ALERT STOK MENIPIS (STOK MINIMUM) */}
      {/* =================================================================== */}
      {activeSubTab === "min_stok" && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-3xl flex items-start gap-3">
            <div className="p-2 rounded-2xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-xs text-amber-950">
              <span className="font-bold block text-sm">Monitoring Stok Minimum Toko</span>
              <p className="mt-0.5 text-amber-800">
                Berikut adalah daftar barang yang stoknya sudah menyentuh atau di bawah batas minimum alert. Segera jadwalkan kulakan agar tidak kehabisan barang di etalase kasir.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                  <th className="pb-3 pl-1">Nama Produk</th>
                  <th className="pb-3">Kategori</th>
                  <th className="pb-3 text-center">Stok Saat Ini</th>
                  <th className="pb-3 text-center">Batas Minimum</th>
                  <th className="pb-3 text-center">Status Peringatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                      🎉 Semua barang aman! Tidak ada stok yang berada di bawah batas minimum saat ini.
                    </td>
                  </tr>
                ) : (
                  lowStockProducts.map((p) => {
                    const isOut = p.stockInBaseUnit <= 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 pl-1">
                          <span className="font-bold text-slate-900 block">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Base: {p.baseUnit}
                          </span>
                        </td>

                        <td className="py-3 text-slate-600">{p.category}</td>

                        <td className="py-3 text-center font-mono font-bold">
                          <span className={isOut ? "text-rose-600 font-bold" : "text-amber-600"}>
                            {p.stockInBaseUnit} {p.baseUnit}
                          </span>
                        </td>

                        <td className="py-3 text-center font-mono font-bold text-slate-700">
                          {p.minStockAlert || 5} {p.baseUnit}
                        </td>

                        <td className="py-3 text-center">
                          {isOut ? (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              HABIS TOTAL (0)
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              MENIPIS DI BAWAH MINIMUM
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL RIWAYAT OPNAME */}
      {/* =================================================================== */}
      {showOpnameHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Riwayat Sesi Stok Opname</h3>
                <p className="text-xs text-slate-500">Histori sesi rekonsiliasi stok toko sebelumnya</p>
              </div>
              <button
                onClick={() => setShowOpnameHistoryModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {isLoadingHistory ? (
                <p className="text-center py-8 text-xs text-slate-400">Memuat riwayat...</p>
              ) : opnameHistory.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">Belum ada riwayat sesi opname.</p>
              ) : (
                opnameHistory.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{sess.sessionCode}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                          {sess.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        {sess.completedAt || sess.createdAt} {sess.categoryFilter ? `• Kategori: ${sess.categoryFilter}` : ""}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-800 block">
                        {sess.totalDiscrepancyItems} Barang Selisih
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        Rp {Math.round(sess.totalFinancialDiff).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
