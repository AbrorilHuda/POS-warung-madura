-- ============================================================================
-- SKEMA SUPABASE POSTGRESQL: INVOICE PUBLIK POS WARUNG MADURA
-- Sesuai PRD v1.2: Snapshot publik minimal untuk privasi data warung
-- ============================================================================

-- 1. Tabel: invoices (Snapshot Header Invoice Transaksi)
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(50) PRIMARY KEY, -- Sama dengan invoice_code dari POS (mis. 'WM01-000141')
  store_name VARCHAR(150) NOT NULL DEFAULT 'Warung Madura Berkah',
  store_address TEXT NULL DEFAULT 'Jl. Raya Warung Madura No. 24, Buka 24 Jam',
  total_amount NUMERIC(14, 2) NOT NULL,
  paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  change_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Tunai',
  cashier_name VARCHAR(100) NOT NULL DEFAULT 'Cak Mat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel: invoice_items (Snapshot Rincian Item Belanjaan)
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR(50) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  unit_name VARCHAR(100) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL,
  price NUMERIC(14, 2) NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indeks Performa
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- 4. Row Level Security (RLS)
-- Supabase best practice: Publik boleh READ invoice tertentu,
-- sedangkan INSERT/UPDATE/DELETE hanya melalui Service Role backend terotentikasi.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Kebijakan: Siapa saja boleh membaca (SELECT) invoice publik
DROP POLICY IF EXISTS "Public Read Invoices" ON invoices;
CREATE POLICY "Public Read Invoices" ON invoices
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Invoice Items" ON invoice_items;
CREATE POLICY "Public Read Invoice Items" ON invoice_items
  FOR SELECT USING (true);

-- Kebijakan: Penulisan hanya melalui Service Role (API Backend)
DROP POLICY IF EXISTS "Service Role Full Access Invoices" ON invoices;
CREATE POLICY "Service Role Full Access Invoices" ON invoices
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service Role Full Access Items" ON invoice_items;
CREATE POLICY "Service Role Full Access Items" ON invoice_items
  FOR ALL USING (auth.role() = 'service_role');

-- 5. Fungsi Otomatis Pembersihan Faktur Kedaluwarsa (12 Jam)
-- Menghapus invoice dan item relasinya yang sudah melewati batas waktu simpan
CREATE OR REPLACE FUNCTION delete_expired_invoices(retention_hours INT DEFAULT 12)
RETURNS INT AS $$
DECLARE
  deleted_rows INT;
BEGIN
  DELETE FROM invoices
  WHERE created_at < NOW() - (retention_hours || ' hours')::INTERVAL;
  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Opsional) Penjadwalan otomatis di Supabase jika ekstensi pg_cron diaktifkan:
-- SELECT cron.schedule('cleanup-expired-invoices', '0 * * * *', 'SELECT delete_expired_invoices(12);');
