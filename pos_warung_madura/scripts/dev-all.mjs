import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const posDir = path.resolve(__dirname, "..");
const invoiceDir = path.resolve(__dirname, "../../invoice_publik");

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch (e) {}
}

const posPort = process.env.PORT || "5174";
const invoicePort = "5175";

console.log("==================================================");
console.log("🚀 Menjalankan POS Warung Madura & Invoice Cloud...");
console.log(`📁 POS Lokal (Port ${posPort}):       ${posDir}`);
console.log(`📁 Invoice Publik (Port ${invoicePort}):  ${invoiceDir}`);
console.log("==================================================");

const isWin = process.platform === "win32";
const npmCmd = isWin ? "cmd.exe" : "npm";
const npmArgs = (cmd, dir) =>
  isWin
    ? ["/c", `npm run ${cmd}`]
    : ["run", cmd];

// 1. Jalankan POS Server (Port 5174)
const posProcess = spawn(npmCmd, npmArgs("dev", posDir), {
  cwd: posDir,
  shell: isWin,
  stdio: ["inherit", "pipe", "pipe"],
});

posProcess.stdout?.on("data", (data) => {
  process.stdout.write(`\x1b[36m[POS 5174]\x1b[0m ${data}`);
});

posProcess.stderr?.on("data", (data) => {
  process.stderr.write(`\x1b[36m[POS 5174 ERR]\x1b[0m ${data}`);
});

// 2. Jalankan Invoice Publik Server (Port 5175)
const invoiceProcess = spawn(npmCmd, npmArgs("dev", invoiceDir), {
  cwd: invoiceDir,
  shell: isWin,
  stdio: ["inherit", "pipe", "pipe"],
});

invoiceProcess.stdout?.on("data", (data) => {
  process.stdout.write(`\x1b[35m[CLOUD 5175]\x1b[0m ${data}`);
});

invoiceProcess.stderr?.on("data", (data) => {
  process.stderr.write(`\x1b[35m[CLOUD 5175 ERR]\x1b[0m ${data}`);
});

function cleanup() {
  console.log("\n🛑 Menghentikan server POS dan Invoice Cloud...");
  try {
    if (isWin) {
      if (posProcess.pid) spawn("taskkill", ["/pid", String(posProcess.pid), "/f", "/t"]);
      if (invoiceProcess.pid) spawn("taskkill", ["/pid", String(invoiceProcess.pid), "/f", "/t"]);
    } else {
      posProcess.kill("SIGTERM");
      invoiceProcess.kill("SIGTERM");
    }
  } catch (e) {}
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
