-- ============================================================================
-- MIGRASI DATABASE MYSQL LOKAL: POS WARUNG MADURA FASE 2
-- Modul: F5 (Shift Kasir & Multi-User), F6 (Retur, Void, Diskon), F4 (Split Payment)
-- ============================================================================

USE pos_warung_madura;

-- 1. Tabel users (Multi-User & Hak Akses Berbasis PIN)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role ENUM('owner', 'cashier', 'stock_admin') NOT NULL DEFAULT 'cashier',
  pin_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- 2. Tabel cashier_shifts (Buka/Tutup Shift & Rekonsiliasi Kas Laci)
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

-- 3. Tabel shift_cash_movements (Kas Masuk / Kas Keluar Operasional Selama Shift)
CREATE TABLE IF NOT EXISTS shift_cash_movements (
  id VARCHAR(36) PRIMARY KEY,
  shift_id VARCHAR(36) NOT NULL,
  type ENUM('cash_in', 'cash_out') NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_scm_shift (shift_id),
  CONSTRAINT fk_scm_shift
    FOREIGN KEY (shift_id) REFERENCES cashier_shifts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Tabel audit_logs (Audit Trail Keamanan & Aktivitas Sensitif)
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

-- 5. Tabel sale_payments (Multi-Payment / Split Payment PRD F4)
CREATE TABLE IF NOT EXISTS sale_payments (
  id VARCHAR(36) PRIMARY KEY,
  sale_id VARCHAR(36) NOT NULL,
  payment_method ENUM('Tunai', 'QRIS', 'Transfer', 'Kasbon') NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  reference_no VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sale_pay_sale (sale_id),
  CONSTRAINT fk_sale_pay_sale
    FOREIGN KEY (sale_id) REFERENCES sales(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Tabel sale_returns & sale_return_items (Retur Barang PRD F6.2)
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
  INDEX idx_ret_item_return (sale_return_id),
  CONSTRAINT fk_ret_item_return
    FOREIGN KEY (sale_return_id) REFERENCES sale_returns(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Kolom Tambahan pada Tabel sales (Void, Diskon, Shift ID)
-- (Dijalankan secara aman melalui alter table if not exists di backend ensureDatabaseSchema)
