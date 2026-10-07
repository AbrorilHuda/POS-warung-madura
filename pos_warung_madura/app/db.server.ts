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

    // 6. Pastikan ENUM payment_method memuat 'Kasbon'
    try {
      await pool.query(`
        ALTER TABLE sales 
        MODIFY COLUMN payment_method ENUM('Tunai', 'QRIS', 'Hutang', 'Kasbon') DEFAULT 'Tunai';
      `);
    } catch {}

    // 7. Pengaturan default
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

