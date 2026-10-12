import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

let pool: Pool;

declare global {
  // Prevent multiple connection pools during Vite HMR
  var __dbPool: Pool | undefined;
}

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "pos_warung_madura",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  timezone: process.env.DB_TIMEZONE || "+07:00", // Waktu Indonesia Barat (WIB)
};

if (process.env.NODE_ENV === "production") {
  pool = mysql.createPool(dbConfig);
} else {
  if (!global.__dbPool) {
    global.__dbPool = mysql.createPool(dbConfig);
  }
  pool = global.__dbPool;
}

export { pool };

/**
 * Eksekusi query dengan parameter aman
 */
export async function query<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[]
): Promise<T> {
  const [results] = await pool.execute<T>(sql, params);
  return results;
}

let isSchemaInitialized = false;

/**
 * Memastikan tabel dan view terbaru selalu ada di database (auto incremental migration)
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (isSchemaInitialized) return;
  try {
    // 1. Pastikan tabel customers ada (PRD F1.1)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NULL,
        address TEXT NULL,
        credit_limit DECIMAL(14, 2) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_customers_name (name),
        INDEX idx_customers_phone (phone)
      ) ENGINE=InnoDB;
    `);

    // 2. Pastikan tabel receivables ada (PRD F1.4)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS receivables (
        id VARCHAR(36) PRIMARY KEY,
        customer_id VARCHAR(36) NOT NULL,
        sale_id VARCHAR(36) NULL,
        invoice_code VARCHAR(50) NULL,
        amount DECIMAL(14, 2) NOT NULL,
        paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
        due_date DATE NULL,
        status ENUM('open', 'partial', 'paid', 'void') DEFAULT 'open',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_receivables_customer (customer_id),
        INDEX idx_receivables_sale (sale_id),
        INDEX idx_receivables_status (status),
        INDEX idx_receivables_due_date (due_date)
      ) ENGINE=InnoDB;
    `);

    // 3. Pastikan tabel receivable_payments ada (PRD F1.5)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS receivable_payments (
        id VARCHAR(36) PRIMARY KEY,
        customer_id VARCHAR(36) NOT NULL,
        receivable_id VARCHAR(36) NULL,
        amount DECIMAL(14, 2) NOT NULL,
        payment_method ENUM('Tunai', 'Transfer', 'QRIS') DEFAULT 'Tunai',
        notes TEXT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        shift_id VARCHAR(36) NULL,
        created_by VARCHAR(100) DEFAULT 'Kasir',
        INDEX idx_rec_pay_customer (customer_id),
        INDEX idx_rec_pay_receivable (receivable_id),
        INDEX idx_rec_pay_paid_at (paid_at)
      ) ENGINE=InnoDB;
    `);

    // 3b. Pastikan kolom customer_group ada di customers (PRD F3.3)
    try {
      const [cgCols] = await pool.query<RowDataPacket[]>(
        `SHOW COLUMNS FROM customers LIKE 'customer_group'`
      );
      if (cgCols.length === 0) {
        await pool.query(`
          ALTER TABLE customers 
          ADD COLUMN customer_group VARCHAR(50) DEFAULT 'umum' AFTER credit_limit;
        `);
      }
    } catch {}

    // 4. View saldo utang pelanggan (PRD F1.4 & F3.3)
    await pool.query(`
      CREATE OR REPLACE VIEW v_customer_receivables_summary AS
      SELECT 
        c.id AS customer_id,
        c.name,
        c.phone,
        c.address,
        c.customer_group,
        c.credit_limit,
        c.is_active,
        COALESCE(SUM(CASE WHEN r.status IN ('open', 'partial') THEN (r.amount - r.paid_amount) ELSE 0 END), 0) AS total_debt,
        COALESCE(COUNT(CASE WHEN r.status IN ('open', 'partial') THEN 1 ELSE NULL END), 0) AS unpaid_invoices_count,
        MIN(CASE WHEN r.status IN ('open', 'partial') THEN r.due_date ELSE NULL END) AS earliest_due_date,
        MAX(r.created_at) AS last_receivable_at
      FROM customers c
      LEFT JOIN receivables r ON c.id = r.customer_id
      GROUP BY c.id, c.name, c.phone, c.address, c.customer_group, c.credit_limit, c.is_active;
    `);

    // 4b. View stok terkini produk dari ledger (PRD F2)
    await pool.query(`
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

    // 5. Tambah kolom customer_id dan customer_name di sales jika belum ada
    const [cols] = await pool.query<RowDataPacket[]>(
      `SHOW COLUMNS FROM sales LIKE 'customer_id'`
    );
    if (cols.length === 0) {
      await pool.query(`
        ALTER TABLE sales 
        ADD COLUMN customer_id VARCHAR(36) NULL AFTER payment_method,
        ADD COLUMN customer_name VARCHAR(255) NULL AFTER customer_id,
        ADD INDEX idx_sales_customer (customer_id);
      `);
    }

    // 6. Pastikan ENUM payment_method memuat 'Kasbon' dan 'Campuran' (PRD F4.2)
    try {
      await pool.query(`
        ALTER TABLE sales 
        MODIFY COLUMN payment_method ENUM('Tunai', 'QRIS', 'Hutang', 'Kasbon', 'Campuran') DEFAULT 'Tunai';
      `);
    } catch {}

    // 7. Tabel users (PRD F5.1, F5.2 Multi-User & PIN login)
    await pool.query(`
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

    try {
      await pool.query("ALTER TABLE users MODIFY COLUMN pin_hash VARCHAR(255) NULL;");
    } catch {}

    // Inisialisasi User default jika tabel users masih kosong (Cak Mat: Owner PIN 1234, Siti: Kasir PIN 0000)
    const [userCountRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM users");
    if (userCountRows[0]?.cnt === 0) {
      // SHA-256('1234') = 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
      // SHA-256('0000') = 9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0
      await pool.query(`
        INSERT INTO users (id, name, role, pin_hash, is_active) VALUES
        ('usr-owner-01', 'Cak Mat (Pemilik)', 'owner', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', TRUE),
        ('usr-cashier-01', 'Siti (Kasir)', 'cashier', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', TRUE);
      `);
    }

    // 8. Tabel cashier_shifts (PRD F5.3, F5.4 Buka/Tutup Shift)
    await pool.query(`
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
        INDEX idx_shifts_status (status),
        INDEX idx_shifts_cashier (cashier_id),
        INDEX idx_shifts_created (created_at)
      ) ENGINE=InnoDB;
    `);

    // 9. Tabel shift_cash_movements (PRD F5.5 Kas Masuk / Kas Keluar selama shift)
    await pool.query(`
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

    // 10. Tabel audit_logs (PRD F5.7 Jejak Rekam Aktivitas Sensitif)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50) NULL,
        target_id VARCHAR(50) NULL,
        details TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_action (action),
        INDEX idx_audit_created (created_at)
      ) ENGINE=InnoDB;
    `);

    // 11. Tabel sale_payments (PRD F4 Split Payment)
    await pool.query(`
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

    // 12. Tabel sale_returns & sale_return_items (PRD F6.2 Retur Barang)
    await pool.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_returns_sale (sale_id),
        INDEX idx_returns_code (return_code)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sale_return_items (
        id VARCHAR(36) PRIMARY KEY,
        sale_return_id VARCHAR(36) NOT NULL,
        sale_item_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        quantity DECIMAL(12, 4) NOT NULL,
        refund_price DECIMAL(14, 2) NOT NULL,
        is_restockable BOOLEAN DEFAULT TRUE,
        condition_notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ret_item_return (sale_return_id)
      ) ENGINE=InnoDB;
    `);

    // 13. Tambahkan kolom void, diskon, shift_id ke sales jika belum ada
    const [colsVoid] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM sales LIKE 'is_void'");
    if (colsVoid.length === 0) {
      await pool.query(`
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

    // 14. Tabel product_prices (PRD F3: Harga Bertingkat / Grosir & Reseller)
    await pool.query(`
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
        CONSTRAINT fk_pp_product
          FOREIGN KEY (product_id) REFERENCES products(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_pp_unit
          FOREIGN KEY (unit_id) REFERENCES product_units(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 15. Kolom applied_tier_name di sale_items jika belum ada
    try {
      const [atnCols] = await pool.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM sale_items LIKE 'applied_tier_name'"
      );
      if (atnCols.length === 0) {
        await pool.query(`
          ALTER TABLE sale_items
          ADD COLUMN applied_tier_name VARCHAR(100) NULL AFTER subtotal;
        `);
      }
    } catch {}

    // 16. Pengaturan default
    await pool.query(`
      INSERT INTO store_settings (setting_key, setting_value) VALUES
        ('owner_pin', '1234'),
        ('kasbon_due_days', '14')
      ON DUPLICATE KEY UPDATE setting_value = setting_value;
    `);

    // 17. Bersihkan barcode pada produk yang sudah dihapus/dinonaktifkan (is_active = FALSE)
    // agar barcode tidak memicu ER_DUP_ENTRY jika toko mendaftarkan ulang barang tersebut
    try {
      await pool.query(`
        UPDATE product_units pu
        JOIN products p ON pu.product_id = p.id
        SET pu.barcode = NULL
        WHERE p.is_active = FALSE AND pu.barcode IS NOT NULL;
      `);
    } catch {}

    // 18. Tabel stock_batches (PRD F7.2 Tanggal Kedaluwarsa & FEFO)
    await pool.query(`
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
        CONSTRAINT fk_sb_product
          FOREIGN KEY (product_id) REFERENCES products(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 19. Tambahkan kolom batch_id ke stock_movements jika belum ada
    try {
      const [colsBatch] = await pool.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM stock_movements LIKE 'batch_id'"
      );
      if (colsBatch.length === 0) {
        await pool.query(
          "ALTER TABLE stock_movements ADD COLUMN batch_id VARCHAR(36) NULL AFTER reference_id;"
        );
      }
    } catch {}

    // 20. Tambahkan kolom category_filter dan total_financial_diff ke stock_opnames jika belum ada
    try {
      const [colsOpn] = await pool.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM stock_opnames LIKE 'category_filter'"
      );
      if (colsOpn.length === 0) {
        await pool.query(`
          ALTER TABLE stock_opnames 
          ADD COLUMN category_filter VARCHAR(100) NULL AFTER status,
          ADD COLUMN total_financial_diff DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER total_discrepancy_items;
        `);
      }
    } catch {}

    // 21. Tambahkan kolom cost_price dan financial_diff ke stock_opname_items jika belum ada
    try {
      const [colsOpnItem] = await pool.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM stock_opname_items LIKE 'cost_price'"
      );
      if (colsOpnItem.length === 0) {
        await pool.query(`
          ALTER TABLE stock_opname_items 
          ADD COLUMN cost_price DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER difference,
          ADD COLUMN financial_diff DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER cost_price;
        `);
      }
    } catch {}

    // 22. Inisialisasi batch awal untuk produk yang sudah ada stoknya jika tabel batch masih kosong
    try {
      const [batchCount] = await pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) as cnt FROM stock_batches"
      );
      if (batchCount[0]?.cnt === 0) {
        // Ambil produk dengan stok riil > 0 dari view
        const [prods] = await pool.query<RowDataPacket[]>(`
          SELECT 
            p.id, 
            v.current_stock_base_unit, 
            COALESCE(pu.cost_price, 0) as cost_price
          FROM products p
          JOIN v_product_current_stock v ON p.id = v.product_id
          LEFT JOIN product_units pu ON p.id = pu.product_id AND pu.is_base_unit = TRUE
          WHERE p.is_active = TRUE AND v.current_stock_base_unit > 0
        `);

        for (const row of prods) {
          const batchId = `sb-init-${row.id.slice(-8)}`;
          await pool.query(`
            INSERT INTO stock_batches (
              id, product_id, batch_no, qty_base, initial_qty_base, cost_price, expiry_date, notes
            ) VALUES (?, ?, 'BATCH-AWAL', ?, ?, ?, NULL, 'Batch Inisialisasi Stok Sistem')
          `, [batchId, row.id, row.current_stock_base_unit, row.current_stock_base_unit, row.cost_price]);
        }
      }
    } catch (e: any) {
      console.warn("[Init stock batches warning]:", e.message);
    }

    isSchemaInitialized = true;
  } catch (err: any) {
    console.warn("[ensureDatabaseSchema warning]:", err.message);
  }
}

/**
 * Tes koneksi ke MySQL lokal
 */
export async function testDbConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    await pool.query("SELECT 1");
    await ensureDatabaseSchema();
    return { ok: true, message: "Terhubung ke MySQL lokal pos_warung_madura" };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Gagal menghubungi MySQL lokal" };
  }
}

