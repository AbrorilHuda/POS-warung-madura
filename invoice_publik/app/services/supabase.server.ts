// Pastikan file .env dimuat jika berjalan di runtime Node.js
try {
  process.loadEnvFile?.();
} catch { }

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PublicInvoice, PublicInvoiceItem, SyncPayload } from "../types/invoice";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || "";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    "";

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log("[Supabase Server] Terhubung ke Supabase Cloud:", supabaseUrl);
    } catch (err) {
      console.warn("[Supabase Server] Gagal inisialisasi Supabase:", err);
      return null;
    }
  }

  return supabaseClient;
}

/**
 * In-Memory Mock Store untuk pengembangan lokal tanpa akun Supabase
 */
const mockInvoices = new Map<string, PublicInvoice>();

// Seed sample invoice hanya jika SUPABASE_URL tidak diatur (mode offline murni)
if (!process.env.SUPABASE_URL) {
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
    ],
    isDemoMock: true,
  };
  mockInvoices.set(sampleInvoice.id, sampleInvoice);
}

export function isSupabaseConnected(): boolean {
  return getSupabaseClient() !== null;
}

/**
 * Memeriksa status koneksi dan kesiapan tabel di Supabase
 */
export async function checkSupabaseStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  tablesReady: boolean;
  url?: string;
  message: string;
}> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      configured: false,
      connected: false,
      tablesReady: false,
      message: "SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diatur di .env (Mode Mock In-Memory aktif)",
    };
  }

  try {
    const { error } = await client.from("invoices").select("id").limit(1);
    if (error) {
      if (error.code === "PGRST205") {
        return {
          configured: true,
          connected: true,
          tablesReady: false,
          message: "Terhubung ke Supabase, namun tabel 'invoices' belum dibuat. Jalankan supabase-schema.sql di SQL Editor Supabase.",
        };
      }
      return {
        configured: true,
        connected: false,
        tablesReady: false,
        message: `Koneksi Supabase error: ${error.message}`,
      };
    }

    return {
      configured: true,
      connected: true,
      tablesReady: true,
      message: "Supabase terhubung dan tabel database siap digunakan!",
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      tablesReady: false,
      message: `Gagal menghubungi Supabase: ${err.message}`,
    };
  }
}

/**
 * Validasi format kode faktur agar aman dari input berbahaya (alfanumerik, tanda hubung, garis bawah, 3-50 karakter)
 */
export function isValidInvoiceCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  return /^[A-Za-z0-9_-]{3,50}$/.test(code.trim());
}

/**
 * Menghapus invoice yang sudah melewati batas waktu simpan (default 12 jam)
 */
export async function cleanupExpiredInvoices(): Promise<{
  deletedCount: number;
  retentionHours: number;
  cutoffTime: string;
  error?: string;
}> {
  const retentionHours = Number(process.env.INVOICE_RETENTION_HOURS) || 12;
  const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString();
  const client = getSupabaseClient();

  // 1. Bersihkan memory mock
  let mockDeleted = 0;
  for (const [id, inv] of mockInvoices.entries()) {
    if (inv.createdAt && new Date(inv.createdAt).getTime() < Date.now() - retentionHours * 60 * 60 * 1000) {
      mockInvoices.delete(id);
      mockDeleted++;
    }
  }

  // 2. Bersihkan di Supabase
  if (client) {
    try {
      const { data, error } = await client
        .from("invoices")
        .delete()
        .lt("created_at", cutoffTime)
        .select("id");

      if (error) {
        console.error("[Cleanup Error] Gagal hapus invoice kedaluwarsa:", error);
        return { deletedCount: 0, retentionHours, cutoffTime, error: error.message };
      }

      const count = (data ? data.length : 0) + mockDeleted;
      if (count > 0) {
        console.log(`[Cleanup] Menghapus ${count} invoice kedaluwarsa (> ${retentionHours} jam)`);
      }
      return { deletedCount: count, retentionHours, cutoffTime };
    } catch (err: any) {
      console.error("[Cleanup Exception]", err);
      return { deletedCount: 0, retentionHours, cutoffTime, error: err.message };
    }
  }

  return { deletedCount: mockDeleted, retentionHours, cutoffTime };
}

// Inisialisasi timer otomatis pembersihan invoice setiap 1 jam jika di server runtime
if (typeof setInterval !== "undefined") {
  const globalObj = globalThis as any;
  if (!globalObj.__invoiceCleanupScheduled) {
    globalObj.__invoiceCleanupScheduled = true;
    const interval = setInterval(() => {
      cleanupExpiredInvoices().catch((err) => {
        console.warn("[Auto Cleanup Timer Error]", err);
      });
    }, 60 * 60 * 1000);
    if (interval.unref) {
      interval.unref();
    }
  }
}

import type { InvoiceQueryResult } from "../types/invoice";

/**
 * Mengambil invoice beserta status detail (validasi, expired 12 jam, not found)
 */
export async function queryInvoiceWithStatus(invoiceCode: string): Promise<InvoiceQueryResult> {
  const code = (invoiceCode || "").trim().toUpperCase();
  const retentionHours = Number(process.env.INVOICE_RETENTION_HOURS) || 12;
  const retentionMs = retentionHours * 60 * 60 * 1000;
  const now = Date.now();

  // 1. Validasi format kode faktur
  if (!isValidInvoiceCode(code)) {
    return {
      invoice: null,
      status: "invalid_code",
      retentionHours,
      message: "Format nomor faktur tidak valid. Gunakan huruf, angka, dan tanda hubung (-).",
    };
  }

  const client = getSupabaseClient();

  // 2. Jika Supabase aktif, fetch dari Postgres
  if (client) {
    try {
      const { data: invData, error: invError } = await client
        .from("invoices")
        .select("*")
        .eq("id", code)
        .single();

      if (invData && !invError) {
        const createdTime = new Date(invData.created_at).getTime();
        const expiresTime = createdTime + retentionMs;
        const isExpired = now >= expiresTime;

        if (isExpired) {
          // Hapus otomatis dari database cloud karena sudah melewati 12 jam
          await client.from("invoices").delete().eq("id", code);
          return {
            invoice: null,
            status: "expired",
            retentionHours,
            message: `Struk belanja ${code} telah kedaluwarsa dan dihapus otomatis dari server setelah ${retentionHours} jam dari waktu pembelian demi privasi data.`,
          };
        }

        // Ambil items, prioritaskan urutan created_at jika ada
        let itemsData: any[] = [];
        const { data: orderedItems, error: itemsError } = await client
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", code)
          .order("created_at", { ascending: true });

        if (itemsError) {
          const { data: fallbackItems } = await client
            .from("invoice_items")
            .select("*")
            .eq("invoice_id", code);
          itemsData = fallbackItems || [];
        } else {
          itemsData = orderedItems || [];
        }

        const items: PublicInvoiceItem[] = itemsData.map((it: any) => ({
          id: it.id,
          invoiceId: it.invoice_id,
          productName: it.product_name,
          unitName: it.unit_name,
          quantity: Number(it.quantity),
          price: Number(it.price),
          subtotal: Number(it.subtotal),
        }));

        const remainingMinutes = Math.max(0, Math.floor((expiresTime - now) / 60000));

        return {
          invoice: {
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
            retentionHours,
            expiresAt: new Date(expiresTime).toISOString(),
            remainingMinutes,
            isExpired: false,
          },
          status: "found",
          retentionHours,
        };
      }
    } catch (err) {
      console.error("[Supabase Error] Gagal fetch invoice:", err);
    }
  }

  // 3. Fallback mock store
  const mock = mockInvoices.get(code);
  if (mock) {
    const createdTime = new Date(mock.createdAt).getTime();
    const expiresTime = createdTime + retentionMs;
    const isExpired = now >= expiresTime;

    if (isExpired) {
      mockInvoices.delete(code);
      return {
        invoice: null,
        status: "expired",
        retentionHours,
        message: `Struk belanja ${code} telah kedaluwarsa dan dihapus otomatis setelah ${retentionHours} jam dari waktu pembelian demi privasi data.`,
      };
    }

    const remainingMinutes = Math.max(0, Math.floor((expiresTime - now) / 60000));
    return {
      invoice: {
        ...mock,
        retentionHours,
        expiresAt: new Date(expiresTime).toISOString(),
        remainingMinutes,
        isExpired: false,
      },
      status: "found",
      retentionHours,
    };
  }

  return {
    invoice: null,
    status: "not_found",
    retentionHours,
    message: `Nomor faktur ${code} belum ditemukan atau masih dalam antrean sinkronisasi.`,
  };
}

/**
 * Mengambil invoice berdasarkan nomor invoice
 */
export async function getInvoiceByCode(invoiceCode: string): Promise<PublicInvoice | null> {
  const result = await queryInvoiceWithStatus(invoiceCode);
  return result.invoice;
}

/**
 * Menyimpan snapshot invoice transaksi yang dikirim oleh POS Warung
 */
export async function saveInvoiceSnapshot(
  data: SyncPayload["invoice"]
): Promise<{ success: boolean; error?: string }> {
  const invoiceId = data.id || data.invoiceCode;
  if (!invoiceId || !isValidInvoiceCode(invoiceId)) {
    return { success: false, error: "Nomor invoice tidak valid atau format tidak aman" };
  }

  // Pemicu pembersihan background invoice yang sudah kedaluwarsa
  cleanupExpiredInvoices().catch(() => { });

  const storeName = data.storeName || process.env.DEFAULT_STORE_NAME || "Warung Madura Berkah";
  const storeAddress =
    data.storeAddress ||
    process.env.DEFAULT_STORE_ADDRESS ||
    "Jl. Raya Warung Madura No. 24, Buka 24 Jam Non-Stop";
  const cashierName = data.cashierName || process.env.DEFAULT_CASHIER_NAME || "Cak Mat";
  const createdAt = data.createdAt || new Date().toISOString();

  const client = getSupabaseClient();

  // Simpan ke in-memory map sebagai cache / fallback
  const mockItemObjects: PublicInvoiceItem[] = (data.items || []).map((it: any, idx) => ({
    id: `item-${Date.now()}-${idx}`,
    invoiceId: invoiceId,
    productName: it.productName || it.product_name || it.snapshot_product_name || "Produk",
    unitName: it.unitName || it.unit_name || it.snapshot_unit_name || "Pcs",
    quantity: Number(it.qty ?? it.quantity ?? 1),
    price: Number(it.price || 0),
    subtotal: Number(it.subtotal || 0),
  }));

  const invoiceObj: PublicInvoice = {
    id: invoiceId,
    storeName,
    storeAddress,
    totalAmount: data.totalAmount,
    paidAmount: data.paidAmount,
    changeAmount: data.changeAmount,
    paymentMethod: data.paymentMethod,
    cashierName,
    createdAt,
    items: mockItemObjects,
    isDemoMock: !client,
  };

  mockInvoices.set(invoiceId, invoiceObj);

  // Jika Supabase aktif, simpan ke database cloud
  if (client) {
    try {
      // 1. Upsert header invoice
      const { error: headerErr } = await client.from("invoices").upsert({
        id: invoiceId,
        store_name: storeName,
        store_address: storeAddress,
        total_amount: data.totalAmount,
        paid_amount: data.paidAmount,
        change_amount: data.changeAmount,
        payment_method: data.paymentMethod,
        cashier_name: cashierName,
        created_at: createdAt,
      });

      if (headerErr) {
        console.error("[Supabase Error] Gagal simpan invoice header:", headerErr);
        return { success: false, error: `Supabase header error: ${headerErr.message}` };
      }

      // 2. Hapus item lama jika ada
      await client.from("invoice_items").delete().eq("invoice_id", invoiceId);

      // 3. Insert items
      const insertRows = (data.items || []).map((it: any) => ({
        invoice_id: invoiceId,
        product_name: it.productName || it.product_name || it.snapshot_product_name || "Produk",
        unit_name: it.unitName || it.unit_name || it.snapshot_unit_name || "Pcs",
        quantity: Number(it.qty ?? it.quantity ?? 1),
        price: Number(it.price || 0),
        subtotal: Number(it.subtotal || 0),
      }));

      const { error: itemsErr } = await client.from("invoice_items").insert(insertRows);
      if (itemsErr) {
        console.error("[Supabase Error] Gagal simpan invoice items:", itemsErr);
        return { success: false, error: `Supabase items error: ${itemsErr.message}` };
      }

      return { success: true };
    } catch (err: any) {
      console.error("[Supabase Exception] Gagal simpan:", err);
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}
