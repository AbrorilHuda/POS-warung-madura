import fs from "fs";
import path from "path";
import os from "os";
import zlib from "zlib";
import crypto from "crypto";
import { spawn } from "child_process";
import { pool, query } from "../db.server";
import { getStoreConfig } from "./pos.server";
import type { RowDataPacket } from "mysql2/promise";

export interface BackupMetadata {
  id: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  formattedSize: string;
  createdAt: string;
  storeCode: string;
  storeName: string;
  totalSales: number;
  totalProducts: number;
  sha256: string;
  reason: "manual" | "auto_daily" | "on_close" | "pre_restore";
  isEncrypted: boolean;
}

export interface BackupStatus {
  lastBackupAt: string | null;
  daysSinceLastBackup: number | null;
  isWarning: boolean; // Peringatan jika > 3 hari
  totalBackups: number;
  backupDir: string;
  retentionCount: number;
  availableShortcuts?: { label: string; path: string }[];
}

export interface InspectBackupResult {
  valid: boolean;
  error?: string;
  metadata?: Partial<BackupMetadata>;
  tableCount?: number;
  previewSql?: string;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  safetyBackupFile?: string;
  restoredSalesCount?: number;
  restoredProductsCount?: number;
  error?: string;
}

/**
 * Format bytes ke ukuran yang mudah dibaca (KB / MB)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

let cachedBackupDir: string | null = null;

/**
 * Mendapatkan daftar shortcut lokasi folder backup yang direkomendasikan
 */
export function getRecommendedBackupShortcuts(): { label: string; path: string }[] {
  const list: { label: string; path: string }[] = [];

  // 1. Partisi C:\
  if (fs.existsSync("C:\\")) {
    list.push({ label: "Drive C (C:\\POS_Backups)", path: "C:\\POS_Backups" });
  }

  // 2. Partisi D:\ (sangat direkomendasikan untuk keamanan data warung)
  if (fs.existsSync("D:\\")) {
    list.push({ label: "Drive D (D:\\POS_Backups)", path: "D:\\POS_Backups" });
  }

  // 3. Folder Dokumen Pengguna
  try {
    const docsDir = path.join(os.homedir(), "Documents", "POS_Backups");
    list.push({ label: "Folder Dokumen", path: docsDir });
  } catch {}

  // 4. Default Project / AppData
  const defaultDir = path.resolve(process.cwd(), "backups");
  list.push({ label: "Folder Bawaan Aplikasi", path: defaultDir });

  return list;
}

/**
 * Resolusi direktori penyimpanan backup (membaca dari store_settings jika dikonfigurasi pengguna)
 */
export async function resolveBackupDirectory(): Promise<string> {
  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'backup_directory' LIMIT 1`
    );
    if (rows.length > 0 && rows[0]?.setting_value) {
      const customPath = path.resolve(rows[0].setting_value.trim());
      if (customPath) {
        if (!fs.existsSync(customPath)) {
          fs.mkdirSync(customPath, { recursive: true });
        }
        cachedBackupDir = customPath;
        return customPath;
      }
    }
  } catch (e) {}

  const configuredDir = process.env.BACKUP_DIR?.trim();
  if (configuredDir) {
    const resolvedEnv = path.resolve(configuredDir);
    if (!fs.existsSync(resolvedEnv)) {
      try {
        fs.mkdirSync(resolvedEnv, { recursive: true });
      } catch {}
    }
    if (fs.existsSync(resolvedEnv)) {
      cachedBackupDir = resolvedEnv;
      return resolvedEnv;
    }
  }

  const defaultDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(defaultDir)) {
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch {}
  }
  cachedBackupDir = defaultDir;
  return defaultDir;
}

/**
 * Mendapatkan direktori penyimpanan backup aktif (menggunakan cache jika tersedia)
 */
export function getBackupDirectory(): string {
  if (cachedBackupDir && fs.existsSync(cachedBackupDir)) {
    return cachedBackupDir;
  }

  const configuredDir = process.env.BACKUP_DIR?.trim();
  if (configuredDir) {
    const resolvedEnv = path.resolve(configuredDir);
    if (!fs.existsSync(resolvedEnv)) {
      try {
        fs.mkdirSync(resolvedEnv, { recursive: true });
      } catch {}
    }
    if (fs.existsSync(resolvedEnv)) {
      cachedBackupDir = resolvedEnv;
      return resolvedEnv;
    }
  }

  const defaultDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(defaultDir)) {
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch {}
  }
  cachedBackupDir = defaultDir;
  return defaultDir;
}

/**
 * Mengubah dan menyimpan lokasi direktori penyimpanan backup yang dipilih pengguna
 */
export async function setCustomBackupDirectory(
  targetDir: string
): Promise<{ success: boolean; path: string; message: string }> {
  if (!targetDir || !targetDir.trim()) {
    return { success: false, path: "", message: "Path direktori tidak boleh kosong" };
  }

  const cleanPath = path.resolve(targetDir.trim());

  try {
    if (!fs.existsSync(cleanPath)) {
      fs.mkdirSync(cleanPath, { recursive: true });
    }

    // Uji izin tulis (write test)
    const testFile = path.join(cleanPath, `.write_test_${Date.now()}`);
    fs.writeFileSync(testFile, "OK", "utf8");
    fs.unlinkSync(testFile);

    // Simpan ke database store_settings
    await pool.query(
      `INSERT INTO store_settings (setting_key, setting_value) VALUES ('backup_directory', ?)
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [cleanPath, cleanPath]
    );

    cachedBackupDir = cleanPath;
    return {
      success: true,
      path: cleanPath,
      message: `Lokasi penyimpanan backup berhasil diset ke: ${cleanPath}`,
    };
  } catch (err: any) {
    return {
      success: false,
      path: cleanPath,
      message: `Gagal mengakses direktori '${cleanPath}': ${err.message}`,
    };
  }
}

/**
 * Jumlah retensi file backup terakhir (default: 14)
 */
export function getRetentionCount(): number {
  const val = Number(process.env.BACKUP_RETENTION_COUNT);
  return !isNaN(val) && val > 0 ? val : 14;
}

/**
 * Mendapatkan path executable mysqldump jika tersedia
 */
function getMysqldumpPath(): string | null {
  const possiblePaths = [
    path.resolve(process.cwd(), "resources", "mysql", "bin", "mysqldump.exe"),
    path.resolve(process.cwd(), "..", "resources", "mysql", "bin", "mysqldump.exe"),
  ];

  if (process.env.RESOURCES_PATH) {
    possiblePaths.unshift(path.join(process.env.RESOURCES_PATH, "mysql", "bin", "mysqldump.exe"));
  }

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Mendapatkan path executable mysql jika tersedia
 */
function getMysqlClientPath(): string | null {
  const possiblePaths = [
    path.resolve(process.cwd(), "resources", "mysql", "bin", "mysql.exe"),
    path.resolve(process.cwd(), "..", "resources", "mysql", "bin", "mysql.exe"),
  ];

  if (process.env.RESOURCES_PATH) {
    possiblePaths.unshift(path.join(process.env.RESOURCES_PATH, "mysql", "bin", "mysql.exe"));
  }

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Logical SQL Dump Engine fallback mandiri (pure Node.js)
 * Memastikan backup tetap 100% berfungsi walaupun mysqldump binary tidak tersedia
 */
async function generateLogicalSqlDump(): Promise<string> {
  const connection = await pool.getConnection();
  try {
    const lines: string[] = [];
    const timestamp = new Date().toISOString();
    const storeConfig = getStoreConfig();

    lines.push(`-- ========================================================`);
    lines.push(`-- POS WARUNG MADURA — BACKUP DATABASE SNAPSHOT`);
    lines.push(`-- Toko: ${storeConfig.storeName} (${storeConfig.storeCode})`);
    lines.push(`-- Waktu Backup: ${timestamp}`);
    lines.push(`-- ========================================================\n`);
    lines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
    lines.push(`SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n`);

    // Ambil daftar semua tabel
    const [tablesRows] = await connection.query<RowDataPacket[]>(`SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`);
    const tableNames: string[] = tablesRows.map((r) => Object.values(r)[0] as string);

    for (const tableName of tableNames) {
      lines.push(`-- --------------------------------------------------------`);
      lines.push(`-- Tabel: \`${tableName}\``);
      lines.push(`-- --------------------------------------------------------`);
      lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);

      const [createRows] = await connection.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${tableName}\``);
      const createSql = (createRows[0] as any)["Create Table"];
      lines.push(`${createSql};\n`);

      // Dump baris data
      const [rows] = await connection.query<RowDataPacket[]>(`SELECT * FROM \`${tableName}\``);
      if (rows.length > 0) {
        lines.push(`INSERT INTO \`${tableName}\` VALUES`);
        const valueLines: string[] = [];
        for (const row of rows) {
          const formattedCols = Object.values(row).map((val) => {
            if (val === null || val === undefined) return "NULL";
            if (typeof val === "number") return String(val);
            if (typeof val === "boolean") return val ? "1" : "0";
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
            // Escape string aman
            const str = String(val)
              .replace(/\\/g, "\\\\")
              .replace(/'/g, "\\'")
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\r");
            return `'${str}'`;
          });
          valueLines.push(`  (${formattedCols.join(", ")})`);
        }
        lines.push(`${valueLines.join(",\n")};`);
      }
      lines.push("\n");
    }

    lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
    lines.push(`-- END OF BACKUP --\n`);

    return lines.join("\n");
  } finally {
    connection.release();
  }
}

/**
 * Membersihkan backup lama sesuai batas retensi N hari/file (PRD T3.1)
 */
async function cleanupOldBackups(backupDir: string, retentionCount: number): Promise<void> {
  try {
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".sql.gz") || f.endsWith(".sql"));
    if (files.length <= retentionCount) return;

    // Sort berdasarkan modified time (tertua dulu)
    const fileStats = files.map((file) => {
      const fullPath = path.join(backupDir, file);
      const stat = fs.statSync(fullPath);
      return { file, fullPath, mtime: stat.mtimeMs };
    });

    fileStats.sort((a, b) => a.mtime - b.mtime);

    const excessCount = fileStats.length - retentionCount;
    for (let i = 0; i < excessCount; i++) {
      const fileToDelete = fileStats[i];
      if (fileToDelete) {
        try {
          fs.unlinkSync(fileToDelete.fullPath);
          console.log(`[Backup Retensi] Menghapus backup lama: ${fileToDelete.file}`);
        } catch (err) {
          console.warn(`[Backup Retensi] Gagal menghapus file ${fileToDelete.file}:`, err);
        }
      }
    }
  } catch (err) {
    console.warn("[Backup Retensi] Gagal mengevaluasi retensi backup:", err);
  }
}

/**
 * Menghitung ringkasan database (total transaksi penjualan dan produk)
 */
async function getDatabaseSummary(): Promise<{ totalSales: number; totalProducts: number }> {
  try {
    const [salesRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM sales`);
    const [productRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM products WHERE is_active = TRUE`);
    return {
      totalSales: Number(salesRows[0]?.count || 0),
      totalProducts: Number(productRows[0]?.count || 0),
    };
  } catch {
    return { totalSales: 0, totalProducts: 0 };
  }
}

/**
 * Membuat backup lokal database MySQL otomatis / manual (PRD T3.1 & T3.3)
 */
export async function createLocalBackup(options: {
  reason?: "manual" | "auto_daily" | "on_close" | "pre_restore";
  passphrase?: string;
} = {}): Promise<BackupMetadata> {
  const reason = options.reason || "manual";
  const backupDir = await resolveBackupDirectory();
  const storeConfig = getStoreConfig();
  const summary = await getDatabaseSummary();

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const baseFilename = `pos_backup_${storeConfig.storeCode}_${dateStr}_${reason}`;
  const targetGzFile = path.join(backupDir, `${baseFilename}.sql.gz`);

  let sqlContent: string;
  const mysqldumpExe = getMysqldumpPath();

  if (mysqldumpExe) {
    try {
      sqlContent = await new Promise<string>((resolve, reject) => {
        const port = process.env.DB_PORT || "3307";
        const host = process.env.DB_HOST || "127.0.0.1";
        const user = process.env.DB_USER || "root";
        const dbName = process.env.DB_NAME || "pos_warung_madura";

        const args = [
          `-h${host}`,
          `-P${port}`,
          `-u${user}`,
          `--databases`,
          dbName,
          `--add-drop-table`,
          `--quick`,
          `--single-transaction`,
          `--default-character-set=utf8mb4`,
        ];

        const proc = spawn(mysqldumpExe, args);
        let out = "";
        let errOut = "";

        proc.stdout.on("data", (chunk) => {
          out += chunk.toString("utf8");
        });
        proc.stderr.on("data", (chunk) => {
          errOut += chunk.toString("utf8");
        });

        proc.on("close", (code) => {
          if (code === 0 && out.length > 0) {
            resolve(out);
          } else {
            console.warn(`[Backup mysqldump] Gagal (code ${code}): ${errOut}, beralih ke logical dump.`);
            reject(new Error(errOut || "mysqldump exit with error"));
          }
        });

        proc.on("error", (err) => reject(err));
      });
    } catch {
      sqlContent = await generateLogicalSqlDump();
    }
  } else {
    sqlContent = await generateLogicalSqlDump();
  }

  // Tambahkan header metadata PRD di awal SQL
  const headerMeta = `-- META:STORE_CODE=${storeConfig.storeCode}
-- META:STORE_NAME=${storeConfig.storeName}
-- META:TOTAL_SALES=${summary.totalSales}
-- META:TOTAL_PRODUCTS=${summary.totalProducts}
-- META:REASON=${reason}
-- META:CREATED_AT=${now.toISOString()}
`;
  const fullContent = headerMeta + sqlContent;

  // Kompresi Gzip
  let compressedBuffer = zlib.gzipSync(Buffer.from(fullContent, "utf8"), { level: 9 });
  let isEncrypted = false;

  // Enkripsi opsional AES-256-GCM jika passphrase diberikan (PRD T3.2)
  if (options.passphrase && options.passphrase.trim().length >= 6) {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(options.passphrase, salt, 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(compressedBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Format: "ENCGCM" (6B) + salt (16B) + iv (12B) + tag (16B) + ciphertext
    compressedBuffer = Buffer.concat([Buffer.from("ENCGCM"), salt, iv, tag, encrypted]);
    isEncrypted = true;
  }

  // Hitung Checksum SHA-256
  const sha256 = crypto.createHash("sha256").update(compressedBuffer).digest("hex");

  // Tulis file terkompresi ke disk
  fs.writeFileSync(targetGzFile, compressedBuffer);
  const sizeBytes = compressedBuffer.length;

  const metadata: BackupMetadata = {
    id: path.basename(targetGzFile),
    filename: path.basename(targetGzFile),
    filePath: targetGzFile,
    sizeBytes,
    formattedSize: formatBytes(sizeBytes),
    createdAt: now.toISOString(),
    storeCode: storeConfig.storeCode,
    storeName: storeConfig.storeName,
    totalSales: summary.totalSales,
    totalProducts: summary.totalProducts,
    sha256,
    reason,
    isEncrypted,
  };

  // Simpan record backup terakhir di store_settings
  try {
    await query(
      `INSERT INTO store_settings (setting_key, setting_value) VALUES ('last_backup_at', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [now.toISOString()]
    );
    await query(
      `INSERT INTO store_settings (setting_key, setting_value) VALUES ('last_backup_file', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [metadata.filename]
    );
  } catch (err) {
    console.warn("[Backup] Gagal memperbarui status backup di store_settings:", err);
  }

  // Bersihkan backup lama sesuai retensi (PRD T3.1)
  await cleanupOldBackups(backupDir, getRetentionCount());

  return metadata;
}

/**
 * Mengambil status backup terkini untuk peringatan (PRD T3.3)
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  const backupDir = await resolveBackupDirectory();
  const retentionCount = getRetentionCount();

  let lastBackupAt: string | null = null;
  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'last_backup_at' LIMIT 1`
    );
    if (rows.length > 0 && rows[0]?.setting_value) {
      lastBackupAt = rows[0].setting_value;
    }
  } catch {}

  const files = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir).filter((f) => f.endsWith(".sql.gz") || f.endsWith(".sql"))
    : [];

  let daysSinceLastBackup: number | null = null;
  if (lastBackupAt) {
    const lastDate = new Date(lastBackupAt).getTime();
    const now = Date.now();
    daysSinceLastBackup = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
  } else if (files.length > 0) {
    // Estimasi dari mtime file terbaru
    let newestMtime = 0;
    for (const f of files) {
      const stat = fs.statSync(path.join(backupDir, f));
      if (stat.mtimeMs > newestMtime) newestMtime = stat.mtimeMs;
    }
    lastBackupAt = new Date(newestMtime).toISOString();
    daysSinceLastBackup = Math.floor((Date.now() - newestMtime) / (1000 * 60 * 60 * 24));
  }

  // Peringatan jika belum pernah backup atau backup terakhir > 3 hari (PRD T3.3)
  const isWarning = daysSinceLastBackup === null || daysSinceLastBackup > 3;

  return {
    lastBackupAt,
    daysSinceLastBackup,
    isWarning,
    totalBackups: files.length,
    backupDir,
    retentionCount,
    availableShortcuts: getRecommendedBackupShortcuts(),
  };
}

/**
 * Mengambil daftar seluruh file backup yang tersedia
 */
export async function getBackupList(): Promise<BackupMetadata[]> {
  const backupDir = getBackupDirectory();
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".sql.gz") || f.endsWith(".sql"));
  const results: BackupMetadata[] = [];

  for (const filename of files) {
    const fullPath = path.join(backupDir, filename);
    try {
      const stat = fs.statSync(fullPath);
      const isGz = filename.endsWith(".sql.gz");
      let sha256 = "";
      let isEncrypted = false;
      let totalSales = 0;
      let totalProducts = 0;
      let storeCode = "WM01";
      let storeName = "Warung Madura";
      let reason: BackupMetadata["reason"] = "manual";

      const buf = fs.readFileSync(fullPath);
      sha256 = crypto.createHash("sha256").update(buf).digest("hex");

      const parseMetaFromSqlString = (str: string) => {
        const mSales = str.match(/-- META:TOTAL_SALES=(\d+)/);
        if (mSales) totalSales = Number(mSales[1]);
        const mProd = str.match(/-- META:TOTAL_PRODUCTS=(\d+)/);
        if (mProd) totalProducts = Number(mProd[1]);
        const mStore = str.match(/-- META:STORE_CODE=([^\r\n]+)/);
        if (mStore) storeCode = mStore[1]?.trim() || "WM01";
        const mStoreName = str.match(/-- META:STORE_NAME=([^\r\n]+)/);
        if (mStoreName) storeName = mStoreName[1]?.trim() || "Warung Madura";
        const mReason = str.match(/-- META:REASON=([^\r\n]+)/);
        if (mReason) reason = (mReason[1]?.trim() as any) || "manual";
      };

      if (isGz) {
        if (buf.subarray(0, 6).toString("ascii") === "ENCGCM") {
          isEncrypted = true;
        } else {
          try {
            const decompressed = zlib.gunzipSync(buf);
            const headStr = decompressed.subarray(0, 4096).toString("utf8");
            parseMetaFromSqlString(headStr);
          } catch {}
        }
      } else {
        // Plain .sql file
        try {
          const headStr = buf.subarray(0, 4096).toString("utf8");
          parseMetaFromSqlString(headStr);
        } catch {}
      }

      results.push({
        id: filename,
        filename,
        filePath: fullPath,
        sizeBytes: stat.size,
        formattedSize: formatBytes(stat.size),
        createdAt: stat.mtime.toISOString(),
        storeCode,
        storeName,
        totalSales,
        totalProducts,
        sha256,
        reason,
        isEncrypted,
      });
    } catch (e) {
      console.warn(`[Backup List] Gagal memuat metadata ${filename}:`, e);
    }
  }

  // Urutkan dari yang paling baru
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results;
}

/**
 * Menginspeksi dan memverifikasi integritas file backup sebelum restore (PRD T3.4 & T3.6)
 */
export async function inspectBackupFile(filePath: string, passphrase?: string): Promise<InspectBackupResult> {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: "File backup tidak ditemukan" };
  }

  try {
    const rawBuffer = fs.readFileSync(filePath);
    let sqlString = "";

    if (rawBuffer.subarray(0, 6).toString("ascii") === "ENCGCM") {
      if (!passphrase) {
        return { valid: false, error: "File backup terenkripsi. Silakan masukkan kata sandi." };
      }
      try {
        const salt = rawBuffer.subarray(6, 22);
        const iv = rawBuffer.subarray(22, 34);
        const tag = rawBuffer.subarray(34, 50);
        const encryptedData = rawBuffer.subarray(50);
        const key = crypto.scryptSync(passphrase, salt, 32);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const decryptedGz = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
        sqlString = zlib.gunzipSync(decryptedGz).toString("utf8");
      } catch (err) {
        return { valid: false, error: "Kata sandi salah atau arsip terenkripsi rusak." };
      }
    } else if (filePath.endsWith(".gz")) {
      try {
        sqlString = zlib.gunzipSync(rawBuffer).toString("utf8");
      } catch (err) {
        return { valid: false, error: "Gagal mendekompresi arsip gzip backup. File mungkin korup." };
      }
    } else {
      sqlString = rawBuffer.toString("utf8");
    }

    // Hitung jumlah DROP TABLE atau CREATE TABLE sebagai validasi skema
    const tableMatches = sqlString.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/gi);
    const tableCount = tableMatches ? tableMatches.length : 0;

    const mSales = sqlString.match(/-- META:TOTAL_SALES=(\d+)/);
    const mProd = sqlString.match(/-- META:TOTAL_PRODUCTS=(\d+)/);
    const mStore = sqlString.match(/-- META:STORE_CODE=([^\r\n]+)/);

    return {
      valid: tableCount > 0,
      tableCount,
      metadata: {
        totalSales: mSales ? Number(mSales[1]) : 0,
        totalProducts: mProd ? Number(mProd[1]) : 0,
        storeCode: mStore ? mStore[1]?.trim() : "WM01",
      },
      previewSql: sqlString.slice(0, 500),
    };
  } catch (err: any) {
    return { valid: false, error: err.message || "Gagal membaca file backup" };
  }
}

/**
 * Memulihkan database dari file backup (PRD T3.4 & T3.5)
 * Otomatis membuat safety snapshot sebelum restore dijalankan.
 */
export async function restoreBackupFile(filePath: string, passphrase?: string): Promise<RestoreResult> {
  const inspect = await inspectBackupFile(filePath, passphrase);
  if (!inspect.valid) {
    return { success: false, message: inspect.error || "File backup tidak valid", error: inspect.error };
  }

  // 1. Buat safety snapshot kondisi database sekarang sebelum ditimpa (PRD T3.4)
  let safetyBackup: BackupMetadata | null = null;
  try {
    safetyBackup = await createLocalBackup({ reason: "pre_restore" });
    console.log(`[Restore] Safety backup berhasil dibuat: ${safetyBackup.filename}`);
  } catch (err) {
    console.warn("[Restore] Gagal membuat safety backup pra-restore:", err);
  }

  // 2. Dekompresi isi SQL
  const rawBuffer = fs.readFileSync(filePath);
  let sqlString = "";

  if (rawBuffer.subarray(0, 6).toString("ascii") === "ENCGCM") {
    const salt = rawBuffer.subarray(6, 22);
    const iv = rawBuffer.subarray(22, 34);
    const tag = rawBuffer.subarray(34, 50);
    const encryptedData = rawBuffer.subarray(50);
    const key = crypto.scryptSync(passphrase!, salt, 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decryptedGz = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    sqlString = zlib.gunzipSync(decryptedGz).toString("utf8");
  } else if (filePath.endsWith(".gz")) {
    sqlString = zlib.gunzipSync(rawBuffer).toString("utf8");
  } else {
    sqlString = rawBuffer.toString("utf8");
  }

  // 3. Eksekusi SQL ke database
  const mysqlExe = getMysqlClientPath();
  const dbName = process.env.DB_NAME || "pos_warung_madura";
  const port = process.env.DB_PORT || "3307";
  const host = process.env.DB_HOST || "127.0.0.1";
  const user = process.env.DB_USER || "root";

  if (mysqlExe) {
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(mysqlExe, [`-h${host}`, `-P${port}`, `-u${user}`, `--default-character-set=utf8mb4`, dbName]);
        let errOut = "";

        proc.stdin.write(sqlString);
        proc.stdin.end();

        proc.stderr.on("data", (chunk) => {
          errOut += chunk.toString("utf8");
        });

        proc.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`MySQL client restore error (code ${code}): ${errOut}`));
          }
        });

        proc.on("error", (err) => reject(err));
      });
    } catch (err) {
      console.warn("[Restore via mysql.exe gagal, menjalankan via connection query]:", err);
      await executeSqlStatementsInPool(sqlString);
    }
  } else {
    await executeSqlStatementsInPool(sqlString);
  }

  const summary = await getDatabaseSummary();

  return {
    success: true,
    message: `Database berhasil dipulihkan! ${summary.totalProducts} produk dan ${summary.totalSales} transaksi telah dimuat.`,
    safetyBackupFile: safetyBackup?.filename,
    restoredSalesCount: summary.totalSales,
    restoredProductsCount: summary.totalProducts,
  };
}

/**
 * Fallback eksekusi statement SQL menggunakan pool connection
 */
async function executeSqlStatementsInPool(sqlContent: string): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    // Pisahkan pernyataan berdasarkan delimiter ';' di akhir baris
    const statements = sqlContent
      .split(/;\s*[\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await connection.query(stmt);
        } catch (e: any) {
          // Abaikan komentar atau directive jika error non-fatal
          if (!stmt.startsWith("--") && !stmt.startsWith("/*")) {
            console.warn("[Restore SQL Exec Warning]:", e.message, "Query snippet:", stmt.slice(0, 100));
          }
        }
      }
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    connection.release();
  }
}

/**
 * Menghapus file backup tertentu dari disk
 */
export async function deleteBackupFile(filename: string): Promise<boolean> {
  try {
    const backupDir = getBackupDirectory();
    const safeFilename = path.basename(filename);
    const filePath = path.join(backupDir, safeFilename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn(`[Delete Backup] Gagal menghapus ${filename}:`, err);
    return false;
  }
}

/**
 * Menyimpan file backup yang diunggah secara manual oleh pengguna (.sql / .sql.gz)
 */
export async function saveUploadedBackup(
  filename: string,
  buffer: Buffer
): Promise<BackupMetadata> {
  const backupDir = getBackupDirectory();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  let safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safeName.endsWith(".sql") && !safeName.endsWith(".sql.gz")) {
    safeName += ".sql";
  }

  const targetPath = path.join(backupDir, safeName);
  fs.writeFileSync(targetPath, buffer);

  const list = await getBackupList();
  const found = list.find((b) => b.filename === safeName);
  if (found) return found;

  const stat = fs.statSync(targetPath);
  return {
    id: safeName,
    filename: safeName,
    filePath: targetPath,
    sizeBytes: stat.size,
    formattedSize: formatBytes(stat.size),
    createdAt: stat.mtime.toISOString(),
    storeCode: "UPLOAD",
    storeName: "Berkas Impor",
    totalSales: 0,
    totalProducts: 0,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    reason: "manual",
    isEncrypted: false,
  };
}
