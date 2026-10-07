import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import net from "net";
import { promisify } from "util";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db.server";
import { getStoreConfig } from "./pos.server";
import { getCustomerById } from "./customer.server";
import {
  generateSaleReceiptEscPos,
  generateTestPrintEscPos,
  generateCashDrawerKickEscPos,
} from "./escpos.server";
import type { Sale } from "../types/pos";

const execAsync = promisify(exec);

export interface PrinterSettings {
  printerType: "windows" | "network" | "browser";
  printerName: string;
  networkIp: string;
  networkPort: number;
  paperWidth: 58 | 80;
  autoPrint: boolean;
  autoCut: boolean;
  openCashDrawer: boolean;
  copies: number;
  storePhone: string;
  customFooter: string;
}

export interface WindowsPrinterInfo {
  name: string;
  isDefault: boolean;
  portName: string;
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  printerType: "windows",
  printerName: "",
  networkIp: "192.168.1.200",
  networkPort: 9100,
  paperWidth: 58,
  autoPrint: false,
  autoCut: true,
  openCashDrawer: true,
  copies: 1,
  storePhone: "0812-3456-7890",
  customFooter: "Matur Sembah Nuwun! Buka 24 Jam Non-Stop",
};

/**
 * Mendapatkan daftar printer yang terdaftar di Windows menggunakan Win32_Printer.
 */
export async function getAvailableWindowsPrinters(): Promise<WindowsPrinterInfo[]> {
  try {
    const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default, PortName | ConvertTo-Json"`;
    const { stdout } = await execAsync(cmd, { timeout: 8000 });
    const trimmed = stdout.trim();
    if (!trimmed) return [];

    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : [parsed];

    return list.map((item: any) => ({
      name: String(item.Name || ""),
      isDefault: Boolean(item.Default),
      portName: String(item.PortName || ""),
    }));
  } catch (err: any) {
    console.warn("[getAvailableWindowsPrinters error]:", err.message);
    return [];
  }
}

/**
 * Mengambil konfigurasi printer dari database store_settings.
 */
export async function getPrinterSettingsFromDb(): Promise<PrinterSettings> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT setting_key, setting_value FROM store_settings WHERE setting_key LIKE 'printer_%' OR setting_key IN ('store_phone', 'receipt_footer')`
    );

    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.setting_key] = r.setting_value;
    }

    return {
      printerType: (map.printer_type as any) || DEFAULT_PRINTER_SETTINGS.printerType,
      printerName: map.printer_name ?? DEFAULT_PRINTER_SETTINGS.printerName,
      networkIp: map.printer_network_ip || DEFAULT_PRINTER_SETTINGS.networkIp,
      networkPort: map.printer_network_port ? parseInt(map.printer_network_port, 10) : DEFAULT_PRINTER_SETTINGS.networkPort,
      paperWidth: map.printer_paper_width === "80" ? 80 : 58,
      autoPrint: map.printer_auto_print === "1",
      autoCut: map.printer_auto_cut !== "0",
      openCashDrawer: map.printer_cash_drawer !== "0",
      copies: map.printer_copies ? parseInt(map.printer_copies, 10) : 1,
      storePhone: map.store_phone || DEFAULT_PRINTER_SETTINGS.storePhone,
      customFooter: map.receipt_footer || DEFAULT_PRINTER_SETTINGS.customFooter,
    };
  } catch (err: any) {
    console.warn("[getPrinterSettingsFromDb warning]:", err.message);
    return { ...DEFAULT_PRINTER_SETTINGS };
  }
}

/**
 * Menyimpan konfigurasi printer ke store_settings.
 */
export async function savePrinterSettingsToDb(settings: Partial<PrinterSettings>): Promise<void> {
  const current = await getPrinterSettingsFromDb();
  const merged = { ...current, ...settings };

  const entries: [string, string][] = [
    ["printer_type", merged.printerType],
    ["printer_name", merged.printerName],
    ["printer_network_ip", merged.networkIp],
    ["printer_network_port", String(merged.networkPort)],
    ["printer_paper_width", String(merged.paperWidth)],
    ["printer_auto_print", merged.autoPrint ? "1" : "0"],
    ["printer_auto_cut", merged.autoCut ? "1" : "0"],
    ["printer_cash_drawer", merged.openCashDrawer ? "1" : "0"],
    ["printer_copies", String(merged.copies)],
    ["store_phone", merged.storePhone],
    ["receipt_footer", merged.customFooter],
  ];

  for (const [key, value] of entries) {
    await pool.query(
      `INSERT INTO store_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`,
      [key, value, value]
    );
  }
}

/**
 * Mengirimkan data RAW ESC/POS via direct TCP socket ke printer jaringan (IP:Port).
 */
async function sendRawToNetworkPrinter(
  buffer: Buffer,
  ip: string,
  port: number = 9100
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(5000);

    socket.on("connect", () => {
      socket.write(buffer, () => {
        socket.end();
        if (!isResolved) {
          isResolved = true;
          resolve({ success: true, message: `Berhasil dicetak ke printer jaringan ${ip}:${port}` });
        }
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      if (!isResolved) {
        isResolved = true;
        resolve({
          success: false,
          message: `Koneksi ke printer jaringan ${ip}:${port} timed out (periksa kabel/IP printer).`,
        });
      }
    });

    socket.on("error", (err) => {
      socket.destroy();
      if (!isResolved) {
        isResolved = true;
        resolve({
          success: false,
          message: `Gagal menghubungkan ke printer jaringan ${ip}:${port}: ${err.message}`,
        });
      }
    });

    socket.connect(port, ip);
  });
}

export function isVirtualWindowsPrinter(printerName: string): boolean {
  const lower = (printerName || "").toLowerCase();
  return (
    lower.includes("microsoft print to pdf") ||
    lower.includes("print to pdf") ||
    lower.includes("xps document writer") ||
    lower.includes("onenote") ||
    lower.includes("fax")
  );
}

/**
 * Mengirimkan data RAW ESC/POS ke Windows Printer Spooler menggunakan script print-raw.ps1.
 */
async function sendRawToWindowsPrinter(
  buffer: Buffer,
  printerName: string
): Promise<{ success: boolean; message: string }> {
  // Jika printerName kosong, cari default printer
  let targetPrinter = printerName;
  if (!targetPrinter) {
    const printers = await getAvailableWindowsPrinters();
    const defaultPrinter = printers.find((p) => p.isDefault) || printers[0];
    if (!defaultPrinter) {
      return {
        success: false,
        message: "Tidak ada printer yang terpasang di sistem Windows ini.",
      };
    }
    targetPrinter = defaultPrinter.name;
  }

  // Cegah pengiriman data biner RAW ESC/POS ke printer virtual seperti Microsoft Print to PDF
  if (isVirtualWindowsPrinter(targetPrinter)) {
    return {
      success: false,
      message: `'${targetPrinter}' adalah printer virtual Windows, bukan printer thermal fisik (ESC/POS). Driver PDF Windows tidak mendukung data biner RAW sehingga menghasilkan file .pdf yang rusak/tidak dapat dibuka. Gunakan mode 'Dialog Browser / Simpan PDF' atau tombol Pratinjau untuk membuat file PDF resmi yang valid.`,
    };
  }

  // Tulis buffer ke file temporer
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `pos_receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.bin`);
  fs.writeFileSync(tempFile, buffer);

  try {
    const scriptPath = path.resolve(process.cwd(), "scripts", "print-raw.ps1");
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script pencetak tidak ditemukan: ${scriptPath}`);
    }

    const escapedPrinter = targetPrinter.replace(/"/g, '`"');
    const escapedFile = tempFile.replace(/"/g, '`"');
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${escapedPrinter}" -FilePath "${escapedFile}"`;

    const { stdout, stderr } = await execAsync(cmd, { timeout: 12000 });
    if (stderr && stderr.includes("Error")) {
      return { success: false, message: `Gagal mencetak: ${stderr.trim()}` };
    }

    return {
      success: true,
      message: `Berhasil dikirim ke printer spooler: ${targetPrinter}`,
    };
  } catch (err: any) {
    console.error("[sendRawToWindowsPrinter error]:", err);
    return {
      success: false,
      message: `Gagal mencetak ke printer '${targetPrinter}': ${err.message}`,
    };
  } finally {
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {}
  }
}

/**
 * Mengirimkan raw buffer ke target printer sesuai konfigurasi.
 */
export async function sendRawBufferToPrinter(
  buffer: Buffer,
  settings?: PrinterSettings
): Promise<{ success: boolean; message: string }> {
  const currentSettings = settings || (await getPrinterSettingsFromDb());

  if (currentSettings.printerType === "browser") {
    return {
      success: true,
      message: "Mode cetak browser dialog dipilih.",
    };
  }

  if (currentSettings.printerType === "network") {
    return await sendRawToNetworkPrinter(
      buffer,
      currentSettings.networkIp,
      currentSettings.networkPort
    );
  }

  // Default: windows spooler
  return await sendRawToWindowsPrinter(buffer, currentSettings.printerName);
}

/**
 * Mencetak struk transaksi penjualan (Sale).
 * Mendukung salinan (F9.4), sisa kasbon pelanggan (F1.10), auto-cut, dan cash drawer kick.
 */
export async function printSaleReceipt(
  sale: Sale,
  options?: { isCopy?: boolean; settings?: PrinterSettings }
): Promise<{ success: boolean; message: string }> {
  try {
    const settings = options?.settings || (await getPrinterSettingsFromDb());
    const storeConfig = getStoreConfig();

    // Ambil data utang pelanggan jika transaksi kasbon
    let customerDebtInfo:
      | { currentKasbon: number; previousDebt: number; totalRemainingDebt: number }
      | undefined;

    if (
      (sale.paymentMethod === "Kasbon" || sale.paymentMethod === "Hutang") &&
      sale.customerId
    ) {
      try {
        const customer = await getCustomerById(sale.customerId);
        if (customer) {
          const sisaNota = Math.max(0, sale.totalAmount - (sale.paidAmount || 0));
          const totalDebt = customer.totalDebt || 0;
          const previousDebt = Math.max(0, totalDebt - sisaNota);
          customerDebtInfo = {
            currentKasbon: sisaNota,
            previousDebt,
            totalRemainingDebt: totalDebt,
          };
        }
      } catch (err) {
        console.warn("[printSaleReceipt: getCustomerDebtInfo error]:", err);
      }
    }

    const buffer = generateSaleReceiptEscPos(sale, {
      paperWidth: settings.paperWidth,
      storeConfig,
      storePhone: settings.storePhone,
      receiptFooter: settings.customFooter,
      isCopy: Boolean(options?.isCopy),
      cashDrawerKick: settings.openCashDrawer,
      autoCut: settings.autoCut,
      customerDebtInfo,
    });

    const copiesCount = Math.max(1, settings.copies || 1);
    let lastResult = { success: false, message: "" };

    for (let i = 0; i < copiesCount; i++) {
      lastResult = await sendRawBufferToPrinter(buffer, settings);
      if (!lastResult.success) break;
    }

    return lastResult;
  } catch (err: any) {
    console.error("[printSaleReceipt error]:", err);
    return {
      success: false,
      message: `Kesalahan cetak struk: ${err.message}`,
    };
  }
}

/**
 * Melakukan uji cetak thermal (Test Print).
 */
export async function executeTestPrint(
  customSettings?: Partial<PrinterSettings>
): Promise<{ success: boolean; message: string }> {
  try {
    const currentSettings = await getPrinterSettingsFromDb();
    const settings = { ...currentSettings, ...customSettings };
    const storeConfig = getStoreConfig();

    const buffer = generateTestPrintEscPos({
      paperWidth: settings.paperWidth,
      storeName: storeConfig.storeName,
      printerName: settings.printerName || (settings.printerType === "network" ? `${settings.networkIp}:${settings.networkPort}` : "Default Windows Printer"),
    });

    return await sendRawBufferToPrinter(buffer, settings);
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal uji cetak: ${err.message}`,
    };
  }
}

/**
 * Membuka laci uang (Cash Drawer Kick).
 */
export async function executeOpenCashDrawer(
  customSettings?: Partial<PrinterSettings>
): Promise<{ success: boolean; message: string }> {
  try {
    const settings = customSettings
      ? { ...(await getPrinterSettingsFromDb()), ...customSettings }
      : await getPrinterSettingsFromDb();

    const buffer = generateCashDrawerKickEscPos();
    return await sendRawBufferToPrinter(buffer, settings);
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal membuka laci: ${err.message}`,
    };
  }
}
