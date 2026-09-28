import fs from "fs";
import path from "path";
import { pool, query } from "../db.server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { Product, ProductUnit, Sale, StockMovement, StockOpnameItem } from "../types/pos";

/**
 * Mengambil semua data produk beserta multi-satuan dan stok realtime dari ledger
 */
export async function getProductsFromDb(): Promise<Product[]> {
  // 1. Ambil data produk & stok realtime dari view
  const productRows = await query<RowDataPacket[]>(`
    SELECT 
      p.id, 
      p.name, 
      p.category, 
      p.base_unit AS baseUnit, 
      p.min_stock_alert AS minStockAlert,
      COALESCE(s.current_stock_base_unit, 0) AS stockInBaseUnit
    FROM products p
    LEFT JOIN v_product_current_stocks s ON p.id = s.product_id
    WHERE p.is_active = TRUE
    ORDER BY p.name ASC
  `);

  if (productRows.length === 0) return [];

  // 2. Ambil seluruh data units
  const unitRows = await query<RowDataPacket[]>(`
    SELECT 
      id,
      product_id AS productId,
      unit_name AS unitName,
      conversion_ratio AS conversionRatio,
      price,
      cost_price AS costPrice,
      barcode,
      is_base_unit AS isBaseUnit
    FROM product_units
    ORDER BY conversion_ratio ASC
  `);

  // 3. Mapping relasi produk ke units
  return productRows.map((p) => {
    const units: ProductUnit[] = unitRows
      .filter((u) => u.productId === p.id)
      .map((u) => ({
        id: u.id,
        productId: u.productId,
        unitName: u.unitName,
        conversionRatio: Number(u.conversionRatio),
        price: Number(u.price),
        costPrice: u.costPrice ? Number(u.costPrice) : undefined,
        barcode: u.barcode,
        isBaseUnit: Boolean(u.isBaseUnit),
      }));

    return {
      id: p.id,
      name: p.name,
      category: p.category,
      baseUnit: p.baseUnit,
      stockInBaseUnit: Number(p.stockInBaseUnit),
      minStockAlert: p.minStockAlert,
      units,
    };
  });
}

/**
 * Mencari produk dan satuan berdasarkan scan barcode (Lookup < 1ms via Index)
 */
export async function findByBarcode(barcode: string): Promise<{ product: Product; unit: ProductUnit } | null> {
  const rows = await query<RowDataPacket[]>(`
    SELECT 
      u.id AS unit_id,
      u.unit_name,
      u.conversion_ratio,
      u.price,
      u.cost_price,
      u.barcode,
      u.is_base_unit,
      p.id AS product_id,
      p.name AS product_name,
      p.category,
      p.base_unit
    FROM product_units u
    JOIN products p ON u.product_id = p.id
    WHERE u.barcode = ? AND p.is_active = TRUE
    LIMIT 1
  `, [barcode.trim()]);

  if (rows.length === 0) return null;
  const row = rows[0];

  const unit: ProductUnit = {
    id: row.unit_id,
    productId: row.product_id,
    unitName: row.unit_name,
    conversionRatio: Number(row.conversion_ratio),
    price: Number(row.price),
    costPrice: row.cost_price ? Number(row.cost_price) : undefined,
    barcode: row.barcode,
    isBaseUnit: Boolean(row.is_base_unit),
  };

  const product: Product = {
    id: row.product_id,
    name: row.product_name,
    category: row.category,
    baseUnit: row.base_unit,
    stockInBaseUnit: 0,
    units: [unit],
  };

  return { product, unit };
}

/**
 * Menyimpan Transaksi Penjualan ke MySQL Lokal dalam 1 Transaksi Atomik
 * (Menulis sales, sale_items, dan stock_movements ledger out)
 */
export async function createSaleTransaction(sale: Sale): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Simpan Header Sales
    await connection.execute(`
      INSERT INTO sales (
        id, invoice_code, total_amount, paid_amount, change_amount, 
        payment_method, cashier_name, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sale.id,
      sale.invoiceCode,
      sale.totalAmount,
      sale.paidAmount,
      sale.changeAmount,
      sale.paymentMethod,
      sale.cashierName,
      sale.syncStatus,
    ]);

    // 2. Simpan Sale Items & Ledger Mutasi Keluar
    for (const item of sale.items) {
      // Pastikan produk ada di tabel products agar tidak melanggar foreign key constraint
      const [prodCheck] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM products WHERE id = ?`,
        [item.productId]
      );

      if (prodCheck.length === 0) {
        await connection.execute(`
          INSERT INTO products (id, name, category, base_unit, min_stock_alert, is_active)
          VALUES (?, ?, 'Kebutuhan Harian', ?, 10, TRUE)
          ON DUPLICATE KEY UPDATE name = VALUES(name)
        `, [item.productId, item.productName, item.unitName || "pcs"]);
      }

      const itemId = `sitem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await connection.execute(`
        INSERT INTO sale_items (
          id, sale_id, product_id, snapshot_product_name, snapshot_unit_name,
          conversion_ratio, price, cost_price, quantity, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        itemId,
        sale.id,
        item.productId,
        item.productName,
        item.unitName,
        item.conversionRatio,
        item.price,
        item.costPrice || null,
        item.qty,
        item.subtotal,
      ]);

      // Kurangi stok di ledger (nilai negatif di base unit)
      const deductionInBaseUnit = -(item.qty * item.conversionRatio);
      const movementId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await connection.execute(`
        INSERT INTO stock_movements (
          id, product_id, type, quantity_in_base_unit, unit_name_used,
          unit_qty_used, reference_type, reference_id, notes
        ) VALUES (?, ?, 'out', ?, ?, ?, 'sale', ?, ?)
      `, [
        movementId,
        item.productId,
        deductionInBaseUnit,
        item.unitName,
        item.qty,
        sale.id,
        `Penjualan ${sale.invoiceCode}`,
      ]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // Coba kirimkan snapshot transaksi ke Invoice Publik (non-blocking jika offline)
  try {
    await pushSaleToPublicInvoice(sale);
  } catch {
    // Mode offline normal: jika cloud tidak aktif, transaksi tetap tersimpan aman di MySQL lokal
  }
}

/**
 * Mencatat Kulakan Stok Masuk ke Ledger MySQL Lokal
 */
export async function createStockKulakan(params: {
  productId: string;
  unit: ProductUnit;
  unitQty: number;
  costPrice: number;
  supplier: string;
}): Promise<void> {
  const { productId, unit, unitQty, costPrice, supplier } = params;
  const qtyInBaseUnit = unitQty * unit.conversionRatio;
  const movementId = `mov-in-${Date.now()}`;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Simpan Mutasi Masuk
    await connection.execute(`
      INSERT INTO stock_movements (
        id, product_id, type, quantity_in_base_unit, unit_name_used,
        unit_qty_used, cost_per_unit, reference_type, notes
      ) VALUES (?, ?, 'in', ?, ?, ?, ?, 'purchase', ?)
    `, [
      movementId,
      productId,
      qtyInBaseUnit,
      unit.unitName,
      unitQty,
      costPrice,
      `Kulakan dari ${supplier}`,
    ]);

    // 2. Update referensi cost price di product_units
    if (costPrice > 0 && unit?.id) {
      await connection.execute(`
        UPDATE product_units 
        SET cost_price = ? 
        WHERE id = ?
      `, [costPrice, unit.id]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Menyimpan Rekonsiliasi Sesi Stok Opname Bulanan
 */
export async function createStockOpnameAdjustment(
  sessionCode: string,
  items: StockOpnameItem[]
): Promise<void> {
  const opnameId = `opn-${Date.now()}`;
  const totalDiffItems = items.filter((it) => it.difference !== 0);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Header Opname
    await connection.execute(`
      INSERT INTO stock_opnames (id, session_code, status, total_discrepancy_items, completed_at)
      VALUES (?, ?, 'completed', ?, NOW())
    `, [opnameId, sessionCode, totalDiffItems.length]);

    // 2. Items & Mutasi Penyesuaian
    for (const it of items) {
      const opnItemId = `opn-item-${Date.now()}-${it.productId}`;
      await connection.execute(`
        INSERT INTO stock_opname_items (id, opname_id, product_id, system_stock, physical_stock, difference, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        opnItemId,
        opnameId,
        it.productId,
        it.systemStock,
        it.physicalStock,
        it.difference,
        it.notes || null,
      ]);

      // Jika ada selisih, buat adjustment ledger
      if (it.difference !== 0) {
        const adjMovementId = `mov-adj-${Date.now()}-${it.productId}`;
        await connection.execute(`
          INSERT INTO stock_movements (
            id, product_id, type, quantity_in_base_unit, unit_name_used,
            unit_qty_used, reference_type, reference_id, notes
          ) VALUES (?, ?, 'adjustment', ?, ?, ?, 'opname', ?, ?)
        `, [
          adjMovementId,
          it.productId,
          it.difference,
          it.baseUnit,
          Math.abs(it.difference),
          opnameId,
          `Opname ${sessionCode}: ${it.notes || "Koreksi Fisik"}`,
        ]);
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Mengambil histori transaksi penjualan beserta items snapshot dari MySQL
 */
export async function getSalesFromDb(): Promise<Sale[]> {
  const salesRows = await query<RowDataPacket[]>(`
    SELECT 
      id, invoice_code AS invoiceCode, total_amount AS totalAmount,
      paid_amount AS paidAmount, change_amount AS changeAmount,
      payment_method AS paymentMethod, cashier_name AS cashierName,
      sync_status AS syncStatus,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS timestamp
    FROM sales
    ORDER BY created_at DESC
    LIMIT 100
  `);

  if (salesRows.length === 0) return [];

  const itemRows = await query<RowDataPacket[]>(`
    SELECT 
      id, sale_id AS saleId, product_id AS productId,
      snapshot_product_name AS productName, snapshot_unit_name AS unitName,
      conversion_ratio AS conversionRatio, price, cost_price AS costPrice,
      quantity AS qty, subtotal
    FROM sale_items
  `);

  return salesRows.map((s) => ({
    id: s.id,
    invoiceCode: s.invoiceCode,
    timestamp: s.timestamp,
    totalAmount: Number(s.totalAmount),
    paidAmount: Number(s.paidAmount),
    changeAmount: Number(s.changeAmount),
    paymentMethod: s.paymentMethod,
    syncStatus: s.syncStatus,
    cashierName: s.cashierName,
    items: itemRows
      .filter((it) => it.saleId === s.id)
      .map((it) => ({
        productId: it.productId,
        productName: it.productName,
        unitName: it.unitName,
        conversionRatio: Number(it.conversionRatio),
        price: Number(it.price),
        qty: Number(it.qty),
        subtotal: Number(it.subtotal),
        costPrice: it.costPrice ? Number(it.costPrice) : undefined,
      })),
  }));
}

/**
 * Mengambil riwayat mutasi stok (ledger) terkini dari MySQL
 */
export async function getStockMovementsFromDb(): Promise<StockMovement[]> {
  const rows = await query<RowDataPacket[]>(`
    SELECT 
      sm.id, sm.product_id AS productId, p.name AS productName,
      sm.type, sm.quantity_in_base_unit AS quantityInBaseUnit,
      sm.unit_name_used AS unitNameUsed, sm.unit_qty_used AS unitQtyUsed,
      sm.cost_per_unit AS costPerUnit, sm.notes,
      DATE_FORMAT(sm.created_at, '%Y-%m-%d %H:%i:%s') AS timestamp
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    ORDER BY sm.created_at DESC
    LIMIT 100
  `);

  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    type: r.type,
    quantityInBaseUnit: Number(r.quantityInBaseUnit),
    unitNameUsed: r.unitNameUsed,
    unitQtyUsed: Number(r.unitQtyUsed),
    costPerUnit: r.costPerUnit ? Number(r.costPerUnit) : undefined,
    notes: r.notes || "",
    timestamp: r.timestamp,
  }));
}

/**
 * Membuat Produk Baru beserta Multi-Satuan di MySQL
 */
export async function createProductWithUnits(product: Product): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert product
    await connection.execute(`
      INSERT INTO products (id, name, category, base_unit, min_stock_alert)
      VALUES (?, ?, ?, ?, ?)
    `, [
      product.id,
      product.name,
      product.category,
      product.baseUnit,
      product.minStockAlert || 10,
    ]);

    // 2. Insert units
    for (const unit of product.units) {
      await connection.execute(`
        INSERT INTO product_units (
          id, product_id, unit_name, conversion_ratio, price, cost_price, barcode, is_base_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        unit.id,
        product.id,
        unit.unitName,
        unit.conversionRatio,
        unit.price,
        unit.costPrice || null,
        unit.barcode?.trim() || null,
        unit.isBaseUnit ? 1 : 0,
      ]);
    }

    // 3. Insert initial stock movement if any
    if (product.stockInBaseUnit > 0) {
      const movId = `mov-init-${Date.now()}`;
      await connection.execute(`
        INSERT INTO stock_movements (
          id, product_id, type, quantity_in_base_unit, unit_name_used,
          unit_qty_used, reference_type, notes
        ) VALUES (?, ?, 'in', ?, ?, 1, 'init', 'Stok Awal Pendaftaran Barang')
      `, [
        movId,
        product.id,
        product.stockInBaseUnit,
        product.baseUnit,
      ]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export function getSyncSecretKey(): string {
  return (process.env.SYNC_SECRET_KEY || "").trim();
}

export function getSyncApiUrl(): string {
  return (process.env.PUBLIC_INVOICE_SYNC_URL || "http://127.0.0.1:5175/api/sync").trim();
}

export interface StoreConfig {
  storeCode: string;
  storeName: string;
  storeSlug: string;
  storeTagline: string;
  storeAddress: string;
  storeCity: string;
  cashierName: string;
  publicInvoiceBaseUrl: string;
  syncSecretKey?: string;
}

export interface CloudTenantInfo {
  valid: boolean;
  id?: string;
  storeName?: string;
  storeCode?: string;
  storeSlug?: string;
  storeAddress?: string | null;
  ownerEmail?: string | null;
  contactWa?: string | null;
  plan?: "free" | "pro";
  status?: "active" | "suspended" | "pending";
  invoiceCount?: number;
  invoiceLimit?: number;
  quotaRemaining?: number;
  error?: string;
  errorCode?: string;
}

export interface CloudStatusResult {
  ok: boolean;
  message: string;
  supabaseConnected?: boolean;
  tenant?: CloudTenantInfo | null;
  saas?: {
    freePlanLimit: number;
    proPlanPrice: number;
    resetDay: number;
  };
}

/**
 * Membaca konfigurasi profil toko / warung dari environment variable (.env)
 */
export function getStoreConfig(): StoreConfig {
  return {
    storeCode: process.env.STORE_CODE || "WM01",
    storeName: process.env.STORE_NAME || "Warung Madura Berkah",
    storeSlug: process.env.STORE_SLUG || "warung-madura-berkah",
    storeTagline: process.env.STORE_TAGLINE || "Buka 24 Jam Non-Stop",
    storeAddress: process.env.STORE_ADDRESS || "Jl. Raya Warung Madura No. 24, Buka 24 Jam Non-Stop",
    storeCity: process.env.STORE_CITY || "Sumenep",
    cashierName: process.env.CASHIER_DEFAULT_NAME || "Cak Mat",
    publicInvoiceBaseUrl: process.env.PUBLIC_INVOICE_BASE_URL || "",
    syncSecretKey: getSyncSecretKey(),
  };
}

/**
 * Mengecek ketersediaan server Cloud Invoice Sync & Validasi Tenant SaaS
 */
export async function testCloudConnection(): Promise<CloudStatusResult> {
  const syncSecret = getSyncSecretKey();
  if (!syncSecret) {
    return {
      ok: false,
      message: "Cloud offline / belum terhubung (Secret Key kosong)",
      tenant: null,
    };
  }

  const syncUrl = getSyncApiUrl();
  try {
    const res = await fetch(syncUrl, {
      method: "GET",
      headers: {
        "x-sync-secret": syncSecret,
      },
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const data = await res.json();
      const tenant: CloudTenantInfo | null = data.tenant || null;
      let message = "Server Cloud Terhubung";

      if (tenant) {
        if (!tenant.valid) {
          message = `Cloud Online — ${tenant.error || "Secret Key tidak valid"}`;
        } else if (tenant.plan === "pro") {
          message = `Cloud Online — Paket Pro (Unlimited)`;
        } else if (tenant.plan === "free") {
          message = `Cloud Online — Paket Free (Sisa: ${tenant.quotaRemaining}/${tenant.invoiceLimit})`;
        }
      }

      return {
        ok: Boolean(tenant && tenant.valid),
        message,
        supabaseConnected: data.supabase?.connected ?? data.supabaseConnected,
        tenant,
        saas: data.saas,
      };
    }
    return { ok: false, message: `Server Cloud respon HTTP ${res.status}`, tenant: null };
  } catch (err: any) {
    return {
      ok: false,
      message: "Server Cloud Offline (jalankan invoice_publik di port 5175)",
      tenant: null,
    };
  }
}

export interface UpdateCloudConfigInput {
  syncSecretKey: string;
  syncApiUrl?: string;
  publicBaseUrl?: string;
  storeCode?: string;
  storeSlug?: string;
  storeName?: string;
  storeAddress?: string;
}

/**
 * Memverifikasi Secret Key ke server SaaS tanpa menyimpan terlebih dahulu
 */
export async function verifyTenantSecret(secretKey: string, apiUrl?: string): Promise<{
  ok: boolean;
  message: string;
  tenant?: CloudTenantInfo | null;
}> {
  const url = apiUrl?.trim() || process.env.PUBLIC_INVOICE_SYNC_URL || "http://127.0.0.1:5175/api/sync";
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-sync-secret": secretKey.trim(),
      },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      const tenant = data.tenant as CloudTenantInfo | null;
      if (tenant && tenant.valid) {
        return {
          ok: true,
          message: `Secret Key Valid! Toko: ${tenant.storeName} (${tenant.storeCode}) — Paket ${tenant.plan?.toUpperCase()}`,
          tenant,
        };
      }
      return {
        ok: false,
        message: tenant?.error || "Secret Key tidak terdaftar di platform SaaS",
        tenant: null,
      };
    }
    return {
      ok: false,
      message: `Server merespon HTTP ${res.status}`,
      tenant: null,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `Gagal menghubungi server sync (${err.message})`,
      tenant: null,
    };
  }
}

/**
 * Menyimpan konfigurasi cloud SaaS ke file .env dan runtime process.env
 * Jika hanya secret key yang diinput, identitas toko otomatis diambil dari respon SaaS!
 */
export async function saveCloudConfig(input: UpdateCloudConfigInput): Promise<{
  ok: boolean;
  message: string;
  tenant?: CloudTenantInfo | null;
}> {
  const secretKey = (input.syncSecretKey || "").trim();
  if (!secretKey) {
    return { ok: false, message: "Secret Key tidak boleh kosong", tenant: null };
  }

  const syncUrl = input.syncApiUrl?.trim() || process.env.PUBLIC_INVOICE_SYNC_URL || "http://127.0.0.1:5175/api/sync";

  // 1. Verifikasi secret key ke server SaaS & ambil profil toko lengkap
  const verifyResult = await verifyTenantSecret(secretKey, syncUrl);
  if (!verifyResult.ok || !verifyResult.tenant) {
    return {
      ok: false,
      message: verifyResult.message || "Secret Key tidak valid di platform SaaS",
      tenant: null,
    };
  }

  const tenant = verifyResult.tenant;

  // 2. Ambil identitas otomatis dari respon SaaS (kecuali dioverride secara eksplisit)
  const storeName = input.storeName?.trim() || tenant.storeName || process.env.STORE_NAME || "Warung Madura";
  const storeCode = input.storeCode?.trim().toUpperCase() || tenant.storeCode || process.env.STORE_CODE || "WM01";
  const storeSlug = input.storeSlug?.trim() || tenant.storeSlug || process.env.STORE_SLUG || "warung-madura";
  const storeAddress = input.storeAddress?.trim() || tenant.storeAddress || process.env.STORE_ADDRESS || "";
  const publicBaseUrl = input.publicBaseUrl !== undefined ? input.publicBaseUrl.trim() : (process.env.PUBLIC_INVOICE_BASE_URL || "");

  // 3. Update runtime process.env
  process.env.SYNC_SECRET_KEY = secretKey;
  process.env.PUBLIC_INVOICE_SYNC_URL = syncUrl;
  process.env.STORE_NAME = storeName;
  process.env.STORE_CODE = storeCode;
  process.env.STORE_SLUG = storeSlug;
  if (storeAddress) process.env.STORE_ADDRESS = storeAddress;
  if (publicBaseUrl !== undefined) process.env.PUBLIC_INVOICE_BASE_URL = publicBaseUrl;

  // 4. Update file .env secara permanen
  const envPath = path.resolve(process.cwd(), ".env");
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf-8");
  }

  const updateEnvKey = (key: string, value: string) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  };

  updateEnvKey("SYNC_SECRET_KEY", secretKey);
  updateEnvKey("PUBLIC_INVOICE_SYNC_URL", syncUrl);
  updateEnvKey("STORE_NAME", storeName);
  updateEnvKey("STORE_CODE", storeCode);
  updateEnvKey("STORE_SLUG", storeSlug);
  if (storeAddress) updateEnvKey("STORE_ADDRESS", storeAddress);
  if (publicBaseUrl !== undefined) updateEnvKey("PUBLIC_INVOICE_BASE_URL", publicBaseUrl);

  try {
    fs.writeFileSync(envPath, content, "utf-8");
  } catch (err: any) {
    console.error("[saveCloudConfig] Gagal menulis ke .env:", err);
  }

  return {
    ok: true,
    message: `Toko "${storeName}" (${storeCode}) berhasil dihubungkan! Paket: ${tenant.plan?.toUpperCase()}.`,
    tenant: {
      ...tenant,
      storeName,
      storeCode,
      storeSlug,
      storeAddress,
    },
  };
}

/**
 * Memutuskan sambungan toko dari Cloud SaaS
 */
export async function disconnectCloudConfig(): Promise<{ ok: boolean; message: string }> {
  process.env.SYNC_SECRET_KEY = "";
  const envPath = path.resolve(process.cwd(), ".env");
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf-8");
  }

  const regex = new RegExp(`^SYNC_SECRET_KEY=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `SYNC_SECRET_KEY=`);
  } else {
    content += `\nSYNC_SECRET_KEY=`;
  }

  try {
    fs.writeFileSync(envPath, content, "utf-8");
  } catch (err: any) {
    console.error("[disconnectCloudConfig] Gagal mengosongkan SYNC_SECRET_KEY:", err);
  }

  return { ok: true, message: "Koneksi cloud toko berhasil diputuskan." };
}

export interface PushSaleResult {
  success: boolean;
  publicUrl?: string | null;
  quotaRemaining?: number;
  error?: string;
  errorCode?: string;
}

/**
 * Mengirimkan snapshot satu invoice ke server Invoice Publik (Supabase Cloud API)
 */
export async function pushSaleToPublicInvoice(sale: Sale): Promise<PushSaleResult> {
  const storeConfig = getStoreConfig();
  const syncSecret = getSyncSecretKey();
  if (!syncSecret) {
    return {
      success: false,
      error: "Cloud sync belum dikonfigurasi (Secret Key belum terhubung)",
      errorCode: "NOT_CONNECTED",
    };
  }

  const syncUrl = getSyncApiUrl();

  try {
    const payload = {
      secretKey: syncSecret,
      invoice: {
        id: sale.invoiceCode,
        storeName: storeConfig.storeName,
        storeAddress: storeConfig.storeAddress,
        totalAmount: sale.totalAmount,
        paidAmount: sale.paidAmount,
        changeAmount: sale.changeAmount,
        paymentMethod: sale.paymentMethod,
        cashierName: sale.cashierName || storeConfig.cashierName,
        createdAt: new Date().toISOString(),
        items: sale.items.map((it) => ({
          productName: it.productName,
          unitName: it.unitName,
          qty: it.qty,
          price: it.price,
          subtotal: it.subtotal,
        })),
      },
    };

    const res = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": syncSecret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.ok) {
      await query(
        `UPDATE sales SET sync_status = 'synced', synced_at = NOW() WHERE id = ?`,
        [sale.id]
      );
      return {
        success: true,
        publicUrl: data.publicUrl,
        quotaRemaining: data.quotaRemaining,
      };
    }

    const errorMsg = data?.error || `HTTP ${res.status}`;
    const errorCode = data?.errorCode;
    console.warn(`[Sync Cloud POS] Gagal kirim invoice ${sale.invoiceCode}:`, errorMsg);

    return {
      success: false,
      error: errorMsg,
      errorCode,
    };
  } catch (err: any) {
    // Mode offline normal: jika server cloud tidak dapat dihubungi, transaksi tetap aman di MySQL
    console.log("[Sync Cloud POS] Transaksi tersimpan lokal (akan disinkronkan saat online):", err.message);
    return {
      success: false,
      error: err.message || "Cloud server offline",
    };
  }
}

export interface SyncSalesResult {
  syncedCount: number;
  totalPending: number;
  cloudOnline: boolean;
  message: string;
  quotaRemaining?: number;
  plan?: string;
  errorDetail?: string;
}

/**
 * Menyinkronkan seluruh transaksi berstatus pending ke server Invoice Publik
 */
export async function syncSalesInDb(): Promise<SyncSalesResult> {
  const cloudHealth = await testCloudConnection();
  if (!cloudHealth.ok) {
    const pendingSales = await query<RowDataPacket[]>(`
      SELECT COUNT(*) AS count FROM sales WHERE sync_status = 'pending'
    `);
    const totalPending = pendingSales[0]?.count || 0;
    return {
      syncedCount: 0,
      totalPending: Number(totalPending),
      cloudOnline: false,
      message: "Server cloud (port 5175) belum aktif. Pastikan aplikasi invoice_publik berjalan.",
    };
  }

  // Jika auth secret salah atau toko disuspend
  if (cloudHealth.tenant && !cloudHealth.tenant.valid) {
    const pendingSales = await query<RowDataPacket[]>(`
      SELECT COUNT(*) AS count FROM sales WHERE sync_status = 'pending'
    `);
    const totalPending = pendingSales[0]?.count || 0;
    return {
      syncedCount: 0,
      totalPending: Number(totalPending),
      cloudOnline: true,
      errorDetail: cloudHealth.tenant.errorCode,
      message: `Autentikasi Cloud Gagal: ${cloudHealth.tenant.error || "Secret Key tidak valid"}. Periksa SYNC_SECRET_KEY di .env.`,
    };
  }

  const pendingSales = await query<RowDataPacket[]>(`
    SELECT 
      id, invoice_code AS invoiceCode, total_amount AS totalAmount,
      paid_amount AS paidAmount, change_amount AS changeAmount,
      payment_method AS paymentMethod, cashier_name AS cashierName,
      sync_status AS syncStatus,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS timestamp
    FROM sales
    WHERE sync_status = 'pending'
    ORDER BY created_at ASC
    LIMIT 50
  `);

  if (pendingSales.length === 0) {
    return {
      syncedCount: 0,
      totalPending: 0,
      cloudOnline: true,
      quotaRemaining: cloudHealth.tenant?.quotaRemaining,
      plan: cloudHealth.tenant?.plan,
      message: "Semua transaksi sudah tersinkron ke cloud.",
    };
  }

  const placeholders = pendingSales.map(() => "?").join(",");
  const itemRows = await query<RowDataPacket[]>(`
    SELECT 
      sale_id AS saleId, product_id AS productId,
      snapshot_product_name AS productName, snapshot_unit_name AS unitName,
      conversion_ratio AS conversionRatio, price, quantity AS qty, subtotal
    FROM sale_items
    WHERE sale_id IN (${placeholders})
  `, pendingSales.map((s) => s.id));

  let syncedCount = 0;
  let lastQuotaRemaining = cloudHealth.tenant?.quotaRemaining;
  let stopReason: string | null = null;

  for (const s of pendingSales) {
    const items = itemRows
      .filter((it) => it.saleId === s.id)
      .map((it) => ({
        productId: it.productId,
        productName: it.productName,
        unitName: it.unitName,
        conversionRatio: Number(it.conversionRatio),
        price: Number(it.price),
        qty: Number(it.qty),
        subtotal: Number(it.subtotal),
      }));

    const saleObj: Sale = {
      id: s.id,
      invoiceCode: s.invoiceCode,
      totalAmount: Number(s.totalAmount),
      paidAmount: Number(s.paidAmount),
      changeAmount: Number(s.changeAmount),
      paymentMethod: s.paymentMethod,
      cashierName: s.cashierName,
      syncStatus: s.syncStatus,
      timestamp: s.timestamp,
      items,
    };

    const pushResult = await pushSaleToPublicInvoice(saleObj);
    if (pushResult.success) {
      syncedCount++;
      if (typeof pushResult.quotaRemaining === "number") {
        lastQuotaRemaining = pushResult.quotaRemaining;
      }
    } else {
      if (pushResult.errorCode === "QUOTA_EXCEEDED") {
        stopReason = "Kuota invoice paket Free telah habis. Upgrade ke paket Pro untuk invoice tanpa batas.";
        break;
      } else if (pushResult.errorCode === "INVALID_SECRET" || pushResult.errorCode === "SUSPENDED") {
        stopReason = pushResult.error || "Akses cloud ditolak.";
        break;
      }
    }
  }

  const finalMsg = stopReason
    ? `${syncedCount} dari ${pendingSales.length} transaksi disinkronkan. Berhenti: ${stopReason}`
    : `${syncedCount} dari ${pendingSales.length} transaksi berhasil disinkronkan ke cloud.`;

  return {
    syncedCount,
    totalPending: pendingSales.length,
    cloudOnline: true,
    quotaRemaining: lastQuotaRemaining,
    plan: cloudHealth.tenant?.plan,
    errorDetail: stopReason || undefined,
    message: finalMsg,
  };
}

/**
 * Mengubah data produk dan satuan-satuannya di MySQL
 */
export async function updateProductWithUnits(product: Product): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(`
      UPDATE products
      SET name = ?, category = ?, base_unit = ?, min_stock_alert = ?
      WHERE id = ?
    `, [
      product.name,
      product.category,
      product.baseUnit,
      product.minStockAlert || 10,
      product.id,
    ]);

    // Hapus unit lama lalu pasang unit baru
    await connection.execute(`DELETE FROM product_units WHERE product_id = ?`, [product.id]);

    for (const unit of product.units) {
      await connection.execute(`
        INSERT INTO product_units (
          id, product_id, unit_name, conversion_ratio, price, cost_price, barcode, is_base_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        unit.id || `unit-${product.id}-${Date.now()}-${Math.random()}`,
        product.id,
        unit.unitName,
        unit.conversionRatio,
        unit.price,
        unit.costPrice || null,
        unit.barcode?.trim() || null,
        unit.isBaseUnit ? 1 : 0,
      ]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Menghapus produk secara aman (Soft Delete) agar riwayat transaksi & ledger keuangan tetap utuh
 */
export async function deleteProductInDb(productId: string): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.execute(`UPDATE products SET is_active = FALSE WHERE id = ?`, [productId]);
  } finally {
    connection.release();
  }
}

