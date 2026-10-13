import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Muat variabel .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "pos_warung_madura",
  multipleStatements: true,
};

// Hitung tanggal kedaluwarsa dinamis untuk pengujian FEFO
function getExpiryDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

// Master Data Lengkap Warung Madura (Multi-Satuan, Tier Grosir, Barcode, Stok & Batch)
const SEED_PRODUCTS = [
  {
    id: "p-01",
    name: "Sampoerna A Mild 16",
    category: "Rokok",
    baseUnit: "batang",
    minStockAlert: 80,
    units: [
      { id: "u-01-btg", unitName: "Ketengan (Batang)", conversionRatio: 1, price: 2500, costPrice: 2000, barcode: "001-SMP-BTG", isBaseUnit: true },
      { id: "u-01-pck", unitName: "Bungkus (16 Btg)", conversionRatio: 16, price: 33500, costPrice: 30500, barcode: "899238812039", isBaseUnit: false },
      { id: "u-01-slp", unitName: "Slop (10 Bks)", conversionRatio: 160, price: 330000, costPrice: 300000, barcode: "899238812040", isBaseUnit: false },
    ],
    tiers: [
      { unitId: "u-01-slp", tierName: "Grosir Reseller (Min 5 Slop)", minQty: 5, price: 325000, customerGroup: "reseller" },
    ],
    batches: [
      { batchNo: "BATCH-SAM-01", qty: 160, expiryDate: getExpiryDate(6), notes: "Batch H-7 (Segera Jual)" },
      { batchNo: "BATCH-SAM-02", qty: 320, expiryDate: getExpiryDate(180), notes: "Batch Normal" },
    ],
  },
  {
    id: "p-02",
    name: "Indomie Goreng Spesial 85g",
    category: "Mie & Sembako",
    baseUnit: "pcs",
    minStockAlert: 40,
    units: [
      { id: "u-02-pcs", unitName: "Pcs", conversionRatio: 1, price: 3500, costPrice: 2950, barcode: "089686010924", isBaseUnit: true },
      { id: "u-02-dus", unitName: "Dus (40 Pcs)", conversionRatio: 40, price: 132000, costPrice: 118000, barcode: "089686010999", isBaseUnit: false },
    ],
    tiers: [
      { unitId: "u-02-dus", tierName: "Kartonan Grosir (Min 5 Dus)", minQty: 5, price: 128000, customerGroup: "umum" },
    ],
    batches: [
      { batchNo: "BATCH-IDM-01", qty: 40, expiryDate: getExpiryDate(25), notes: "Batch H-30" },
      { batchNo: "BATCH-IDM-02", qty: 120, expiryDate: getExpiryDate(240), notes: "Batch Normal" },
    ],
  },
  {
    id: "p-03",
    name: "Djarum Super 12",
    category: "Rokok",
    baseUnit: "batang",
    minStockAlert: 60,
    units: [
      { id: "u-03-btg", unitName: "Ketengan (Batang)", conversionRatio: 1, price: 2200, costPrice: 1800, barcode: "002-DJR-BTG", isBaseUnit: true },
      { id: "u-03-pck", unitName: "Bungkus (12 Btg)", conversionRatio: 12, price: 24000, costPrice: 21500, barcode: "899277511001", isBaseUnit: false },
      { id: "u-03-slp", unitName: "Slop (10 Bks)", conversionRatio: 120, price: 235000, costPrice: 212000, barcode: "899277511018", isBaseUnit: false },
    ],
    tiers: [],
    batches: [
      { batchNo: "BATCH-DJR-01", qty: 360, expiryDate: getExpiryDate(150), notes: "Batch Normal" },
    ],
  },
  {
    id: "p-04",
    name: "Le Minerale Dingin 600ml",
    category: "Minuman Dingin",
    baseUnit: "botol",
    minStockAlert: 24,
    units: [
      { id: "u-04-btl", unitName: "Botol Dingin", conversionRatio: 1, price: 4000, costPrice: 2800, barcode: "899600141401", isBaseUnit: true },
      { id: "u-04-dus", unitName: "Dus (24 Btl)", conversionRatio: 24, price: 88000, costPrice: 66000, barcode: "899600141499", isBaseUnit: false },
    ],
    tiers: [
      { unitId: "u-04-dus", tierName: "Grosir Dus (Min 3 Dus)", minQty: 3, price: 84000, customerGroup: "umum" },
    ],
    batches: [
      { batchNo: "BATCH-LEM-01", qty: 72, expiryDate: getExpiryDate(300), notes: "Batch Segar" },
    ],
  },
  {
    id: "p-05",
    name: "Kopi Kapal Api Spesial Mix 24g",
    category: "Jajanan & Kopi",
    baseUnit: "sachet",
    minStockAlert: 30,
    units: [
      { id: "u-05-sch", unitName: "Sachet", conversionRatio: 1, price: 2000, costPrice: 1400, barcode: "899100110123", isBaseUnit: true },
      { id: "u-05-rtg", unitName: "Renteng (10 Sachet)", conversionRatio: 10, price: 18500, costPrice: 14000, barcode: "899100110999", isBaseUnit: false },
      { id: "u-05-dus", unitName: "Dus (120 Sachet)", conversionRatio: 120, price: 215000, costPrice: 165000, barcode: "899100110120", isBaseUnit: false },
    ],
    tiers: [
      { unitId: "u-05-rtg", tierName: "Reseller Warteg (Min 5 Renteng)", minQty: 5, price: 17500, customerGroup: "reseller" },
    ],
    batches: [
      { batchNo: "BATCH-KPL-01", qty: 150, expiryDate: getExpiryDate(210), notes: "Batch Normal" },
    ],
  },
  {
    id: "p-06",
    name: "Gas Elpiji 3 Kg (Isi Ulang)",
    category: "Gas & Galon",
    baseUnit: "tabung",
    minStockAlert: 5,
    units: [
      { id: "u-06-tbg", unitName: "Tabung Tukar", conversionRatio: 1, price: 22000, costPrice: 19000, barcode: "GAS-3KG-001", isBaseUnit: true },
    ],
    tiers: [],
    batches: [
      { batchNo: "BATCH-GAS-01", qty: 15, expiryDate: null, notes: "Tanpa Expired" },
    ],
  },
  {
    id: "p-07",
    name: "Telur Ayam Negeri Fresh",
    category: "Mie & Sembako",
    baseUnit: "butir",
    minStockAlert: 32,
    units: [
      { id: "u-07-btr", unitName: "Per Butir", conversionRatio: 1, price: 2000, costPrice: 1600, barcode: "TLR-BTR-001", isBaseUnit: true },
      { id: "u-07-kg", unitName: "1 Kg (~16 Butir)", conversionRatio: 16, price: 29000, costPrice: 25500, barcode: "TLR-KG-001", isBaseUnit: false },
    ],
    tiers: [],
    batches: [
      { batchNo: "BATCH-TLR-01", qty: 160, expiryDate: getExpiryDate(14), notes: "Telur Fresh Peternak" },
    ],
  },
  {
    id: "p-08",
    name: "Teh Pucuk Harum 350ml Dingin",
    category: "Minuman Dingin",
    baseUnit: "botol",
    minStockAlert: 12,
    units: [
      { id: "u-08-btl", unitName: "Botol Dingin", conversionRatio: 1, price: 4000, costPrice: 3000, barcode: "899600146001", isBaseUnit: true },
      { id: "u-08-dus", unitName: "Dus (24 Btl)", conversionRatio: 24, price: 86000, costPrice: 72000, barcode: "899600146099", isBaseUnit: false },
    ],
    tiers: [],
    batches: [
      { batchNo: "BATCH-TPC-01", qty: 48, expiryDate: getExpiryDate(180), notes: "Batch Minuman Dingin" },
    ],
  },
  {
    id: "p-09",
    name: "Beras Ramos Setra Ramos 5 Kg",
    category: "Mie & Sembako",
    baseUnit: "karung",
    minStockAlert: 5,
    units: [
      { id: "u-09-krg", unitName: "Karung 5 Kg", conversionRatio: 1, price: 72000, costPrice: 66000, barcode: "BRS-RAMOS-5KG", isBaseUnit: true },
    ],
    tiers: [
      { unitId: "u-09-krg", tierName: "Ambil 3 Karung+", minQty: 3, price: 70000, customerGroup: "umum" },
    ],
    batches: [
      { batchNo: "BATCH-BRS-01", qty: 12, expiryDate: getExpiryDate(360), notes: "Beras Pulen" },
    ],
  },
  {
    id: "p-10",
    name: "Galon Aqua 19 Liter (Isi Ulang)",
    category: "Gas & Galon",
    baseUnit: "galon",
    minStockAlert: 8,
    units: [
      { id: "u-10-gln", unitName: "Galon Tukar", conversionRatio: 1, price: 21000, costPrice: 17500, barcode: "GLN-AQUA-19L", isBaseUnit: true },
    ],
    tiers: [],
    batches: [
      { batchNo: "BATCH-AQU-01", qty: 20, expiryDate: null, notes: "Galon Tukar Toko" },
    ],
  },
];

// Pelanggan Contoh & Saldo Kasbon Awal
const SEED_CUSTOMERS = [
  {
    id: "cust-ali",
    name: "Cak Ali (Tetangga)",
    phone: "081234567890",
    address: "Jl. Madura Indah No. 12",
    customerGroup: "langganan",
    creditLimit: 500000,
  },
  {
    id: "cust-sri",
    name: "Bu Sri (Warteg Barokah)",
    phone: "081987654321",
    address: "Depan Gang 3",
    customerGroup: "reseller",
    creditLimit: 1500000,
  },
  {
    id: "cust-budi",
    name: "Pak Budi (Bengkel Motor)",
    phone: "085678901234",
    address: "Sebelah Warung",
    customerGroup: "umum",
    creditLimit: 300000,
  },
];

async function refreshDatabase() {
  const args = process.argv.slice(2);
  const isHardReset = args.includes("--reset-hard") || args.includes("--hard-reset");
  const isNoSeed = args.includes("--no-seed") || args.includes("--tanpa-seed") || args.includes("--clean") || args.includes("--empty");
  const isCleanTransactionsOnly = args.includes("--clean-transactions");

  let modeLabel = "REFRESH & RE-SEED LENGKAP";
  if (isHardReset && isNoSeed) {
    modeLabel = "RESET-HARD TOTAL KOSONG (DROP, REBUILD & TANPA SEED)";
  } else if (isHardReset) {
    modeLabel = "RESET-HARD TOTAL (DROP, REBUILD & SEED ULANG)";
  } else if (isNoSeed) {
    modeLabel = "REFRESH TOTAL BERSIH TANPA SEED (KOSONG SIAP PAKAI)";
  } else if (isCleanTransactionsOnly) {
    modeLabel = "BERSIHKAN TRANSAKSI SAJA";
  }

  console.log("==================================================================");
  console.log(" 🏪 SCRIPT REFRESH & SINKRONISASI DATABASE POS WARUNG MADURA");
  console.log("==================================================================");
  console.log(`Target Host     : ${DB_CONFIG.host}:${DB_CONFIG.port}`);
  console.log(`Database        : ${DB_CONFIG.database}`);
  console.log(`Mode Operasi    : ${modeLabel}`);
  console.log("------------------------------------------------------------------");

  // 1. Hubungkan ke MySQL
  const connection = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    multipleStatements: true,
  });

  try {
    // 2. Jika Hard Reset: Drop database dan buat baru
    if (isHardReset) {
      console.log(`[1/5] Melakukan Drop & Re-create database ${DB_CONFIG.database}...`);
      await connection.query(`DROP DATABASE IF EXISTS \`${DB_CONFIG.database}\`;`);
    }

    await connection.query(`
      CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\`
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci;
    `);
    await connection.query(`USE \`${DB_CONFIG.database}\`;`);

    // 3. Eksekusi skema tabel dasar dari schema.sql
    console.log("[2/5] Mengeksekusi struktur skema tabel (schema.sql)...");
    const schemaPath = path.resolve(__dirname, "../migrations/schema.sql");
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, "utf-8");
      await connection.query(schemaSql);
    }

    // 4. Pastikan semua tabel lanjutan (PRD F1 s/d F7) sudah dibuat
    console.log("[3/5] Memeriksa & menerapkan seluruh tabel lanjutan (F1-F7)...");

    // Tabel users (F5)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        role ENUM('owner', 'cashier', 'stock_admin') NOT NULL DEFAULT 'cashier',
        pin_hash VARCHAR(255) NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_role (role)
      ) ENGINE=InnoDB;
    `);

    // Tabel cashier_shifts (F5)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cashier_shifts (
        id VARCHAR(36) PRIMARY KEY,
        shift_code VARCHAR(50) UNIQUE NOT NULL,
        cashier_id VARCHAR(36) NOT NULL,
        cashier_name VARCHAR(100) NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP NULL,
        starting_cash DECIMAL(14, 2) NOT NULL DEFAULT 0,
        expected_cash DECIMAL(14, 2) NOT NULL DEFAULT 0,
        actual_cash DECIMAL(14, 2) NULL,
        cash_difference DECIMAL(14, 2) NULL,
        total_cash_sales DECIMAL(14, 2) NOT NULL DEFAULT 0,
        total_qris_sales DECIMAL(14, 2) NOT NULL DEFAULT 0,
        total_debt_sales DECIMAL(14, 2) NOT NULL DEFAULT 0,
        total_debt_collected_cash DECIMAL(14, 2) NOT NULL DEFAULT 0,
        total_cash_in DECIMAL(14, 2) NOT NULL DEFAULT 0,
        total_cash_out DECIMAL(14, 2) NOT NULL DEFAULT 0,
        status ENUM('open', 'closed') DEFAULT 'open',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_shifts_status (status)
      ) ENGINE=InnoDB;
    `);

    // Tabel shift_cash_movements (F5)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shift_cash_movements (
        id VARCHAR(36) PRIMARY KEY,
        shift_id VARCHAR(36) NOT NULL,
        type ENUM('cash_in', 'cash_out') NOT NULL,
        amount DECIMAL(14, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_scm_shift (shift_id)
      ) ENGINE=InnoDB;
    `);

    // Tabel audit_logs (F5.7, F7.4)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50) NULL,
        target_id VARCHAR(50) NULL,
        details TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_action (action)
      ) ENGINE=InnoDB;
    `);

    // Tabel sale_payments (F4)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sale_payments (
        id VARCHAR(36) PRIMARY KEY,
        sale_id VARCHAR(36) NOT NULL,
        payment_method ENUM('Tunai', 'QRIS', 'Transfer', 'Kasbon') NOT NULL,
        amount DECIMAL(14, 2) NOT NULL,
        reference_no VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sale_pay_sale (sale_id)
      ) ENGINE=InnoDB;
    `);

    // Tabel sale_returns & sale_return_items (F6)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sale_returns (
        id VARCHAR(36) PRIMARY KEY,
        return_code VARCHAR(50) UNIQUE NOT NULL,
        sale_id VARCHAR(36) NOT NULL,
        invoice_code VARCHAR(50) NOT NULL,
        shift_id VARCHAR(36) NULL,
        total_refund_amount DECIMAL(14, 2) NOT NULL,
        refund_method ENUM('Tunai', 'Kasbon_Dipotong', 'Kredit_Toko') DEFAULT 'Tunai',
        reason TEXT NOT NULL,
        approved_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS sale_return_items (
        id VARCHAR(36) PRIMARY KEY,
        sale_return_id VARCHAR(36) NOT NULL,
        sale_item_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        quantity DECIMAL(12, 4) NOT NULL,
        refund_price DECIMAL(14, 2) NOT NULL,
        is_restockable BOOLEAN DEFAULT TRUE,
        condition_notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Tabel promotions (PRD F6.4 Promo Otomatis)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS promotions (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        promo_type VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        product_id VARCHAR(36) NULL,
        unit_id VARCHAR(36) NULL,
        min_qty DECIMAL(12, 4) DEFAULT 1,
        discount_type VARCHAR(50) DEFAULT 'percentage',
        discount_value DECIMAL(14, 2) NOT NULL DEFAULT 0,
        buy_product_id VARCHAR(36) NULL,
        buy_unit_id VARCHAR(36) NULL,
        buy_qty DECIMAL(12, 4) DEFAULT 1,
        get_product_id VARCHAR(36) NULL,
        get_unit_id VARCHAR(36) NULL,
        get_qty DECIMAL(12, 4) DEFAULT 1,
        get_discount_percent DECIMAL(5, 2) DEFAULT 100,
        bundle_price DECIMAL(14, 2) NULL,
        bundle_items TEXT NULL,
        priority INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_promo_active (is_active, start_date, end_date)
      ) ENGINE=InnoDB;
    `);

    // Tabel suppliers (PRD F8.1 Master Supplier)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(50) NULL,
        address TEXT NULL,
        default_payment_term_days INT NOT NULL DEFAULT 0,
        notes TEXT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_supplier_name (name)
      ) ENGINE=InnoDB;
    `);

    // Tabel purchases & purchase_items (PRD F8.2 & F8.3 Pencatatan Kulakan Terstruktur)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id VARCHAR(36) PRIMARY KEY,
        invoice_number VARCHAR(100) NOT NULL,
        supplier_id VARCHAR(36) NOT NULL,
        supplier_name VARCHAR(150) NOT NULL,
        purchase_date DATETIME NOT NULL,
        subtotal DECIMAL(14, 2) NOT NULL DEFAULT 0,
        discount DECIMAL(14, 2) NOT NULL DEFAULT 0,
        shipping_cost DECIMAL(14, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(14, 2) NOT NULL,
        paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
        payment_method ENUM('Tunai', 'Transfer', 'Utang') DEFAULT 'Tunai',
        payment_status ENUM('paid', 'partial', 'unpaid') DEFAULT 'paid',
        due_date DATE NULL,
        notes TEXT NULL,
        created_by VARCHAR(100) DEFAULT 'Kasir',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_purchases_supplier (supplier_id),
        INDEX idx_purchases_invoice (invoice_number),
        INDEX idx_purchases_status (payment_status),
        INDEX idx_purchases_date (purchase_date)
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id VARCHAR(36) PRIMARY KEY,
        purchase_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        unit_id VARCHAR(36) NOT NULL,
        unit_name VARCHAR(50) NOT NULL,
        quantity DECIMAL(12, 4) NOT NULL,
        conversion_ratio DECIMAL(12, 4) NOT NULL DEFAULT 1,
        cost_price DECIMAL(14, 2) NOT NULL,
        subtotal DECIMAL(14, 2) NOT NULL,
        batch_no VARCHAR(100) NULL,
        expiry_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pi_purchase (purchase_id),
        INDEX idx_pi_product (product_id)
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS supplier_payments (
        id VARCHAR(36) PRIMARY KEY,
        purchase_id VARCHAR(36) NULL,
        supplier_id VARCHAR(36) NOT NULL,
        amount DECIMAL(14, 2) NOT NULL,
        payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payment_method ENUM('Tunai', 'Transfer') DEFAULT 'Tunai',
        notes TEXT NULL,
        created_by VARCHAR(100) DEFAULT 'Kasir',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sp_supplier (supplier_id),
        INDEX idx_sp_purchase (purchase_id)
      ) ENGINE=InnoDB;
    `);

    // Tabel receivables & receivable_payments (F1)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS receivables (
        id VARCHAR(36) PRIMARY KEY,
        customer_id VARCHAR(36) NOT NULL,
        sale_id VARCHAR(36) NULL,
        invoice_code VARCHAR(50) NULL,
        amount DECIMAL(14, 2) NOT NULL,
        paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
        remaining_amount DECIMAL(14, 2) NOT NULL,
        due_date DATE NULL,
        status ENUM('open', 'partial', 'paid', 'void') DEFAULT 'open',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_rec_customer (customer_id),
        INDEX idx_rec_status (status)
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS receivable_payments (
        id VARCHAR(36) PRIMARY KEY,
        customer_id VARCHAR(36) NOT NULL,
        receivable_id VARCHAR(36) NULL,
        amount DECIMAL(14, 2) NOT NULL,
        payment_method ENUM('Tunai', 'Transfer', 'QRIS') DEFAULT 'Tunai',
        notes TEXT NULL,
        shift_id VARCHAR(36) NULL,
        created_by VARCHAR(100) NOT NULL DEFAULT 'Kasir',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_rp_cust (customer_id)
      ) ENGINE=InnoDB;
    `);

    // Tabel stock_batches (F7.2 FEFO)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS stock_batches (
        id VARCHAR(36) PRIMARY KEY,
        product_id VARCHAR(36) NOT NULL,
        batch_no VARCHAR(100) NOT NULL,
        qty_base DECIMAL(12, 4) NOT NULL DEFAULT 0,
        initial_qty_base DECIMAL(12, 4) NOT NULL DEFAULT 0,
        cost_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
        expiry_date DATE NULL,
        received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notes TEXT NULL,
        INDEX idx_stock_batches_product (product_id),
        INDEX idx_stock_batches_expiry (expiry_date),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Kolom batch_id di stock_movements
    try {
      const [colBatch] = await connection.query("SHOW COLUMNS FROM stock_movements LIKE 'batch_id'");
      if (colBatch.length === 0) {
        await connection.query("ALTER TABLE stock_movements ADD COLUMN batch_id VARCHAR(36) NULL AFTER reference_id;");
      }
    } catch { }

    // Tabel product_prices (F3 Harga Bertingkat)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_prices (
        id VARCHAR(36) PRIMARY KEY,
        product_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NOT NULL,
        tier_name VARCHAR(100) NOT NULL,
        min_qty DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
        price DECIMAL(14, 2) NOT NULL,
        customer_group VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pp_product (product_id),
        INDEX idx_pp_unit (unit_id),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (unit_id) REFERENCES product_units(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // View v_product_current_stocks
    await connection.query(`
      CREATE OR REPLACE VIEW v_product_current_stocks AS
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.category,
        p.base_unit,
        p.min_stock_alert,
        COALESCE(SUM(sm.quantity_in_base_unit), 0) AS current_stock_base_unit
      FROM products p
      LEFT JOIN stock_movements sm ON p.id = sm.product_id
      WHERE p.is_active = TRUE
      GROUP BY p.id, p.name, p.category, p.base_unit, p.min_stock_alert;
    `);

    // Pastikan kolom-kolom baru di tabel dasar schema.sql sudah dibuat
    try {
      const [colCg] = await connection.query("SHOW COLUMNS FROM customers LIKE 'customer_group'");
      if (colCg.length === 0) {
        await connection.query("ALTER TABLE customers ADD COLUMN customer_group VARCHAR(50) DEFAULT 'umum' AFTER address;");
      }
    } catch { }

    try {
      const [colSalesCust] = await connection.query("SHOW COLUMNS FROM sales LIKE 'customer_id'");
      if (colSalesCust.length === 0) {
        await connection.query(`
          ALTER TABLE sales 
          ADD COLUMN customer_id VARCHAR(36) NULL AFTER payment_method,
          ADD COLUMN customer_name VARCHAR(255) NULL AFTER customer_id,
          ADD INDEX idx_sales_customer (customer_id);
        `);
      }
      const [colsVoid] = await connection.query("SHOW COLUMNS FROM sales LIKE 'is_void'");
      if (colsVoid.length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD COLUMN is_void BOOLEAN DEFAULT FALSE AFTER sync_status,
          ADD COLUMN void_reason TEXT NULL AFTER is_void,
          ADD COLUMN voided_at TIMESTAMP NULL AFTER void_reason,
          ADD COLUMN voided_by VARCHAR(100) NULL AFTER voided_at,
          ADD COLUMN shift_id VARCHAR(36) NULL AFTER voided_by,
          ADD COLUMN discount_amount DECIMAL(14, 2) DEFAULT 0 AFTER total_amount,
          ADD COLUMN discount_type VARCHAR(50) NULL AFTER discount_amount;
        `);
      }

      const [colDiscReason] = await connection.query("SHOW COLUMNS FROM sales LIKE 'discount_reason'");
      if (colDiscReason.length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD COLUMN discount_reason VARCHAR(255) NULL AFTER discount_type,
          ADD COLUMN promo_name VARCHAR(150) NULL AFTER discount_reason;
        `);
      }
    } catch { }

    try {
      const [atnCols] = await connection.query("SHOW COLUMNS FROM sale_items LIKE 'applied_tier_name'");
      if (atnCols.length === 0) {
        await connection.query("ALTER TABLE sale_items ADD COLUMN applied_tier_name VARCHAR(100) NULL AFTER subtotal;");
      }

      const [colSiDisc] = await connection.query("SHOW COLUMNS FROM sale_items LIKE 'discount_amount'");
      if (colSiDisc.length === 0) {
        await connection.query(`
          ALTER TABLE sale_items
          ADD COLUMN discount_amount DECIMAL(14, 2) DEFAULT 0 AFTER subtotal,
          ADD COLUMN discount_type VARCHAR(50) NULL AFTER discount_amount,
          ADD COLUMN discount_note VARCHAR(150) NULL AFTER discount_type;
        `);
      }
    } catch { }

    try {
      await connection.query(`
        INSERT INTO store_settings (setting_key, setting_value) VALUES
          ('cashier_max_discount_percent', '10')
        ON DUPLICATE KEY UPDATE setting_value = setting_value;
      `);
    } catch { }

    try {
      const [colOpn] = await connection.query("SHOW COLUMNS FROM stock_opnames LIKE 'category_filter'");
      if (colOpn.length === 0) {
        await connection.query(`
          ALTER TABLE stock_opnames 
          ADD COLUMN category_filter VARCHAR(100) NULL AFTER status,
          ADD COLUMN total_financial_diff DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER total_discrepancy_items;
        `);
      }
    } catch { }

    try {
      const [colOpnItem] = await connection.query("SHOW COLUMNS FROM stock_opname_items LIKE 'cost_price'");
      if (colOpnItem.length === 0) {
        await connection.query(`
          ALTER TABLE stock_opname_items 
          ADD COLUMN cost_price DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER difference,
          ADD COLUMN financial_diff DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER cost_price;
        `);
      }
    } catch { }

    // 5. Bersihkan data transaksi uji coba
    console.log("[4/5] Membersihkan histori transaksi lama (sales, opnames, mutasi kotor)...");
    await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

    // Kosongkan riwayat penjualan & opname
    const truncateTables = [
      "sale_items", "sales", "sale_payments", "sale_return_items", "sale_returns",
      "stock_opname_items", "stock_opnames", "shift_cash_movements", "cashier_shifts",
      "audit_logs", "receivables", "receivable_payments", "promotions"
    ];
    for (const tbl of truncateTables) {
      try {
        await connection.query(`TRUNCATE TABLE \`${tbl}\`;`);
      } catch { }
    }

    if (!isCleanTransactionsOnly) {
      const masterTables = [
        "stock_batches", "stock_movements", "product_prices", "product_units", "products", "customers"
      ];
      for (const tbl of masterTables) {
        try {
          await connection.query(`TRUNCATE TABLE \`${tbl}\`;`);
        } catch { }
      }
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1;");

    if (isCleanTransactionsOnly) {
      console.log("✓ Berhasil membersihkan semua data transaksi! Master produk & pelanggan dipertahankan.");
      await connection.end();
      return;
    }

    // 6. Seed Master Data Baru
    console.log("[5/5] Menyemai Master Data Baru (10 Produk Warung, Batch FEFO, Tier Harga, Pelanggan, User)...");

    // A. Users Default (Cak Mat: Owner PIN 1234, Siti: Kasir PIN 0000)
    await connection.query(`
      INSERT INTO users (id, name, role, pin_hash, is_active) VALUES
      ('usr-owner-01', 'Cak Mat (Pemilik)', 'owner', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', TRUE),
      ('usr-cashier-01', 'Siti (Kasir)', 'cashier', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', TRUE)
      ON DUPLICATE KEY UPDATE name = VALUES(name);
    `);

    // B. Store Settings
    await connection.query(`
      INSERT INTO store_settings (setting_key, setting_value) VALUES
        ('store_name', 'Warung Madura Berkah 24 Jam'),
        ('store_address', 'Jl. Kaliurang Km 5.5, Depok, Sleman'),
        ('store_phone', '081234567890'),
        ('receipt_footer', 'Matur Suksma! Buka 24 Jam Non-Stop'),
        ('owner_pin', '1234'),
        ('kasbon_due_days', '14'),
        ('printer_paper_width', '58'),
        ('printer_auto_cut', '1')
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
    `);

    // Jika mode TANPA SEED (hanya refresh struktur database kosong siap pakai)
    if (isNoSeed) {
      console.log("------------------------------------------------------------------");
      console.log("✅ SUKSES! Database pos_warung_madura telah di-refresh BERSIH TANPA SEED!");
      console.log(`- Seluruh tabel, view, dan kolom migrasi (F1-F7) siap digunakan.`);
      console.log(`- Akun Kasir: Siti (PIN 0000) & Pemilik: Cak Mat (PIN 1234).`);
      console.log(`- Pengaturan toko default aktif.`);
      console.log(`- Master Produk: 0 (Kosong, siap diisi barang riil toko Anda)`);
      console.log(`- Transaksi Penjualan & Kasbon: 0 (Bersih)`);
      console.log("==================================================================");
      await connection.end();
      return;
    }

    // C. Pelanggan
    for (const c of SEED_CUSTOMERS) {
      await connection.execute(`
        INSERT INTO customers (id, name, phone, address, customer_group, credit_limit, is_active)
        VALUES (?, ?, ?, ?, ?, ?, TRUE)
      `, [c.id, c.name, c.phone, c.address, c.customerGroup, c.creditLimit]);
    }

    // D. Produk, Multi-Satuan, Tier Grosir, Batch FEFO & Ledger Masuk
    for (const p of SEED_PRODUCTS) {
      // 1. Simpan Produk
      await connection.execute(`
        INSERT INTO products (id, name, category, base_unit, min_stock_alert, is_active)
        VALUES (?, ?, ?, ?, ?, TRUE)
      `, [p.id, p.name, p.category, p.baseUnit, p.minStockAlert]);

      // 2. Simpan Multi-Satuan
      for (const u of p.units) {
        await connection.execute(`
          INSERT INTO product_units (id, product_id, unit_name, conversion_ratio, price, cost_price, barcode, is_base_unit)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [u.id, p.id, u.unitName, u.conversionRatio, u.price, u.costPrice, u.barcode, u.isBaseUnit]);
      }

      // 3. Simpan Harga Bertingkat / Grosir (PRD F3)
      for (const t of p.tiers) {
        await connection.execute(`
          INSERT INTO product_prices (id, product_id, unit_id, tier_name, min_qty, price, customer_group)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [`tier-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, p.id, t.unitId, t.tierName, t.minQty, t.price, t.customerGroup]);
      }

      // 4. Simpan Batch Stok & Mutasi Masuk (PRD F7 FEFO)
      let totalStockBase = 0;
      for (const b of p.batches) {
        const batchId = `sb-${p.id}-${b.batchNo.toLowerCase()}`;
        const baseCost = p.units.find(u => u.isBaseUnit)?.costPrice || p.units[0]?.costPrice || 0;

        await connection.execute(`
          INSERT INTO stock_batches (id, product_id, batch_no, qty_base, initial_qty_base, cost_price, expiry_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [batchId, p.id, b.batchNo, b.qty, b.qty, baseCost, b.expiryDate, b.notes]);

        await connection.execute(`
          INSERT INTO stock_movements (id, product_id, type, quantity_in_base_unit, unit_name_used, unit_qty_used, reference_type, batch_id, notes)
          VALUES (?, ?, 'in', ?, ?, ?, 'purchase', ?, ?)
        `, [`mov-${p.id}-${b.batchNo}`, p.id, b.qty, p.baseUnit, b.qty, batchId, `Stok Awal (${b.batchNo})`]);

        totalStockBase += b.qty;
      }
    }

    console.log("------------------------------------------------------------------");
    console.log("✅ SUKSES BESAR! Database pos_warung_madura telah berhasil di-refresh!");
    console.log(`- 10 Produk Madura Lengkap (Rokok, Sembako, Minuman Dingin, Kopi, Gas, Telur)`);
    console.log(`- Multi-Satuan (Ecer, Bungkus, Slop, Dus, Renteng, Karung)`);
    console.log(`- Harga Bertingkat / Grosir & Reseller`);
    console.log(`- Batch FEFO dengan status Kedaluwarsa H-7, H-30 & Aman`);
    console.log(`- Pelanggan Kasbon (Cak Ali, Bu Sri Warteg, Pak Budi)`);
    console.log(`- Akun Kasir: Siti (PIN 0000) & Pemilik: Cak Mat (PIN 1234)`);
    console.log("==================================================================");
  } catch (error) {
    console.error("❌ Terjadi kesalahan saat me-refresh database:", error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

refreshDatabase().catch((e) => {
  console.error(e);
  process.exit(1);
});
