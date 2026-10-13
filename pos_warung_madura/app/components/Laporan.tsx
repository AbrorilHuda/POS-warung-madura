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
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  Key,
  Clock,
  User,
  X,
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
  activeShift?: any;
  onOpenShiftModal?: () => void;
  onViewSaleReceipt: (sale: Sale) => void;
  onSyncAllSales: () => void;
  isSyncing: boolean;
  onVoidOrReturnSale?: (invoiceCode: string) => void;
}

export const Laporan: React.FC<LaporanProps> = ({
  sales,
  products,
  activeShift,
  onOpenShiftModal,
  onViewSaleReceipt,
  onSyncAllSales,
  isSyncing,
  onVoidOrReturnSale,
}) => {
  // PRD F2.8 & F5.6: Otorisasi Pemilik untuk Laba & HPP
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState<boolean>(() => {
    return activeShift?.role === "owner";
  });
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState<boolean>(false);
  const [ownerPinInput, setOwnerPinInput] = useState<string>("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [unlockToast, setUnlockToast] = useState<string | null>(null);
  const [printToast, setPrintToast] = useState<string | null>(null);
  const [isPrintingShift, setIsPrintingShift] = useState<boolean>(false);

  // Sync role owner jika activeShift berganti
  useEffect(() => {
    if (activeShift?.role === "owner") {
      setIsOwnerUnlocked(true);
    }
  }, [activeShift?.role]);

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

  // Sub-Tab State: 'shift' (Kasir Shift Summary), 'overview' (Laba & Omzet), 'products' (Top & Dead stock), 'transactions' (Rincian Nota)
  const [activeSubTab, setActiveSubTab] = useState<"shift" | "overview" | "products" | "transactions">(
    activeShift && activeShift.role !== "owner" ? "shift" : "overview"
  );

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
      totalDiscounts: sales.reduce((sum, s) => sum + (s.discountAmount || 0), 0),
      totalReturns: 0,
      voidTransactionsCount: sales.filter((s) => s.isVoid).length,
    });
  };

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Handler Verifikasi PIN Pemilik (Supervisor Override - PRD F5.6)
  const handleVerifyOwnerPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ownerPinInput.trim()) {
      setUnlockError("PIN Pemilik wajib diisi");
      return;
    }

    setIsVerifyingPin(true);
    setUnlockError(null);

    try {
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_owner_pin",
          pin: ownerPinInput.trim(),
          reason: "Membuka Akses Metrik Laba & HPP di Tab Laporan",
          userName: activeShift?.cashierName || "Kasir",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setIsOwnerUnlocked(true);
        setIsUnlockModalOpen(false);
        setOwnerPinInput("");
        setUnlockToast("Akses Pemilik Berhasil! Laba, HPP, dan Margin kini terbuka.");
        setTimeout(() => setUnlockToast(null), 4500);
      } else {
        setUnlockError(data.error || "PIN Pemilik atau Kode Pemulihan salah!");
      }
    } catch {
      setUnlockError("Gagal menghubungi server verifikasi.");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Handler Cetak Ringkasan Shift ke Printer Thermal (PRD F5.4 & F9.6)
  const handlePrintThermalShift = async (shiftToPrint: any) => {
    setIsPrintingShift(true);
    setPrintToast(null);

    try {
      const fd = new FormData();
      fd.append("intent", "print_shift_report");
      if (shiftToPrint) {
        fd.append("shift", JSON.stringify(shiftToPrint));
      }

      const res = await fetch("/api/printer", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (data.ok) {
        setPrintToast("Struk Ringkasan Shift Berhasil Dicetak ke Printer Thermal ESC/POS!");
        setTimeout(() => setPrintToast(null), 4000);
      } else {
        // Fallback ke window print
        handleFallbackHtmlPrint(shiftToPrint);
      }
    } catch {
      handleFallbackHtmlPrint(shiftToPrint);
    } finally {
      setIsPrintingShift(false);
    }
  };

  const handleFallbackHtmlPrint = (s: any) => {
    const printWindow = window.open("", "_blank", "width=380,height=600");
    if (!printWindow) return;

    const diffText =
      s.cashDifference === null
        ? "Belum ditutup"
        : s.cashDifference === 0
          ? "Pas (Rp 0)"
          : s.cashDifference > 0
            ? `Lebih (+Rp ${Number(s.cashDifference).toLocaleString("id-ID")})`
            : `Kurang (-Rp ${Math.abs(Number(s.cashDifference)).toLocaleString("id-ID")})`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rekap Shift - ${s.shiftCode || s.id}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 12px; color: #000; width: 280px; }
          .text-center { text-align: center; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .bold { font-weight: bold; }
          @media print { body { width: 100%; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="text-center bold">WARUNG MADURA</div>
        <div class="text-center" style="font-size: 10px;">LAPORAN RINGKASAN SHIFT KASIR</div>
        <div class="divider"></div>
        <div class="row"><span>Kode Shift:</span><span class="bold">${s.shiftCode || s.id}</span></div>
        <div class="row"><span>Kasir:</span><span>${s.cashierName || "Kasir"}</span></div>
        <div class="row"><span>Mulai:</span><span>${s.startTime || "-"}</span></div>
        <div class="row"><span>Selesai:</span><span>${s.endTime || "Masih Berjalan"}</span></div>
        <div class="divider"></div>
        <div class="row"><span>Modal Awal:</span><span>Rp ${(Number(s.startingCash) || 0).toLocaleString("id-ID")}</span></div>
        <div class="row"><span>Penjualan Tunai:</span><span>Rp ${(Number(s.totalCashSales) || 0).toLocaleString("id-ID")}</span></div>
        <div class="row"><span>Penjualan QRIS:</span><span>Rp ${(Number(s.totalQrisSales) || 0).toLocaleString("id-ID")}</span></div>
        <div class="row"><span>Kasbon Baru:</span><span>Rp ${(Number(s.totalDebtSales) || 0).toLocaleString("id-ID")}</span></div>
        <div class="row"><span>Pelunasan Kasbon:</span><span>Rp ${(Number(s.totalDebtCollectedCash) || 0).toLocaleString("id-ID")}</span></div>
        <div class="divider"></div>
        <div class="row bold"><span>Uang Laci Diharapkan:</span><span>Rp ${(Number(s.expectedCash) || 0).toLocaleString("id-ID")}</span></div>
        ${s.actualCash !== null ? `<div class="row bold"><span>Hitungan Fisik:</span><span>Rp ${(Number(s.actualCash) || 0).toLocaleString("id-ID")}</span></div>` : ""}
        ${s.cashDifference !== null ? `<div class="row bold"><span>Selisih Kas:</span><span>${diffText}</span></div>` : ""}
        <div class="divider"></div>
        <div class="text-center" style="font-size: 10px; margin-top: 15px;">Dicetak: ${new Date().toLocaleString("id-ID")}</div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Download CSV export (Hanya Pemilik)
  const handleExportCsv = () => {
    if (!isOwnerUnlocked) {
      setIsUnlockModalOpen(true);
      return;
    }
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

  // Cetak Dokumen PDF Laporan Keuangan Resmi (PRD F2.7)
  const handlePrintReport = () => {
    const printWindow = window.open("", "_blank", "width=960,height=1000");
    if (!printWindow) {
      alert("Jendela pencetakan diblokir browser. Mohon izinkan pop-up untuk mencetak dokumen laporan.");
      return;
    }

    const curSummary = summary || {
      periodLabel: "Semua Data Tersedia",
      startDate: startDate || "-",
      endDate: endDate || "-",
      totalRevenue: sales.reduce((sum, s) => sum + s.totalAmount, 0),
      totalTransactions: sales.length,
      averageOrderValue: sales.length > 0 ? Math.round(sales.reduce((sum, s) => sum + s.totalAmount, 0) / sales.length) : 0,
      totalCostOfGoodsSold: 0,
      grossProfit: 0,
      grossMarginPercent: 0,
      totalDiscounts: sales.reduce((sum, s) => sum + (s.discountAmount || 0), 0),
      totalReturns: 0,
      voidTransactionsCount: sales.filter((s) => s.isVoid).length,
      totalCashSales: sales.filter((s) => s.paymentMethod === "Tunai").reduce((sum, s) => sum + s.totalAmount, 0),
      totalQrisSales: sales.filter((s) => s.paymentMethod === "QRIS").reduce((sum, s) => sum + s.totalAmount, 0),
      totalDebtSales: sales.filter((s) => s.paymentMethod === "Kasbon").reduce((sum, s) => sum + s.totalAmount, 0),
      totalDebtCollected: 0,
      totalRestockExpense: 0,
      netCashFlow: 0,
      totalInventoryAssetValue: 0,
      lowStockCount: 0,
    };

    const netSales = Math.max(0, curSummary.totalRevenue - (curSummary.totalDiscounts || 0));
    const printedAt = new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "medium" });
    const cashierName = activeShift?.cashierName || "Kasir / Pemilik";

    const topProductRows = topProducts.slice(0, 10).map((tp, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>${tp.productName}</strong></td>
        <td>${tp.category || "Umum"}</td>
        <td style="text-align: right;">${tp.totalQtySold.toLocaleString("id-ID")}</td>
        <td style="text-align: right;">Rp ${tp.totalRevenue.toLocaleString("id-ID")}</td>
        ${isOwnerUnlocked ? `<td style="text-align: right; font-weight: bold; color: #047857;">Rp ${tp.totalProfit.toLocaleString("id-ID")} (${tp.profitMarginPercent}%)</td>` : ""}
      </tr>
    `).join("");

    const salesListToRender = detailedSales.length > 0 ? detailedSales : sales.map((s) => ({
      invoiceCode: s.invoiceCode,
      timestamp: s.timestamp || (s as any).createdAt || new Date().toISOString(),
      cashierName: s.cashierName || "Kasir",
      customerName: s.customerName || "Pelanggan Umum",
      paymentMethod: s.paymentMethod,
      totalAmount: s.totalAmount,
      totalCogs: 0,
      grossProfit: 0,
      itemCount: s.items?.length || 0,
      isVoid: s.isVoid,
      discountAmount: s.discountAmount || 0,
      promoName: s.promoName,
    }));

    const transactionRows = salesListToRender.slice(0, 50).map((row, idx) => `
      <tr style="${row.isVoid ? 'background-color: #fee2e2; text-decoration: line-through; color: #991b1b;' : ''}">
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;">${row.invoiceCode}</td>
        <td>${row.timestamp ? String(row.timestamp).slice(0, 16).replace("T", " ") : "-"}</td>
        <td>${row.cashierName || "-"}</td>
        <td>${row.customerName || "Umum"}</td>
        <td><span class="badge">${row.paymentMethod}</span></td>
        <td style="text-align: right;">Rp ${(row.discountAmount || 0).toLocaleString("id-ID")}</td>
        <td style="text-align: right; font-weight: bold;">Rp ${row.totalAmount.toLocaleString("id-ID")}</td>
        ${isOwnerUnlocked ? `<td style="text-align: right; color: #047857;">Rp ${(row.grossProfit || 0).toLocaleString("id-ID")}</td>` : ""}
        <td style="text-align: center;">${row.isVoid ? '<span style="color: red; font-weight: bold;">VOID</span>' : '<span style="color: green;">Sah</span>'}</td>
      </tr>
    `).join("");

    const html = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Laporan Keuangan & Penjualan - Warung Madura</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 15mm 15mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 24px;
            font-size: 11px;
            line-height: 1.45;
          }
          .no-print {
            margin-bottom: 20px;
            padding: 12px 16px;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .btn-print {
            background: #0f172a;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 12px;
            cursor: pointer;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .store-name {
            font-size: 18px;
            font-weight: 900;
            letter-spacing: -0.5px;
            color: #0f172a;
            text-transform: uppercase;
          }
          .store-sub {
            font-size: 11px;
            color: #475569;
            margin-top: 2px;
          }
          .doc-info {
            text-align: right;
            font-size: 10px;
            color: #334155;
          }
          .doc-title {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .filter-summary {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 14px;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 11px;
          }
          .filter-item { display: flex; flex-direction: column; }
          .filter-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; }
          .filter-val { font-weight: bold; color: #0f172a; }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 16px;
          }
          .kpi-card {
            border: 1px solid #cbd5e1;
            background: #ffffff;
            border-radius: 8px;
            padding: 8px 10px;
          }
          .kpi-title { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px; }
          .kpi-value { font-size: 13px; font-weight: 800; color: #0f172a; }
          .kpi-sub { font-size: 9px; color: #64748b; margin-top: 1px; }
          .section-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #0f172a;
            margin-top: 16px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
            font-size: 10px;
          }
          th, td {
            border: 1px solid #e2e8f0;
            padding: 5px 8px;
            text-align: left;
          }
          th {
            background: #f1f5f9;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            font-size: 9px;
          }
          .badge {
            display: inline-block;
            padding: 1px 5px;
            border-radius: 4px;
            background: #e2e8f0;
            font-size: 9px;
            font-weight: 600;
          }
          .sig-container {
            margin-top: 28px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .sig-box {
            width: 220px;
            text-align: center;
            font-size: 11px;
          }
          .sig-space {
            height: 60px;
          }
          .sig-name {
            font-weight: bold;
            border-top: 1px solid #0f172a;
            padding-top: 4px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            .badge { border: 1px solid #cbd5e1; }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <div>
            <strong>Pratinjau Dokumen Siap Cetak (A4)</strong>
            <div style="font-size: 11px; color: #475569;">Pilih tujuan printer atau "Save as PDF" di menu cetak browser.</div>
          </div>
          <button class="btn-print" onclick="window.print()">Cetak / Simpan PDF</button>
        </div>

        <div class="header">
          <div>
            <div class="store-name">WARUNG MADURA 24 JAM</div>
            <div class="store-sub">Solusi Kasir & Manajemen Ritel Offline-First</div>
            <div class="store-sub">Layanan Siaga 24 Jam Non-Stop • Struk Digital Supabase</div>
          </div>
          <div class="doc-info">
            <div class="doc-title">Laporan Keuangan & Penjualan</div>
            <div>Waktu Cetak: ${printedAt}</div>
            <div>Petugas / Kasir: <strong>${cashierName}</strong></div>
            <div>Akses: <strong>${isOwnerUnlocked ? "Mode Pemilik (Laba Terbuka)" : "Mode Kasir"}</strong></div>
          </div>
        </div>

        <div class="filter-summary">
          <div class="filter-item">
            <span class="filter-label">Periode Laporan</span>
            <span class="filter-val">${curSummary.periodLabel || period}</span>
          </div>
          <div class="filter-item">
            <span class="filter-label">Rentang Tanggal</span>
            <span class="filter-val">${curSummary.startDate} s/d ${curSummary.endDate}</span>
          </div>
          <div class="filter-item">
            <span class="filter-label">Filter Metode Bayar</span>
            <span class="filter-val">${paymentMethod === "all" ? "Semua Metode Pembayaran" : paymentMethod}</span>
          </div>
        </div>

        <!-- Ringkasan Eksekutif KPI -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">Penjualan Kotor (Omzet)</div>
            <div class="kpi-value">Rp ${curSummary.totalRevenue.toLocaleString("id-ID")}</div>
            <div class="kpi-sub">${curSummary.totalTransactions} transaksi berhasil</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Potongan Diskon & Promo</div>
            <div class="kpi-value" style="color: #dc2626;">Rp ${(curSummary.totalDiscounts || 0).toLocaleString("id-ID")}</div>
            <div class="kpi-sub">Total promo diberikan</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Penjualan Bersih</div>
            <div class="kpi-value" style="color: #2563eb;">Rp ${netSales.toLocaleString("id-ID")}</div>
            <div class="kpi-sub">Rata-rata Rp ${curSummary.averageOrderValue.toLocaleString("id-ID")} / nota</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Laba Kotor (Gross Profit)</div>
            <div class="kpi-value" style="color: #047857;">
              ${isOwnerUnlocked ? `Rp ${curSummary.grossProfit.toLocaleString("id-ID")}` : "Terproteksi PIN"}
            </div>
            <div class="kpi-sub">${isOwnerUnlocked ? `Margin: ${curSummary.grossMarginPercent}%` : "Khusus Pemilik"}</div>
          </div>
        </div>

        <!-- KPI Arus Kas & Piutang -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">Penerimaan Tunai (Cash)</div>
            <div class="kpi-value">Rp ${(curSummary.totalCashSales || 0).toLocaleString("id-ID")}</div>
            <div class="kpi-sub">Kas laci masuk</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Penerimaan QRIS</div>
            <div class="kpi-value">Rp ${(curSummary.totalQrisSales || 0).toLocaleString("id-ID")}</div>
            <div class="kpi-sub">Rekening bank / e-wallet</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Kasbon Baru Terbit</div>
            <div class="kpi-value" style="color: #b45309;">Rp ${(curSummary.totalDebtSales || 0).toLocaleString("id-ID")}</div>
            <div class="kpi-sub">Piutang pelanggan baru</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Pelunasan Kasbon Diterima</div>
            <div class="kpi-value" style="color: #047857;">Rp ${(curSummary.totalDebtCollected || 0).toLocaleString("id-ID")}</div>
            <div class="kpi-sub">Pelunasan utang tunai</div>
          </div>
        </div>

        ${topProducts.length > 0 ? `
          <div class="section-title">
            <span>10 Produk Terlaris (Top Selling Products)</span>
            <span style="font-size: 9px; font-weight: normal; color: #64748b;">Berdasarkan total volume penjualan</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">No</th>
                <th>Nama Produk</th>
                <th>Kategori</th>
                <th style="text-align: right;">Jumlah Terjual</th>
                <th style="text-align: right;">Total Omzet</th>
                ${isOwnerUnlocked ? '<th style="text-align: right;">Kontribusi Laba</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${topProductRows}
            </tbody>
          </table>
        ` : ''}

        <div class="section-title">
          <span>Rincian Transaksi Penjualan (Maksimal 50 Terakhir)</span>
          <span style="font-size: 9px; font-weight: normal; color: #64748b;">Total ${salesListToRender.length} transaksi di periode ini</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 25px; text-align: center;">No</th>
              <th>Nomor Nota</th>
              <th>Waktu</th>
              <th>Kasir</th>
              <th>Pelanggan</th>
              <th>Metode</th>
              <th style="text-align: right;">Diskon</th>
              <th style="text-align: right;">Total Akhir</th>
              ${isOwnerUnlocked ? '<th style="text-align: right;">Laba Kotor</th>' : ''}
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${transactionRows}
          </tbody>
        </table>

        <!-- Kolom Tanda Tangan Resmi Pengesahan -->
        <div class="sig-container">
          <div class="sig-box">
            <div>Dibuat & Dilaporkan Oleh,</div>
            <div class="sig-space"></div>
            <div class="sig-name">( ${cashierName} )</div>
            <div style="font-size: 10px; color: #64748b;">Kasir / Petugas Jaga</div>
          </div>
          <div class="sig-box">
            <div>Mengetahui & Menyetujui,</div>
            <div class="sig-space"></div>
            <div class="sig-name">( Pemilik Warung Madura )</div>
            <div style="font-size: 10px; color: #64748b;">Penanggung Jawab Usaha</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const pendingCount = sales.filter((s) => s.syncStatus === "pending").length;

  const maxTrendValue = Math.max(
    ...(dailyTrend.map((t) => Math.max(t.revenue, t.profit))),
    1
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {unlockToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-900 text-white text-xs font-semibold flex items-center justify-between shadow-xl border border-emerald-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{unlockToast}</span>
          </div>
          <span className="text-[10px] bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full font-mono">
            Supervisor Override
          </span>
        </div>
      )}

      {printToast && (
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-between shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>{printToast}</span>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
            ESC/POS Thermal
          </span>
        </div>
      )}

      {/* Header Banner Modern Rounded-3xl */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/50">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-60 h-60 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-emerald-300 text-xs font-semibold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>PRD F2 & F5 • Laporan & Otorisasi</span>
              </span>

              {/* Mode Keamanan Indikator Badge (PRD F2.8 & F5.6) */}
              {isOwnerUnlocked ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mode Pemilik (Laba Terbuka)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mode Kasir (Laba & HPP Terproteksi)</span>
                </div>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Analitik Keuangan Warung Madura
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Ringkasan kasir shift berjalan, omzet real-time, arus kas laci, produk terlaris,
              serta laporan laba kotor & HPP khusus otorisasi Pemilik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Tombol Unlock / Kunci Kembali Akses Pemilik (PRD F2.8) */}
            {isOwnerUnlocked ? (
              <button
                onClick={() => setIsOwnerUnlocked(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/15 cursor-pointer backdrop-blur-md"
                title="Kunci kembali data laba & HPP ke Mode Kasir"
              >
                <Lock className="w-4 h-4 text-amber-300" />
                <span>Kunci (Mode Kasir)</span>
              </button>
            ) : (
              <button
                onClick={() => setIsUnlockModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/40 cursor-pointer"
                title="Buka akses metrik laba & HPP dengan PIN Pemilik 6 digit"
              >
                <Key className="w-4 h-4" />
                <span>Buka Akses Laba (PIN)</span>
              </button>
            )}

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
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/10 cursor-pointer backdrop-blur-md"
              title={isOwnerUnlocked ? "Unduh file Excel CSV dengan UTF-8 BOM" : "Memerlukan PIN Pemilik untuk ekspor"}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
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

      {/* Tab Navigasi Sub-Laporan */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
        {/* Tab 1: Ringkasan Shift Saya (PRD F2.8 & F5.4) */}
        <button
          onClick={() => setActiveSubTab("shift")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${activeSubTab === "shift"
            ? "bg-slate-900 text-white shadow-xs"
            : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
            }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Ringkasan Shift Saya</span>
          {activeShift && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        {/* Tab 2: Tren & Analitik Laba Rugi */}
        <button
          onClick={() => setActiveSubTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${activeSubTab === "overview"
            ? "bg-slate-900 text-white shadow-xs"
            : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
            }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
          <span>Analitik Laba & Arus Kas</span>
          {!isOwnerUnlocked && (
            <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
              PIN
            </span>
          )}
        </button>

        {/* Tab 3: Top Seller & Dead Stock */}
        <button
          onClick={() => setActiveSubTab("products")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${activeSubTab === "products"
            ? "bg-slate-900 text-white shadow-xs"
            : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
            }`}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Top Seller & Dead Stock</span>
        </button>

        {/* Tab 4: Daftar Transaksi */}
        <button
          onClick={() => setActiveSubTab("transactions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${activeSubTab === "transactions"
            ? "bg-slate-900 text-white shadow-xs"
            : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
            }`}
        >
          <Receipt className="w-3.5 h-3.5 text-purple-400" />
          <span>Daftar Transaksi ({detailedSales.length || sales.length})</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* SUB-TAB 1: RINGKASAN SHIFT KASIR (PRD F2.8 & F5.4) */}
      {/* ==================================================================== */}
      {activeSubTab === "shift" && (
        <div className="space-y-5">
          {activeShift ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>Shift Kasir Aktif: {activeShift.cashierName}</span>
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 font-mono">
                      {activeShift.shiftCode || "SHIFT AKTIF"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Dimulai: <strong>{new Date(activeShift.startTime).toLocaleString("id-ID")}</strong> &bull; Bebas dipantau kasir tanpa membuka rahasia laba toko.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isPrintingShift}
                    onClick={() => handlePrintThermalShift(activeShift)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                    title="Cetak ke printer thermal 58mm/80mm"
                  >
                    <Printer className={`w-3.5 h-3.5 ${isPrintingShift ? "animate-spin" : ""}`} />
                    <span>Cetak Struk Shift (F9)</span>
                  </button>

                  {onOpenShiftModal && (
                    <button
                      type="button"
                      onClick={onOpenShiftModal}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Tutup Shift / Hitung Laci</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Grid Metrik Kasir Shift */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Modal Awal Laci
                  </span>
                  <p className="text-xl font-black text-slate-900 font-mono">
                    Rp {(Number(activeShift.startingCash) || 0).toLocaleString("id-ID")}
                  </p>
                  <span className="text-[10px] text-slate-400 block">Uang kembalian saat buka shift</span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Penjualan Tunai Shift
                  </span>
                  <p className="text-xl font-black text-emerald-700 font-mono">
                    Rp {(Number(activeShift.totalCashSales) || 0).toLocaleString("id-ID")}
                  </p>
                  <span className="text-[10px] text-emerald-600 block">Uang fisik masuk laci</span>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/70 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                    Penjualan QRIS Shift
                  </span>
                  <p className="text-xl font-black text-blue-700 font-mono">
                    Rp {(Number(activeShift.totalQrisSales) || 0).toLocaleString("id-ID")}
                  </p>
                  <span className="text-[10px] text-blue-600 block">Masuk rekening digital toko</span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Kasbon Baru Terbit
                  </span>
                  <p className="text-xl font-black text-amber-900 font-mono">
                    Rp {(Number(activeShift.totalDebtSales) || 0).toLocaleString("id-ID")}
                  </p>
                  <span className="text-[10px] text-amber-700 block">Piutang yang dicatat shift ini</span>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/70 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                    Pelunasan Kasbon Tunai
                  </span>
                  <p className="text-xl font-black text-indigo-700 font-mono">
                    Rp {(Number(activeShift.totalDebtCollectedCash) || 0).toLocaleString("id-ID")}
                  </p>
                  <span className="text-[10px] text-indigo-600 block">Uang pelunasan masuk laci</span>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/70 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                    Kas Masuk / Keluar (Petty Cash)
                  </span>
                  <p className="text-xl font-black text-purple-900 font-mono">
                    +Rp {(Number(activeShift.totalCashIn) || 0).toLocaleString("id-ID")}{" "}
                    <span className="text-rose-600 text-sm font-semibold">
                      (-Rp {(Number(activeShift.totalCashOut) || 0).toLocaleString("id-ID")})
                    </span>
                  </p>
                  <span className="text-[10px] text-purple-600 block">Arus kas kecil operasional laci</span>
                </div>
              </div>

              {/* Total Uang Laci yang Harus Ada */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                <div>
                  <span className="text-xs text-slate-300 font-semibold block">
                    TOTAL UANG TUNAI YANG HARUS ADA DI LACI (KAS DIHARAPKAN):
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mt-1">
                    Rp {(Number(activeShift.expectedCash) || 0).toLocaleString("id-ID")}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Modal Awal + Tunai Masuk + Pelunasan Tunai + Kas Masuk - Kas Keluar
                  </p>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={onOpenShiftModal}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg"
                  >
                    Rekonsiliasi Kas Laci Sekarang
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center shadow-xs space-y-3">
              <Clock className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900">Belum Ada Shift Kasir yang Dibuka</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Buka shift kasir terlebih dahulu dengan memasukkan modal awal laci untuk mulai mencatat transaksi dan melihat rekonsiliasi kas.
              </p>
              {onOpenShiftModal && (
                <button
                  type="button"
                  onClick={onOpenShiftModal}
                  className="mt-2 px-5 py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
                >
                  Buka Shift Kasir Baru
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter Control Bar (Hanya tampil pada overview, products, transactions) */}
      {activeSubTab !== "shift" && (
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${period === p.id
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
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 2: ANALITIK KEUANGAN & LABA RUGI */}
      {/* ==================================================================== */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Main KPI Metrik Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Omzet Penjualan (Selalu Terbuka) */}
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

            {/* Laba Kotor & Margin (Terkunci jika Mode Kasir - PRD F2.8) */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 transition space-y-2 relative overflow-hidden">
              {!isOwnerUnlocked && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-xs z-10 flex flex-col items-center justify-center p-3 text-center border border-slate-200 rounded-2xl animate-in fade-in">
                  <Lock className="w-5 h-5 text-amber-600 mb-1" />
                  <span className="text-xs font-bold text-slate-800">Laba & HPP Terkunci</span>
                  <span className="text-[10px] text-slate-400">Khusus Peran Pemilik</span>
                  <button
                    onClick={() => setIsUnlockModalOpen(true)}
                    className="mt-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                  >
                    Buka Akses PIN
                  </button>
                </div>
              )}
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

            {/* Arus Kas Bersih (Terkunci jika Mode Kasir) */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 transition space-y-2 relative overflow-hidden">
              {!isOwnerUnlocked && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-xs z-10 flex flex-col items-center justify-center p-3 text-center border border-slate-200 rounded-2xl animate-in fade-in">
                  <Lock className="w-5 h-5 text-indigo-600 mb-1" />
                  <span className="text-xs font-bold text-slate-800">Arus Kas Masuk Terkunci</span>
                  <button
                    onClick={() => setIsUnlockModalOpen(true)}
                    className="mt-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 underline cursor-pointer"
                  >
                    Buka Akses PIN
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Arus Kas Bersih (Cash Flow)
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

            {/* Nilai Persediaan Stok (Terkunci jika Mode Kasir) */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-amber-300 transition space-y-2 relative overflow-hidden">
              {!isOwnerUnlocked && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-xs z-10 flex flex-col items-center justify-center p-3 text-center border border-slate-200 rounded-2xl animate-in fade-in">
                  <Lock className="w-5 h-5 text-amber-600 mb-1" />
                  <span className="text-xs font-bold text-slate-800">Aset Stok Terkunci</span>
                  <button
                    onClick={() => setIsUnlockModalOpen(true)}
                    className="mt-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                  >
                    Buka Akses PIN
                  </button>
                </div>
              )}
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
                  className={`font-semibold ${(summary?.lowStockCount || 0) > 0 ? "text-amber-600" : "text-slate-400"
                    }`}
                >
                  {summary?.lowStockCount || 0} Stok Menipis
                </span>
              </div>
            </div>
          </div>

          {/* Ringkasan Retur, Void, & Diskon (PRD F6.5) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Total Diskon & Promo</p>
                  <p className="text-xl font-black text-amber-950 font-mono">
                    Rp {(summary?.totalDiscounts || 0).toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-200/60 px-2.5 py-0.5 rounded-full">
                Potongan
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider">Total Nilai Retur</p>
                  <p className="text-xl font-black text-indigo-950 font-mono">
                    Rp {(summary?.totalReturns || 0).toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-200/60 px-2.5 py-0.5 rounded-full">
                Pengembalian
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-rose-800 tracking-wider">Transaksi Void (Batal)</p>
                  <p className="text-xl font-black text-rose-950 font-mono">
                    {(summary?.voidTransactionsCount || 0)} Transaksi
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-200/60 px-2.5 py-0.5 rounded-full">
                Audit Trail
              </span>
            </div>
          </div>

          {/* Visual Daily Trend Bar Chart & Arus Kas */}
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
                  {isOwnerUnlocked && (
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Laba Kotor
                    </span>
                  )}
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
                      const profHeight = isOwnerUnlocked
                        ? Math.max(Math.round((pt.profit / maxTrendValue) * 100), 2)
                        : 0;
                      const shortDate = pt.date.slice(5);

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
                            {isOwnerUnlocked && (
                              <p className="text-emerald-300">
                                Laba: Rp {pt.profit.toLocaleString("id-ID")}
                              </p>
                            )}
                            <p className="text-slate-300">{pt.transactionsCount} Transaksi</p>
                          </div>

                          {/* Bar Cluster */}
                          <div className="w-full flex items-end justify-center gap-1 h-32">
                            <div
                              style={{ height: `${revHeight}%` }}
                              className="w-3 bg-blue-500 rounded-t-sm group-hover:bg-blue-600 transition"
                            />
                            {isOwnerUnlocked && (
                              <div
                                style={{ height: `${profHeight}%` }}
                                className="w-3 bg-emerald-500 rounded-t-sm group-hover:bg-emerald-600 transition"
                              />
                            )}
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
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 3: TOP PRODUCTS & DEAD STOCK */}
      {/* ==================================================================== */}
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
                      {isOwnerUnlocked ? (
                        <p className="text-[10px] font-semibold text-emerald-600">
                          Laba: Rp {p.totalProfit.toLocaleString("id-ID")} ({p.profitMarginPercent}%)
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-mono">
                          Laba: •••••• (Terkunci)
                        </p>
                      )}
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
                      {isOwnerUnlocked ? (
                        <p className="font-mono font-bold text-amber-900">
                          Rp {ds.totalAssetValue.toLocaleString("id-ID")}
                        </p>
                      ) : (
                        <p className="font-mono text-slate-400 text-xs">
                          •••••• (Terkunci)
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 4: DAFTAR TRANSAKSI LENGKAP */}
      {/* ==================================================================== */}
      {activeSubTab === "transactions" && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-700" />
                <span>Riwayat Lengkap Nota Penjualan</span>
              </h3>
              <p className="text-xs text-slate-500">
                Data detail omzet, metode bayar, dan rincian transaksi tiap nota.
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
                    const matchedSale = sales.find((s) => s.invoiceCode === saleRow.invoiceCode);
                    const isVoid = saleRow.isVoid || Boolean(matchedSale && matchedSale.isVoid);

                    return (
                      <tr
                        key={saleRow.invoiceCode}
                        className={`transition ${isVoid ? "bg-rose-50/40 hover:bg-rose-50/70" : "hover:bg-slate-50/80"}`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={isVoid ? "line-through text-slate-400" : ""}>{saleRow.invoiceCode}</span>
                            {isVoid && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white tracking-wider">
                                VOID
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{saleRow.timestamp}</td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800">{saleRow.cashierName}</p>
                          <p className="text-[10px] text-slate-400">{saleRow.customerName}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${saleRow.paymentMethod === "Tunai"
                              ? "bg-emerald-50 text-emerald-700"
                              : saleRow.paymentMethod === "QRIS"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-amber-50 text-amber-800"
                              }`}
                          >
                            {saleRow.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <div className={isVoid ? "line-through text-slate-400" : "text-slate-900"}>
                            Rp {saleRow.totalAmount.toLocaleString("id-ID")}
                          </div>
                          {Boolean(saleRow.discountAmount && saleRow.discountAmount > 0) && (
                            <div className="text-[10px] text-amber-600 font-medium">
                              Diskon: -Rp {saleRow.discountAmount?.toLocaleString("id-ID")}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">
                          {isVoid ? "-" : isOwnerUnlocked ? `Rp ${saleRow.totalCogs.toLocaleString("id-ID")}` : "••••••"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                          {isVoid ? (
                            <span className="text-slate-400 font-normal">-</span>
                          ) : isOwnerUnlocked ? (
                            `Rp ${saleRow.grossProfit.toLocaleString("id-ID")}`
                          ) : (
                            <span className="text-slate-400 font-normal">••••••</span>
                          )}
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
                                disabled={isVoid}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-medium transition ${isVoid
                                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                  : "bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 cursor-pointer"
                                  }`}
                                title={isVoid ? "Nota sudah dibatalkan (VOID)" : "Retur Barang atau Void Nota"}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{isVoid ? "Sudah Void" : "Retur/Void"}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : sales.length > 0 ? (
                  sales.map((sale) => {
                    const isVoid = Boolean(sale.isVoid);
                    return (
                      <tr
                        key={sale.id}
                        className={`transition ${isVoid ? "bg-rose-50/40 hover:bg-rose-50/70" : "hover:bg-slate-50/80"}`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={isVoid ? "line-through text-slate-400" : ""}>{sale.invoiceCode}</span>
                            {isVoid && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white tracking-wider">
                                VOID
                              </span>
                            )}
                          </div>
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
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <div className={isVoid ? "line-through text-slate-400" : "text-slate-900"}>
                            Rp {sale.totalAmount.toLocaleString("id-ID")}
                          </div>
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
                          </div>
                        </td>
                      </tr>
                    );
                  })
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

      {/* ==================================================================== */}
      {/* MODAL: OTORISASI PIN PEMILIK (PRD F2.8 & F5.6) */}
      {/* ==================================================================== */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Otorisasi PIN Pemilik</h3>
                  <p className="text-[10px] text-slate-400">Buka Akses Laba Kotor & HPP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUnlockModalOpen(false);
                  setOwnerPinInput("");
                  setUnlockError(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Sesuai ketentuan keamanan, metrik <strong>Laba Kotor</strong>, <strong>HPP</strong>, dan <strong>Nilai Persediaan</strong> hanya dapat dilihat dengan izin Pemilik.
            </p>

            <form onSubmit={handleVerifyOwnerPin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Masukkan PIN Pemilik (6 Digit) / Kode Pemulihan
                </label>
                <input
                  type="password"
                  autoFocus
                  maxLength={18}
                  value={ownerPinInput}
                  onChange={(e) => setOwnerPinInput(e.target.value)}
                  placeholder="PIN 6 Digit atau REC-XXXX-XXXX"
                  className="w-full text-center tracking-widest text-lg font-mono font-bold py-2.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Virtual Numpad Cepat */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setOwnerPinInput((prev) => (prev.length < 18 ? prev + num : prev))}
                    className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-mono font-bold text-sm text-slate-800 transition cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOwnerPinInput("")}
                  className="py-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerPinInput((prev) => (prev.length < 18 ? prev + "0" : prev))}
                  className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-mono font-bold text-sm text-slate-800 transition cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerPinInput((prev) => prev.slice(0, -1))}
                  className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-xs text-slate-700 transition cursor-pointer"
                >
                  &larr; Hapus
                </button>
              </div>

              {unlockError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-medium">
                  {unlockError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUnlockModalOpen(false);
                    setOwnerPinInput("");
                    setUnlockError(null);
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPin}
                  className="flex-1 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shadow-md"
                >
                  {isVerifyingPin ? "Memeriksa..." : "Verifikasi PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
