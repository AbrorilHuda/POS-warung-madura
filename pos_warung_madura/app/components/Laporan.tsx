import React, { useState } from "react";
import {
  TrendingUp,
  DollarSign,
  Package,
  Receipt,
  Eye,
  CloudUpload,
} from "lucide-react";
import type { Sale, Product } from "../types/pos";

interface LaporanProps {
  sales: Sale[];
  products: Product[];
  onViewSaleReceipt: (sale: Sale) => void;
  onSyncAllSales: () => void;
  isSyncing: boolean;
}

export const Laporan: React.FC<LaporanProps> = ({
  sales,
  products,
  onViewSaleReceipt,
  onSyncAllSales,
  isSyncing,
}) => {
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);

  let totalCost = 0;
  let totalCostTrackedRevenue = 0;

  sales.forEach((s) => {
    s.items.forEach((it) => {
      if (it.costPrice && it.costPrice > 0) {
        totalCost += it.costPrice * it.qty;
        totalCostTrackedRevenue += it.price * it.qty;
      }
    });
  });

  const estimatedGrossProfit = totalCostTrackedRevenue - totalCost;
  const profitMarginPercent =
    totalCostTrackedRevenue > 0
      ? Math.round((estimatedGrossProfit / totalCostTrackedRevenue) * 100)
      : 0;

  const totalStockAssetValue = products.reduce((sum, p) => {
    const baseUnit = p.units?.find((u) => u.isBaseUnit) || p.units?.[0];
    const cost = baseUnit ? (baseUnit.costPrice || baseUnit.price * 0.8) : 0;
    return sum + (p.stockInBaseUnit || 0) * cost;
  }, 0);

  const pendingCount = sales.filter((s) => s.syncStatus === "pending").length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Laporan Penjualan & Margin
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ringkasan omzet, perkiraan margin keuntungan, dan status antrean sinkronisasi invoice cloud.
          </p>
        </div>

        {pendingCount > 0 && (
          <button
            onClick={onSyncAllSales}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
          >
            <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>
              {isSyncing ? "Menyinkronkan..." : `Kirim ${pendingCount} Transaksi ke Cloud`}
            </span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Omzet</span>
          <p className="text-xl font-black text-slate-900 font-mono mt-1">
            Rp {totalRevenue.toLocaleString("id-ID")}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {sales.length} Transaksi
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Estimasi Margin Laba</span>
          <p className="text-xl font-black text-emerald-600 font-mono mt-1">
            Rp {estimatedGrossProfit.toLocaleString("id-ID")}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Margin rata-rata ~{profitMarginPercent}%
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Nilai Aset Stok</span>
          <p className="text-xl font-black text-slate-900 font-mono mt-1">
            Rp {Math.round(totalStockAssetValue).toLocaleString("id-ID")}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {products.length} SKU Barang
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Status Sinkronisasi</span>
          <p className="text-xl font-black text-slate-900 font-mono mt-1">
            {sales.length - pendingCount}/{sales.length}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {pendingCount === 0 ? "Semua tersinkron" : `${pendingCount} Menunggu`}
          </span>
        </div>
      </div>

      {/* Transactions History */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
        <h3 className="font-bold text-slate-900 text-xs mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Receipt className="w-3.5 h-3.5 text-slate-600" />
          <span>Riwayat Transaksi Penjualan</span>
        </h3>

        <div className="space-y-2">
          {sales.map((sale) => (
            <div
              key={sale.id}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {sale.invoiceCode}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      sale.syncStatus === "synced"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {sale.syncStatus === "synced" ? "Tersinkron" : "Antrean Sync"}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  {sale.timestamp} &bull; {sale.paymentMethod} &bull; Kasir: {sale.cashierName}
                </p>
                <p className="text-slate-400 text-[10px] mt-0.5">
                  {sale.items.map((i) => `${i.productName} (${i.qty} ${i.unitName})`).join(", ")}
                </p>
              </div>

              <div className="flex items-center gap-3 justify-between sm:justify-end">
                <span className="font-mono font-bold text-xs text-slate-900">
                  Rp {sale.totalAmount.toLocaleString("id-ID")}
                </span>

                <button
                  onClick={() => onViewSaleReceipt(sale)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
                >
                  <Eye className="w-3 h-3 text-slate-500" />
                  <span>Struk</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
