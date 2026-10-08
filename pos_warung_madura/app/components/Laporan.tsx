import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Receipt,
  Eye,
  CloudUpload,
  Download,
  Printer,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  AlertCircle,
  BarChart3,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import type { Sale, Product } from "../types/pos";
import type {
  FinancialSummary,
  TopProductItem,
  DeadStockItem,
  DailyTrendPoint,
  DetailedSaleReportRow,
} from "../services/report.server";

interface LaporanProps {
  sales: Sale[];
  products: Product[];
  onViewSaleReceipt: (sale: Sale) => void;
  onSyncAllSales: () => void;
  isSyncing: boolean;
  onVoidOrReturnSale?: (invoiceCode: string) => void;
}

export const Laporan: React.FC<LaporanProps> = ({
  sales,
  products,
  onViewSaleReceipt,
  onSyncAllSales,
  isSyncing,
  onVoidOrReturnSale,
}) => {
  // Filter States
  const [period, setPeriod] = useState<
    "today" | "yesterday" | "last_7_days" | "this_month" | "last_month" | "custom"
  >("today");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [deadStockDays, setDeadStockDays] = useState<number>(30);

  // Tab State
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "products" | "transactions">("overview");

  // Remote Data State
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([]);
  const [deadStock, setDeadStock] = useState<DeadStockItem[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendPoint[]>([]);
  const [detailedSales, setDetailedSales] = useState<DetailedSaleReportRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch report data from /api/report
  const fetchReportData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        period,
        paymentMethod,
        deadStockDays: String(deadStockDays),
      });

      if (period === "custom") {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }

      const res = await fetch(`/api/report?${params.toString()}`);
      const data = await res.json();

      if (data.ok) {
        setSummary(data.summary);
        setTopProducts(data.topProducts || []);
        setDeadStock(data.deadStock || []);
        setDailyTrend(data.dailyTrend || []);
        setDetailedSales(data.detailedSales || []);
      } else {
        throw new Error(data.error || "Gagal memuat data laporan keuangan");
      }
    } catch (err: any) {
      console.warn("Fallback to client-side calculations due to fetch error:", err);
      setErrorMsg(err.message || "Gagal memuat analitik server. Menampilkan data lokal.");
      // Fallback calculation using client-side sales & products
      computeClientFallback();
    } finally {
      setIsLoading(false);
    }
  }, [period, startDate, endDate, paymentMethod, deadStockDays, sales, products]);

  // Client-side fallback calculation if offline or server API isn't responding
  const computeClientFallback = () => {
    const totalRev = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    let totalCogs = 0;
    sales.forEach((s) => {
      s.items.forEach((it) => {
        const cost = it.costPrice && it.costPrice > 0 ? it.costPrice : it.price * 0.8;
        totalCogs += cost * it.qty;
      });
    });
    const grossProfit = totalRev - totalCogs;
    const margin = totalRev > 0 ? Math.round((grossProfit / totalRev) * 100) : 0;

    const totalStockAssetValue = products.reduce((sum, p) => {
      const baseUnit = p.units?.find((u) => u.isBaseUnit) || p.units?.[0];
      const cost = baseUnit ? baseUnit.costPrice || baseUnit.price * 0.8 : 0;
      return sum + (p.stockInBaseUnit || 0) * cost;
    }, 0);

    const cashSales = sales
      .filter((s) => s.paymentMethod === "Tunai")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const qrisSales = sales
      .filter((s) => s.paymentMethod === "QRIS")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const debtSales = sales
      .filter((s) => s.paymentMethod === "Kasbon")
      .reduce((sum, s) => sum + s.totalAmount, 0);

    setSummary({
      periodLabel: "Perhitungan Lokal Kasir",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      totalRevenue: totalRev,
      totalTransactions: sales.length,
      averageOrderValue: sales.length > 0 ? Math.round(totalRev / sales.length) : 0,
      totalCostOfGoodsSold: Math.round(totalCogs),
      grossProfit: Math.round(grossProfit),
      grossMarginPercent: margin,
      totalCashSales: cashSales,
      totalQrisSales: qrisSales,
      totalDebtSales: debtSales,
      totalDebtCollected: 0,
      totalRestockExpense: 0,
      netCashFlow: cashSales + qrisSales,
      totalInventoryAssetValue: Math.round(totalStockAssetValue),
      lowStockCount: products.filter((p) => (p.stockInBaseUnit || 0) <= (p.minStockAlert || 5)).length,
    });
  };

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Download CSV export
  const handleExportCsv = () => {
    const params = new URLSearchParams({
      period,
      paymentMethod,
      deadStockDays: String(deadStockDays),
      export: "csv",
    });
    if (period === "custom") {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    }
    window.open(`/api/report?${params.toString()}`, "_blank");
  };

  // Trigger print report
  const handlePrintReport = () => {
    window.print();
  };

  const pendingCount = sales.filter((s) => s.syncStatus === "pending").length;

  // Maximum value for Daily Trend chart scaling
  const maxTrendValue = Math.max(
    ...(dailyTrend.map((t) => Math.max(t.revenue, t.profit))),
    1
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner Modern Rounded-3xl */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/50">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-60 h-60 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-emerald-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>F2 PRD • Laporan Keuangan & Laba Bersih</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Analitik Keuangan Warung Madura
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Pantau laba kotor berbasis HPP (*moving average*), omzet real-time, arus kas masuk
              per metode bayar, produk terlaris, serta deteksi stok macet (*dead stock*).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {pendingCount > 0 && (
              <button
                onClick={onSyncAllSales}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition cursor-pointer backdrop-blur-md"
              >
                <CloudUpload className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Menyinkronkan..." : `Sync Cloud (${pendingCount})`}</span>
              </button>
            )}

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/40 cursor-pointer"
              title="Unduh file Excel CSV dengan UTF-8 BOM"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor Excel</span>
            </button>

            <button
              onClick={handlePrintReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/10 cursor-pointer backdrop-blur-md"
              title="Cetak atau Simpan sebagai PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>

            <button
              onClick={fetchReportData}
              disabled={isLoading}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition border border-white/10 cursor-pointer backdrop-blur-md"
              title="Perbarui Data Laporan"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Period Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Periode:
            </span>
            {(
              [
                { id: "today", label: "Hari Ini" },
                { id: "yesterday", label: "Kemarin" },
                { id: "last_7_days", label: "7 Hari" },
                { id: "this_month", label: "Bulan Ini" },
                { id: "last_month", label: "Bulan Lalu" },
                { id: "custom", label: "Kustom" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  period === p.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Metode:
            </span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Metode</option>
              <option value="Tunai">Tunai Saja</option>
              <option value="QRIS">QRIS Saja</option>
              <option value="Kasbon">Kasbon Saja</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker Inputs */}
        {period === "custom" && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <span>Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <span>Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <button
              onClick={fetchReportData}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
            >
              Terapkan Tanggal
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Main KPI Metrik Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Omzet Penjualan */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Omzet</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            Rp {(summary?.totalRevenue || 0).toLocaleString("id-ID")}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>{summary?.totalTransactions || 0} Transaksi</span>
            <span>AOV: Rp {(summary?.averageOrderValue || 0).toLocaleString("id-ID")}</span>
          </div>
        </div>

        {/* Laba Kotor & Margin */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 transition space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Laba Kotor (Gross Profit)
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 font-mono">
            Rp {(summary?.grossProfit || 0).toLocaleString("id-ID")}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>HPP: Rp {(summary?.totalCostOfGoodsSold || 0).toLocaleString("id-ID")}</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              Margin {summary?.grossMarginPercent || 0}%
            </span>
          </div>
        </div>

        {/* Arus Kas Bersih */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 transition space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
              Arus Kas Masuk (Cash Flow)
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-700 font-mono">
            Rp {(summary?.netCashFlow || 0).toLocaleString("id-ID")}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Tunai: Rp {(summary?.totalCashSales || 0).toLocaleString("id-ID")}</span>
            <span>QRIS: Rp {(summary?.totalQrisSales || 0).toLocaleString("id-ID")}</span>
          </div>
        </div>

        {/* Nilai Persediaan Stok */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-amber-300 transition space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Nilai Aset Persediaan
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            Rp {(summary?.totalInventoryAssetValue || 0).toLocaleString("id-ID")}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>{products.length} SKU Barang</span>
            <span
              className={`font-semibold ${
                (summary?.lowStockCount || 0) > 0 ? "text-amber-600" : "text-slate-400"
              }`}
            >
              {summary?.lowStockCount || 0} Stok Menipis
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigasi Sub-Laporan */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer ${
            activeSubTab === "overview"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 hover:bg-slate-200 text-slate-600"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Tren & Rincian Arus Kas</span>
        </button>

        <button
          onClick={() => setActiveSubTab("products")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer ${
            activeSubTab === "products"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 hover:bg-slate-200 text-slate-600"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Top Seller & Dead Stock</span>
        </button>

        <button
          onClick={() => setActiveSubTab("transactions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer ${
            activeSubTab === "transactions"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 hover:bg-slate-200 text-slate-600"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Daftar Transaksi ({detailedSales.length || sales.length})</span>
        </button>
      </div>

      {/* Konten Sub-Tab 1: Ringkasan Grafik & Arus Kas */}
      {activeSubTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visual Daily Trend Bar Chart (2 Kolom) */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  <span>Tren Omzet & Laba Harian</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Grafik performa per hari pada rentang filter yang dipilih.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Omzet
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Laba Kotor
                </span>
              </div>
            </div>

            {dailyTrend.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                Belum ada data transaksi pada rentang periode ini untuk ditampilkan grafik.
              </div>
            ) : (
              <div className="pt-6 space-y-4">
                <div className="flex items-end gap-2 h-44 overflow-x-auto pb-2">
                  {dailyTrend.map((pt) => {
                    const revHeight = Math.max(Math.round((pt.revenue / maxTrendValue) * 100), 4);
                    const profHeight = Math.max(Math.round((pt.profit / maxTrendValue) * 100), 2);
                    const shortDate = pt.date.slice(5); // MM-DD

                    return (
                      <div
                        key={pt.date}
                        className="flex-1 min-w-[42px] flex flex-col items-center gap-1.5 group relative"
                      >
                        {/* Tooltip Hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] p-2 rounded-lg pointer-events-none z-20 whitespace-nowrap shadow-lg">
                          <p className="font-bold">{pt.date}</p>
                          <p className="text-blue-300">
                            Omzet: Rp {pt.revenue.toLocaleString("id-ID")}
                          </p>
                          <p className="text-emerald-300">
                            Laba: Rp {pt.profit.toLocaleString("id-ID")}
                          </p>
                          <p className="text-slate-300">{pt.transactionsCount} Transaksi</p>
                        </div>

                        {/* Bar Cluster */}
                        <div className="w-full flex items-end justify-center gap-1 h-32">
                          <div
                            style={{ height: `${revHeight}%` }}
                            className="w-3 bg-blue-500 rounded-t-sm group-hover:bg-blue-600 transition"
                          />
                          <div
                            style={{ height: `${profHeight}%` }}
                            className="w-3 bg-emerald-500 rounded-t-sm group-hover:bg-emerald-600 transition"
                          />
                        </div>

                        <span className="text-[10px] font-mono text-slate-400">
                          {shortDate}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Rincian Arus Kas (Cash Flow Breakdown) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-600" />
                <span>Rincian Arus Kas Warung</span>
              </h3>
              <p className="text-xs text-slate-500">
                Penerimaan tunai langsung vs piutang kasbon.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Penjualan Tunai</p>
                    <p className="text-[10px] text-slate-500">Uang laci kasir</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-900">
                  Rp {(summary?.totalCashSales || 0).toLocaleString("id-ID")}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Penjualan QRIS</p>
                    <p className="text-[10px] text-slate-500">Masuk rekening digital</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-900">
                  Rp {(summary?.totalQrisSales || 0).toLocaleString("id-ID")}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Pelunasan Kasbon</p>
                    <p className="text-[10px] text-slate-500">Diterima dari utang lama</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-indigo-700">
                  Rp {(summary?.totalDebtCollected || 0).toLocaleString("id-ID")}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900">Kasbon Baru Terbit</p>
                    <p className="text-[10px] text-amber-700">Belum menjadi kas</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-amber-900">
                  Rp {(summary?.totalDebtSales || 0).toLocaleString("id-ID")}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-rose-100 text-rose-800">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-rose-900">Belanja Kulakan Masuk</p>
                    <p className="text-[10px] text-rose-700">Pengeluaran stok barang</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-rose-800">
                  - Rp {(summary?.totalRestockExpense || 0).toLocaleString("id-ID")}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-800">Arus Kas Bersih Diterima:</span>
                <span className="font-mono text-sm text-emerald-700">
                  Rp {(summary?.netCashFlow || 0).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Konten Sub-Tab 2: Top Products & Dead Stock */}
      {activeSubTab === "products" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 10 Best Seller */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Top 10 Produk Terlaris</span>
              </h3>
              <p className="text-xs text-slate-500">
                Peringkat produk berdasarkan kuantiti terjual dan sumbangan laba kotor.
              </p>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Belum ada produk yang terjual dalam periode ini.
              </div>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, idx) => (
                  <div
                    key={p.productId}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs hover:border-slate-300 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-200/80 font-bold font-mono text-[11px] text-slate-700 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{p.productName}</p>
                        <p className="text-[10px] text-slate-500">
                          {p.category} &bull; Terjual:{" "}
                          <span className="font-semibold text-slate-700">
                            {p.totalQtySold} pcs
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-mono font-bold text-slate-900">
                        Rp {p.totalRevenue.toLocaleString("id-ID")}
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-600">
                        Laba: Rp {p.totalProfit.toLocaleString("id-ID")} ({p.profitMarginPercent}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dead Stock (Produk Macet) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Produk Tidak Laku (Dead Stock)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Stok ada di gudang tetapi belum terjual selama waktu yang ditentukan.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] text-slate-500 font-medium">Batas:</span>
                <select
                  value={deadStockDays}
                  onChange={(e) => setDeadStockDays(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none"
                >
                  <option value={14}>≥ 14 Hari</option>
                  <option value={30}>≥ 30 Hari</option>
                  <option value={60}>≥ 60 Hari</option>
                  <option value={90}>≥ 90 Hari</option>
                </select>
              </div>
            </div>

            {deadStock.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span>Bagus! Tidak ada produk dead stock macet &gt; {deadStockDays} hari.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {deadStock.map((ds) => (
                  <div
                    key={ds.productId}
                    className="p-3 rounded-xl bg-amber-50/40 border border-amber-200/50 flex items-center justify-between text-xs hover:border-amber-300 transition"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{ds.productName}</p>
                      <p className="text-[10px] text-slate-500">
                        {ds.category} &bull; Sisa Stok:{" "}
                        <span className="font-semibold text-slate-800">
                          {ds.stockInBaseUnit} {ds.baseUnit}
                        </span>
                      </p>
                      <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                        {ds.daysSinceLastSold === null
                          ? "Belum pernah terjual sama sekali"
                          : `Terakhir laku ${ds.daysSinceLastSold} hari yang lalu`}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] text-slate-500">Nilai Aset Mengendap:</p>
                      <p className="font-mono font-bold text-amber-900">
                        Rp {ds.totalAssetValue.toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Konten Sub-Tab 3: Daftar Transaksi & Detail Nota */}
      {activeSubTab === "transactions" && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-700" />
                <span>Riwayat Lengkap Nota Penjualan</span>
              </h3>
              <p className="text-xs text-slate-500">
                Data detail omzet, HPP per transaksi, dan estimasi laba bersih tiap nota.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Total: {detailedSales.length || sales.length} Transaksi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">No. Nota</th>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Kasir / Pelanggan</th>
                  <th className="py-2.5 px-3">Metode</th>
                  <th className="py-2.5 px-3 text-right">Omzet</th>
                  <th className="py-2.5 px-3 text-right">HPP</th>
                  <th className="py-2.5 px-3 text-right">Laba Kotor</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailedSales.length > 0 ? (
                  detailedSales.map((saleRow) => {
                    // Temukan objek sale asli jika kasir ingin melihat struk
                    const matchedSale = sales.find((s) => s.invoiceCode === saleRow.invoiceCode);

                    return (
                      <tr key={saleRow.invoiceCode} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {saleRow.invoiceCode}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{saleRow.timestamp}</td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800">{saleRow.cashierName}</p>
                          <p className="text-[10px] text-slate-400">{saleRow.customerName}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              saleRow.paymentMethod === "Tunai"
                                ? "bg-emerald-50 text-emerald-700"
                                : saleRow.paymentMethod === "QRIS"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-amber-50 text-amber-800"
                            }`}
                          >
                            {saleRow.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          Rp {saleRow.totalAmount.toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">
                          Rp {saleRow.totalCogs.toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                          Rp {saleRow.grossProfit.toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {matchedSale && (
                              <button
                                onClick={() => onViewSaleReceipt(matchedSale)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                                title="Lihat Struk"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Struk</span>
                              </button>
                            )}

                            {onVoidOrReturnSale && (
                              <button
                                onClick={() => onVoidOrReturnSale(saleRow.invoiceCode)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-medium transition cursor-pointer"
                                title="Retur Barang atau Void Nota"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Retur/Void</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : sales.length > 0 ? (
                  sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {sale.invoiceCode}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{sale.timestamp}</td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800">{sale.cashierName}</p>
                        <p className="text-[10px] text-slate-400">{sale.customerName || "Umum"}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        Rp {sale.totalAmount.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">-</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                        -
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onViewSaleReceipt(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                            title="Lihat Struk"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Struk</span>
                          </button>

                          {onVoidOrReturnSale && (
                            <button
                              onClick={() => onVoidOrReturnSale(sale.invoiceCode)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-medium transition cursor-pointer"
                              title="Retur Barang atau Void Nota"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Retur/Void</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Belum ada transaksi penjualan yang tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
