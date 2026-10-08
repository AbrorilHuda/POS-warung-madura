import type { RowDataPacket } from "mysql2";
import { pool, query, ensureDatabaseSchema } from "../db.server";

export interface ReportFilter {
  period?: "today" | "yesterday" | "last_7_days" | "this_month" | "last_month" | "custom";
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  paymentMethod?: string; // 'all' | 'Tunai' | 'QRIS' | 'Kasbon'
}

export interface FinancialSummary {
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;          // Total Omzet
  totalTransactions: number;      // Total Transaksi
  averageOrderValue: number;      // Rata-rata per Transaksi
  totalCostOfGoodsSold: number;   // Total HPP
  grossProfit: number;            // Laba Kotor (Omzet - HPP)
  grossMarginPercent: number;     // Margin (%)
  totalCashSales: number;         // Penerimaan Tunai Langsung
  totalQrisSales: number;         // Penerimaan QRIS
  totalDebtSales: number;         // Kasbon Baru Terbit
  totalDebtCollected: number;     // Pelunasan Kasbon Diterima
  totalRestockExpense: number;    // Belanja Kulakan Masuk
  netCashFlow: number;            // Arus Kas Bersih Masuk
  totalInventoryAssetValue: number; // Nilai Aset Stok Saat Ini
  lowStockCount: number;          // Jumlah Produk Stok Menipis
}

export interface TopProductItem {
  productId: string;
  productName: string;
  category: string;
  totalQtySold: number;
  totalRevenue: number;
  totalCogs: number;
  totalProfit: number;
  profitMarginPercent: number;
}

export interface DeadStockItem {
  productId: string;
  productName: string;
  category: string;
  stockInBaseUnit: number;
  baseUnit: string;
  costPrice: number;
  totalAssetValue: number;
  lastSoldDate: string | null;
  daysSinceLastSold: number | null;
}

export interface DailyTrendPoint {
  date: string;
  revenue: number;
  cogs: number;
  profit: number;
  transactionsCount: number;
}

export interface DetailedSaleReportRow {
  invoiceCode: string;
  timestamp: string;
  cashierName: string;
  customerName: string;
  paymentMethod: string;
  totalAmount: number;
  totalCogs: number;
  grossProfit: number;
  itemCount: number;
}

/**
 * Menyelesaikan rentang tanggal SQL dari filter yang dipilih
 */
export function resolveDateRange(filter: ReportFilter): { start: string; end: string; label: string } {
  const now = new Date();
  const formatYmd = (d: Date) => d.toISOString().slice(0, 10);

  if (filter.period === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = formatYmd(yesterday);
    return { start: `${yStr} 00:00:00`, end: `${yStr} 23:59:59`, label: "Kemarin" };
  }

  if (filter.period === "last_7_days") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    return {
      start: `${formatYmd(sevenDaysAgo)} 00:00:00`,
      end: `${formatYmd(now)} 23:59:59`,
      label: "7 Hari Terakhir",
    };
  }

  if (filter.period === "last_month") {
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: `${formatYmd(firstDayLastMonth)} 00:00:00`,
      end: `${formatYmd(lastDayLastMonth)} 23:59:59`,
      label: "Bulan Lalu",
    };
  }

  if (filter.period === "this_month") {
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: `${formatYmd(firstDayThisMonth)} 00:00:00`,
      end: `${formatYmd(now)} 23:59:59`,
      label: "Bulan Ini",
    };
  }

  if (filter.period === "custom" && filter.startDate && filter.endDate) {
    return {
      start: `${filter.startDate} 00:00:00`,
      end: `${filter.endDate} 23:59:59`,
      label: `${filter.startDate} s/d ${filter.endDate}`,
    };
  }

  // Default: Hari Ini
  const todayStr = formatYmd(now);
  return { start: `${todayStr} 00:00:00`, end: `${todayStr} 23:59:59`, label: "Hari Ini" };
}

/**
 * Menghitung Laporan Keuangan Utama (Ringkasan Omzet, HPP, Laba, dan Arus Kas)
 */
export async function getFinancialSummary(filter: ReportFilter): Promise<FinancialSummary> {
  await ensureDatabaseSchema();
  const { start, end, label } = resolveDateRange(filter);

  let methodClause = "";
  const params: any[] = [start, end];

  if (filter.paymentMethod && filter.paymentMethod !== "all") {
    methodClause = "AND s.payment_method = ?";
    params.push(filter.paymentMethod);
  }

  // 1. Query Agregasi Penjualan & HPP (Abaikan Nota yang sudah VOID)
  const salesAggQuery = `
    SELECT 
      COUNT(DISTINCT s.id) AS total_transactions,
      COALESCE(SUM(s.total_amount), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN s.payment_method = 'Tunai' THEN s.total_amount ELSE 0 END), 0) AS total_cash_sales,
      COALESCE(SUM(CASE WHEN s.payment_method = 'QRIS' THEN s.total_amount ELSE 0 END), 0) AS total_qris_sales,
      COALESCE(SUM(CASE WHEN s.payment_method IN ('Kasbon', 'Hutang') THEN s.total_amount ELSE 0 END), 0) AS total_debt_sales
    FROM sales s
    WHERE s.created_at BETWEEN ? AND ? AND (s.is_void IS NULL OR s.is_void = FALSE)
    ${methodClause}
  `;

  const salesAggRows = await query<RowDataPacket[]>(salesAggQuery, params);
  const salesAgg = salesAggRows[0] || {};

  // 2. Query HPP (COGS) dari Snapshot sale_items
  const cogsQuery = `
    SELECT 
      COALESCE(SUM(
        COALESCE(si.cost_price, pu.cost_price, si.price * 0.8) * si.quantity
      ), 0) AS total_cogs
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    LEFT JOIN product_units pu ON si.product_unit_id = pu.id
    WHERE s.created_at BETWEEN ? AND ? AND (s.is_void IS NULL OR s.is_void = FALSE)
    ${methodClause}
  `;
  const cogsRows = await query<RowDataPacket[]>(cogsQuery, params);
  const totalCogs = Number(cogsRows[0]?.total_cogs || 0);

  // 3. Pelunasan Kasbon yang Masuk pada Periode Ini
  const debtCollectedQuery = `
    SELECT COALESCE(SUM(rp.amount), 0) AS total_collected
    FROM receivable_payments rp
    WHERE rp.paid_at BETWEEN ? AND ?
  `;
  const debtCollectedRows = await query<RowDataPacket[]>(debtCollectedQuery, [start, end]);
  const totalDebtCollected = Number(debtCollectedRows[0]?.total_collected || 0);

  // 4. Belanja Kulakan Masuk pada Periode Ini (Cash Outflow)
  const restockQuery = `
    SELECT COALESCE(SUM(
      COALESCE(sm.cost_per_unit, 0) * sm.unit_qty_used
    ), 0) AS total_restock
    FROM stock_movements sm
    WHERE sm.type = 'in' AND sm.created_at BETWEEN ? AND ?
  `;
  const restockRows = await query<RowDataPacket[]>(restockQuery, [start, end]);
  const totalRestockExpense = Number(restockRows[0]?.total_restock || 0);

  // 5. Total Nilai Persediaan Stok Saat Ini & Produk Menipis (Gunakan View v_product_current_stocks)
  const stockInventoryQuery = `
    SELECT 
      COALESCE(SUM(
        COALESCE(s.current_stock_base_unit, 0) * COALESCE(base_u.cost_price, base_u.price * 0.8, 0)
      ), 0) AS total_inventory_value,
      COUNT(CASE WHEN COALESCE(s.current_stock_base_unit, 0) <= p.min_stock_alert THEN 1 END) AS low_stock_count
    FROM products p
    LEFT JOIN v_product_current_stocks s ON p.id = s.product_id
    LEFT JOIN product_units base_u ON p.id = base_u.product_id AND base_u.is_base_unit = 1
    WHERE p.is_active = 1
  `;
  const stockInvRows = await query<RowDataPacket[]>(stockInventoryQuery);
  const totalInventoryAssetValue = Number(stockInvRows[0]?.total_inventory_value || 0);
  const lowStockCount = Number(stockInvRows[0]?.low_stock_count || 0);

  // Kalkulasi Keuangan
  const totalRevenue = Number(salesAgg.total_revenue || 0);
  const totalTransactions = Number(salesAgg.total_transactions || 0);
  const averageOrderValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;
  const grossProfit = totalRevenue - totalCogs;
  const grossMarginPercent = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

  const totalCashSales = Number(salesAgg.total_cash_sales || 0);
  const totalQrisSales = Number(salesAgg.total_qris_sales || 0);
  const totalDebtSales = Number(salesAgg.total_debt_sales || 0);

  // Arus kas masuk nyata (Tunai + QRIS + Pelunasan Kasbon) dikurangi belanja kulakan
  const netCashFlow = totalCashSales + totalQrisSales + totalDebtCollected - totalRestockExpense;

  return {
    periodLabel: label,
    startDate: start.slice(0, 10),
    endDate: end.slice(0, 10),
    totalRevenue,
    totalTransactions,
    averageOrderValue,
    totalCostOfGoodsSold: totalCogs,
    grossProfit,
    grossMarginPercent,
    totalCashSales,
    totalQrisSales,
    totalDebtSales,
    totalDebtCollected,
    totalRestockExpense,
    netCashFlow,
    totalInventoryAssetValue,
    lowStockCount,
  };
}

/**
 * Mendapatkan Daftar Produk Terlaris (Berdasarkan Kuantiti & Sumbangan Laba)
 */
export async function getTopProducts(filter: ReportFilter, limit: number = 10): Promise<TopProductItem[]> {
  await ensureDatabaseSchema();
  const { start, end } = resolveDateRange(filter);

  let methodClause = "";
  const params: any[] = [start, end];
  if (filter.paymentMethod && filter.paymentMethod !== "all") {
    methodClause = "AND s.payment_method = ?";
    params.push(filter.paymentMethod);
  }
  params.push(limit);

  const queryStr = `
    SELECT 
      si.product_id AS productId,
      si.snapshot_product_name AS productName,
      COALESCE(p.category, 'Umum') AS category,
      SUM(si.quantity) AS totalQtySold,
      SUM(si.subtotal) AS totalRevenue,
      SUM(COALESCE(si.cost_price, pu.cost_price, si.price * 0.8) * si.quantity) AS totalCogs,
      SUM(si.subtotal - (COALESCE(si.cost_price, pu.cost_price, si.price * 0.8) * si.quantity)) AS totalProfit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    LEFT JOIN products p ON si.product_id = p.id
    LEFT JOIN product_units pu ON si.product_unit_id = pu.id
    WHERE s.created_at BETWEEN ? AND ? AND (s.is_void IS NULL OR s.is_void = FALSE)
    ${methodClause}
    GROUP BY si.product_id, si.snapshot_product_name, p.category
    ORDER BY totalProfit DESC
    LIMIT ?
  `;

  const rows = await query<RowDataPacket[]>(queryStr, params);

  return rows.map((r) => {
    const rev = Number(r.totalRevenue || 0);
    const profit = Number(r.totalProfit || 0);
    return {
      productId: r.productId,
      productName: r.productName,
      category: r.category,
      totalQtySold: Number(r.totalQtySold || 0),
      totalRevenue: rev,
      totalCogs: Number(r.totalCogs || 0),
      totalProfit: profit,
      profitMarginPercent: rev > 0 ? Math.round((profit / rev) * 100) : 0,
    };
  });
}

/**
 * Mendapatkan Daftar Produk Macet (Dead Stock) - Ada stok tapi tidak terjual dalam N hari
 */
export async function getDeadStockProducts(daysThreshold: number = 14): Promise<DeadStockItem[]> {
  await ensureDatabaseSchema();
  const queryStr = `
    SELECT 
      p.id AS productId,
      p.name AS productName,
      p.category,
      COALESCE(s.current_stock_base_unit, 0) AS stockInBaseUnit,
      p.base_unit AS baseUnit,
      COALESCE(base_u.cost_price, base_u.price * 0.8, 0) AS costPrice,
      (COALESCE(s.current_stock_base_unit, 0) * COALESCE(base_u.cost_price, base_u.price * 0.8, 0)) AS totalAssetValue,
      MAX(sales.created_at) AS lastSoldDate,
      DATEDIFF(NOW(), MAX(sales.created_at)) AS daysSinceLastSold
    FROM products p
    LEFT JOIN v_product_current_stocks s ON p.id = s.product_id
    LEFT JOIN product_units base_u ON p.id = base_u.product_id AND base_u.is_base_unit = 1
    LEFT JOIN sale_items si ON p.id = si.product_id
    LEFT JOIN sales ON si.sale_id = sales.id AND (sales.is_void IS NULL OR sales.is_void = FALSE)
    WHERE p.is_active = 1 AND COALESCE(s.current_stock_base_unit, 0) > 0
    GROUP BY p.id, p.name, p.category, s.current_stock_base_unit, p.base_unit, base_u.cost_price, base_u.price
    HAVING (daysSinceLastSold >= ? OR daysSinceLastSold IS NULL)
    ORDER BY totalAssetValue DESC
    LIMIT 15
  `;

  const rows = await query<RowDataPacket[]>(queryStr, [daysThreshold]);

  return rows.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    category: r.category,
    stockInBaseUnit: Number(r.stockInBaseUnit || 0),
    baseUnit: r.baseUnit,
    costPrice: Number(r.costPrice || 0),
    totalAssetValue: Number(r.totalAssetValue || 0),
    lastSoldDate: r.lastSoldDate ? new Date(r.lastSoldDate).toISOString().slice(0, 10) : null,
    daysSinceLastSold: r.daysSinceLastSold !== null ? Number(r.daysSinceLastSold) : null,
  }));
}

/**
 * Mendapatkan Data Tren Penjualan Harian
 */
export async function getDailyTrend(filter: ReportFilter): Promise<DailyTrendPoint[]> {
  await ensureDatabaseSchema();
  const { start, end } = resolveDateRange(filter);

  let methodClause = "";
  const params: any[] = [start, end];
  if (filter.paymentMethod && filter.paymentMethod !== "all") {
    methodClause = "AND s.payment_method = ?";
    params.push(filter.paymentMethod);
  }

  const queryStr = `
    SELECT 
      DATE(s.created_at) AS tx_date,
      COUNT(DISTINCT s.id) AS tx_count,
      COALESCE(SUM(s.total_amount), 0) AS daily_revenue,
      COALESCE(SUM(
        COALESCE(si.cost_price, pu.cost_price, si.price * 0.8) * si.quantity
      ), 0) AS daily_cogs
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    LEFT JOIN product_units pu ON si.product_unit_id = pu.id
    WHERE s.created_at BETWEEN ? AND ? AND (s.is_void IS NULL OR s.is_void = FALSE)
    ${methodClause}
    GROUP BY DATE(s.created_at)
    ORDER BY tx_date ASC
  `;

  const rows = await query<RowDataPacket[]>(queryStr, params);

  return rows.map((r) => {
    const rev = Number(r.daily_revenue || 0);
    const cogs = Number(r.daily_cogs || 0);
    const dateFormatted = r.tx_date instanceof Date ? r.tx_date.toISOString().slice(0, 10) : String(r.tx_date);
    return {
      date: dateFormatted,
      revenue: rev,
      cogs,
      profit: rev - cogs,
      transactionsCount: Number(r.tx_count || 0),
    };
  });
}

/**
 * Mengambil daftar transaksi penjualan terinci beserta HPP dan laba kotor per nota
 */
export async function getDetailedSalesReport(
  filter: ReportFilter,
  limit: number = 50
): Promise<DetailedSaleReportRow[]> {
  await ensureDatabaseSchema();
  const { start, end } = resolveDateRange(filter);
  const conditions: string[] = [
    "s.created_at BETWEEN ? AND ?",
    "(s.is_void IS NULL OR s.is_void = FALSE)"
  ];
  const params: any[] = [start, end];

  if (filter.paymentMethod && filter.paymentMethod !== "all") {
    conditions.push("s.payment_method = ?");
    params.push(filter.paymentMethod);
  }

  const whereClause = conditions.join(" AND ");

  const sql = `
    SELECT
      s.invoice_code,
      s.created_at,
      COALESCE(s.cashier_name, 'Kasir') AS cashier_name,
      COALESCE(s.customer_name, c.name, 'Pelanggan Umum') AS customer_name,
      s.payment_method,
      s.total_amount,
      COUNT(si.id) AS item_count,
      SUM(COALESCE(si.cost_price, pu.cost_price, si.price * 0.8) * si.quantity) AS total_cogs
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN sale_items si ON s.id = si.sale_id
    LEFT JOIN product_units pu ON si.product_unit_id = pu.id
    WHERE ${whereClause}
    GROUP BY s.id, s.invoice_code, s.created_at, s.cashier_name, s.customer_name, c.name, s.payment_method, s.total_amount
    ORDER BY s.created_at DESC
    LIMIT ?
  `;

  params.push(limit);

  const rows = await query<RowDataPacket[]>(sql, params);

  return rows.map((r) => {
    const totalAmount = Number(r.total_amount || 0);
    const totalCogs = Number(r.total_cogs || 0);
    const dateFormatted =
      r.created_at instanceof Date
        ? r.created_at.toLocaleString("id-ID")
        : String(r.created_at);

    return {
      invoiceCode: String(r.invoice_code || ""),
      timestamp: dateFormatted,
      cashierName: String(r.cashier_name || "Kasir"),
      customerName: String(r.customer_name || "Pelanggan Umum"),
      paymentMethod: String(r.payment_method || "Tunai"),
      totalAmount,
      totalCogs: Math.round(totalCogs),
      grossProfit: Math.round(totalAmount - totalCogs),
      itemCount: Number(r.item_count || 0),
    };
  });
}

/**
 * Menghasilkan file CSV resmi dengan UTF-8 BOM agar langsung kompatibel dibuka di Microsoft Excel
 */
export async function generateFinancialCsv(filter: ReportFilter): Promise<string> {
  const summary = await getFinancialSummary(filter);
  const topProducts = await getTopProducts(filter, 20);
  const detailedSales = await getDetailedSalesReport(filter, 200);

  // UTF-8 Byte Order Mark (BOM) agar Microsoft Excel membaca karakter dengan benar
  let csv = "\uFEFF";

  csv += "=== LAPORAN KEUANGAN & LABA RUGI POS WARUNG MADURA ===\n";
  csv += `Periode: ${summary.periodLabel} (${summary.startDate} s/d ${summary.endDate})\n`;
  csv += `Diekspor Pada: ${new Date().toLocaleString("id-ID")}\n\n`;

  csv += "--- RINGKASAN KEUANGAN UTAMA ---\n";
  csv += "Metrik,Nilai\n";
  csv += `Total Omzet Penjualan,${summary.totalRevenue}\n`;
  csv += `Total HPP (Harga Pokok),${summary.totalCostOfGoodsSold}\n`;
  csv += `Laba Kotor (Gross Profit),${summary.grossProfit}\n`;
  csv += `Margin Keuntungan (%),${summary.grossMarginPercent}%\n`;
  csv += `Jumlah Transaksi,${summary.totalTransactions}\n`;
  csv += `Rata-rata Transaksi (AOV),${summary.averageOrderValue}\n`;
  csv += `Penerimaan Tunai,${summary.totalCashSales}\n`;
  csv += `Penerimaan QRIS,${summary.totalQrisSales}\n`;
  csv += `Kasbon Baru Terbit,${summary.totalDebtSales}\n`;
  csv += `Pelunasan Kasbon Diterima,${summary.totalDebtCollected}\n`;
  csv += `Belanja Kulakan Masuk,${summary.totalRestockExpense}\n`;
  csv += `Arus Kas Bersih (Cash Flow),${summary.netCashFlow}\n`;
  csv += `Total Nilai Persediaan Stok Saat Ini,${summary.totalInventoryAssetValue}\n`;
  csv += `Produk Stok Menipis (Alert),${summary.lowStockCount}\n\n`;

  csv += "--- PRODUK DENGAN KONTRIBUSI LABA TERTINGGI (TOP SELLER) ---\n";
  csv += "No,Nama Produk,Kategori,Qty Terjual,Omzet Penjualan,Total HPP,Laba Kotor,Margin (%)\n";
  topProducts.forEach((p, idx) => {
    const cleanName = `"${p.productName.replace(/"/g, '""')}"`;
    const cleanCat = `"${p.category.replace(/"/g, '""')}"`;
    csv += `${idx + 1},${cleanName},${cleanCat},${p.totalQtySold},${p.totalRevenue},${p.totalCogs},${p.totalProfit},${p.profitMarginPercent}%\n`;
  });

  csv += "\n--- RINCIAN TRANSAKSI NOTA PENJUALAN ---\n";
  csv += "No Nota,Waktu,Kasir,Pelanggan,Metode Bayar,Omzet,HPP,Laba Kotor\n";
  detailedSales.forEach((s) => {
    csv += `"${s.invoiceCode}","${s.timestamp}","${s.cashierName}","${s.customerName}","${s.paymentMethod}",${s.totalAmount},${s.totalCogs},${s.grossProfit}\n`;
  });

  return csv;
}

