import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getAllPromotions,
  getActivePromotions,
  createPromotion,
  updatePromotion,
  togglePromotion,
  deletePromotion,
} from "../services/promo.server";
import { verifyOwnerPin, createAuditLog } from "../services/shift.server";

/**
 * GET /api/promotions
 * Mengambil daftar promosi (seluruhnya atau yang aktif saja)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("active") === "true";

  try {
    const promotions = activeOnly
      ? await getActivePromotions()
      : await getAllPromotions();
    return Response.json({ ok: true, promotions });
  } catch (err: any) {
    console.error("[api.promotions loader error]:", err);
    return Response.json(
      { ok: false, error: err.message || "Gagal memuat promosi" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/promotions
 * Menangani pembuatan, pengubahan, pengaktifan, dan penghapusan promo,
 * serta otorisasi override diskon manual kasir jika melebihi batas.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Metode tidak diizinkan" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const actionType = body.action;

    switch (actionType) {
      case "create": {
        const promo = await createPromotion(body.data);
        return Response.json({ ok: true, promo });
      }

      case "update": {
        const id = String(body.id || "");
        if (!id) return Response.json({ ok: false, error: "ID Promo wajib diisi" }, { status: 400 });
        await updatePromotion(id, body.data);
        return Response.json({ ok: true });
      }

      case "toggle": {
        const id = String(body.id || "");
        const isActive = Boolean(body.isActive);
        if (!id) return Response.json({ ok: false, error: "ID Promo wajib diisi" }, { status: 400 });
        await togglePromotion(id, isActive);
        return Response.json({ ok: true, isActive });
      }

      case "delete": {
        const id = String(body.id || "");
        if (!id) return Response.json({ ok: false, error: "ID Promo wajib diisi" }, { status: 400 });
        await deletePromotion(id);
        return Response.json({ ok: true });
      }

      case "authorize_discount": {
        // PRD F6.3: Otorisasi PIN Pemilik untuk diskon di atas limit atau di bawah HPP
        const ownerPin = String(body.ownerPin || "").trim();
        const discountType = body.discountType || "manual";
        const reason = String(body.reason || "Diskon Khusus Pelanggan").trim();
        const amount = Number(body.amount || 0);
        const itemOrInvoice = String(body.target || "Transaksi");

        if (!ownerPin) {
          return Response.json({ ok: false, error: "PIN Pemilik wajib diisi" }, { status: 400 });
        }

        const valid = await verifyOwnerPin(ownerPin);
        if (!valid) {
          return Response.json({ ok: false, error: "PIN Pemilik tidak valid" }, { status: 401 });
        }

        // Catat ke Audit Log
        await createAuditLog(
          "SUPERVISOR_DISCOUNT_OVERRIDE",
          "discount",
          null,
          `Otorisasi diskon ${discountType} pada ${itemOrInvoice} senilai Rp ${amount.toLocaleString("id-ID")}. Alasan: ${reason}`,
          "Pemilik"
        );

        return Response.json({ ok: true, message: "Otorisasi Diskon Pemilik Disetujui" });
      }

      default:
        return Response.json({ ok: false, error: "Aksi tidak dikenali" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[api.promotions action error]:", err);
    return Response.json(
      { ok: false, error: err.message || "Gagal memproses aksi promo" },
      { status: 400 }
    );
  }
}
