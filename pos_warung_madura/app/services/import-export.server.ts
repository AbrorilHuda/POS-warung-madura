import crypto from "crypto";
import { pool, query, ensureDatabaseSchema } from "../db.server";
import type { RowDataPacket } from "mysql2/promise";

/**
 * Tipe data untuk baris produk yang divalidasi dari CSV
 */
export interface ValidatedProductRow {
  rowNumber: number;
  barcode: string;
  name: string;
  category: string;
  baseUnit: string;
  additionalUnit?: string;
  conversionRatio: number;
  costPrice: number;
  price: number;
  initialStock: number;
  minStockAlert: number;
  expiryDate?: string;
  isDuplicateInDb: boolean;
  existingProductId?: string;
  existingProductName?: string;
}

export interface ProductImportValidationError {
  rowNumber: number;
  name: string;
  barcode: string;
  reason: string;
}

export interface ProductImportPreviewResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  validRows: ValidatedProductRow[];
  errorRows: ProductImportValidationError[];
}

/**
 * Tipe data untuk baris pelanggan yang divalidasi dari CSV
 */
export interface ValidatedCustomerRow {
  rowNumber: number;
  name: string;
  phone?: string;
  address?: string;
  customerGroup: "umum" | "langganan" | "reseller";
  creditLimit: number;
  initialDebt: number;
  notes?: string;
  isDuplicateInDb: boolean;
  existingCustomerId?: string;
}

export interface CustomerImportValidationError {
  rowNumber: number;
  name: string;
  reason: string;
}

export interface CustomerImportPreviewResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  validRows: ValidatedCustomerRow[];
  errorRows: CustomerImportValidationError[];
}

/**
 * Helper: Parser CSV tangguh yang mendukung pemisah koma (,) atau titik koma (;),
 * menangani kutipan ganda (""), newline, dan UTF-8 BOM.
 */
export function parseCsvContent(rawCsv: string): { headers: string[]; rows: Record<string, string>[]; rawRowsCount: number } {
  // 1. Bersihkan UTF-8 BOM dan normalisasi baris baru
  const cleanContent = rawCsv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = cleanContent.split("\n").filter((line) => line.trim().length > 0);

  if (rawLines.length === 0) {
    return { headers: [], rows: [], rawRowsCount: 0 };
  }

  // 2. Deteksi delimiter: apakah koma (,) atau titik koma (;)
  const firstLine = rawLines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";

  // 3. Parser per baris dengan state machine untuk menangani tanda kutip (quoted & unquoted fields)
  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let i = 0;
    while (i < line.length) {
      // Lewati whitespace sebelum token jika bukan delimiter
      while (i < line.length && line[i] === " " && line[i] !== delimiter) i++;

      if (i < line.length && line[i] === '"') {
        // Quoted field (RFC 4180)
        i++; // skip opening quote
        let cur = "";
        while (i < line.length) {
          if (line[i] === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') {
              cur += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            cur += line[i];
            i++;
          }
        }
        fields.push(cur.trim());
        // Lewati karakter sampai ke delimiter berikutnya
        while (i < line.length && line[i] !== delimiter) i++;
        if (i < line.length && line[i] === delimiter) i++;
      } else {
        // Unquoted field (mengizinkan kutipan literal di tengah teks seperti inch atau nama warung)
        let cur = "";
        while (i < line.length && line[i] !== delimiter) {
          cur += line[i];
          i++;
        }
        fields.push(cur.trim());
        if (i < line.length && line[i] === delimiter) i++;
      }
    }
    // Jika baris diakhiri dengan delimiter, tambahkan kolom kosong terakhir
    if (line.endsWith(delimiter)) {
      fields.push("");
    }
    return fields;
  };

  const rawHeaders = parseLine(rawLines[0]);
  const headers = rawHeaders.map((h) =>
    h
      .toLowerCase()
      .replace(/[\s\-_]/g, "")
      .replace(/[^a-z0-9]/g, "")
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const values = parseLine(rawLines[i]);
    // Skip baris yang benar-benar kosong
    if (values.every((v) => v === "")) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] !== undefined ? values[idx] : "";
    });
    // Simpan juga baris asli ke key index
    rawHeaders.forEach((origH, idx) => {
      rowObj[`_orig_${idx}`] = values[idx] !== undefined ? values[idx] : "";
    });
    rows.push(rowObj);
  }

  return { headers, rows, rawRowsCount: rawLines.length - 1 };
}

/**
 * Escape nilai untuk CSV dengan format aman dan kutipan jika diperlukan
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ============================================================================
// 1. TEMPLATE GENERATORS (PRD F10.1)
// ============================================================================

/**
 * Menghasilkan Template CSV untuk Produk lengkap dengan UTF-8 BOM
 */
export function getProductTemplateCsv(): string {
  const headers = [
    "Barcode",
    "Nama Produk",
    "Kategori",
    "Satuan Dasar",
    "Satuan Tambahan",
    "Rasio Konversi",
    "Harga Beli",
    "Harga Jual",
    "Stok Awal",
    "Min Stok Alert",
    "Kedaluwarsa (YYYY-MM-DD)",
  ];

  const samples = [
    [
      "8999909123456",
      "Rokok Gudang Garam Filter",
      "Rokok",
      "bungkus",
      "Slop",
      "10",
      "24000",
      "26000",
      "50",
      "5",
      "2027-12-31",
    ],
    [
      "8992775123456",
      "Indomie Goreng Spesial",
      "Makanan Instan",
      "pcs",
      "Dus",
      "40",
      "3100",
      "3500",
      "120",
      "20",
      "2026-10-30",
    ],
    [
      "8991234567890",
      "Kopi Kapal Api Special Mix",
      "Jajanan & Kopi",
      "sachet",
      "Renteng",
      "10",
      "1500",
      "2000",
      "100",
      "10",
      "2027-06-15",
    ],
    [
      "8998866123456",
      "Minyak Goreng Kita 1L",
      "Sembako",
      "botol",
      "Karton",
      "12",
      "14500",
      "16500",
      "36",
      "6",
      "2026-12-31",
    ],
    [
      "8997788123456",
      "Telur Ayam Negeri",
      "Sembako",
      "kg",
      "Tray",
      "15",
      "26000",
      "29000",
      "45",
      "5",
      "",
    ],
  ];

  const rows = [headers, ...samples].map((row) => row.map(escapeCsv).join(","));
  // Sisipkan UTF-8 BOM agar Microsoft Excel Windows langsung membukanya dengan benar
  return "\uFEFF" + rows.join("\r\n");
}

/**
 * Menghasilkan Template CSV untuk Pelanggan & Saldo Kasbon Awal
 */
export function getCustomerTemplateCsv(): string {
  const headers = [
    "Nama Pelanggan",
    "Nomor HP",
    "Alamat",
    "Grup Pelanggan",
    "Batas Kasbon (Limit)",
    "Saldo Utang Awal",
    "Catatan",
  ];

  const samples = [
    [
      "Pak Slamet",
      "081234567890",
      "Jalan Mawar No. 12",
      "langganan",
      "500000",
      "75000",
      "Langganan kopi harian",
    ],
    [
      "Bu Hj. Aminah",
      "085712345678",
      "RT 02 RW 01",
      "umum",
      "300000",
      "0",
      "Belanja kebutuhan pokok",
    ],
    [
      "Toko Mitra Berkah",
      "081987654321",
      "Pasar Induk Kios 4",
      "reseller",
      "2000000",
      "350000",
      "Mitra grosir rokok & mie",
    ],
  ];

  const rows = [headers, ...samples].map((row) => row.map(escapeCsv).join(","));
  return "\uFEFF" + rows.join("\r\n");
}

// ============================================================================
// 2. VALIDASI & PREVIEW IMPOR PRODUK (PRD F10.2 & F10.3)
// ============================================================================

export async function validateProductImport(csvContent: string): Promise<ProductImportPreviewResult> {
  await ensureDatabaseSchema();
  const { rows, rawRowsCount } = parseCsvContent(csvContent);

  const validRows: ValidatedProductRow[] = [];
  const errorRows: ProductImportValidationError[] = [];

  // Ambil semua barcode dan nama produk yang ada di database untuk deteksi duplikat
  const existingUnits = await query<RowDataPacket[]>(`
    SELECT pu.barcode, pu.product_id, p.name AS product_name
    FROM product_units pu
    JOIN products p ON pu.product_id = p.id
    WHERE pu.barcode IS NOT NULL AND pu.barcode != '' AND p.is_active = TRUE
  `);

  const existingProductsByName = await query<RowDataPacket[]>(`
    SELECT id, name
    FROM products
    WHERE is_active = TRUE
  `);

  const barcodeDbMap = new Map<string, { productId: string; productName: string }>();
  existingUnits.forEach((u) => {
    if (u.barcode) barcodeDbMap.set(String(u.barcode).trim(), { productId: u.product_id, productName: u.product_name });
  });

  const nameDbMap = new Map<string, string>();
  existingProductsByName.forEach((p) => {
    nameDbMap.set(String(p.name).trim().toLowerCase(), p.id);
  });

  // Pelacakan duplikasi barcode di dalam file itu sendiri
  const seenBarcodesInFile = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // Baris 1 adalah header di spreadsheet

    // Pencocokan fleksibel nama kolom
    const barcodeRaw =
      row["barcode"] || row["kodebarcode"] || row["kodebarang"] || row["kode"] || row["_orig_0"] || "";
    const nameRaw =
      row["namaproduk"] || row["nama"] || row["namabarang"] || row["produk"] || row["_orig_1"] || "";
    const categoryRaw =
      row["kategori"] || row["kategoriproduk"] || row["category"] || row["_orig_2"] || "Umum";
    const baseUnitRaw =
      row["satuandasar"] || row["satuan"] || row["baseunit"] || row["unit"] || row["_orig_3"] || "pcs";
    const addUnitRaw =
      row["satuantambahan"] || row["satuan2"] || row["kemasan"] || row["_orig_4"] || "";
    const ratioRaw =
      row["rasiokonversi"] || row["rasio"] || row["konversi"] || row["_orig_5"] || "1";
    const costPriceRaw =
      row["hargabeli"] || row["modal"] || row["hpp"] || row["costprice"] || row["_orig_6"] || "0";
    const priceRaw =
      row["hargajual"] || row["harga"] || row["price"] || row["_orig_7"] || "0";
    const initialStockRaw =
      row["stokawal"] || row["stok"] || row["stock"] || row["_orig_8"] || "0";
    const minStockRaw =
      row["minstokalert"] || row["minstock"] || row["stokminimum"] || row["_orig_9"] || "10";
    const expiryRaw =
      row["kedaluwarsa"] || row["kadaluwarsa"] || row["tglkedaluwarsa"] || row["expirydate"] || row["_orig_10"] || "";

    const name = nameRaw.trim();
    const barcode = barcodeRaw.trim();
    const category = categoryRaw.trim() || "Umum";
    const baseUnit = baseUnitRaw.trim() || "pcs";
    const additionalUnit = addUnitRaw.trim() || undefined;

    // 1. Validasi Nama Produk
    if (!name) {
      errorRows.push({
        rowNumber,
        name: "(Kosong)",
        barcode: barcode || "-",
        reason: "Nama produk tidak boleh kosong",
      });
      continue;
    }

    // 2. Validasi Harga Jual
    const priceClean = priceRaw.replace(/[^0-9.-]+/g, "");
    const price = Number(priceClean);
    if (isNaN(price) || price < 0) {
      errorRows.push({
        rowNumber,
        name,
        barcode: barcode || "-",
        reason: `Harga jual '${priceRaw}' tidak valid (wajib angka positif atau 0)`,
      });
      continue;
    }

    // 3. Validasi Harga Beli / Modal
    const costClean = costPriceRaw.replace(/[^0-9.-]+/g, "");
    const costPrice = Number(costClean);
    if (isNaN(costPrice) || costPrice < 0) {
      errorRows.push({
        rowNumber,
        name,
        barcode: barcode || "-",
        reason: `Harga beli '${costPriceRaw}' tidak valid (tidak boleh negatif)`,
      });
      continue;
    }

    // 4. Validasi Rasio Konversi
    const ratioClean = ratioRaw.replace(/[^0-9.-]+/g, "");
    const conversionRatio = ratioClean !== "" ? Number(ratioClean) : 1;
    if (isNaN(conversionRatio) || conversionRatio <= 0) {
      errorRows.push({
        rowNumber,
        name,
        barcode: barcode || "-",
        reason: `Rasio konversi '${ratioRaw}' harus lebih besar dari 0`,
      });
      continue;
    }

    // 5. Validasi Stok Awal
    const stockClean = initialStockRaw.replace(/[^0-9.-]+/g, "");
    const initialStock = Number(stockClean);
    if (isNaN(initialStock) || initialStock < 0) {
      errorRows.push({
        rowNumber,
        name,
        barcode: barcode || "-",
        reason: `Stok awal '${initialStockRaw}' tidak boleh negatif`,
      });
      continue;
    }

    // 6. Validasi Barcode Ganda di dalam File CSV
    if (barcode) {
      if (seenBarcodesInFile.has(barcode)) {
        errorRows.push({
          rowNumber,
          name,
          barcode,
          reason: `Barcode '${barcode}' ganda di dalam berkas CSV (sudah muncul di baris sebelumnya)`,
        });
        continue;
      }
      seenBarcodesInFile.add(barcode);
    }

    // 7. Cek Duplikat terhadap Database
    let isDuplicateInDb = false;
    let existingProductId: string | undefined = undefined;
    let existingProductName: string | undefined = undefined;

    if (barcode && barcodeDbMap.has(barcode)) {
      const match = barcodeDbMap.get(barcode)!;
      isDuplicateInDb = true;
      existingProductId = match.productId;
      existingProductName = match.productName;
    } else if (nameDbMap.has(name.toLowerCase())) {
      isDuplicateInDb = true;
      existingProductId = nameDbMap.get(name.toLowerCase());
      existingProductName = name;
    }

    // 8. Normalisasi Tanggal Kedaluwarsa jika ada
    let cleanExpiry: string | undefined = undefined;
    if (expiryRaw.trim()) {
      const exp = expiryRaw.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
        cleanExpiry = exp;
      } else {
        // Coba parsing tanggal format umum
        const parsedDate = new Date(exp);
        if (!isNaN(parsedDate.getTime())) {
          cleanExpiry = parsedDate.toISOString().slice(0, 10);
        }
      }
    }

    const minStock = Math.max(0, Number(minStockRaw.replace(/[^0-9.-]+/g, "")) || 10);

    validRows.push({
      rowNumber,
      barcode,
      name,
      category,
      baseUnit,
      additionalUnit,
      conversionRatio,
      costPrice,
      price,
      initialStock,
      minStockAlert: minStock,
      expiryDate: cleanExpiry,
      isDuplicateInDb,
      existingProductId,
      existingProductName,
    });
  }

  const duplicateCount = validRows.filter((r) => r.isDuplicateInDb).length;

  return {
    totalRows: rawRowsCount,
    validCount: validRows.length,
    errorCount: errorRows.length,
    duplicateCount,
    validRows,
    errorRows,
  };
}

// ============================================================================
// 3. COMMIT IMPOR PRODUK DALAM 1 TRANSAKSI MYSQL ATOMIK (PRD F10.4)
// ============================================================================

export async function commitProductImport(
  validRows: ValidatedProductRow[],
  duplicateAction: "skip" | "update" | "create_new" = "update"
): Promise<{
  success: boolean;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  totalProcessed: number;
}> {
  await ensureDatabaseSchema();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of validRows) {
      if (row.isDuplicateInDb && duplicateAction === "skip") {
        skippedCount++;
        continue;
      }

      if (row.isDuplicateInDb && duplicateAction === "update" && row.existingProductId) {
        // --- MODE UPDATE ---
        const prodId = row.existingProductId;

        // 1. Update info produk induk
        await connection.execute(`
          UPDATE products
          SET name = ?, category = ?, min_stock_alert = ?
          WHERE id = ?
        `, [row.name, row.category, row.minStockAlert, prodId]);

        // 2. Update harga pada unit dasar
        await connection.execute(`
          UPDATE product_units
          SET price = ?, cost_price = ?
          WHERE product_id = ? AND is_base_unit = TRUE
        `, [row.price, row.costPrice || null, prodId]);

        // 3. Jika ada stok awal yang diinput, catat sebagai mutasi penyesuaian jika diperlukan
        if (row.initialStock > 0) {
          const moveId = `sm-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await connection.execute(`
            INSERT INTO stock_movements (
              id, product_id, type, quantity_in_base_unit, unit_name_used, unit_qty_used, cost_per_unit, reference_type, notes
            ) VALUES (?, ?, 'in', ?, ?, ?, ?, 'initial', 'Penambahan Stok dari Impor CSV')
          `, [
            moveId,
            prodId,
            row.initialStock,
            row.baseUnit,
            row.initialStock,
            row.costPrice || null,
          ]);
        }

        updatedCount++;
      } else {
        // --- MODE BUAT BARU (Termasuk create_new ketika duplikat) ---
        const newProductId = crypto.randomUUID();
        let finalBarcode = row.barcode ? row.barcode.trim() : null;

        if (row.isDuplicateInDb && duplicateAction === "create_new" && finalBarcode) {
          // Berikan suffix unik jika barcode bentrok
          finalBarcode = `${finalBarcode}-${Math.floor(100 + Math.random() * 900)}`;
        }

        // 1. Insert ke tabel products
        await connection.execute(`
          INSERT INTO products (id, name, category, base_unit, min_stock_alert, is_active)
          VALUES (?, ?, ?, ?, ?, TRUE)
        `, [
          newProductId,
          row.name,
          row.category,
          row.baseUnit,
          row.minStockAlert,
        ]);

        // 2. Insert Base Unit ke product_units
        const baseUnitId = crypto.randomUUID();
        await connection.execute(`
          INSERT INTO product_units (
            id, product_id, unit_name, conversion_ratio, price, cost_price, barcode, is_base_unit
          ) VALUES (?, ?, ?, 1.0000, ?, ?, ?, TRUE)
        `, [
          baseUnitId,
          newProductId,
          row.baseUnit,
          row.price,
          row.costPrice || null,
          finalBarcode,
        ]);

        // 3. Insert Satuan Tambahan jika ada (contoh: Dus, Slop, Renteng)
        if (row.additionalUnit && row.conversionRatio > 1) {
          const addUnitId = crypto.randomUUID();
          // Estimasi harga satuan tambahan = harga satuan dasar × rasio (atau sesuaikan)
          const addPrice = row.price * row.conversionRatio;
          const addCost = (row.costPrice || 0) * row.conversionRatio;

          await connection.execute(`
            INSERT INTO product_units (
              id, product_id, unit_name, conversion_ratio, price, cost_price, barcode, is_base_unit
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, FALSE)
          `, [
            addUnitId,
            newProductId,
            row.additionalUnit,
            row.conversionRatio,
            addPrice,
            addCost || null,
          ]);
        }

        // 4. Catat Stok Awal ke ledger stock_movements (Single Source of Truth)
        if (row.initialStock > 0) {
          const moveId = `sm-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await connection.execute(`
            INSERT INTO stock_movements (
              id, product_id, type, quantity_in_base_unit, unit_name_used, unit_qty_used, cost_per_unit, reference_type, notes
            ) VALUES (?, ?, 'in', ?, ?, ?, ?, 'initial', 'Stok Awal dari Impor CSV')
          `, [
            moveId,
            newProductId,
            row.initialStock,
            row.baseUnit,
            row.initialStock,
            row.costPrice || null,
          ]);

          // Jika ada tanggal kedaluwarsa, catat batch
          if (row.expiryDate) {
            const batchId = `bat-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            await connection.execute(`
              INSERT INTO stock_batches (
                id, product_id, batch_number, initial_qty, remaining_qty, expiry_date, cost_price, supplier_name
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Impor CSV')
            `, [
              batchId,
              newProductId,
              `BATCH-IMP-${new Date().toISOString().slice(0, 10)}`,
              row.initialStock,
              row.initialStock,
              row.expiryDate,
              row.costPrice || null,
            ]);
          }
        }

        insertedCount++;
      }
    }

    await connection.commit();
    return {
      success: true,
      insertedCount,
      updatedCount,
      skippedCount,
      totalProcessed: validRows.length,
    };
  } catch (error) {
    await connection.rollback();
    console.error("[commitProductImport] Rollback transaction karena error:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================================================
// 4. VALIDASI & COMMIT IMPOR PELANGGAN + SALDO AWAL (PRD F10.6)
// ============================================================================

export async function validateCustomerImport(csvContent: string): Promise<CustomerImportPreviewResult> {
  await ensureDatabaseSchema();
  const { rows, rawRowsCount } = parseCsvContent(csvContent);

  const validRows: ValidatedCustomerRow[] = [];
  const errorRows: CustomerImportValidationError[] = [];

  const existingCustomers = await query<RowDataPacket[]>(`
    SELECT id, name, phone FROM customers WHERE is_active = TRUE
  `);

  const nameMap = new Map<string, string>();
  existingCustomers.forEach((c) => {
    nameMap.set(String(c.name).trim().toLowerCase(), c.id);
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    const nameRaw =
      row["namapelanggan"] || row["nama"] || row["customer"] || row["_orig_0"] || "";
    const phoneRaw =
      row["nomorhp"] || row["nohp"] || row["phone"] || row["telepon"] || row["_orig_1"] || "";
    const addressRaw =
      row["alamat"] || row["address"] || row["_orig_2"] || "";
    const groupRaw =
      row["gruppelanggan"] || row["grup"] || row["group"] || row["_orig_3"] || "umum";
    const limitRaw =
      row["bataskasbonlimit"] || row["limit"] || row["creditlimit"] || row["_orig_4"] || "0";
    const initialDebtRaw =
      row["saldoutangawal"] || row["saldokasbon"] || row["utangawal"] || row["saldoawal"] || row["_orig_5"] || "0";
    const notesRaw =
      row["catatan"] || row["notes"] || row["_orig_6"] || "";

    const name = nameRaw.trim();
    if (!name) {
      errorRows.push({
        rowNumber,
        name: "(Kosong)",
        reason: "Nama pelanggan wajib diisi",
      });
      continue;
    }

    const creditLimitClean = limitRaw.replace(/[^0-9.-]+/g, "");
    const creditLimit = Math.max(0, Number(creditLimitClean) || 0);

    const initialDebtClean = initialDebtRaw.replace(/[^0-9.-]+/g, "");
    const initialDebt = Number(initialDebtClean);
    if (isNaN(initialDebt) || initialDebt < 0) {
      errorRows.push({
        rowNumber,
        name,
        reason: `Saldo utang awal '${initialDebtRaw}' tidak valid (tidak boleh negatif)`,
      });
      continue;
    }

    let customerGroup: "umum" | "langganan" | "reseller" = "umum";
    const lowerGroup = groupRaw.toLowerCase();
    if (lowerGroup.includes("langganan")) customerGroup = "langganan";
    else if (lowerGroup.includes("reseller")) customerGroup = "reseller";

    const isDuplicateInDb = nameMap.has(name.toLowerCase());
    const existingCustomerId = isDuplicateInDb ? nameMap.get(name.toLowerCase()) : undefined;

    validRows.push({
      rowNumber,
      name,
      phone: phoneRaw.trim() || undefined,
      address: addressRaw.trim() || undefined,
      customerGroup,
      creditLimit,
      initialDebt,
      notes: notesRaw.trim() || undefined,
      isDuplicateInDb,
      existingCustomerId,
    });
  }

  const duplicateCount = validRows.filter((r) => r.isDuplicateInDb).length;

  return {
    totalRows: rawRowsCount,
    validCount: validRows.length,
    errorCount: errorRows.length,
    duplicateCount,
    validRows,
    errorRows,
  };
}

export async function commitCustomerImport(
  validRows: ValidatedCustomerRow[],
  duplicateAction: "skip" | "update" | "create_new" = "update"
): Promise<{
  success: boolean;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  totalProcessed: number;
}> {
  await ensureDatabaseSchema();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of validRows) {
      if (row.isDuplicateInDb && duplicateAction === "skip") {
        skippedCount++;
        continue;
      }

      if (row.isDuplicateInDb && duplicateAction === "update" && row.existingCustomerId) {
        const custId = row.existingCustomerId;
        await connection.execute(`
          UPDATE customers
          SET phone = COALESCE(?, phone),
              address = COALESCE(?, address),
              customer_group = ?,
              credit_limit = ?,
              notes = COALESCE(?, notes)
          WHERE id = ?
        `, [
          row.phone || null,
          row.address || null,
          row.customerGroup,
          row.creditLimit,
          row.notes || null,
          custId,
        ]);

        // Jika ada saldo utang awal, tambahkan ke receivables
        if (row.initialDebt > 0) {
          const recId = crypto.randomUUID();
          await connection.execute(`
            INSERT INTO receivables (
              id, customer_id, sale_id, invoice_code, amount, paid_amount, due_date, status, notes
            ) VALUES (?, ?, NULL, 'SALDO-AWAL', ?, 0, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'open', 'Saldo Kasbon Awal (Impor CSV)')
          `, [recId, custId, row.initialDebt]);
        }

        updatedCount++;
      } else {
        const newCustId = crypto.randomUUID();
        const finalName =
          row.isDuplicateInDb && duplicateAction === "create_new"
            ? `${row.name} (${Math.floor(100 + Math.random() * 900)})`
            : row.name;

        await connection.execute(`
          INSERT INTO customers (
            id, name, phone, address, customer_group, credit_limit, notes, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
        `, [
          newCustId,
          finalName,
          row.phone || null,
          row.address || null,
          row.customerGroup,
          row.creditLimit,
          row.notes || null,
        ]);

        // Catat saldo utang awal ke buku besar kasbon (PRD F10.6)
        if (row.initialDebt > 0) {
          const recId = crypto.randomUUID();
          await connection.execute(`
            INSERT INTO receivables (
              id, customer_id, sale_id, invoice_code, amount, paid_amount, due_date, status, notes
            ) VALUES (?, ?, NULL, 'SALDO-AWAL', ?, 0, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'open', 'Saldo Kasbon Awal (Impor CSV)')
          `, [recId, newCustId, row.initialDebt]);
        }

        insertedCount++;
      }
    }

    await connection.commit();
    return {
      success: true,
      insertedCount,
      updatedCount,
      skippedCount,
      totalProcessed: validRows.length,
    };
  } catch (error) {
    await connection.rollback();
    console.error("[commitCustomerImport] Rollback transaction:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================================================
// 5. EKSPOR LENGKAP DALAM FORMAT CSV / EXCEL UTF-8 BOM (PRD F10.5)
// ============================================================================

/**
 * Ekspor Seluruh Master Produk & Multi-Satuan ke CSV
 */
export async function exportProductsToCsv(): Promise<string> {
  await ensureDatabaseSchema();

  const rows = await query<RowDataPacket[]>(`
    SELECT 
      p.id AS product_id,
      p.name AS product_name,
      p.category,
      p.base_unit,
      p.min_stock_alert,
      COALESCE(s.current_stock_base_unit, 0) AS current_stock,
      pu.unit_name,
      pu.conversion_ratio,
      pu.price,
      pu.cost_price,
      pu.barcode,
      pu.is_base_unit
    FROM products p
    JOIN product_units pu ON p.id = pu.product_id
    LEFT JOIN v_product_current_stocks s ON p.id = s.product_id
    WHERE p.is_active = TRUE
    ORDER BY p.name ASC, pu.conversion_ratio ASC
  `);

  const headers = [
    "ID Produk",
    "Barcode",
    "Nama Produk",
    "Kategori",
    "Satuan Kemasan",
    "Rasio Konversi (ke Satuan Dasar)",
    "Satuan Dasar",
    "Harga Modal (Beli)",
    "Harga Jual",
    "Stok Fisik Terkini (Satuan Dasar)",
    "Batas Min Stok",
    "Status Satuan Dasar",
  ];

  const dataRows = rows.map((r) => [
    r.product_id,
    r.barcode || "",
    r.product_name,
    r.category,
    r.unit_name,
    Number(r.conversion_ratio),
    r.base_unit,
    r.cost_price ? Number(r.cost_price) : 0,
    Number(r.price),
    Number(r.current_stock),
    Number(r.min_stock_alert),
    r.is_base_unit ? "Ya" : "Tidak",
  ]);

  const csvBody = [headers, ...dataRows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  return "\uFEFF" + csvBody;
}

/**
 * Ekspor Data Pelanggan & Buku Saldo Kasbon ke CSV
 */
export async function exportCustomersToCsv(): Promise<string> {
  await ensureDatabaseSchema();

  const rows = await query<RowDataPacket[]>(`
    SELECT 
      customer_id,
      name,
      phone,
      address,
      customer_group,
      credit_limit,
      total_debt,
      unpaid_invoices_count,
      earliest_due_date,
      last_receivable_at
    FROM v_customer_receivables_summary
    ORDER BY total_debt DESC, name ASC
  `);

  const headers = [
    "ID Pelanggan",
    "Nama Pelanggan",
    "Nomor HP",
    "Alamat",
    "Grup Pelanggan",
    "Batas Kasbon (Limit)",
    "Total Saldo Utang Berjalan",
    "Jumlah Nota Kasbon Belum Lunas",
    "Jatuh Tempo Terdekat",
    "Transaksi Kasbon Terakhir",
  ];

  const dataRows = rows.map((r) => [
    r.customer_id,
    r.name,
    r.phone || "",
    r.address || "",
    r.customer_group || "umum",
    Number(r.credit_limit),
    Number(r.total_debt),
    Number(r.unpaid_invoices_count),
    r.earliest_due_date ? String(r.earliest_due_date).slice(0, 10) : "-",
    r.last_receivable_at ? String(r.last_receivable_at).slice(0, 19) : "-",
  ]);

  const csvBody = [headers, ...dataRows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  return "\uFEFF" + csvBody;
}

/**
 * Ekspor Riwayat Transaksi Penjualan Lengkap ke CSV
 */
export async function exportSalesHistoryToCsv(filters?: {
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}): Promise<string> {
  await ensureDatabaseSchema();

  let sql = `
    SELECT 
      s.invoice_code,
      s.created_at,
      s.cashier_name,
      s.customer_name,
      s.payment_method,
      s.total_amount,
      s.discount_amount,
      s.discount_type,
      s.promo_name,
      s.paid_amount,
      s.change_amount,
      s.sync_status,
      s.is_void,
      s.void_reason
    FROM sales s
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters?.startDate) {
    sql += ` AND DATE(s.created_at) >= ?`;
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    sql += ` AND DATE(s.created_at) <= ?`;
    params.push(filters.endDate);
  }
  if (filters?.paymentMethod && filters.paymentMethod !== "all") {
    sql += ` AND s.payment_method = ?`;
    params.push(filters.paymentMethod);
  }

  sql += ` ORDER BY s.created_at DESC`;

  const rows = await query<RowDataPacket[]>(sql, params);

  const headers = [
    "Nomor Nota",
    "Waktu Transaksi",
    "Kasir",
    "Pelanggan",
    "Metode Pembayaran",
    "Total Penjualan",
    "Diskon (Rp)",
    "Tipe Diskon",
    "Program Promo",
    "Jumlah Dibayar",
    "Kembalian",
    "Status Void",
    "Alasan Void",
    "Status Sync Cloud",
  ];

  const dataRows = rows.map((r) => [
    r.invoice_code,
    String(r.created_at).slice(0, 19),
    r.cashier_name || "Kasir",
    r.customer_name || "Pelanggan Umum",
    r.payment_method,
    Number(r.total_amount),
    Number(r.discount_amount || 0),
    r.discount_type || "-",
    r.promo_name || "-",
    Number(r.paid_amount),
    Number(r.change_amount),
    r.is_void ? "Dibatalkan (Void)" : "Sah",
    r.void_reason || "-",
    r.sync_status || "synced",
  ]);

  const csvBody = [headers, ...dataRows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  return "\uFEFF" + csvBody;
}

/**
 * Ekspor Nilai Aset & Rekap Stok Persediaan ke CSV
 */
export async function exportStockInventoryToCsv(): Promise<string> {
  await ensureDatabaseSchema();

  const rows = await query<RowDataPacket[]>(`
    SELECT 
      p.id,
      p.name,
      p.category,
      p.base_unit,
      p.min_stock_alert,
      COALESCE(s.current_stock_base_unit, 0) AS current_stock,
      COALESCE(pu.cost_price, pu.price * 0.8) AS estimated_cost_price,
      pu.price AS selling_price,
      pu.barcode
    FROM products p
    JOIN product_units pu ON p.id = pu.product_id AND pu.is_base_unit = TRUE
    LEFT JOIN v_product_current_stocks s ON p.id = s.product_id
    WHERE p.is_active = TRUE
    ORDER BY p.category ASC, p.name ASC
  `);

  const headers = [
    "Barcode",
    "Nama Produk",
    "Kategori",
    "Satuan Dasar",
    "Stok Fisik Tersedia",
    "Batas Minimum Stok",
    "Status Stok",
    "Estimasi Harga Beli (HPP/Satuan)",
    "Harga Jual (Satuan Dasar)",
    "Total Nilai Persediaan Aset (Stok × HPP)",
  ];

  const dataRows = rows.map((r) => {
    const stock = Number(r.current_stock);
    const minAlert = Number(r.min_stock_alert);
    const cost = Number(r.estimated_cost_price);
    const totalAssetValue = Math.round(stock * cost);
    const statusStok = stock <= 0 ? "Habis (Kosong)" : stock <= minAlert ? "Menipis (Perlu Kulakan)" : "Aman";

    return [
      r.barcode || "",
      r.name,
      r.category,
      r.base_unit,
      stock,
      minAlert,
      statusStok,
      cost,
      Number(r.selling_price),
      totalAssetValue,
    ];
  });

  const csvBody = [headers, ...dataRows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  return "\uFEFF" + csvBody;
}
