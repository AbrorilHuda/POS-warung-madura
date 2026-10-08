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

    // 4. View saldo utang pelanggan (PRD F1.4)
    await pool.query(`
      CREATE OR REPLACE VIEW v_customer_receivables_summary AS
      SELECT 
        c.id AS customer_id,
        c.name,
        c.phone,
        c.address,
        c.credit_limit,
        c.is_active,
        COALESCE(SUM(CASE WHEN r.status IN ('open', 'partial') THEN (r.amount - r.paid_amount) ELSE 0 END), 0) AS total_debt,
        COALESCE(COUNT(CASE WHEN r.status IN ('open', 'partial') THEN 1 ELSE NULL END), 0) AS unpaid_invoices_count,
        MIN(CASE WHEN r.status IN ('open', 'partial') THEN r.due_date ELSE NULL END) AS earliest_due_date,
        MAX(r.created_at) AS last_receivable_at
      FROM customers c
      LEFT JOIN receivables r ON c.id = r.customer_id
      GROUP BY c.id, c.name, c.phone, c.address, c.credit_limit, c.is_active;
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

    // 14. Pengaturan default
    await pool.query(`
      INSERT INTO store_settings (setting_key, setting_value) VALUES
        ('owner_pin', '1234'),
        ('kasbon_due_days', '14')
      ON DUPLICATE KEY UPDATE setting_value = setting_value;
    `);

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

