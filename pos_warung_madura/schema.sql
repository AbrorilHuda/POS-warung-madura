-- ============================================================================
-- SKEMA DATABASE MYSQL LOKAL: POS WARUNG MADURA
-- Sesuai PRD v1.1 (Fullstack React Router + MySQL Lokal di Laptop Warung)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS pos_warung_madura
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pos_warung_madura;

-- ----------------------------------------------------------------------------
-- 1. Tabel: store_settings (Konfigurasi & Profil Warung)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_settings (
  setting_key VARCHAR(50) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. Tabel: products (Master Produk Induk)
-- Memuat data induk dan base_unit (satuan terkecil).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  base_unit VARCHAR(50) NOT NULL, -- Contoh: 'batang', 'pcs', 'butir', 'tabung'
  min_stock_alert INT DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_name (name),
  INDEX idx_products_category (category)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. Tabel: product_units (Level Satuan Kemasan & Barcode)
-- ATURAN PRD: Barcode MELEKAT KE SATUAN, BUKAN PRODUK INDUK.
-- Contoh: Indomie pcs vs dus, Rokok bungkus vs slop memiliki barcode & harga berbeda.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_units (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  unit_name VARCHAR(100) NOT NULL, -- Contoh: 'Ketengan (Batang)', 'Bungkus', 'Slop', 'Dus'
  conversion_ratio DECIMAL(12, 4) NOT NULL DEFAULT 1.0000, -- Pengali ke base_unit (misal Slop = 160 batang)
  price DECIMAL(14, 2) NOT NULL, -- Harga jual satuan ini
  cost_price DECIMAL(14, 2) NULL, -- Referensi harga modal/kulakan terkini
  barcode VARCHAR(100) NULL, -- Barcode unik spesifik untuk kemasan ini
  is_base_unit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX uq_barcode (barcode),
  INDEX idx_product_units_product (product_id),
  CONSTRAINT fk_product_units_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. Tabel: stock_movements (Ledger Mutasi Stok)
-- ATURAN PRD: Single source of truth untuk hitung stok riil.
-- Semua mutasi dihitung & dikonversi ke satuan terkecil (quantity_in_base_unit).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  type ENUM('in', 'out', 'adjustment') NOT NULL, -- 'in' = kulakan, 'out' = penjualan, 'adjustment' = opname
  quantity_in_base_unit DECIMAL(12, 4) NOT NULL, -- Positif jika bertambah, negatif jika keluar/penjualan
  unit_name_used VARCHAR(100) NOT NULL, -- Satuan yang diinput kasir saat transaksi/kulakan
  unit_qty_used DECIMAL(12, 4) NOT NULL, -- Jumlah satuan tersebut
  cost_per_unit DECIMAL(14, 2) NULL, -- Harga modal per satuan (khusus type 'in')
  reference_type VARCHAR(50) NULL, -- 'sale', 'purchase', 'opname'
  reference_id VARCHAR(50) NULL, -- ID transaksi penjualan / kulakan / opname
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sm_product (product_id),
  INDEX idx_sm_created (created_at),
  INDEX idx_sm_type (type),
  CONSTRAINT fk_sm_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. Tabel: sales (Header Transaksi Penjualan)
-- ATURAN PRD: invoice_code format {kode_warung}-{no_urut}, unik global & siap offline.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(36) PRIMARY KEY,
  invoice_code VARCHAR(50) NOT NULL, -- Contoh: 'WM01-000141'
  total_amount DECIMAL(14, 2) NOT NULL,
  paid_amount DECIMAL(14, 2) NOT NULL,
  change_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  payment_method ENUM('Tunai', 'QRIS', 'Hutang') DEFAULT 'Tunai',
  cashier_name VARCHAR(100) DEFAULT 'Cak Mat',
  sync_status ENUM('pending', 'synced', 'failed') DEFAULT 'pending',
  synced_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX uq_sales_invoice_code (invoice_code),
  INDEX idx_sales_sync_status (sync_status),
  INDEX idx_sales_created (created_at)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. Tabel: sale_items (Rincian Item Transaksi)
-- Menyimpan snapshot nama, satuan, dan harga saat transaksi terjadi.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_items (
  id VARCHAR(36) PRIMARY KEY,
  sale_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  product_unit_id VARCHAR(36) NULL,
  snapshot_product_name VARCHAR(255) NOT NULL,
  snapshot_unit_name VARCHAR(100) NOT NULL,
  conversion_ratio DECIMAL(12, 4) NOT NULL,
  price DECIMAL(14, 2) NOT NULL,
  cost_price DECIMAL(14, 2) NULL,
  quantity DECIMAL(12, 4) NOT NULL,
  subtotal DECIMAL(14, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sale_items_sale (sale_id),
  INDEX idx_sale_items_product (product_id),
  CONSTRAINT fk_sale_items_sale
    FOREIGN KEY (sale_id) REFERENCES sales(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. Tabel: stock_opnames (Sesi Stok Opname Bulanan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_opnames (
  id VARCHAR(36) PRIMARY KEY,
  session_code VARCHAR(50) NOT NULL, -- Contoh: 'OPN-2026-09'
  status ENUM('draft', 'completed') DEFAULT 'draft',
  total_discrepancy_items INT DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  UNIQUE INDEX uq_opname_code (session_code)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. Tabel: stock_opname_items (Rincian Hasil Cek Fisik vs Sistem)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_opname_items (
  id VARCHAR(36) PRIMARY KEY,
  opname_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  system_stock DECIMAL(12, 4) NOT NULL,
  physical_stock DECIMAL(12, 4) NOT NULL,
  difference DECIMAL(12, 4) NOT NULL, -- physical_stock - system_stock
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_opname_items_session (opname_id),
  CONSTRAINT fk_opname_items_session
    FOREIGN KEY (opname_id) REFERENCES stock_opnames(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_opname_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================================
-- SQL VIEW HELPER: v_product_current_stocks
-- Menghitung stok terkini tiap produk secara realtime dari ledger mutasi.
-- ============================================================================
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

-- ============================================================================
-- KONFIGURASI AWAL (STORE SETTINGS)
-- ============================================================================
INSERT INTO store_settings (setting_key, setting_value) VALUES
  ('store_code', 'WM01'),
  ('store_name', 'Warung Madura Berkah'),
  ('store_address', 'Jl. Raya Kalianget No. 88, Sumenep'),
  ('receipt_footer', 'Matur Sembah Nuwun! Buka 24 Jam Non-Stop')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Catatan: Master produk & transaksi dibiarkan bersih/kosong agar kasir
-- dapat menginput data barang secara manual dari awal.
