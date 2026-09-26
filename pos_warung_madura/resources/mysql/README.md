# MySQL Portable — untuk dibundel ke aplikasi desktop (Electron)

Folder ini isinya MySQL Community Server versi ZIP Archive (bukan installer),
yang nanti di-spawn otomatis oleh Electron sebagai child process saat aplikasi
POS dibuka. Ini BUKAN untuk dipakai saat development — untuk development tetap
pakai Laragon seperti biasa (lihat `.env`).

## Cara isi folder ini

1. Download ZIP Archive MySQL (pilih versi LTS, mis. `8.4.11 LTS`) dari
   https://dev.mysql.com/downloads/mysql/ — pilih OS **Microsoft Windows**,
   file **"Windows (x86, 64-bit), ZIP Archive"**.
2. Extract ZIP tersebut. Kamu akan dapat folder semacam `mysql-8.4.11-winx64/`.
3. Copy folder **`bin/`** dari dalamnya ke sini, jadi strukturnya:

   ```
   resources/mysql/
   ├── bin/              ← isi persis dari mysql-x.x.x-winx64/bin/
   │   ├── mysqld.exe
   │   ├── mysql.exe
   │   └── ... (dll pendukung lainnya)
   ├── data/              ← data directory, DIBIARKAN KOSONG (lihat catatan di bawah)
   └── README.md          ← file ini
   ```

   Folder `lib/` dan `share/` dari hasil extract MySQL **juga perlu dicopy**
   ke sini (sejajar dengan `bin/`) karena `mysqld.exe` butuh file-file di
   `share/` (charset, error messages, dll) saat start.

4. **Jangan commit folder `bin/`, `lib/`, `share/` ke git** — ukurannya besar
   dan itu binary pihak ketiga, bukan source code kita. Sudah di-`.gitignore`
   (lihat bawah).

## Soal folder `data/`

Folder ini sengaja dibiarkan kosong di repo. `data/` akan otomatis terisi saat
MySQL pertama kali di-initialize (Electron main process yang akan menjalankan
`mysqld --initialize-insecure --datadir=...` di first run aplikasi). Kalau
kamu mau test manual duluan sebelum ada kode Electron-nya, jalankan dari
folder ini:

```
bin\mysqld.exe --initialize-insecure --datadir=data --basedir=.
```

## Port

MySQL portable ini sengaja dijalankan di port **3307** (bukan 3306), supaya
tidak bentrok kalau di laptop yang sama kebetulan ada MySQL lain terinstall
(mis. dari Laragon/XAMPP). Port ini nanti di-set lewat argumen command line
saat Electron spawn `mysqld.exe`, bukan lewat file `my.ini` — karena path
`datadir`/`basedir` perlu dihitung dinamis relatif ke lokasi instalasi
aplikasi (beda-beda tiap laptop user).

## Kenapa gak pakai my.ini statis

Karena lokasi folder aplikasi setelah di-install beda-beda tiap user
(`C:\Users\<nama>\AppData\Local\Programs\pos-warung\...`), path absolut untuk
`datadir` dan `basedir` gak bisa di-hardcode di file config. Nanti Electron
main process yang generate argumen ini secara dinamis saat spawn proses,
berdasarkan `process.resourcesPath`.

## Optimasi Ukuran Bundle (Pembersihan File Bloat)

Secara default, folder `lib/` dari MySQL Community Server berisi berbagai file static compile, debug builds, dictionary bahasa Asia Timur, dan plugin enterprise yang tidak digunakan oleh aplikasi POS.

Sebelum aplikasi dikemas oleh `electron-builder`, script otomatis `scripts/strip-mysql-bloat.mjs` dijalankan (atau bisa dijalankan manual via `npm run mysql:strip`) untuk memangkas **~250MB - 330MB+** data tanpa mengganggu runtime MySQL:

| File / Folder | Perkiraan Ukuran | Alasan Penghapusan |
|---|---|---|
| `lib/mysqlclient.lib` | ~75 - 79 MB | Static library untuk compile C/C++, tidak dipakai saat runtime Windows. |
| `lib/mecab/` (seluruh folder) | ~130 - 150 MB | Dictionary fulltext search bahasa Jepang/Korea/China, tidak digunakan aplikasi POS. |
| `lib/plugin/debug/` (seluruh folder) | ~15 - 98 MB | Versi debug dari plugin-plugin MySQL (versi release sudah ada di `lib/plugin/`). |
| `lib/plugin/authentication_*_client.dll` (`oci`, `kerberos`, `ldap_sasl`, `webauthn`) | ~24 MB | Plugin autentikasi enterprise (LDAP, Kerberos, Cloud OCI, WebAuthn) yang tidak dibutuhkan koneksi lokal `root`. |
| `lib/plugin/group_replication.dll` | ~2.2 MB | Plugin cluster multi-master replication MySQL, tidak digunakan single-instance POS. |
| `lib/plugin/component_keyring_file.dll` | ~1.3 MB | Komponen enkripsi enterprise keyring file. |
| `lib/private/icudt*/brkitr/cjdict.dict` & `khmerdict.dict` | ~2.4 MB | Kamus pemisah kata bahasa Mandarin/Jepang & Khmer. |

### File Inti yang WAJIB DIBIARKAN:
- `lib/libmysql.dll`, `lib/libssl-3-x64.dll`, `lib/libcrypto-3-x64.dll` (dependency runtime dasar).
- Plugin release lainnya di `lib/plugin/` (seperti `caching_sha2_password`, dll).
- File data ICU lainnya di `lib/private/icudt*/` (untuk sorting/collation Unicode).

