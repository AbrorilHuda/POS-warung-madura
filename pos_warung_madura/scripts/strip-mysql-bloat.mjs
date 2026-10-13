import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const mysqlDir = path.join(projectRoot, "resources", "mysql");
const mysqlBinDir = path.join(mysqlDir, "bin");
const mysqlLibDir = path.join(mysqlDir, "lib");
const mysqlShareDir = path.join(mysqlDir, "share");

if (!fs.existsSync(mysqlDir)) {
  console.log("[Strip MySQL] Direktori resources/mysql tidak ditemukan. Melewati proses pembersihan.");
  process.exit(0);
}

console.log("[Strip MySQL] Memulai optimasi dan pemangkasan bloatware MySQL portable...");

let totalBytesDeleted = 0;
let deletedCount = 0;

function removePath(targetPath, description) {
  if (!fs.existsSync(targetPath)) return;

  try {
    const stats = fs.statSync(targetPath);
    let size = 0;

    if (stats.isDirectory()) {
      const getDirSize = (dir) => {
        let s = 0;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            s += getDirSize(full);
          } else if (entry.isFile()) {
            s += fs.statSync(full).size;
          }
        }
        return s;
      };
      size = getDirSize(targetPath);
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      size = stats.size;
      fs.unlinkSync(targetPath);
    }

    totalBytesDeleted += size;
    deletedCount++;
    const mb = (size / (1024 * 1024)).toFixed(2);
    console.log(`  ✓ Dihapus: ${path.relative(projectRoot, targetPath)} (${mb} MB) [${description}]`);
  } catch (err) {
    console.warn(`  ✗ Gagal menghapus ${targetPath}:`, err.message);
  }
}

// ============================================================================
// 1. PEMBERSIHAN FOLDER bin/ (Paling masif: PDB Debug Symbols & Unused Tools)
// ============================================================================
if (fs.existsSync(mysqlBinDir)) {
  const binFiles = fs.readdirSync(mysqlBinDir);

  // Executable dan DLL yang WAJIB DIPERTAHANKAN untuk runtime POS
  const essentialBinaries = new Set([
    "mysqld.exe",     // Database Daemon Utama
    "mysql.exe",      // CLI client (untuk restore sql)
    "mysqldump.exe",  // Backup tool native
    "mysqladmin.exe", // Safe shutdown fallback
  ]);

  for (const file of binFiles) {
    const fullPath = path.join(mysqlBinDir, file);
    const lower = file.toLowerCase();

    // A. Hapus SEMUA file debug symbols (.pdb) — mysqld.pdb berukuran > 600 MB!
    if (lower.endsWith(".pdb")) {
      removePath(fullPath, "PDB Debug Symbols (Sangat Besar)");
      continue;
    }

    // B. Hapus SEMUA static linking compiler libraries (.lib) di bin
    if (lower.endsWith(".lib")) {
      removePath(fullPath, "Static link library (.lib) tidak terpakai");
      continue;
    }

    // C. Hapus Perl scripts (.pl)
    if (lower.endsWith(".pl")) {
      removePath(fullPath, "Perl maintenance script");
      continue;
    }

    // D. Hapus DLL debug
    if (lower.includes("-debug.dll")) {
      removePath(fullPath, "Debug variant DLL");
      continue;
    }

    // E. Hapus Executable (.exe) yang tidak pernah dipanggil oleh POS
    if (lower.endsWith(".exe") && !essentialBinaries.has(lower)) {
      removePath(fullPath, "Unused MySQL CLI Tool");
      continue;
    }
  }
}

// ============================================================================
// 2. PEMBERSIHAN FOLDER lib/ (C/C++ Libs, Unused Plugins, & Dictionaries)
// ============================================================================
if (fs.existsSync(mysqlLibDir)) {
  // A. Static libraries di lib/
  removePath(path.join(mysqlLibDir, "mysqlclient.lib"), "Static compile library (C/C++)");
  removePath(path.join(mysqlLibDir, "libmysql.lib"), "Static compile library (.lib)");
  removePath(path.join(mysqlLibDir, "mysqlservices.lib"), "Static compile library (.lib)");

  // B. Seluruh folder mecab/ (dictionary fulltext search Jepang/China/Korea)
  removePath(path.join(mysqlLibDir, "mecab"), "Mecab fulltext dictionary");

  // C. Seluruh folder plugin/debug/
  removePath(path.join(mysqlLibDir, "plugin", "debug"), "Plugin debug builds");

  // D. Plugin yang tidak digunakan (replikasi cluster, enterprise, auth tak terpakai)
  const unusedPlugins = [
    "authentication_oci_client.dll",
    "authentication_kerberos_client.dll",
    "authentication_ldap_sasl_client.dll",
    "authentication_webauthn_client.dll",
    "group_replication.dll",
    "component_keyring_file.dll",
    "component_mysqlbackup.dll",
    "ha_example.dll",
    "ha_mock.dll",
    "rewrite_example.dll",
    "adt_null.dll",
    "semisync_master.dll",
    "semisync_replica.dll",
    "semisync_slave.dll",
    "semisync_source.dll",
  ];

  for (const plugin of unusedPlugins) {
    removePath(path.join(mysqlLibDir, "plugin", plugin), "Unused plugin/replication");
  }

  // E. Dictionary bahasa asing di lib/private/icudt*/brkitr/
  const privateDir = path.join(mysqlLibDir, "private");
  if (fs.existsSync(privateDir)) {
    const icuDirs = fs.readdirSync(privateDir).filter((d) => d.startsWith("icu"));
    for (const icu of icuDirs) {
      const brkitrDir = path.join(privateDir, icu, "brkitr");
      removePath(path.join(brkitrDir, "cjdict.dict"), "Chinese/Japanese dictionary");
      removePath(path.join(brkitrDir, "khmerdict.dict"), "Khmer dictionary");
      removePath(path.join(brkitrDir, "burmesedict.dict"), "Burmese dictionary");
      removePath(path.join(brkitrDir, "laodict.dict"), "Lao dictionary");
      removePath(path.join(brkitrDir, "thaidict.dict"), "Thai dictionary");
    }
  }
}

// ============================================================================
// 3. PEMBERSIHAN FOLDER share/ (Bahasa Asing yang Tidak Digunakan)
// ============================================================================
if (fs.existsSync(mysqlShareDir)) {
  const shareEntries = fs.readdirSync(mysqlShareDir, { withFileTypes: true });
  // Hanya pertahankan english, charsets, dan file teks esensial
  const keepShare = new Set(["english", "charsets"]);

  for (const entry of shareEntries) {
    if (entry.isDirectory() && !keepShare.has(entry.name.toLowerCase())) {
      removePath(path.join(mysqlShareDir, entry.name), `Unused language messages (${entry.name})`);
    }
  }
}

const totalMb = (totalBytesDeleted / (1024 * 1024)).toFixed(2);
console.log(`\n[Strip MySQL] Selesai! Sebanyak ${deletedCount} file/folder berhasil dipangkas.`);
console.log(`[Strip MySQL] Total ruang disk yang berhasil dihemat: ~${totalMb} MB.\n`);
