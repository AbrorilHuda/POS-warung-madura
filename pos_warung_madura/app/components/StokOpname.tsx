import React, { useState } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  Save,
} from "lucide-react";
import type { Product, StockOpnameItem } from "../types/pos";

interface StokOpnameProps {
  products: Product[];
  onApplyOpnameAdjustment: (items: StockOpnameItem[]) => void;
}

export const StokOpname: React.FC<StokOpnameProps> = ({
  products,
  onApplyOpnameAdjustment,
}) => {
  const [physicalCounts, setPhysicalCounts] = useState<{ [productId: string]: number }>(() => {
    const initial: { [key: string]: number } = {};
    products.forEach((p) => {
      initial[p.id] = p.stockInBaseUnit;
    });
    return initial;
  });

  const [notes, setNotes] = useState<{ [productId: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState<string>("");

  const handlePhysicalChange = (productId: string, val: number) => {
    setPhysicalCounts((prev) => ({
      ...prev,
      [productId]: Math.max(0, val),
    }));
  };

  const handleNotesChange = (productId: string, val: string) => {
    setNotes((prev) => ({
      ...prev,
      [productId]: val,
    }));
  };

  const opnameItems: StockOpnameItem[] = products.map((p) => {
    const physical = physicalCounts[p.id] ?? p.stockInBaseUnit;
    return {
      productId: p.id,
      productName: p.name,
      baseUnit: p.baseUnit,
      systemStock: p.stockInBaseUnit,
      physicalStock: physical,
      difference: physical - p.stockInBaseUnit,
      notes: notes[p.id] || "",
    };
  });

  const totalDifferences = opnameItems.filter((it) => it.difference !== 0);

  React.useEffect(() => {
    setPhysicalCounts((prev) => {
      const updated = { ...prev };
      products.forEach((p) => {
        if (updated[p.id] === undefined) {
          updated[p.id] = p.stockInBaseUnit;
        }
      });
      return updated;
    });
  }, [products]);

  const handleFinalizeOpname = () => {
    onApplyOpnameAdjustment(opnameItems);
    setSuccessMessage(
      `Sukses merekonsiliasi stok! Dibuat penyesuaian ledger untuk ${totalDifferences.length} barang.`
    );
    const resetCounts: { [key: string]: number } = {};
    opnameItems.forEach((it) => {
      resetCounts[it.productId] = it.physicalStock;
    });
    setPhysicalCounts(resetCounts);
    setNotes({});
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Stok Opname Bulanan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cocokkan stok sistem dengan stok fisik nyata. Selisih akan otomatis dibuatkan penyesuaian di ledger.
          </p>
        </div>

        {totalDifferences.length > 0 && (
          <button
            onClick={handleFinalizeOpname}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Rekonsiliasi ({totalDifferences.length} Selisih)</span>
          </button>
        )}
      </div>

      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Item Dicek</span>
          <p className="text-xl font-bold text-slate-900 font-mono mt-1">{products.length} SKU</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Stok Sesuai</span>
          <p className="text-xl font-bold text-emerald-600 font-mono mt-1">
            {opnameItems.filter((i) => i.difference === 0).length} SKU
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Ada Selisih</span>
          <p className="text-xl font-bold text-rose-600 font-mono mt-1">
            {totalDifferences.length} SKU
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
              <th className="pb-2.5 pl-1">Produk & Satuan</th>
              <th className="pb-2.5 text-center">Stok Sistem</th>
              <th className="pb-2.5 text-center">Hitungan Fisik</th>
              <th className="pb-2.5 text-center">Selisih</th>
              <th className="pb-2.5">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {opnameItems.map((item) => {
              const hasDiff = item.difference !== 0;
              const isNegative = item.difference < 0;

              return (
                <tr key={item.productId} className="hover:bg-slate-50/60 transition">
                  <td className="py-2.5 pl-1">
                    <span className="font-bold text-slate-900 text-xs block">{item.productName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Base: {item.baseUnit}
                    </span>
                  </td>

                  <td className="py-2.5 text-center font-mono font-bold text-slate-700">
                    {item.systemStock} {item.baseUnit}
                  </td>

                  <td className="py-2.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={item.physicalStock}
                      onChange={(e) =>
                        handlePhysicalChange(item.productId, parseInt(e.target.value) || 0)
                      }
                      className="w-20 text-center py-1 px-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </td>

                  <td className="py-2.5 text-center">
                    {!hasDiff ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                        Cocok
                      </span>
                    ) : isNegative ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 font-mono">
                        {item.difference} {item.baseUnit}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-50 text-cyan-700 font-mono">
                        +{item.difference} {item.baseUnit}
                      </span>
                    )}
                  </td>

                  <td className="py-2.5">
                    <input
                      type="text"
                      placeholder="Catatan..."
                      value={item.notes}
                      onChange={(e) => handleNotesChange(item.productId, e.target.value)}
                      className="w-full py-1 px-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
