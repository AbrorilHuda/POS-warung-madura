import type { Sale } from "../types/pos";
import type { StoreConfig } from "./pos.server";

export interface EscPosOptions {
  paperWidth: 58 | 80;
  storeConfig?: StoreConfig;
  isCopy?: boolean;
  cashDrawerKick?: boolean;
  autoCut?: boolean;
  storePhone?: string;
  receiptFooter?: string;
  customerDebtInfo?: {
    currentKasbon: number;
    previousDebt: number;
    totalRemainingDebt: number;
  };
}

/**
 * EscPosBuilder — Generator binary buffer ESC/POS murni (Node.js buffer).
 * Mendukung printer thermal 58mm (32 kolom) & 80mm (48 kolom).
 */
export class EscPosBuilder {
  private chunks: Buffer[] = [];
  private readonly maxCols: number;

  constructor(paperWidth: 58 | 80 = 58) {
    this.maxCols = paperWidth === 80 ? 48 : 32;
    this.init();
  }

  getBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }

  // 1. Inisialisasi printer
  init(): this {
    this.chunks.push(Buffer.from([0x1b, 0x40])); // ESC @
    return this;
  }

  // 2. Alignment
  alignLeft(): this {
    this.chunks.push(Buffer.from([0x1b, 0x61, 0x00])); // ESC a 0
    return this;
  }

  alignCenter(): this {
    this.chunks.push(Buffer.from([0x1b, 0x61, 0x01])); // ESC a 1
    return this;
  }

  alignRight(): this {
    this.chunks.push(Buffer.from([0x1b, 0x61, 0x02])); // ESC a 2
    return this;
  }

  // 3. Text formatting
  bold(enable: boolean = true): this {
    this.chunks.push(Buffer.from([0x1b, 0x45, enable ? 0x01 : 0x00])); // ESC E n
    return this;
  }

  doubleHeight(enable: boolean = true): this {
    this.chunks.push(Buffer.from([0x1d, 0x21, enable ? 0x01 : 0x00])); // GS ! n
    return this;
  }

  doubleSize(enable: boolean = true): this {
    this.chunks.push(Buffer.from([0x1d, 0x21, enable ? 0x11 : 0x00])); // GS ! 0x11
    return this;
  }

  normalSize(): this {
    this.chunks.push(Buffer.from([0x1d, 0x21, 0x00]));
    return this;
  }

  // 4. Line Feed
  feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.chunks.push(Buffer.from([0x0a]));
    }
    return this;
  }

  // 5. Teks baris
  text(str: string): this {
    this.chunks.push(Buffer.from(str, "ascii"));
    return this;
  }

  line(str: string = ""): this {
    this.text(str);
    this.feed(1);
    return this;
  }

  // 6. Garis horizontal pemisah
  horizontalLine(char: string = "-"): this {
    this.line(char.repeat(this.maxCols));
    return this;
  }

  // 7. Format 2 kolom (Kiri & Kanan pas lebar kertas)
  twoColumns(left: string, right: string): this {
    const totalLen = left.length + right.length;
    if (totalLen >= this.maxCols) {
      // Jika teks kiri terlalu panjang, potong atau bungkus
      const maxLeftLen = this.maxCols - right.length - 1;
      const truncatedLeft = left.slice(0, Math.max(0, maxLeftLen));
      const spaces = " ".repeat(Math.max(1, this.maxCols - truncatedLeft.length - right.length));
      this.line(truncatedLeft + spaces + right);
    } else {
      const spaces = " ".repeat(this.maxCols - totalLen);
      this.line(left + spaces + right);
    }
    return this;
  }

  // 8. Cetak item produk belanja
  printItem(name: string, qty: number, unitName: string, price: number, subtotal: number): this {
    const qtyPriceStr = `  ${qty} ${unitName} x ${price.toLocaleString("id-ID")}`;
    const subtotalStr = subtotal.toLocaleString("id-ID");

    if (this.maxCols === 32) {
      // Format 58mm (32 kolom)
      // Baris 1: Nama produk
      // Baris 2: Qty x Harga di kiri, Subtotal di kanan
      this.line(name);
      this.twoColumns(qtyPriceStr, subtotalStr);
    } else {
      // Format 80mm (48 kolom)
      // Baris 1: Nama produk (max 22 char), Qty (6 char), Harga (9 char), Subtotal (11 char)
      const formattedQty = `${qty} ${unitName}`.slice(0, 8).padEnd(8);
      const formattedPrice = price.toLocaleString("id-ID").padStart(9);
      const formattedSubtotal = subtotalStr.padStart(11);

      if (name.length > 20) {
        this.line(name);
        this.line(`  ${formattedQty} @ ${formattedPrice}  = ${formattedSubtotal.trim()}`);
      } else {
        const paddedName = name.padEnd(20);
        this.line(`${paddedName} ${formattedQty} ${formattedPrice} ${formattedSubtotal}`);
      }
    }
    return this;
  }

  // 9. QR Code ESC/POS standar
  printQrCode(qrData: string, dotSize: number = 4): this {
    if (!qrData) return this;
    const dataBuffer = Buffer.from(qrData, "utf8");
    const len = dataBuffer.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);

    // 1. Set model (Model 2)
    this.chunks.push(Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]));
    // 2. Set dot size (4 untuk 58mm, 6 untuk 80mm)
    this.chunks.push(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, dotSize]));
    // 3. Set error correction level M (0x31 = Level M)
    this.chunks.push(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]));
    // 4. Store data
    this.chunks.push(Buffer.from([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]));
    this.chunks.push(dataBuffer);
    // 5. Print QR code
    this.chunks.push(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]));
    this.feed(1);
    return this;
  }

  // 10. Cash Drawer Kick Pulse (ESC p 0 25 250)
  cashDrawerKick(): this {
    this.chunks.push(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
    return this;
  }

  // 11. Cut Paper (Feed & Cut)
  cutPaper(): this {
    this.feed(3);
    this.chunks.push(Buffer.from([0x1d, 0x56, 0x42, 0x00])); // GS V 66 0
    return this;
  }
}

/**
 * Men-generate struk penjualan resmi dalam format ESC/POS biner.
 */
export function generateSaleReceiptEscPos(
  sale: Sale,
  options: EscPosOptions
): Buffer {
  const {
    paperWidth = 58,
    storeConfig,
    isCopy = false,
    cashDrawerKick = true,
    autoCut = true,
    customerDebtInfo,
  } = options;

  const builder = new EscPosBuilder(paperWidth);

  // 1. Kick cash drawer di awal jika transaksi tunai
  if (cashDrawerKick && sale.paymentMethod === "Tunai") {
    builder.cashDrawerKick();
  }

  // 2. Header Toko
  const storeName = storeConfig?.storeName || "WARUNG MADURA";
  const storeAddress = storeConfig?.storeAddress || "Buka 24 Jam Non-Stop";
  const storePhone = options.storePhone || "";

  builder.alignCenter();
  if (isCopy) {
    builder.bold(true).line("*** SALINAN / COPY ***").bold(false);
  }
  builder.doubleSize(true).bold(true).line(storeName.toUpperCase()).normalSize().bold(false);
  builder.line(storeAddress);
  if (storePhone) {
    builder.line(`Telp: ${storePhone}`);
  }
  builder.horizontalLine("=");

  // 3. Info Nota & Kasir
  builder.alignLeft();
  builder.twoColumns("No. Nota :", sale.invoiceCode);
  builder.twoColumns("Waktu    :", sale.timestamp);
  builder.twoColumns("Kasir    :", sale.cashierName || "Kasir");

  if (sale.customerName) {
    builder.twoColumns("Pelanggan:", sale.customerName);
  }
  builder.horizontalLine("-");

  // 4. Daftar Item
  builder.alignLeft();
  for (const it of sale.items) {
    builder.printItem(
      it.productName,
      it.qty,
      it.unitName,
      it.price,
      it.subtotal
    );
  }
  builder.horizontalLine("-");

  // 5. Total & Pembayaran
  const totalQty = sale.items.reduce((sum, it) => sum + (it.qty || 1), 0);
  builder.twoColumns(`Total Item (${totalQty}) :`, `Rp ${sale.totalAmount.toLocaleString("id-ID")}`);

  if (sale.paymentMethod === "Tunai") {
    builder.twoColumns("Metode Bayar :", "Tunai");
    builder.twoColumns("Uang Diterima:", `Rp ${(sale.paidAmount || sale.totalAmount).toLocaleString("id-ID")}`);
    builder.twoColumns("Kembalian    :", `Rp ${(sale.changeAmount || 0).toLocaleString("id-ID")}`);
  } else if (sale.paymentMethod === "Kasbon" || sale.paymentMethod === "Hutang") {
    builder.bold(true);
    builder.twoColumns("Metode Bayar :", "KASBON / UTANG");
    if (sale.paidAmount && sale.paidAmount > 0) {
      builder.twoColumns("Dibayar Dimuka:", `Rp ${sale.paidAmount.toLocaleString("id-ID")}`);
      const sisaNota = Math.max(0, sale.totalAmount - sale.paidAmount);
      builder.twoColumns("Sisa Kasbon Nota:", `Rp ${sisaNota.toLocaleString("id-ID")}`);
    } else {
      builder.twoColumns("Kasbon Nota  :", `Rp ${sale.totalAmount.toLocaleString("id-ID")}`);
    }
    builder.bold(false);

    // PRD F1.10: Struk kasbon mencantumkan total sisa utang pelanggan
    if (customerDebtInfo) {
      builder.feed(1);
      builder.alignLeft();
      builder.line("[ INFORMASI SALDO KASBON ]");
      if (customerDebtInfo.previousDebt > 0) {
        builder.twoColumns("Utang Sebelumnya :", `Rp ${customerDebtInfo.previousDebt.toLocaleString("id-ID")}`);
      }
      builder.bold(true);
      builder.twoColumns("TOTAL UTANG KINI :", `Rp ${customerDebtInfo.totalRemainingDebt.toLocaleString("id-ID")}`);
      builder.bold(false);
    }
  } else {
    builder.twoColumns("Metode Bayar :", sale.paymentMethod);
    builder.twoColumns("Total Bayar  :", `Rp ${sale.totalAmount.toLocaleString("id-ID")}`);
  }
  builder.horizontalLine("=");

  // 6. QR Code Struk Digital (Jika ada URL publik)
  const baseUrl = storeConfig?.publicInvoiceBaseUrl || "http://localhost:5175";
  const storeSlug = storeConfig?.storeSlug || "warung-madura-berkah";
  const invoiceUrl = `${baseUrl.replace(/\/$/, "")}/${storeSlug}/invoice/${sale.invoiceCode}`;

  builder.alignCenter();
  builder.line("Scan QR untuk Struk Digital:");
  builder.feed(1);
  builder.printQrCode(invoiceUrl, paperWidth === 80 ? 5 : 4);
  builder.feed(1);

  // 7. Footer
  const footerMsg = options.receiptFooter || "Matur Sembah Nuwun! Buka 24 Jam Non-Stop";
  builder.line(footerMsg);
  builder.line("Barang yang sudah dibeli");
  builder.line("dapat ditukar dalam 1x24 jam");
  builder.feed(1);

  // 8. Auto Cut Paper
  if (autoCut) {
    builder.cutPaper();
  } else {
    builder.feed(4);
  }

  return builder.getBuffer();
}

/**
 * Men-generate struk uji cetak (Test Print).
 */
export function generateTestPrintEscPos(options: {
  paperWidth: 58 | 80;
  storeName?: string;
  printerName?: string;
}): Buffer {
  const { paperWidth = 58, storeName = "WARUNG MADURA", printerName = "Default Thermal" } = options;
  const builder = new EscPosBuilder(paperWidth);

  builder.alignCenter();
  builder.doubleSize(true).bold(true).line("UJI CETAK THERMAL").normalSize().bold(false);
  builder.line(storeName);
  builder.line(`Printer: ${printerName}`);
  builder.line(`Format Kertas: ${paperWidth} mm`);
  builder.horizontalLine("=");

  builder.alignLeft();
  builder.line("Waktu: " + new Date().toLocaleString("id-ID"));
  builder.line("Status: Printer Terhubung OK!");
  builder.horizontalLine("-");
  builder.line("Testing Karakter Font Normal:");
  builder.line("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  builder.line("1234567890 !@#$%^&*()-+");
  builder.horizontalLine("-");

  builder.bold(true).line("Testing Teks Tebal (Bold)").bold(false);
  builder.alignCenter();
  builder.doubleHeight(true).line("Testing Double Height").normalSize();
  builder.horizontalLine("=");

  builder.alignCenter();
  builder.line("Matur Sembah Nuwun!");
  builder.feed(1);
  builder.cutPaper();

  return builder.getBuffer();
}

/**
 * Men-generate buffer untuk trigger pembukaan laci kasir (Cash Drawer Kick).
 */
export function generateCashDrawerKickEscPos(): Buffer {
  const builder = new EscPosBuilder(58);
  builder.cashDrawerKick();
  return builder.getBuffer();
}
