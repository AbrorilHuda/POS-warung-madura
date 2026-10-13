# 🏪 POS Warung Madura Sistem Kasir Modern & Struk Digital Cloud

Aplikasi Point of Sale (POS) modern khusus operasional warung madura dan ritel minimarket UMKM, dirancang untuk berjalan secara **offline-first** di laptop/PC kasir menggunakan **Electron Desktop** dengan database **MySQL Portable terisolasi**, serta terintegrasi dengan **Layanan Struk Digital Cloud (Invoice Publik)** dan **Scanner Barcode Nirkabel Kamera HP**.

> [!NOTE]
> 🏷️ **Versi Rilis Saat Ini:** `v3.1.0` (Desktop Windows 64-bit)  
> 📦 **Ukuran Installer Ringan:** Berkas installer installer hanya berukuran **~113 MB** (terpangkas >800 MB berkat optimasi strip bloatware MySQL dan kompresi solid LZMA).  
> 👉 **[Download Rilis Installer Windows (.exe) di GitHub Releases](https://github.com/AbrorilHuda/POS-warung-madura/releases)**

---

## 📂 Struktur Proyek

Repositori ini terdiri dari 2 sub-project utama:

```
POS-warung-madura/
├── pos_warung_madura/          # 🖥️ Aplikasi Desktop Kasir Utama (Electron + React Router v8 + MySQL Portable)
└── invoice_publik/             # ☁️ Layanan Web Verifikasi Struk Publik untuk Pembeli (Supabase Cloud)
```

| Folder | Deskripsi | Port Default |
|---|---|---|
| **`pos_warung_madura`** | Aplikasi Desktop Kasir Electron, manajemen stok & FEFO, kulakan supplier, diskon/promo, import/export CSV, server lokal HTTPS/WSS. | `4000` (Prod) / `5174` (Dev) / `3307` (MySQL) |
| **`invoice_publik`** | Server web struk digital publik untuk pembeli memindai QR nota, terhubung ke Supabase Cloud dengan fitur auto-delete 12 jam. | `5175` |

---

## ⚡ Fitur Utama Lengkap (PRD F1 – F10)

- 💻 **Desktop Standalone (Windows .exe)**: Aplikasi desktop native Windows dibungkus Electron dengan zero-dependency runtime.
- 🗄️ **Zero-Config Portable MySQL**: Menyalakan dan menginisialisasi MySQL lokal secara otomatis di port terisolasi `3307` tanpa perlu menginstal XAMPP/Laragon.
- 📱 **Scanner Barcode Kamera HP Nirkabel (F12)**: Mengubah smartphone kasir menjadi scanner barcode nirkabel via WebSocket aman (`wss://`) dan HTTPS SSL internal.
- 👥 **Buku Kasbon & Pelanggan (F1)**:
  - Pencatatan buku besar utang/piutang pelanggan per transaksi.
  - Limit kredit otomatis dan batas jatuh tempo piutang.
  - Pelunasan utang terstruktur berbasis First-In First-Out (FIFO).
  - Tautan penagihan WhatsApp otomatis 1-klik.
- 📊 **Laporan Finansial, Omzet & Cetak PDF (F2)**:
  - Perhitungan laba kotor & margin riil berbasis HPP (*Harga Pokok Penjualan*).
  - Ringkasan arus kas masuk/keluar kasir dan filter fleksibel (per shift kasir, hari ini, 7 hari, bulan ini, atau custom range).
  - Cetak laporan finansial ke struk thermal 58mm/80mm serta ekspor cetak PDF.
- 🏷️ **Multi-Satuan & Harga Bertingkat / Reseller (F3)**:
  - Menjual eceran/batang, bungkus, slop, hingga dus kartonan.
  - Penetapan harga bertingkat otomatis berdasarkan kuantiti belanja (grosir/reseller).
- 💳 **Pembayaran Non-Tunai & Customer Display (F4)**:
  - Pembayaran QRIS Statis standee & split payment (kombinasi Tunai + Non-Tunai).
  - Layar display pembeli (*Customer Display*) eksternal sinkron realtime via BroadcastChannel/WebSocket.
- 🛡️ **Shift Kasir & Otorisasi Pemilik (F5)**:
  - Buka/tutup shift kasir, rekapitulasi modal awal, dan penghitungan selisih kas fisik.
  - Otorisasi PIN Pemilik (*Supervisor Override*) untuk aksi kritis kasir (diskon khusus melebihi limit, void nota, dsb.).
  - Jejak rekam audit log aktivitas kasir yang tidak dapat dimanipulasi.
- 🔄 **Retur Penjualan, Void Transaksi & Diskon Promo (F6)**:
  - Pembatalan transaksi penuh (*Void*) atau pengembalian sebagian barang (*Retur*) dengan persetujuan PIN Pemilik.
  - Program diskon otomatis bertingkat: diskon persentase/nominal, beli X gratis Y, minimum belanja, bundling paket hemat, serta diskon khusus pelanggan kasbon.
- 📦 **Manajemen Stok Lanjutan & FEFO (F7)**:
  - Tanggal kedaluwarsa berbasis batch dengan algoritma **First Expired, First Out (FEFO)** dan visualisasi alert H-0 (Expired), H-7, H-30.
  - Stok opname fisik dengan scanner barcode dan perhitungan selisih kuantiti serta nilai finansial rupiah (HPP).
  - Penyesuaian stok manual dengan alasan wajib (rusak, hilang, kedaluwarsa, konsumsi sendiri).
  - Rekomendasi kulakan cerdas berdasarkan kecepatan penjualan 30 hari + ekspor daftar belanja ke WhatsApp.
  - Kartu stok produk dengan riwayat saldo berjalan (*running balance*).
- 🚚 **Supplier & Kulakan Lanjutan (F8)**:
  - Pencatatan faktur kulakan dari supplier lengkap dengan nomor nota, termin pembayaran, dan utang usaha.
  - Pembaruan otomatis stok dan kalkulasi HPP baru secara akurat (*moving average*).
- 📥 **Import & Ekspor Data Massal Excel / CSV (F9)**:
  - Unduh template CSV resmi untuk Produk dan Pelanggan.
  - Impor massal data master barang dan pelanggan dari Excel/CSV dengan validasi error baris per baris.
  - Ekspor seluruh katalog produk, data pelanggan, mutasi stok fisik, dan riwayat transaksi penjualan dalam format CSV (UTF-8 BOM siap buka di Microsoft Excel).
- 💾 **Pencadangan & Pemulihan Database Offline (F10)**:
  - Pencadangan otomatis harian menggunakan utilitas native `mysqldump`.
  - Pemulihan (*restore*) aman dari file SQL cadangan.
- 🧾 **Struk Digital Cloud (Invoice Publik)**:
  - Pelanggan dapat memindai QR code nota untuk melihat struk digital online.
  - Struk otomatis terhapus dari cloud dalam 12 jam (retensi privasi).

---

## 🛠️ Prasyarat Sistem (Prerequisites)

1. **Sistem Operasi**: Windows 10 atau Windows 11 (64-bit).
2. **Node.js**: Versi `20.x` atau lebih baru ([Unduh Node.js LTS](https://nodejs.org/)).
3. **Paket MySQL Portable Community Server (LTS)**:
   - Unduh ZIP MySQL Community Server (versi 8.4 LTS x86 64-bit) dari [MySQL Downloads](https://dev.mysql.com/downloads/mysql/).
   - Ekstrak arsip tersebut; Anda membutuhkan folder `bin/`, `lib/`, dan `share/`.

---

## 🚀 Panduan Instalasi Langkah Demi Langkah

### 1. Clone Repositori

```bash
git clone https://github.com/AbrorilHuda/POS-warung-madura.git
cd POS-warung-madura
```

---

### 2. Setup Aplikasi Kasir Desktop (`pos_warung_madura`)

#### A. Masuk ke Direktori & Pasang Dependensi
```bash
cd pos_warung_madura
npm install
```

#### B. Setup Binary MySQL Portable
Salin folder `bin/`, `lib/`, dan `share/` dari hasil ekstrak ZIP MySQL ke dalam folder `pos_warung_madura/resources/mysql/` sehingga strukturnya menjadi:
```
pos_warung_madura/resources/mysql/
├── bin/
│   ├── mysqld.exe
│   ├── mysql.exe
│   ├── mysqldump.exe
│   ├── mysqladmin.exe
│   └── ...
├── lib/
├── share/
└── data/             (folder data biarkan kosong, akan diinisialisasi otomatis)
```

#### C. Pangkas Bloatware MySQL (Hemat ~813 MB!)
Jalankan script pemangkas bloatware MySQL yang telah kami sediakan untuk menghapus symbol debug (.pdb), compiler lib, dan file yang tidak digunakan:
```bash
npm run mysql:strip
```
> 💡 *Ukuran folder `resources/mysql` akan langsung menyusut dari ~912 MB menjadi ~99 MB tanpa mengganggu fungsi database.*

#### D. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
copy .env.example .env
```
Sesuaikan konfigurasi toko Anda (nama toko, alamat, nomor WhatsApp, serta `SYNC_SECRET_KEY`).

---

### 3. Setup Layanan Struk Publik Cloud (`invoice_publik`)

#### A. Masuk ke Direktori & Pasang Dependensi
Buka terminal baru di root repository:
```bash
cd invoice_publik
npm install
```

#### B. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
copy .env.example .env
```
Buka file `.env` di folder `invoice_publik` dan isi kredensial Supabase Anda:
```env
PORT=5175
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SYNC_SECRET_KEY=tok_live_ganti_dengan_secret_acak_anda
INVOICE_RETENTION_HOURS=12
```
> **PENTING**: Nilai `SYNC_SECRET_KEY` di `invoice_publik/.env` **WAJIB SAMA** dengan `SYNC_SECRET_KEY` di `pos_warung_madura/.env`.

---

## 🖥️ Menjalankan Aplikasi (Mode Development)

### 1. Jalankan Server Invoice Publik (Cloud)
Di folder `invoice_publik`:
```bash
npm run dev
```
Server invoice berjalan di `http://127.0.0.1:5175`.

### 2. Jalankan Aplikasi Desktop POS Kasir
Di folder `pos_warung_madura`:
```bash
npm run electron:dev
```
Perintah ini otomatis:
1. Menyalakan Vite Dev Server (`https://127.0.0.1:5174`).
2. Menyalakan MySQL Portable pada port `3307`.
3. Mengompilasi TypeScript Electron process.
4. Membuka jendela desktop Electron dengan dukungan *Hot Module Reloading* (HMR).

---

## 📜 Daftar Perintah Lengkap (`package.json`)

Berikut adalah seluruh perintah `npm` yang tersedia di dalam `pos_warung_madura/package.json`:

### 🛠️ Development & Running
| Perintah | Fungsi |
|---|---|
| `npm run electron:dev` | **(Rekomendasi Dev)** Menjalankan Vite dev server + Electron desktop kasir secara simultan. |
| `npm run dev` | Menjalankan web dev server React Router saja (`localhost:5174`). |
| `npm run dev:all` | Menjalankan seluruh proses development bersamaan dengan scanner websocket. |
| `npm run ws:scanner` | Menjalankan server websocket scanner kamera nirkabel secara terpisah. |
| `npm run start` | Menjalankan production server React Router via `@react-router/serve`. |

### 🗄️ Manajemen Database
| Perintah | Fungsi |
|---|---|
| `npm run db:init` | Menginisialisasi skema database dan membuat tabel awal jika belum ada. |
| `npm run db:refresh` | Mereset database dan mengisi ulang data awal warung (10 produk, grosir, kasbon, akun kasir/pemilik). |
| `npm run db:seed` | Alias dari `npm run db:refresh`. |
| `npm run db:clean` | Mereset database menjadi **KOSONG (0 produk/transaksi)**, siap untuk data nyata warung Anda. |
| `npm run db:reset-hard` | Melakukan drop database dan membangun ulang dari nol dengan data awal warung. |
| `npm run db:clean-hard` | Melakukan drop database dan membangun ulang dari nol dalam kondisi bersih kosong tanpa seed. |

### 📦 Build & Packaging Produksi
| Perintah | Fungsi |
|---|---|
| `npm run electron:build` | **(Satu Perintah Lengkap)** Mem-build frontend/server, mengompilasi TypeScript Electron, generate icon, strip bloatware MySQL, dan membuat installer NSIS `.exe`. |
| `npm run build` | Mem-build bundle client dan server React Router v8 untuk mode produksi. |
| `npm run build:electron` | Mengompilasi TypeScript Electron (`electron/main.ts`) ke `dist-electron/main.js`. |
| `npm run icon:generate` | Mengonversi `public/icons/icon.png` menjadi icon multi-resolusi Windows `public/icons/icon.ico`. |
| `npm run mysql:strip` | Memangkas file debug `.pdb`, `.lib`, `.pl`, dan bahasa tak terpakai pada MySQL portable (hemat ~813 MB). |
| `npm run typecheck` | Menjalankan pemeriksaan tipe TypeScript dan typegen React Router. |

---

## 📦 Membangun Paket Installer Desktop (Packaging)

Untuk membuat aplikasi installer siap pakai bagi laptop kasir:

Masuk ke folder `pos_warung_madura`:

### Opsi A: Buat File Installer NSIS (.exe Setup)
```bash
npm run electron:build
```
Installer siap distribusi akan dihasilkan di:
```
pos_warung_madura/release/POS Warung Madura Setup 3.1.0.exe
```
*(Ukuran berkas installer hanya **~113 MB**, siap didistribusikan ke laptop kasir tanpa perlu instalasi Node.js).*

### Opsi B: Buat Folder Portable Unpacked (Langsung Dobel-Klik)
Jika ingin menguji aplikasi tanpa proses instalasi:
```bash
npm run build && npm run build:electron && npx electron-builder --win --dir
```
Hasil aplikasi langsung jalan berada di:
```
pos_warung_madura/release/win-unpacked/POS Warung Madura.exe
```

---

## 📱 Panduan Menggunakan Scanner Kamera HP Nirkabel

Aplikasi dilengkapi fitur scanner kamera HP (shortcut **F12**) yang terhubung secara realtime via WebSocket.

### Langkah Setup Sekali Saja di Laptop:
1. **Buka Port 4000 di Windows Firewall**:
   Jalankan perintah ini di **PowerShell (Run as Administrator)**:
   ```powershell
   New-NetFirewallRule -DisplayName "POS Warung Madura - Port 4000" `
     -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Private
   ```
2. Pastikan HP dan Laptop kasir terhubung ke **jaringan Wi-Fi yang sama**.

### Langkah Menghubungkan HP:
1. Di aplikasi kasir laptop, tekan tombol **F12** atau klik tombol **"Hubungkan HP Scanner"** di pojok kiri bawah.
2. QR Code pairing akan muncul di layar kasir.
3. Buka kamera HP atau browser HP, pindai QR Code tersebut dan buka alamat `https://<ip-laptop>:4000/scanner`.
4. **Penting**: Karena menggunakan sertifikat SSL lokal (self-signed) untuk izin akses kamera:
   - Pada browser HP, pilih **Lanjutan / Advanced**.
   - Klik **Lanjutkan ke situs (tidak aman) / Proceed to ... (unsafe)**.
   - Langkah ini hanya perlu disetujui **1 kali** per HP.
5. Izinkan akses kamera di browser HP.
6. Arahkan kamera HP ke barcode barang — produk belanjaan akan **langsung masuk secara instan ke keranjang kasir laptop**!

---

## ❓ FAQ & Troubleshooting

### 1. Port 3307 bentrok atau MySQL tidak mau menyala?
MySQL portable diatur ke port `3307` agar tidak bentrok dengan XAMPP/Laragon (port `3306`). Jika ada sisa proses lama, hentikan di PowerShell:
```powershell
Stop-Process -Name mysqld -Force
```

### 2. Bagaimana cara mengosongkan database untuk toko baru?
Jalankan perintah berikut di folder `pos_warung_madura`:
```bash
npm run db:clean
```
Data produk demo dan riwayat transaksi akan dikosongkan, sementara tabel, konfigurasi toko, dan akun kasir/pemilik tetap dibuat bersih.

### 3. Di mana lokasi penyimpanan data kasir saat aplikasi terpasang?
Pada mode produksi, database dan sertifikat disimpan di direktori data aplikasi Windows pengguna (`%APPDATA%`):
- Database MySQL: `%APPDATA%\pos_warung_madura\mysql-data\`
- Sertifikat SSL: `%APPDATA%\pos_warung_madura\certs\`
- Berkas Log: `%APPDATA%\pos_warung_madura\app.log`

Data Anda aman dari pembatasan izin administrator Windows dan tidak akan terhapus saat aplikasi diperbarui.

---

## 👨‍💻 Kontributor & Lisensi

Dibuat untuk memajukan dan mendigitalisasi operasional warung madura dan retail UMKM Indonesia.  
Copyright © 2026 **Abroril Huda**. Dilindungi lisensi MIT.
