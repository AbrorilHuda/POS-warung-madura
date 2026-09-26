import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const pngPath = path.join(projectRoot, "public", "icons", "icon.png");
const icoPath = path.join(projectRoot, "public", "icons", "icon.ico");

if (!fs.existsSync(pngPath)) {
  console.error(`[Generate Icon] File sumber PNG tidak ditemukan di: ${pngPath}`);
  process.exit(1);
}

console.log("[Generate Icon] Mengonversi public/icons/icon.png ke multi-resolution Windows .ico...");

try {
  const icoBuffer = await pngToIco(pngPath);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`[Generate Icon] ✅ Berhasil menghasilkan ${icoPath} (${(icoBuffer.length / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error("[Generate Icon] ❌ Gagal mengonversi icon:", err);
  process.exit(1);
}
