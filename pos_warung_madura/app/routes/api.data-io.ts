import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import {
  getProductTemplateCsv,
  getCustomerTemplateCsv,
  validateProductImport,
  commitProductImport,
  validateCustomerImport,
  commitCustomerImport,
  exportProductsToCsv,
  exportCustomersToCsv,
  exportSalesHistoryToCsv,
  exportStockInventoryToCsv,
} from "../services/import-export.server";

/**
 * LOADER: Menangani Unduhan Berkas Template & Ekspor Data CSV/Excel (UTF-8 BOM)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Unduh Template Produk
  if (action === "template_products") {
    const csv = getProductTemplateCsv();
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="template_produk_warung_madura.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  // 2. Unduh Template Pelanggan
  if (action === "template_customers") {
    const csv = getCustomerTemplateCsv();
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="template_pelanggan_warung_madura.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  // 3. Ekspor Data Produk
  if (action === "export_products") {
    const csv = await exportProductsToCsv();
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="katalog_produk_${todayStr}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // 4. Ekspor Data Pelanggan & Kasbon
  if (action === "export_customers") {
    const csv = await exportCustomersToCsv();
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pelanggan_kasbon_${todayStr}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // 5. Ekspor Riwayat Transaksi
  if (action === "export_sales") {
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;
    const paymentMethod = url.searchParams.get("paymentMethod") || undefined;

    const csv = await exportSalesHistoryToCsv({ startDate, endDate, paymentMethod });
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="riwayat_penjualan_${todayStr}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // 6. Ekspor Rekap Nilai Stok Persediaan
  if (action === "export_stock") {
    const csv = await exportStockInventoryToCsv();
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rekap_stok_persediaan_${todayStr}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json({
    ok: false,
    error: "Aksi unduh atau ekspor tidak dikenali.",
    availableActions: [
      "template_products",
      "template_customers",
      "export_products",
      "export_customers",
      "export_sales",
      "export_stock",
    ],
  }, { status: 400 });
}

/**
 * ACTION: Menangani Validasi Baris demi Baris & Eksekusi Impor Database Atomik
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    let payload: any = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      const formData = await request.formData();
      payload = {
        action: formData.get("action"),
        csvContent: formData.get("csvContent"),
        duplicateAction: formData.get("duplicateAction"),
        validRows: formData.get("validRows") ? JSON.parse(String(formData.get("validRows"))) : undefined,
      };
    }

    const { action } = payload;

    // A. Preview & Validasi Impor Produk
    if (action === "preview_products") {
      const csvContent = payload.csvContent || "";
      if (!csvContent.trim()) {
        return Response.json({ ok: false, error: "Isi berkas CSV kosong atau tidak ditemukan." }, { status: 400 });
      }

      const preview = await validateProductImport(csvContent);
      return Response.json({ ok: true, preview });
    }

    // B. Commit Eksekusi Impor Produk (MySQL Transaction)
    if (action === "commit_products") {
      const validRows = payload.validRows;
      const duplicateAction = payload.duplicateAction || "update";

      if (!Array.isArray(validRows) || validRows.length === 0) {
        return Response.json({ ok: false, error: "Tidak ada baris produk valid yang dapat diimpor." }, { status: 400 });
      }

      const result = await commitProductImport(validRows, duplicateAction);
      return Response.json({ ok: true, result });
    }

    // C. Preview & Validasi Impor Pelanggan
    if (action === "preview_customers") {
      const csvContent = payload.csvContent || "";
      if (!csvContent.trim()) {
        return Response.json({ ok: false, error: "Isi berkas CSV kosong atau tidak ditemukan." }, { status: 400 });
      }

      const preview = await validateCustomerImport(csvContent);
      return Response.json({ ok: true, preview });
    }

    // D. Commit Eksekusi Impor Pelanggan (MySQL Transaction)
    if (action === "commit_customers") {
      const validRows = payload.validRows;
      const duplicateAction = payload.duplicateAction || "update";

      if (!Array.isArray(validRows) || validRows.length === 0) {
        return Response.json({ ok: false, error: "Tidak ada baris pelanggan valid yang dapat diimpor." }, { status: 400 });
      }

      const result = await commitCustomerImport(validRows, duplicateAction);
      return Response.json({ ok: true, result });
    }

    return Response.json({ ok: false, error: `Action '${action}' tidak valid.` }, { status: 400 });
  } catch (error: any) {
    console.error("[api.data-io] Terjadi kesalahan:", error);
    return Response.json({ ok: false, error: error.message || "Gagal memproses data IO." }, { status: 500 });
  }
}
