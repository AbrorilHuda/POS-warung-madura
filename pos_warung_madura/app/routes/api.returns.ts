import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getSaleDetailForReturn,
  voidSale,
  returnSaleItems,
} from "../services/returns.server";

/**
 * GET /api/returns?invoiceCode=...
 * Mengambil detail penjualan dan item-itemnya untuk formulir retur / void
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const invoice = url.searchParams.get("invoiceCode") || url.searchParams.get("id");

  if (!invoice) {
    return Response.json({ ok: false, error: "Nomor nota penjualan wajib disertakan" }, { status: 400 });
  }

  try {
    const sale = await getSaleDetailForReturn(invoice);
    if (!sale) {
      return Response.json({ ok: false, error: "Nota penjualan tidak ditemukan" }, { status: 404 });
    }
    return Response.json({ ok: true, sale });
  } catch (err: any) {
    console.error("[api.returns loader error]:", err);
    return Response.json({ ok: false, error: err.message || "Gagal memuat detail nota" }, { status: 500 });
  }
}

/**
 * POST /api/returns
 * Menangani aksi Void Penjualan Penuh atau Retur Parsial Item
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Metode tidak diizinkan" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const actionType = body.action;

    switch (actionType) {
      case "void": {
        const saleId = String(body.saleId || "");
        const reason = String(body.reason || "");
        const ownerPin = String(body.ownerPin || "");
        const approvedBy = String(body.approvedBy || "Pemilik");

        if (!saleId || !reason || !ownerPin) {
          return Response.json(
            { ok: false, error: "ID Transaksi, alasan void, dan PIN Pemilik wajib diisi" },
            { status: 400 }
          );
        }

        const result = await voidSale(saleId, reason, ownerPin, approvedBy);
        return Response.json(result);
      }

      case "return": {
        const saleId = String(body.saleId || "");
        const items = body.items || [];
        const refundMethod = body.refundMethod || "Tunai";
        const reason = String(body.reason || "");
        const ownerPin = String(body.ownerPin || "");
        const approvedBy = String(body.approvedBy || "Pemilik");

        if (!saleId || !items.length || !reason || !ownerPin) {
          return Response.json(
            { ok: false, error: "Data retur barang tidak lengkap" },
            { status: 400 }
          );
        }

        const result = await returnSaleItems(saleId, items, refundMethod, reason, ownerPin, approvedBy);
        return Response.json(result);
      }

      default:
        return Response.json({ ok: false, error: "Aksi retur tidak dikenali" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[api.returns action error]:", err);
    return Response.json({ ok: false, error: err.message || "Gagal memproses aksi retur" }, { status: 400 });
  }
}
