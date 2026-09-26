import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const mysqlLibDir = path.join(projectRoot, "resources", "mysql", "lib");

if (!fs.existsSync(mysqlLibDir)) {
  console.log("[Strip MySQL] Direktori resources/mysql/lib tidak ditemukan. Melewati proses pembersihan.");
  process.exit(0);
}

console.log("[Strip MySQL] Memulai pembersihan file MySQL portable yang tidak diperlukan...");

let totalBytesDeleted = 0;
let deletedCount = 0;

function removePath(targetPath, description) {
  if (!fs.existsSync(targetPath)) return;

  try {
    const stats = fs.statSync(targetPath);
    let size = 0;

    if (stats.isDirectory()) {
      // Hitung recursive size
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

// 1. mysqlclient.lib (file linking C/C++ statis)
removePath(path.join(mysqlLibDir, "mysqlclient.lib"), "Static compile library (C/C++)");

// 2. Seluruh folder mecab/ (dictionary fulltext search Jepang/China/Korea)
removePath(path.join(mysqlLibDir, "mecab"), "Mecab fulltext dictionary");

// 3. Seluruh folder plugin/debug/ (debug builds)
removePath(path.join(mysqlLibDir, "plugin", "debug"), "Plugin debug builds");

// 4. File plugin yang tidak digunakan di lib/plugin/
const unusedPlugins = [
  "authentication_oci_client.dll",
  "authentication_kerberos_client.dll",
  "authentication_ldap_sasl_client.dll",
  "authentication_webauthn_client.dll",
  "group_replication.dll",
  "component_keyring_file.dll",
];

for (const plugin of unusedPlugins) {
  removePath(path.join(mysqlLibDir, "plugin", plugin), "Unused client/auth/replication plugin");
}

// 5. Dictionary cjdict.dict & khmerdict.dict di lib/private/icudt*/brkitr/
const privateDir = path.join(mysqlLibDir, "private");
if (fs.existsSync(privateDir)) {
  const icuDirs = fs.readdirSync(privateDir).filter((d) => d.startsWith("icu"));
  for (const icu of icuDirs) {
    const brkitrDir = path.join(privateDir, icu, "brkitr");
    removePath(path.join(brkitrDir, "cjdict.dict"), "Chinese/Japanese dictionary");
    removePath(path.join(brkitrDir, "khmerdict.dict"), "Khmer dictionary");
  }
}

const totalMb = (totalBytesDeleted / (1024 * 1024)).toFixed(2);
console.log(`[Strip MySQL] Selesai! Sebanyak ${deletedCount} file/folder dihapus. Total ruang terpangkas: ~${totalMb} MB.\n`);
