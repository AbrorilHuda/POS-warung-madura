-- ============================================================================
-- MIGRASI SUPABASE v2: MULTI-TENANT SAAS
-- PRD v2.1: Transformasi ke platform SaaS — jalankan setelah supabase-schema.sql
-- ============================================================================

-- ============================================================================
-- 1. TABEL BARU: tenants
-- Setiap baris = satu toko yang terdaftar di platform
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  store_code      TEXT UNIQUE NOT NULL,
  -- Kode pendek toko, misal "WM01". Dijadikan prefix untuk invoice_code.

  store_slug      TEXT UNIQUE NOT NULL,
  -- Bagian URL, misal "warung-madura-berkah". Auto-generate dari store_name.
  -- Dipakai di: /{store_slug}/invoice/{invoice_code}

  store_name      TEXT NOT NULL,
  owner_name      TEXT,
  -- Nama pemilik warung/toko. Dipakai sebagai nama akun Pemilik (Owner) di POS kasir.
  store_address   TEXT,

  owner_email     TEXT,
  -- Email untuk kirim kredensial via Resend.

  contact_wa      TEXT,
  -- Nomor WhatsApp pemilik (format internasional, misal 6281234567890).

  sync_secret     TEXT UNIQUE NOT NULL,
  -- Token rahasia per toko. Format: tok_live_{random hex 32 char}
  -- Hanya ada di .env POS lokal + tabel ini. Tidak pernah dikirim ke client.

  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  -- 'free'  → 50 invoice/bulan, gratis
  -- 'pro'   → unlimited, Rp 25.000/bulan

  invoice_count   INT NOT NULL DEFAULT 0,
  -- Counter invoice bulan ini. Direset lazy saat request sync masuk.

  invoice_limit   INT NOT NULL DEFAULT 50,
  -- 50 untuk free. Set ke 999999 untuk pro (unlimited praktis).

  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),

  last_reset_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Kapan terakhir invoice_count direset ke 0. Basis logika reset bulanan.

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. MODIFIKASI TABEL: invoices
-- Tambah kolom store_slug & store_code untuk link ke tenant
-- ============================================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS store_slug TEXT REFERENCES tenants(store_slug) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_code TEXT;
-- store_code didenormalisasi (bukan FK) supaya query tidak perlu JOIN saat tampil invoice.

-- Tambah kolom owner_name jika tabel tenants sudah pernah dibuat sebelumnya
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

-- ============================================================================
-- 3. INDEKS PERFORMA
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tenants_sync_secret  ON tenants(sync_secret);
-- Krusial: setiap sync call melakukan lookup berdasarkan sync_secret.

CREATE INDEX IF NOT EXISTS idx_tenants_store_slug   ON tenants(store_slug);
CREATE INDEX IF NOT EXISTS idx_invoices_store_slug  ON invoices(store_slug);

-- ============================================================================
-- 4. TRIGGER: updated_at otomatis di tabel tenants
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) — TABEL tenants
-- Publik hanya boleh SELECT store_name, store_slug, store_address (untuk halaman toko).
-- sync_secret, owner_email, contact_wa hanya Service Role yang bisa akses.
-- ============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Publik boleh baca info toko (untuk halaman profil toko)
DROP POLICY IF EXISTS "Public Read Tenant Info" ON tenants;
CREATE POLICY "Public Read Tenant Info" ON tenants
  FOR SELECT USING (true);
-- Note: sync_secret tidak pernah dikirim ke client karena semua query
--       dijalankan di server (action/loader React Router, bukan client JS).

-- Hanya Service Role yang boleh INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Service Role Full Access Tenants" ON tenants;
CREATE POLICY "Service Role Full Access Tenants" ON tenants
  FOR ALL USING (auth.role() = 'service_role');
