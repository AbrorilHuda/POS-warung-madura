/**
 * ============================================================================
 * MAIN PROCESS ELECTRON — POS WARUNG MADURA
 * ============================================================================
 *
 * KEPUTUSAN DESAIN & TRADE-OFF KOMPILASI:
 * Dipilih pendekatan transpilasi TypeScript via `tsc -p tsconfig.electron.json`
 * yang menghasilkan file JavaScript murni di `dist-electron/main.js`:
 *
 * 1. Dibandingkan `tsx`:
 *    `tsx` sangat praktis untuk menjalankan file `.ts` saat development, tetapi
 *    TIDAK BISA digunakan saat aplikasi di-package oleh `electron-builder` ke installer
 *    Windows (NSIS), karena Electron di dalam bundle ASAR memerlukan file JavaScript (.js).
 * 2. Dibandingkan `electron-vite`:
 *    Aplikasi ini sudah menggunakan React Router v8 (SSR framework mode) dengan
 *    pipeline Vite tersendiri (`@react-router/dev/vite`). Menggabungkan `electron-vite`
 *    berpotensi memicu konflik build pipeline & konfigurasi ganda yang rapuh.
 *    Kompilasi mandiri `tsc` menghasilkan arsitektur yang decoupled, stabil, dan bersih.
 * ============================================================================
 */

import { app, BrowserWindow, dialog } from "electron";
import path from "path";
import fs from "fs";
import { spawn, type ChildProcess } from "child_process";
import mysql from "mysql2/promise";

// Izinkan sertifikat self-signed lokal untuk health check fetch di main process
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// ----------------------------------------------------------------------------
// KONFIGURASI PORT & KONEKSI MYSQL LOKAL PORTABLE
// ----------------------------------------------------------------------------
// Port 3307 dipilih agar tidak bentrok dengan instalasi MySQL laptop (Laragon/XAMPP)
const MYSQL_PORT = 3307;
const MYSQL_HOST = "127.0.0.1";
const DB_USER = "root";
const DB_PASSWORD = "";
const DB_NAME = process.env.DB_NAME || "pos_warung_madura";
const PROD_NODE_PORT = 4000;

let mainWindow: BrowserWindow | null = null;
let mysqlProcess: ChildProcess | null = null;
let serverProcess: ChildProcess | null = null;
let isShuttingDown = false;

// ----------------------------------------------------------------------------
// RESOLUSI PATH DINAMIS
// ----------------------------------------------------------------------------
const isDev = !app.isPackaged;
const appRoot = app.getAppPath();

/**
 * Mendapatkan direktori dasar MySQL:
 * - Development: `resources/mysql/` di dalam root project
 * - Production: `process.resourcesPath/mysql/` dari installer electron-builder
 */
function getMysqlBaseDir(): string {
  if (isDev) {
    return path.join(appRoot, "resources", "mysql");
  }
  return path.join(process.resourcesPath, "mysql");
}

/**
 * Mendapatkan direktori data penyimpanan tabel MySQL:
 * - Development: `resources/mysql/data/`
 * - Production: Direktori writable `app.getPath("userData")/mysql-data`
 *   (folder Program Files pada Windows bersifat read-only untuk user biasa)
 */
function getMysqlDataDir(): string {
  if (isDev) {
    return path.join(getMysqlBaseDir(), "data");
  }
  return path.join(app.getPath("userData"), "mysql-data");
}

/**
 * Mendapatkan lokasi file schema.sql untuk inisialisasi tabel pertama kali
 */
function getSchemaPath(): string {
  const candidates = [
    path.join(appRoot, "migrations", "schema.sql"),
    path.join(appRoot, "schema.sql"),
    path.join(process.resourcesPath, "schema.sql"),
    path.join(process.resourcesPath, "migrations", "schema.sql"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(appRoot, "schema.sql");
}

// ----------------------------------------------------------------------------
// 1. FIRST-RUN INITIALIZATION & VERIFIKASI MYSQL
// ----------------------------------------------------------------------------
function isMysqlInitialized(dataDir: string): boolean {
  if (!fs.existsSync(dataDir)) return false;
  // ibdata1 dan folder mysql sistem adalah bukti pasti MySQL sudah di-initialize
  const hasIbdata = fs.existsSync(path.join(dataDir, "ibdata1"));
  const hasMysqlDir = fs.existsSync(path.join(dataDir, "mysql"));
  return hasIbdata && hasMysqlDir;
}

async function initializeMysqlData(mysqldExe: string, baseDir: string, dataDir: string): Promise<void> {
  console.log("[Electron Main] Menyiapkan data directory MySQL pertama kali di:", dataDir);
  fs.mkdirSync(dataDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const initProc = spawn(
      mysqldExe,
      [
        "--initialize-insecure",
        `--datadir=${dataDir}`,
        `--basedir=${baseDir}`,
        "--console",
      ],
      { windowsHide: true }
    );

    let stderrBuffer = "";
    initProc.stderr?.on("data", (chunk) => {
      const msg = chunk.toString();
      stderrBuffer += msg;
      console.log("[MySQL Init]", msg.trim());
    });

    initProc.on("exit", (code) => {
      if (code === 0) {
        console.log("[Electron Main] Inisialisasi MySQL selesai dengan sukses!");
        resolve();
      } else {
        reject(new Error(`Inisialisasi MySQL gagal (exit code: ${code}):\n${stderrBuffer}`));
      }
    });

    initProc.on("error", (err) => {
      reject(err);
    });
  });
}

// ----------------------------------------------------------------------------
// 2. SPAWN & MONITOR MYSQL CHILD PROCESS
// ----------------------------------------------------------------------------
function spawnMysqlServer(mysqldExe: string, baseDir: string, dataDir: string): void {
  console.log(`[Electron Main] Menjalankan mysqld.exe pada port ${MYSQL_PORT}...`);

  mysqlProcess = spawn(
    mysqldExe,
    [
      `--datadir=${dataDir}`,
      `--basedir=${baseDir}`,
      `--port=${MYSQL_PORT}`,
      `--bind-address=${MYSQL_HOST}`,
      "--console",
    ],
    { windowsHide: true }
  );

  mysqlProcess.stdout?.on("data", (data) => {
    console.log("[MySQL Server]", data.toString().trim());
  });

  mysqlProcess.stderr?.on("data", (data) => {
    console.log("[MySQL Server]", data.toString().trim());
  });

  mysqlProcess.on("exit", (code, signal) => {
    console.log(`[MySQL Server] Berhenti dengan code ${code} / signal ${signal}`);
    mysqlProcess = null;
    if (!isShuttingDown) {
      dialog.showErrorBox(
        "Koneksi Database Terputus",
        "Server database MySQL portable tiba-tiba berhenti berjalan."
      );
      app.quit();
    }
  });
}

// ----------------------------------------------------------------------------
// 3. RETRY CONNECTION MYSQL HINGGA SIAP
// ----------------------------------------------------------------------------
async function waitForMySQLReady(timeoutMs = 15000): Promise<boolean> {
  const startTime = Date.now();
  console.log("[Electron Main] Menunggu kesiapan koneksi MySQL di port 3307...");

  while (Date.now() - startTime < timeoutMs) {
    try {
      const conn = await mysql.createConnection({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        connectTimeout: 800,
      });
      await conn.end();
      console.log("[Electron Main] MySQL berhasil terhubung dan siap menerima query!");
      return true;
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  return false;
}

// ----------------------------------------------------------------------------
// 4. MEMBUAT DATABASE & MENJALANKAN SCHEMA MIGRATION
// ----------------------------------------------------------------------------
async function ensureDatabaseAndTables(): Promise<void> {
  console.log(`[Electron Main] Memeriksa database '${DB_NAME}'...`);

  const connection = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    // Buat database jika belum ada
    await connection.query(`
      CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci;
    `);

    await connection.query(`USE \`${DB_NAME}\`;`);

    // Periksa apakah tabel products sudah ada
    const [tables] = await connection.query("SHOW TABLES LIKE 'products'");
    const tableList = tables as any[];

    if (!tableList || tableList.length === 0) {
      console.log("[Electron Main] Tabel belum ditemukan, mengeksekusi skema awal database...");
      const schemaPath = getSchemaPath();

      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, "utf-8");
        await connection.query(schemaSql);
        console.log("[Electron Main] Skema dan seed data master berhasil diterapkan!");
      } else {
        console.warn("[Electron Main] PERINGATAN: File schema.sql tidak ditemukan di:", schemaPath);
      }
    } else {
      console.log("[Electron Main] Tabel database sudah ada, melewati eksekusi skema.");
    }
  } finally {
    await connection.end();
  }
}

// Abaikan peringatan sertifikat SSL lokal (digunakan oleh plugin basicSsl Vite saat dev)
app.commandLine.appendSwitch("ignore-certificate-errors");

// ----------------------------------------------------------------------------
// 5. SERVER NODE / REACT ROUTER V8 HANDLER
// ----------------------------------------------------------------------------
async function waitForHttpServer(
  initialUrl: string,
  timeoutMs = 25000
): Promise<{ ok: boolean; finalUrl: string }> {
  const start = Date.now();
  console.log(`[Electron Main] Menunggu server HTTP siap di ${initialUrl}...`);

  const candidates = [
    initialUrl,
    initialUrl.startsWith("http://")
      ? initialUrl.replace("http://", "https://")
      : initialUrl.replace("https://", "http://"),
  ];

  while (Date.now() - start < timeoutMs) {
    for (const testUrl of candidates) {
      try {
        const res = await fetch(testUrl);
        if (res.status >= 200 && res.status < 500) {
          console.log(`[Electron Main] Server HTTP siap pada ${testUrl} (status ${res.status})!`);
          return { ok: true, finalUrl: testUrl };
        }
      } catch (e) {
        // Coba lagi di iterasi berikutnya
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return { ok: false, finalUrl: initialUrl };
}

function startProductionNodeServer(): void {
  const serverPath = path.join(appRoot, "server", "production-server.mjs");
  if (!fs.existsSync(serverPath)) {
    throw new Error(`File server produksi tidak ditemukan di ${serverPath}. Silakan pastikan server/production-server.mjs tersedia.`);
  }

  const certDir = path.join(app.getPath("userData"), "certs");

  console.log("[Electron Main] Menjalankan Node server produksi:", serverPath);

  const envVars = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(PROD_NODE_PORT),
    HOST: "0.0.0.0",
    CERT_DIR: certDir,
    DB_HOST: MYSQL_HOST,
    DB_PORT: String(MYSQL_PORT),
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
  };

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: appRoot,
    env: envVars,
    windowsHide: true,
  });

  serverProcess.stdout?.on("data", (chunk) => {
    console.log("[Node Server]", chunk.toString().trim());
  });

  serverProcess.stderr?.on("data", (chunk) => {
    console.log("[Node Server Error]", chunk.toString().trim());
  });

  serverProcess.on("exit", (code) => {
    console.log(`[Node Server] Berhenti dengan code ${code}`);
    serverProcess = null;
  });
}

// ----------------------------------------------------------------------------
// 6. BROWSER WINDOW CREATION
// ----------------------------------------------------------------------------
function createMainWindow(targetUrl: string): void {
  const iconPath = [
    path.join(appRoot, "public", "icons", "icon.ico"),
    path.join(appRoot, "public", "icons", "icon.png"),
    path.join(appRoot, "build", "client", "favicon.ico"),
  ].find((p) => fs.existsSync(p));

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "POS Warung Madura",
    icon: iconPath,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#0f172a", // slate-900 sesuai tema aplikasi
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.maximize();
  mainWindow.loadURL(targetUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ----------------------------------------------------------------------------
// 7. CLEAN GRACEFUL SHUTDOWN (MENCEGAH KERUSAKAN DATA INNODB)
// ----------------------------------------------------------------------------
async function cleanShutdown(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("[Electron Main] Memulai proses shutdown aplikasi...");

  // 1. Matikan Node server child process
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (e) {}
    serverProcess = null;
  }

  // 2. Kirim sinyal SHUTDOWN ke MySQL server agar dirty buffer ditulis ke disk
  if (mysqlProcess) {
    try {
      const conn = await mysql.createConnection({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        connectTimeout: 1500,
      });
      await conn.query("SHUTDOWN");
      await conn.end();
      console.log("[Electron Main] Perintah SHUTDOWN MySQL berhasil dieksekusi.");
    } catch (e) {
      // Fallback: jalankan mysqladmin shutdown jika perintah SQL gagal
      const baseDir = getMysqlBaseDir();
      const adminExe = path.join(baseDir, "bin", "mysqladmin.exe");
      if (fs.existsSync(adminExe)) {
        try {
          spawn(adminExe, ["-u", DB_USER, "-P", String(MYSQL_PORT), "--host=127.0.0.1", "shutdown"], {
            windowsHide: true,
          });
        } catch (err) {}
      }
    }

    // Beri waktu MySQL menulis data sebelum exit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (mysqlProcess) {
      try {
        mysqlProcess.kill();
      } catch (e) {}
      mysqlProcess = null;
    }
  }

  console.log("[Electron Main] Shutdown selesai.");
}

// ----------------------------------------------------------------------------
// LIFECYCLE ELECTRON APP
// ----------------------------------------------------------------------------
app.whenReady().then(async () => {
  try {
    const baseDir = getMysqlBaseDir();
    const dataDir = getMysqlDataDir();
    const mysqldExe = path.join(baseDir, "bin", "mysqld.exe");

    console.log("[Electron Main] Lokasi MySQL Base:", baseDir);
    console.log("[Electron Main] Lokasi MySQL Data:", dataDir);

    // 1. Validasi keberadaan binary mysqld.exe
    if (!fs.existsSync(mysqldExe)) {
      dialog.showErrorBox(
        "Binary MySQL Tidak Ditemukan",
        `File mysqld.exe tidak ditemukan di lokasi:\n${mysqldExe}\n\nPastikan folder resources/mysql/bin telah terisi dengan benar sesuai instruksi resources/mysql/README.md.`
      );
      app.quit();
      return;
    }

    // 2. First-run: Initialize MySQL jika data directory belum pernah dibuat
    if (!isMysqlInitialized(dataDir)) {
      await initializeMysqlData(mysqldExe, baseDir, dataDir);
    }

    // 3. Nyalakan MySQL server child process
    spawnMysqlServer(mysqldExe, baseDir, dataDir);

    // 4. Tunggu MySQL menerima koneksi
    const isMysqlReady = await waitForMySQLReady(15000);
    if (!isMysqlReady) {
      dialog.showErrorBox(
        "Koneksi MySQL Gagal",
        `Gagal menghubungkan ke MySQL portable pada port ${MYSQL_PORT}.\nPastikan port ${MYSQL_PORT} tidak sedang diblokir atau digunakan oleh aplikasi lain.`
      );
      await cleanShutdown();
      app.quit();
      return;
    }

    // 5. Pastikan database dan tabel sudah ada
    await ensureDatabaseAndTables();

    // 6. Tentukan target URL (Dev vs Production)
    let targetUrl = "";
    if (isDev) {
      // Saat development: gunakan Vite dev server untuk hot-reload
      const devPort = process.env.PORT || "5174";
      targetUrl = `http://127.0.0.1:${devPort}`;
      console.log(`[Electron Main] Mode Development: Menghubungkan ke ${targetUrl}`);

      const { ok: devReady, finalUrl } = await waitForHttpServer(targetUrl, 25000);
      if (!devReady) {
        dialog.showErrorBox(
          "Dev Server Tidak Merespons",
          `Tidak dapat menghubungi Vite dev server pada ${targetUrl}.\nPastikan perintah 'npm run dev' sedang berjalan.`
        );
        await cleanShutdown();
        app.quit();
        return;
      }
      targetUrl = finalUrl;
    } else {
      // Saat production: Nyalakan Node server dari server/production-server.mjs
      startProductionNodeServer();
      targetUrl = `https://127.0.0.1:${PROD_NODE_PORT}`;

      const { ok: serverReady, finalUrl } = await waitForHttpServer(targetUrl, 25000);
      if (!serverReady) {
        dialog.showErrorBox(
          "Server Aplikasi Gagal Memulai",
          `Server internal Node.js tidak merespons pada ${targetUrl}.`
        );
        await cleanShutdown();
        app.quit();
        return;
      }
      targetUrl = finalUrl;
    }

    // 7. Buka BrowserWindow
    createMainWindow(targetUrl);
  } catch (err: any) {
    console.error("[Electron Main] Terjadi kesalahan fatal:", err);
    dialog.showErrorBox("Kesalahan Fatal Aplikasi", err.message || String(err));
    await cleanShutdown();
    app.quit();
  }
});

app.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
  if (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("192.168.") ||
    url.includes("10.") ||
    url.includes("172.")
  ) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

app.on("window-all-closed", async () => {
  await cleanShutdown();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (!isShuttingDown) {
    event.preventDefault();
    await cleanShutdown();
    app.quit();
  }
});
