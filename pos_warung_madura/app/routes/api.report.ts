import type { LoaderFunctionArgs } from "react-router";
import {
  type ReportFilter,
  getFinancialSummary,
  getTopProducts,
  getDeadStockProducts,
  getDailyTrend,
  getDetailedSalesReport,
  generateFinancialCsv,
} from "../services/report.server";

/**
 * GET /api/report
 * Endpoint untuk memuat analitik keuangan, produk terlaris, dead stock, tren harian,
 * serta ekspor file CSV yang kompatibel dengan Microsoft Excel (UTF-8 BOM).
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  const period = (url.searchParams.get("period") || "today") as ReportFilter["period"];
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const paymentMethod = url.searchParams.get("paymentMethod") || "all";
  const deadStockDays = parseInt(url.searchParams.get("deadStockDays") || "30", 10);
  const isExport = url.searchParams.get("export") === "csv";

  const filter: ReportFilter = {
    period,
    startDate,
    endDate,
    paymentMethod,
  };

  try {
    if (isExport) {
      const csvString = await generateFinancialCsv(filter);
      const safePeriod = filter.period || "custom";
      const filename = `laporan_keuangan_${safePeriod}_${new Date().toISOString().slice(0, 10)}.csv`;

      return new Response(csvString, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    const [summary, topProducts, deadStock, dailyTrend, detailedSales] = await Promise.all([
      getFinancialSummary(filter),
      getTopProducts(filter, 10),
      getDeadStockProducts(isNaN(deadStockDays) ? 30 : deadStockDays),
      getDailyTrend(filter),
      getDetailedSalesReport(filter, 50),
    ]);

    return Response.json({
      ok: true,
      filter,
      summary,
      topProducts,
      deadStock,
      dailyTrend,
      detailedSales,
    });
  } catch (err: any) {
    console.error("[api.report loader error]:", err);
    return Response.json(
      { ok: false, error: err.message || "Gagal memuat laporan keuangan" },
      { status: 500 }
    );
  }
}
