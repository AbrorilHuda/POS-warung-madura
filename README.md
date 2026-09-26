# 🏪 POS Warung Madura — Sistem Kasir Modern & Struk Digital Cloud

Aplikasi Point of Sale (POS) modern khusus operasional warung madura dan retail minimarket, dirancang untuk berjalan secara **offline-first** di laptop/PC kasir menggunakan **Electron Desktop** dengan database **MySQL Portable terisolasi**, serta terintegrasi dengan **Layanan Struk Digital Cloud (Invoice Publik)** dan **Scanner Barcode Nirkabel Kamera HP**.

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
| **`pos_warung_madura`** | Aplikasi Desktop Kasir Electron, manajemen stok, kulakan, antrian sinkronisasi offline, server lokal HTTPS/WSS. | `4000` (Prod) / `5174` (Dev) |
| **`invoice_publik`** | Server web struk digital publik untuk pelanggan scan QR nota, terhubung ke database cloud Supabase dengan fitur auto-delete 12 jam. | `5175` |

---

## ⚡ Fitur Utama

- 💻 **Desktop Standalone (Electron)**: Membungkus aplikasi web React Router v8 menjadi aplikasi desktop Windows native (.exe).
- 🗄️ **Zero-Config Portable MySQL**: Menyalakan dan menginisialisasi MySQL lokal secara otomatis di port terisolasi `3307` tanpa perlu menginstal XAMPP/Laragon.
- 📱 **Scanner Barcode Nirkabel via Kamera HP (F12)**: Mengubah smartphone kasir menjadi barcode scanner nirkabel menggunakan WebSocket aman (`wss://`) dan HTTPS dengan sertifikat SSL self-signed otomatis (Secure Context).
- 🔄 **Antrian Sinkronisasi Cerdas (Queue Sync)**: Transaksi kasir tetap tersimpan aman di database lokal MySQL jika offline, dan otomatis tersinkronisasi ke cloud begitu internet terhubung.
- 🧾 **Struk Digital & Retensi 12 Jam**: Pelanggan dapat melihat nota online lewat QR code; struk otomatis dihapus dari cloud dalam 12 jam untuk keamanan dan efisiensi penyimpanan.

---

## 🛠️ Prasyarat Sistem (Prerequisites)

Sebelum memulai instalasi, pastikan sistem Anda memenuhi persyaratan:

1. **Sistem Operasi**: Windows 10 atau Windows 11 (64-bit).
2. **Node.js**: Versi `20.x` atau lebih baru ([Unduh Node.js LTS](https://nodejs.org/)).
3. **Paket MySQL Portable Community Server (LTS)**:
   - Unduh arsip ZIP MySQL Community Server (versi LTS, mis. `8.4.x`) dari [MySQL Downloads (Windows x86 64-bit ZIP)](https://dev.mysql.com/downloads/mysql/).
   - Extract ZIP tersebut, Anda akan membutuhkan folder `bin/`, `lib/`, dan `share/`.

---

## 🚀 Panduan Instalasi Langkah Demi Langkah

### 1. Clone Repositori

```bash
git clone https://github.com/AbrorilHuda/POS-warung-madura.git
cd POS-warung-madura
```

---

### 2. Setup Aplikasi Kasir Desktop (`pos_warung_madura`)

#### A. Install Dependensi Node
Buka terminal dan masuk ke folder `pos_warung_madura`:
```bash
cd pos_warung_madura
npm install
```

#### B. Setup Binary MySQL Portable
Letakkan folder `bin/`, `lib/`, dan `share/` hasil extract ZIP MySQL ke dalam folder `pos_warung_madura/resources/mysql/` sehingga strukturnya menjadi:
```
pos_warung_madura/resources/mysql/
├── bin/
│   ├── mysqld.exe
│   ├── mysql.exe
│   └── ...
├── lib/
├── share/
└── data/             (biarkan kosong, akan di-initialize otomatis saat pertama kali dibuka)
```

#### C. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Sesuaikan konfigurasi toko / warung Anda di dalam `.env` (nama warung, alamat, kode unik toko, dan secret key sinkronisasi).

---

### 3. Setup Layanan Struk Publik Cloud (`invoice_publik`)

#### A. Install Dependensi Node
Buka terminal baru dan masuk ke folder `invoice_publik`:
```bash
cd ../invoice_publik
npm install
```

#### B. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Buka file `.env` di `invoice_publik` dan isi kredensial Supabase Anda:
```env
PORT=5175
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SYNC_SECRET_KEY=warung_madura_sync_secret_2026
INVOICE_RETENTION_HOURS=12
```
> **Catatan**: Nilai `SYNC_SECRET_KEY` di `invoice_publik/.env` **HARUS SAMA** dengan `SYNC_SECRET_KEY` di `pos_warung_madura/.env`.

---

## 🖥️ Cara Menjalankan Aplikasi (Mode Development)

### 1. Jalankan Server Invoice Publik (Cloud)
Di folder `invoice_publik`:
```bash
npm run dev
```
Server invoice publik akan berjalan di `http://127.0.0.1:5175`.

### 2. Jalankan Aplikasi Desktop POS Kasir
Di folder `pos_warung_madura`:
```bash
npm run electron:dev
```
Perintah ini akan:
1. Menyalakan Vite Dev Server (`https://127.0.0.1:5174`).
2. Menyalakan MySQL Portable otomatis pada port `3307`.
3. Membuka jendela aplikasi desktop Electron dengan dukungan *Hot Module Reloading* (HMR).

---

## 📦 Membangun Paket Produksi (Packaging Desktop Installer)

Untuk membuat aplikasi siap pakai (distribusi ke laptop kasir tanpa perlu terminal / Node.js):

Masuk ke folder `pos_warung_madura`:

### Opsi A: Buat Unpacked Portable (Folder Siap Pakai Langsung)
```bash
npm run build && npm run build:electron && npx electron-builder --win --dir
```
Hasil build akan berada di:
```
pos_warung_madura/release/win-unpacked/POS Warung Madura.exe
```
Tinggal dobel klik file `.exe` tersebut, aplikasi akan langsung berjalan.

### Opsi B: Buat File Installer NSIS (.exe Setup)
```bash
npm run electron:build
```
Installer akan dihasilkan di:
```
pos_warung_madura/release/POS Warung Madura Setup 1.0.0.exe
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
2. Pastikan HP dan Laptop terhubung ke **jaringan Wi-Fi yang sama**.

### Langkah Menghubungkan HP:
1. Di aplikasi kasir laptop, tekan tombol **F12** atau klik tombol **"Hubungkan HP Scanner"** di pojok kiri bawah.
2. QR Code akan muncul di layar laptop.
3. Buka kamera HP atau Google Lens, arahkan ke QR Code tersebut dan buka tautan `https://<ip-laptop>:4000/scanner`.
4. **Penting**: Karena menggunakan sertifikat SSL internal (self-signed) untuk mengaktifkan akses kamera:
   - Pada browser HP (Chrome/Safari), tap tombol **Lanjutan / Advanced**.
   - Pilih **Lanjutkan ke situs (tidak aman) / Proceed to ... (unsafe)**.
   - Pilihan ini hanya perlu diklik **satu kali** per perangkat HP.
5. Izinkan akses kamera di browser HP.
6. Arahkan kamera HP ke barcode barang — item belanjaan akan **langsung masuk secara instan ke keranjang kasir laptop**!

---

## ❓ FAQ & Troubleshooting

### 1. Port 3307 bentrok dengan proses lain?
MySQL portable diatur ke port `3307` agar tidak bentrok dengan Laragon/XAMPP (port `3306`). Jika port 3307 terpakai, hentikan proses lama di PowerShell:
```powershell
Stop-Process -Name mysqld -Force
```

### 2. Bagaimana cara mereset database lokal ke kondisi awal?
Hapus seluruh file di dalam folder `pos_warung_madura/resources/mysql/data/` (jangan hapus foldernya, biarkan kosong). Saat aplikasi dijalankan kembali, Electron akan menginisialisasi ulang database dan mengeksekusi skema awal secara otomatis.

### 3. Di mana lokasi data database dan sertifikat saat aplikasi terpasang di client?
Pada mode produksi, data disimpan di direktori data aplikasi Windows (`%APPDATA%`):
- Database MySQL: `%APPDATA%\pos_warung_madura\mysql-data\`
- Sertifikat SSL: `%APPDATA%\pos_warung_madura\certs\`
Lokasi ini aman dari pembatasan hak akses (*permission*) Windows dan tidak akan terhapus saat pembaruan aplikasi.

---

## 👨‍💻 Kontributor & Lisensi

Dibuat untuk memudahkan digitalisasi warung madura dan ritel UMKM Indonesia.  
Copyright © 2026 **Abroril Huda**. Dilindungi lisensi MIT.
