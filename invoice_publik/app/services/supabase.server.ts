import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PublicInvoice, PublicInvoiceItem, SyncPayload } from "../types/invoice";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("[Supabase Server] Terhubung ke Supabase Cloud:", supabaseUrl);
  } catch (err) {
    console.warn("[Supabase Server] Gagal inisialisasi Supabase:", err);
  }
} else {
  console.log("[Supabase Server] Berjalan dalam mode Local In-Memory Fallback (SUPABASE_URL belum diatur)");
}

/**
 * In-Memory Mock Store untuk pengembangan lokal tanpa akun Supabase
 */
const mockInvoices = new Map<string, PublicInvoice>();

// Seed sample invoice
const sampleInvoice: PublicInvoice = {
  id: "WM01-000141",
  storeName: "Warung Madura Berkah",
  storeAddress: "Jl. Raya Warung Madura No. 24, Buka 24 Jam Non-Stop",
  totalAmount: 64000,
  paidAmount: 100000,
  changeAmount: 36000,
  paymentMethod: "Tunai",
  cashierName: "Cak Mat",
  createdAt: new Date().toISOString(),
  items: [
    {
      id: "item-1",
      invoiceId: "WM01-000141",
      productName: "Sampoerna A Mild 16",
      unitName: "Bungkus",
      quantity: 1,
      price: 33000,
      subtotal: 33000,
    },
    {
      id: "item-2",
      invoiceId: "WM01-000141",
      productName: "Indomie Goreng Spesial",
      unitName: "Pcs",
      quantity: 5,
      price: 3500,
      subtotal: 17500,
    },
    {
      id: "item-3",
      invoiceId: "WM01-000141",
      productName: "Le Minerale 600ml",
      unitName: "Botol",
      quantity: 2,
      price: 4000,
      subtotal: 8000,
    },
    {
      id: "item-4",
      invoiceId: "WM01-000141",
      productName: "Kopi Kapal Api Spesial Mix",
      unitName: "Sachet",
      quantity: 3,
      price: 1800,
      subtotal: 5500,
    },
  ],
  isDemoMock: true,
};
mockInvoices.set(sampleInvoice.id, sampleInvoice);

export function isSupabaseConnected(): boolean {
  return supabase !== null;
}

/**
 * Mengambil invoice beserta items snapshot berdasarkan invoiceCode (id)
 */
export async function getInvoiceByCode(invoiceCode: string): Promise<PublicInvoice | null> {
  const code = invoiceCode.trim();

  // 1. Jika Supabase aktif, fetch dari Postgres
  if (supabase) {
    try {
      const { data: invData, error: invError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", code)
        .single();

      if (invError || !invData) {
        // Cek mock fallback jika belum ditemukan di cloud
        return mockInvoices.get(code) || null;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", code)
        .order("created_at", { ascending: true });

      const items: PublicInvoiceItem[] = (itemsData || []).map((it: any) => ({
        id: it.id,
        invoiceId: it.invoice_id,
        productName: it.product_name,
        unitName: it.unit_name,
        quantity: Number(it.quantity),
        price: Number(it.price),
        subtotal: Number(it.subtotal),
      }));

      return {
        id: invData.id,
        storeName: invData.store_name,
        storeAddress: invData.store_address,
        totalAmount: Number(invData.total_amount),
        paidAmount: Number(invData.paid_amount || 0),
        changeAmount: Number(invData.change_amount || 0),
        paymentMethod: invData.payment_method || "Tunai",
        cashierName: invData.cashier_name || "Cak Mat",
        createdAt: invData.created_at,
        items,
        isDemoMock: false,
      };
    } catch (err) {
      console.error("[Supabase Error] Gagal fetch invoice:", err);
      return mockInvoices.get(code) || null;
    }
  }

  // 2. Fallback in-memory mock store
  return mockInvoices.get(code) || null;
}

/**
 * Menyimpan snapshot invoice transaksi yang dikirim oleh POS Warung
 */
export async function saveInvoiceSnapshot(
  data: SyncPayload["invoice"]
): Promise<{ success: boolean; error?: string }> {
  const invoiceId = data.id || data.invoiceCode;
  if (!invoiceId) {
    return { success: false, error: "Nomor invoice tidak valid" };
  }

  const storeName = data.storeName || "Warung Madura Berkah";
  const storeAddress = data.storeAddress || "Jl. Raya Warung Madura No. 24, Buka 24 Jam";
  const createdAt = data.createdAt || new Date().toISOString();

  // Simpan ke in-memory map
  const mockItemObjects: PublicInvoiceItem[] = data.items.map((it, idx) => ({
    id: `item-${Date.now()}-${idx}`,
    invoiceId: invoiceId,
    productName: it.productName,
    unitName: it.unitName,
    quantity: it.qty,
    price: it.price,
    subtotal: it.subtotal,
  }));

  const invoiceObj: PublicInvoice = {
    id: invoiceId,
    storeName,
    storeAddress,
    totalAmount: data.totalAmount,
    paidAmount: data.paidAmount,
    changeAmount: data.changeAmount,
    paymentMethod: data.paymentMethod,
    cashierName: data.cashierName,
    createdAt,
    items: mockItemObjects,
    isDemoMock: !supabase,
  };

  mockInvoices.set(invoiceId, invoiceObj);

  // Jika Supabase aktif, simpan ke database cloud
  if (supabase) {
    try {
      // 1. Upsert header invoice
      const { error: headerErr } = await supabase.from("invoices").upsert({
        id: invoiceId,
        store_name: storeName,
        store_address: storeAddress,
        total_amount: data.totalAmount,
        paid_amount: data.paidAmount,
        change_amount: data.changeAmount,
        payment_method: data.paymentMethod,
        cashier_name: data.cashierName,
        created_at: createdAt,
      });

      if (headerErr) {
        console.error("[Supabase Error] Gagal simpan invoice header:", headerErr);
        return { success: false, error: headerErr.message };
      }

      // 2. Hapus item lama jika ada
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

      // 3. Insert items
      const insertRows = data.items.map((it) => ({
        invoice_id: invoiceId,
        product_name: it.productName,
        unit_name: it.unitName,
        quantity: it.qty,
        price: it.price,
        subtotal: it.subtotal,
      }));

      const { error: itemsErr } = await supabase.from("invoice_items").insert(insertRows);
      if (itemsErr) {
        console.error("[Supabase Error] Gagal simpan invoice items:", itemsErr);
        return { success: false, error: itemsErr.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error("[Supabase Exception] Gagal simpan:", err);
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}
