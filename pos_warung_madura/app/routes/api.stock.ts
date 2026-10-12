import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getStockBatches,
  createManualStockAdjustment,
  getStockCardHistory,
  getReorderRecommendations,
  getStockOpnameHistory,
  createStockOpnameAdjustment,
  createStockKulakan,
} from "../services/pos.server";
import type { StockAdjustmentInput, StockOpnameItem } from "../types/pos";

/**
 * GET /api/stock
 * Endpoint query untuk Manajemen Stok Lanjutan:
 * - ?action=batches&productId=...
 * - ?action=stock_card&productId=...
 * - ?action=reorder
 * - ?action=opnames
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "batches";
  const productId = url.searchParams.get("productId") || undefined;

  try {
    switch (action) {
      case "batches": {
        const batches = await getStockBatches(productId);
        return Response.json({ ok: true, batches });
      }

      case "stock_card": {
        if (!productId) {
          return Response.json({ ok: false, error: "Parameter productId wajib disertakan" }, { status: 400 });
        }
        const cardEntries = await getStockCardHistory(productId);
        return Response.json({ ok: true, cardEntries });
      }

      case "reorder": {
        const recommendations = await getReorderRecommendations();
        return Response.json({ ok: true, recommendations });
      }

      case "opnames": {
        const opnameHistory = await getStockOpnameHistory();
        return Response.json({ ok: true, opnameHistory });
      }

      default:
        return Response.json({ ok: false, error: `Action '${action}' tidak dikenali` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[api.stock loader error]:", err);
    return Response.json({ ok: false, error: err.message || "Gagal memproses permintaan stok" }, { status: 500 });
  }
}

/**
 * POST /api/stock
 * Endpoint mutasi & administrasi stok:
 * - action: "manual_adjustment"
 * - action: "opname"
 * - action: "kulakan"
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Metode tidak diizinkan" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const actionType = body.action;

    switch (actionType) {
      case "manual_adjustment": {
        const adjustment: StockAdjustmentInput = {
          productId: String(body.productId || ""),
          qtyDiff: Number(body.qtyDiff || 0),
          reasonCategory: body.reasonCategory,
          notes: body.notes ? String(body.notes) : undefined,
          batchId: body.batchId ? String(body.batchId) : undefined,
          approvedBy: body.approvedBy ? String(body.approvedBy) : "Pemilik",
        };

        if (!adjustment.productId || adjustment.qtyDiff === 0 || !adjustment.reasonCategory) {
          return Response.json(
            { ok: false, error: "Produk, jumlah selisih, dan alasan wajib diisi" },
            { status: 400 }
          );
        }

        await createManualStockAdjustment(adjustment);
        return Response.json({ ok: true, message: "Penyesuaian stok berhasil dicatat ke ledger dan audit log" });
      }

      case "opname": {
        const sessionCode = String(body.sessionCode || `OPN-${Date.now()}`);
        const items: StockOpnameItem[] = body.items || [];
        const categoryFilter = body.categoryFilter || null;
        const approvedBy = body.approvedBy || "Pemilik";
        const notes = body.notes || "";

        await createStockOpnameAdjustment(sessionCode, items, {
          categoryFilter,
          approvedBy,
          notes,
        });

        return Response.json({
          ok: true,
          message: `Sesi opname ${sessionCode} berhasil disimpan dan disetujui`,
        });
      }

      case "kulakan": {
        const { productId, unit, unitQty, costPrice, supplier, batchNo, expiryDate } = body;
        if (!productId || !unit || !unitQty) {
          return Response.json({ ok: false, error: "Data kulakan tidak lengkap" }, { status: 400 });
        }

        await createStockKulakan({
          productId,
          unit,
          unitQty: Number(unitQty),
          costPrice: Number(costPrice || 0),
          supplier: String(supplier || "Distributor"),
          batchNo: batchNo ? String(batchNo) : undefined,
          expiryDate: expiryDate ? String(expiryDate) : null,
        });

        return Response.json({ ok: true, message: "Kulakan dan batch stok berhasil dicatat" });
      }

      default:
        return Response.json({ ok: false, error: `Action '${actionType}' tidak valid` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[api.stock action error]:", err);
    return Response.json({ ok: false, error: err.message || "Gagal memproses aksi stok" }, { status: 500 });
  }
}
