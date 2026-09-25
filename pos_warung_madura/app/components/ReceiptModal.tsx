import React, { useState } from "react";
import {
  Printer,
  CheckCircle2,
  Copy,
  Smartphone,
  Receipt,
  X,
  PlusCircle,
  ShieldCheck,
  CloudCheck,
} from "lucide-react";
import type { Sale } from "../types/pos";

interface ReceiptModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onNewTransaction: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  isOpen,
  onClose,
  onNewTransaction,
}) => {
  const [viewMode, setViewMode] = useState<"thermal" | "mobileWeb">("thermal");
  const [copied, setCopied] = useState(false);

  if (!isOpen || !sale) return null;

  const invoiceUrl = `https://warungku.my.id/invoice/${sale.invoiceCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(invoiceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden my-6">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Transaksi Berhasil</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {sale.invoiceCode}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("thermal")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === "thermal"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Struk Fisik</span>
            </button>
            <button
              onClick={() => setViewMode("mobileWeb")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === "mobileWeb"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Invoice Web</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 bg-slate-50 flex flex-col items-center max-h-[68vh] overflow-y-auto">
          {viewMode === "thermal" ? (
            /* THERMAL RECEIPT DISPLAY */
            <div className="w-full max-w-sm receipt-paper text-slate-900 rounded-xl p-5 shadow-xs font-mono text-xs border border-slate-200">
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h4 className="font-extrabold text-sm tracking-wider uppercase text-slate-900">
                  WARUNG MADURA BERKAH
                </h4>
                <p className="text-[10px] text-slate-500">Buka 24 Jam Nonstop &bull; Sumenep</p>
                <div className="mt-1.5 text-[10px] text-slate-400 flex justify-between">
                  <span>{sale.timestamp}</span>
                  <span>Kasir: {sale.cashierName}</span>
                </div>
                <div className="text-[10px] text-slate-700 font-bold mt-0.5">
                  No: {sale.invoiceCode}
                </div>
              </div>

              {/* Items */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1.5">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <div className="font-semibold text-slate-900">{item.productName}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.qty} x {item.unitName} @ Rp {item.price.toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900">
                      Rp {item.subtotal.toLocaleString("id-ID")}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-slate-700">
                <div className="flex justify-between font-bold text-xs text-slate-900">
                  <span>TOTAL:</span>
                  <span>Rp {sale.totalAmount.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>BAYAR ({sale.paymentMethod}):</span>
                  <span>Rp {sale.paidAmount.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-900">
                  <span>KEMBALI:</span>
                  <span>Rp {sale.changeAmount.toLocaleString("id-ID")}</span>
                </div>
              </div>

              {/* QR Struk */}
              <div className="pt-3 text-center flex flex-col items-center">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Scan QR Invoice Digital:
                </p>
                <div className="p-2 bg-white rounded border border-slate-300 shadow-xs flex flex-col items-center">
                  <div className="w-24 h-24 bg-slate-900 rounded p-1 flex items-center justify-center">
                    <div className="w-full h-full bg-white p-1 grid grid-cols-6 grid-rows-6 gap-0.5">
                      <div className="col-span-2 row-span-2 bg-black"></div>
                      <div className="col-span-2 bg-black"></div>
                      <div className="col-span-2 row-span-2 bg-black"></div>
                      <div className="bg-black"></div>
                      <div className="bg-transparent"></div>
                      <div className="col-span-2 bg-black"></div>
                      <div className="bg-transparent"></div>
                      <div className="bg-black"></div>
                      <div className="col-span-2 row-span-2 bg-black"></div>
                      <div className="bg-black"></div>
                      <div className="col-span-2 bg-black"></div>
                      <div className="col-span-2 row-span-2 bg-black"></div>
                    </div>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5">
                  warungku.my.id/invoice/{sale.invoiceCode}
                </p>
                <p className="text-[10px] text-slate-600 font-semibold mt-1">
                  Matur Sembah Nuwun!
                </p>
              </div>
            </div>
          ) : (
            /* MOBILE WEB INVOICE PREVIEW */
            <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  WM
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 text-xs">Warung Madura Berkah</h5>
                  <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <CloudCheck className="w-3 h-3" />
                    Invoice Digital Resmi
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Kode Invoice:</span>
                  <span className="font-mono font-bold text-slate-900">{sale.invoiceCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu:</span>
                  <span className="text-slate-700">{sale.timestamp}</span>
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                {sale.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-100">
                    <div>
                      <div className="text-slate-800 font-medium">{it.productName}</div>
                      <div className="text-[10px] text-slate-400">
                        {it.qty} x {it.unitName}
                      </div>
                    </div>
                    <div className="font-semibold text-slate-900">
                      Rp {it.subtotal.toLocaleString("id-ID")}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 text-white flex justify-between items-center text-xs">
                <span className="font-medium">Total Dibayar:</span>
                <span className="font-mono font-bold text-sm">
                  Rp {sale.totalAmount.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? "Tersalin!" : "Salin Link"}</span>
            </button>
          </div>

          <button
            onClick={onNewTransaction}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Transaksi Baru</span>
          </button>
        </div>
      </div>
    </div>
  );
};
