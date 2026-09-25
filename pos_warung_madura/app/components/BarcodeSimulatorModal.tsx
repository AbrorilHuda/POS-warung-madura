import React, { useState } from "react";
import { Barcode, X, ArrowRight, Zap } from "lucide-react";
import type { Product } from "../types/pos";

interface BarcodeSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onScanCode: (barcode: string) => void;
}

export const BarcodeSimulatorModal: React.FC<BarcodeSimulatorModalProps> = ({
  isOpen,
  onClose,
  products,
  onScanCode,
}) => {
  const [customBarcode, setCustomBarcode] = useState("");

  if (!isOpen) return null;

  const barcodeList: Array<{
    barcode: string;
    productName: string;
    unitName: string;
    price: number;
  }> = [];

  products.forEach((p) => {
    p.units.forEach((u) => {
      barcodeList.push({
        barcode: u.barcode,
        productName: p.name,
        unitName: u.unitName,
        price: u.price,
      });
    });
  });

  const handleSelectCode = (code: string) => {
    onScanCode(code);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBarcode.trim()) return;
    onScanCode(customBarcode.trim());
    setCustomBarcode("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Simulator Scan Barcode</h3>
            <p className="text-[11px] text-slate-500">
              Pilih barcode barang untuk uji scan dan deteksi otomatis satuan.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <form onSubmit={handleCustomSubmit} className="flex gap-2">
            <input
              type="text"
              value={customBarcode}
              onChange={(e) => setCustomBarcode(e.target.value)}
              placeholder="Tempel / ketik barcode..."
              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Scan
            </button>
          </form>

          {/* Random uncatalogued barcode */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-700 font-medium">
              Uji Coba Barcode Baru (Tak Terdaftar)
            </span>
            <button
              onClick={() => handleSelectCode(`899${Math.floor(100000000 + Math.random() * 900000000)}`)}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold text-xs transition cursor-pointer"
            >
              + Barcode Baru
            </button>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-700 block mb-1.5">
              Daftar Barcode di Master Data:
            </span>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {barcodeList.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectCode(item.barcode)}
                  className="w-full p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-between text-xs transition group text-left cursor-pointer"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{item.productName}</span>
                    <span className="text-[11px] text-slate-500 ml-1.5">({item.unitName})</span>
                    <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                      {item.barcode}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 block">
                      Rp {item.price.toLocaleString("id-ID")}
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-700 flex items-center gap-0.5 justify-end">
                      Scan <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
