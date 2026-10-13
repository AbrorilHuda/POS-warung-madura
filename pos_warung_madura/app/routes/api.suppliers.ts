import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import {
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  createPurchaseTransaction,
  getPurchases,
} from "../services/supplier.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (type === "purchases") {
      const limit = Number(url.searchParams.get("limit") || 50);
      const purchases = await getPurchases(limit);
      return Response.json({ ok: true, purchases });
    }

    const suppliers = await getAllSuppliers();
    return Response.json({ ok: true, suppliers });
  } catch (err: any) {
    console.error("[api.suppliers loader error]:", err);
    return Response.json(
      { ok: false, error: err.message || "Gagal memuat data supplier" },
      { status: 500 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Metode tidak diizinkan" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const actionType = body.action;

    switch (actionType) {
      case "create_supplier": {
        const { name, phone, address, defaultPaymentTermDays, notes } = body;
        if (!name || !name.trim()) {
          return Response.json({ ok: false, error: "Nama supplier wajib diisi" }, { status: 400 });
        }
        const created = await createSupplier({
          name,
          phone,
          address,
          defaultPaymentTermDays,
          notes,
        });
        return Response.json({ ok: true, supplier: created, message: "Supplier berhasil ditambahkan" });
      }

      case "update_supplier": {
        const { id, name, phone, address, defaultPaymentTermDays, notes } = body;
        if (!id) {
          return Response.json({ ok: false, error: "ID supplier wajib diisi" }, { status: 400 });
        }
        await updateSupplier(id, { name, phone, address, defaultPaymentTermDays, notes });
        return Response.json({ ok: true, message: "Data supplier berhasil diperbarui" });
      }

      case "delete_supplier": {
        const { id } = body;
        if (!id) {
          return Response.json({ ok: false, error: "ID supplier wajib diisi" }, { status: 400 });
        }
        await deleteSupplier(id);
        return Response.json({ ok: true, message: "Supplier berhasil dinonaktifkan" });
      }

      case "create_purchase": {
        const { purchase } = body;
        if (!purchase || !purchase.invoiceNumber || !purchase.supplierId || !purchase.items || purchase.items.length === 0) {
          return Response.json(
            { ok: false, error: "Data faktur kulakan tidak lengkap. Mohon isi nomor nota, supplier, dan minimal 1 barang belanja." },
            { status: 400 }
          );
        }
        const purchaseId = await createPurchaseTransaction(purchase);
        return Response.json({
          ok: true,
          purchaseId,
          message: `Nota kulakan ${purchase.invoiceNumber} berhasil dibukukan ke stok dan HPP diperbarui.`,
        });
      }

      default:
        return Response.json({ ok: false, error: "Aksi tidak dikenali" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[api.suppliers action error]:", err);
    return Response.json(
      { ok: false, error: err.message || "Gagal memproses aksi supplier" },
      { status: 400 }
    );
  }
}
