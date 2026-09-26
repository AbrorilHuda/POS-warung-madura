# 🖥️ POS Warung Madura — Desktop Cashier Application

Aplikasi Kasir Desktop untuk Warung Madura dan Minimarket berbasis **Electron**, **React Router v8 (SSR framework mode)**, **Express HTTPS/WSS**, dan **MySQL Portable terisolasi (Port 3307)**.

Untuk dokumentasi lengkap sistem, silakan baca [README.md di root repositori](../README.md).

---

## 🚀 Perintah Cepat (Scripts)

| Perintah | Deskripsi |
|---|---|
| `npm install` | Install semua dependensi Node.js |
| `npm run electron:dev` | Jalankan Vite Dev Server + Electron secara bersamaan (dengan hot reload) |
| `npm run dev` | Jalankan hanya Vite Web Dev Server (`https://127.0.0.1:5174`) |
| `npm run build` | Build bundle client dan server React Router v8 |
| `npm run build:electron` | Kompilasi file TypeScript Electron (`electron/main.ts` -> `dist-electron/main.js`) |
| `npx electron-builder --win --dir` | Buat executable aplikasi siap pakai langsung tanpa instalasi (`release/win-unpacked/`) |
| `npm run electron:build` | Build lengkap dan buat file installer Windows NSIS (`release/POS Warung Madura Setup 1.0.0.exe`) |

---

## 🗄️ MySQL Portable

Pastikan folder `resources/mysql/` telah berisi:
- `bin/` (berisi `mysqld.exe`, `mysql.exe`, dll)
- `lib/`
- `share/`
- `data/` (folder kosong, akan di-initialize otomatis saat first-run aplikasi)

Baca [resources/mysql/README.md](./resources/mysql/README.md) untuk detail lebih lanjut.
