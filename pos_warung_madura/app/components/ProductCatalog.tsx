import React, { useState } from "react";
import {
  Package,
  Layers,
  Plus,
  Barcode,
  Search,
  Edit,
  Trash2,
  X,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  Tag,
  AlertTriangle,
  Users,
  Percent,
  FileSpreadsheet,
} from "lucide-react";
import type { Product, ProductUnit, ProductPriceTier, CustomerGroupType } from "../types/pos";
import { validateTierList } from "../services/pricing";


interface ProductCatalogProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onOpenImportExport?: (tab?: "import_products" | "export_data") => void;
}

// Preset Satuan Dasar (Base Units)
const BASE_UNIT_PRESETS = [
  "pcs",
  "bungkus",
  "sachet",
  "botol",
  "kaleng",
  "cup",
  "kg",
  "butir",
  "tabung",
  "galon",
];

// Preset Kemasan Bertingkat dengan Rasio Konversi Otomatis
const UNIT_PRESETS = [
  { label: "Pcs (1)", name: "Pcs", ratio: 1 },
  { label: "Bungkus (1)", name: "Bungkus", ratio: 1 },
  { label: "Sachet (1)", name: "Sachet", ratio: 1 },
  { label: "Botol (1)", name: "Botol", ratio: 1 },
  { label: "Slop (10 Bks)", name: "Slop", ratio: 10 },
  { label: "Renteng (10 Sch)", name: "Renteng", ratio: 10 },
  { label: "Renteng (12 Sch)", name: "Renteng", ratio: 12 },
  { label: "Dus (24 Btl/Pcs)", name: "Dus", ratio: 24 },
  { label: "Dus (40 Pcs)", name: "Dus", ratio: 40 },
  { label: "Dus (48 Cup)", name: "Dus", ratio: 48 },
  { label: "Dus (120 Sch)", name: "Dus", ratio: 120 },
  { label: "Lusin (12 Pcs)", name: "Lusin", ratio: 12 },
  { label: "Pack (10 Pcs)", name: "Pack", ratio: 10 },
  { label: "Bal (20 Slop)", name: "Bal", ratio: 200 },
  { label: "Karung (25 Kg)", name: "Karung", ratio: 25 },
];

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onOpenImportExport,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Product["category"]>("Mie & Sembako");
  const [baseUnit, setBaseUnit] = useState("pcs");
  const [initialStock, setInitialStock] = useState<number>(40);
  const [units, setUnits] = useState<
    Array<{
      id?: string;
      unitName: string;
      conversionRatio: number;
      price: number;
      costPrice: number;
      barcode: string;
      priceTiers?: ProductPriceTier[];
    }>
  >([]);
  const [expandedTiers, setExpandedTiers] = useState<Record<number, boolean>>({});

  const categories = [
    "Semua",
    "Rokok",
    "Mie & Sembako",
    "Minuman Dingin",
    "Jajanan & Kopi",
    "Gas & Galon",
    "Kebutuhan Harian",
  ];

  // Helper: Buat barcode acak 12 digit jika bungkus tidak punya barcode
  const generateRandomBarcode = (prefix = "899") => {
    return `${prefix}${Math.floor(100000000 + Math.random() * 900000000)}`;
  };

  // Buka Modal Tambah Baru
  const handleOpenAddModal = () => {
    setEditingProductId(null);
    setName("");
    setCategory("Mie & Sembako");
    setBaseUnit("pcs");
    setInitialStock(40);
    setExpandedTiers({});
    applyPackageTemplate("mie");
    setIsModalOpen(true);
  };

  // Buka Modal Edit Produk yang Ada
  const handleOpenEditModal = (prod: Product) => {
    setEditingProductId(prod.id);
    setName(prod.name);
    setCategory(prod.category);
    setBaseUnit(prod.baseUnit);
    setInitialStock(prod.stockInBaseUnit);
    setExpandedTiers({});
    setUnits(
      prod.units.map((u) => ({
        id: u.id,
        unitName: u.unitName,
        conversionRatio: u.conversionRatio,
        price: u.price,
        costPrice: u.costPrice || 0,
        barcode: u.barcode,
        priceTiers: u.priceTiers ? u.priceTiers.map((t) => ({ ...t })) : [],
      }))
    );
    setIsModalOpen(true);
  };

  // Template Paket Satuan Otomatis 1-Klik
  const applyPackageTemplate = (type: "rokok" | "mie" | "kopi" | "minuman" | "sabun" | "ecer") => {
    if (type === "rokok") {
      setCategory("Rokok");
      setBaseUnit("bungkus");
      setUnits([
        {
          unitName: "Bungkus",
          conversionRatio: 1,
          price: 27000,
          costPrice: 25000,
          barcode: generateRandomBarcode("8991"),
          priceTiers: [
            {
              tierName: "Grosir Beli ≥ 5",
              minQty: 5,
              price: 26500,
              customerGroup: "umum",
            },
            {
              tierName: "Khusus Reseller Warung",
              minQty: 5,
              price: 26000,
              customerGroup: "reseller",
            },
          ],
        },
        {
          unitName: "Slop (10 Bungkus)",
          conversionRatio: 10,
          price: 265000,
          costPrice: 248000,
          barcode: generateRandomBarcode("8992"),
          priceTiers: [],
        },
      ]);
    } else if (type === "mie") {
      setCategory("Mie & Sembako");
      setBaseUnit("pcs");
      setUnits([
        {
          unitName: "Pcs / Bungkus",
          conversionRatio: 1,
          price: 3500,
          costPrice: 2900,
          barcode: generateRandomBarcode("8993"),
          priceTiers: [
            {
              tierName: "Grosir Lusinan",
              minQty: 12,
              price: 3200,
              customerGroup: "umum",
            },
            {
              tierName: "Reseller Mitra",
              minQty: 10,
              price: 3000,
              customerGroup: "reseller",
            },
          ],
        },
        {
          unitName: "Dus (40 Pcs)",
          conversionRatio: 40,
          price: 135000,
          costPrice: 116000,
          barcode: generateRandomBarcode("8994"),
          priceTiers: [],
        },
      ]);
    } else if (type === "kopi") {
      setCategory("Jajanan & Kopi");
      setBaseUnit("sachet");
      setUnits([
        {
          unitName: "Sachet",
          conversionRatio: 1,
          price: 2000,
          costPrice: 1500,
          barcode: generateRandomBarcode("8995"),
          priceTiers: [
            {
              tierName: "Grosir ≥ 10 Sachet",
              minQty: 10,
              price: 1800,
              customerGroup: "umum",
            },
          ],
        },
        {
          unitName: "Renteng (10 Sachet)",
          conversionRatio: 10,
          price: 18000,
          costPrice: 15000,
          barcode: generateRandomBarcode("8996"),
          priceTiers: [],
        },
        {
          unitName: "Dus (120 Sachet)",
          conversionRatio: 120,
          price: 210000,
          costPrice: 180000,
          barcode: generateRandomBarcode("8997"),
          priceTiers: [],
        },
      ]);
    } else if (type === "minuman") {
      setCategory("Minuman Dingin");
      setBaseUnit("botol");
      setUnits([
        {
          unitName: "Botol",
          conversionRatio: 1,
          price: 4000,
          costPrice: 3200,
          barcode: generateRandomBarcode("8998"),
          priceTiers: [
            {
              tierName: "Grosir ≥ 6 Botol",
              minQty: 6,
              price: 3800,
              customerGroup: "umum",
            },
          ],
        },
        {
          unitName: "Dus (24 Botol)",
          conversionRatio: 24,
          price: 90000,
          costPrice: 76800,
          barcode: generateRandomBarcode("8999"),
          priceTiers: [],
        },
      ]);
    } else if (type === "sabun") {
      setCategory("Kebutuhan Harian");
      setBaseUnit("sachet");
      setUnits([
        {
          unitName: "Sachet",
          conversionRatio: 1,
          price: 1000,
          costPrice: 750,
          barcode: generateRandomBarcode("8990"),
          priceTiers: [],
        },
        {
          unitName: "Renteng (12 Sachet)",
          conversionRatio: 12,
          price: 11000,
          costPrice: 9000,
          barcode: generateRandomBarcode("8991"),
          priceTiers: [],
        },
      ]);
    } else {
      // Ecer Biasa
      setBaseUnit("pcs");
      setUnits([
        {
          unitName: "Pcs",
          conversionRatio: 1,
          price: 5000,
          costPrice: 4000,
          barcode: generateRandomBarcode("8992"),
          priceTiers: [],
        },
      ]);
    }
  };

  const handleAddUnitRow = () => {
    setUnits([
      ...units,
      {
        unitName: "Dus / Pack",
        conversionRatio: 12,
        price: 0,
        costPrice: 0,
        barcode: generateRandomBarcode("899"),
        priceTiers: [],
      },
    ]);
  };

  const handleRemoveUnitRow = (index: number) => {
    if (units.length <= 1) return;
    setUnits(units.filter((_, i) => i !== index));
  };

  const handleUnitChange = (index: number, field: string, value: any) => {
    setUnits(units.map((u, i) => (i === index ? { ...u, [field]: value } : u)));
  };

  // Pilih preset satuan untuk baris tertentu (mengisi nama & rasio sekaligus)
  const handleApplyUnitPresetToRow = (index: number, preset: { name: string; ratio: number }) => {
    setUnits(
      units.map((u, i) =>
        i === index
          ? {
            ...u,
            unitName: preset.name,
            conversionRatio: preset.ratio,
          }
          : u
      )
    );
  };

  // Handler toggle expand section harga bertingkat (PRD F3.2)
  const handleToggleTierExpand = (idx: number) => {
    setExpandedTiers((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Tambah baris tier grosir baru untuk suatu unit
  const handleAddTier = (unitIdx: number, preset?: Partial<ProductPriceTier>) => {
    setUnits((prev) =>
      prev.map((u, i) => {
        if (i !== unitIdx) return u;
        const currentTiers = u.priceTiers || [];
        const defaultMinQty =
          preset?.minQty ||
          (currentTiers.length === 0 ? 12 : currentTiers[currentTiers.length - 1].minQty + 6);
        const defaultPrice =
          preset?.price ||
          Math.max(0, Math.round((u.price || 0) * 0.9));
        const newTier: ProductPriceTier = {
          tierName: preset?.tierName || `Grosir ≥ ${defaultMinQty}`,
          minQty: defaultMinQty,
          price: defaultPrice,
          customerGroup: (preset?.customerGroup as CustomerGroupType) || "umum",
        };
        return {
          ...u,
          priceTiers: [...currentTiers, newTier],
        };
      })
    );
    setExpandedTiers((prev) => ({ ...prev, [unitIdx]: true }));
  };

  // Hapus tier grosir tertentu
  const handleRemoveTier = (unitIdx: number, tierIdx: number) => {
    setUnits((prev) =>
      prev.map((u, i) =>
        i === unitIdx
          ? {
            ...u,
            priceTiers: (u.priceTiers || []).filter((_, ti) => ti !== tierIdx),
          }
          : u
      )
    );
  };

  // Ubah nilai field tier grosir
  const handleTierChange = (
    unitIdx: number,
    tierIdx: number,
    field: keyof ProductPriceTier,
    value: any
  ) => {
    setUnits((prev) =>
      prev.map((u, i) => {
        if (i !== unitIdx) return u;
        const updatedTiers = (u.priceTiers || []).map((t, ti) =>
          ti === tierIdx ? { ...t, [field]: value } : t
        );
        return { ...u, priceTiers: updatedTiers };
      })
    );
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Validasi daftar tier & cek peringatan HPP (PRD F3.2 & F3.5)
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const tiers = u.priceTiers || [];
      if (tiers.length > 0) {
        const val = validateTierList(tiers, Number(u.costPrice) || 0);
        if (!val.isValid) {
          alert(`Validasi Harga Grosir Satuan '${u.unitName}':\n\n• ${val.errors.join("\n• ")}`);
          setExpandedTiers((prev) => ({ ...prev, [i]: true }));
          return;
        }
        if (val.warnings.length > 0) {
          const proceed = confirm(
            `Peringatan HPP Satuan '${u.unitName}':\n\n• ${val.warnings.join("\n• ")}\n\nApakah Anda yakin ingin tetap menyimpan produk ini?`
          );
          if (!proceed) {
            setExpandedTiers((prev) => ({ ...prev, [i]: true }));
            return;
          }
        }
      }
    }

    const prodId = editingProductId || `prod-${Date.now()}`;
    const newUnits: ProductUnit[] = units.map((u, idx) => ({
      id: u.id || `unit-${prodId}-${idx}`,
      productId: prodId,
      unitName: u.unitName.trim(),
      conversionRatio: Number(u.conversionRatio) || 1,
      price: Number(u.price) || 0,
      costPrice: Number(u.costPrice) || 0,
      barcode: u.barcode.trim(),
      isBaseUnit: idx === 0,
      priceTiers: (u.priceTiers || []).map((t, tIdx) => ({
        id: t.id || `tier-${prodId}-${idx}-${tIdx}`,
        productId: prodId,
        unitId: u.id || `unit-${prodId}-${idx}`,
        tierName: t.tierName?.trim() || `Grosir ≥ ${t.minQty}`,
        minQty: Number(t.minQty) || 2,
        price: Number(t.price) || 0,
        customerGroup: (t.customerGroup as CustomerGroupType) || "umum",
      })),
    }));

    const prodData: Product = {
      id: prodId,
      name: name.trim(),
      category: category,
      baseUnit: baseUnit.toLowerCase().trim(),
      stockInBaseUnit: Number(initialStock) || 0,
      units: newUnits,
    };

    if (editingProductId) {
      onUpdateProduct(prodData);
    } else {
      onAddProduct(prodData);
    }

    setIsModalOpen(false);
  };


  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === "Semua" || p.category === selectedCategory;
    const matchQuery =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.units.some((u) => u.barcode.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchQuery;
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Katalog Produk & Satuan Bertingkat
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola data barang warung dengan template satuan instan (Bungkus & Slop, Sachet & Renteng, Pcs & Dus).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start flex-wrap">
          {onOpenImportExport && (
            <button
              onClick={() => onOpenImportExport("import_products")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs transition cursor-pointer shadow-2xs active:scale-95"
              title="Import & Ekspor Katalog Produk via Excel/CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import / Ekspor CSV</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Produk Baru</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari barang atau scan barcode..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${selectedCategory === cat
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3.5">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">
            {products.length === 0 ? "Belum Ada Produk di Database" : "Produk Tidak Ditemukan"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            {products.length === 0
              ? "Database Anda masih kosong dan siap diinput manual. Klik tombol di bawah untuk mulai mendaftarkan produk pertama warung Anda."
              : "Tidak ada produk yang cocok dengan pencarian atau kategori ini."}
          </p>
          {products.length === 0 && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk Pertama Manual</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((prod) => (
          <div
            key={prod.id}
            className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    {prod.category}
                  </span>
                  <h3 className="font-bold text-sm text-slate-900">{prod.name}</h3>
                </div>
                {prod.stockInBaseUnit <= 0 ? (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                    Stok Habis (0 {prod.baseUnit})
                  </span>
                ) : prod.stockInBaseUnit <= (prod.minStockAlert || 5) ? (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Menipis: {prod.stockInBaseUnit} {prod.baseUnit}
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Total Stok: {prod.stockInBaseUnit} {prod.baseUnit}
                  </span>
                )}
              </div>

              {/* Units Table */}
              <div className="mt-3 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Satuan Jual & Barcode:
                </span>
                {prod.units.map((unit) => (
                  <div
                    key={unit.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs hover:bg-slate-100/70 transition"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{unit.unitName}</span>
                        {unit.isBaseUnit ? (
                          <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                            Satuan Dasar
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-mono font-semibold">
                            1 {unit.unitName} = {unit.conversionRatio} {prod.baseUnit}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-1">
                        <Barcode className="w-3.5 h-3.5 text-slate-400" />
                        <span className="tracking-wide select-all">{unit.barcode}</span>
                      </div>

                      {/* Info Tier Harga Grosir & Reseller (PRD F3.2) */}
                      {unit.priceTiers && unit.priceTiers.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {unit.priceTiers.map((t, tIdx) => (
                            <span
                              key={t.id || tIdx}
                              className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                t.customerGroup === "reseller"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : t.customerGroup === "langganan"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                              title={`Harga grosir: minimal ${t.minQty} ${unit.unitName}`}
                            >
                              <span className="font-bold">≥{t.minQty}</span>
                              <span>Rp {t.price.toLocaleString("id-ID")}</span>
                              {t.customerGroup && t.customerGroup !== "umum" && (
                                <span className="text-[8px] uppercase font-bold tracking-tight">({t.customerGroup})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900 block text-xs">
                        Rp {unit.price.toLocaleString("id-ID")}
                      </span>
                      {unit.costPrice ? (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Modal: Rp {unit.costPrice.toLocaleString("id-ID")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                Satuan Dasar Buku: <strong className="text-slate-800">{prod.baseUnit}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(prod)}
                  className="px-2.5 py-1 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-semibold flex items-center gap-1 transition cursor-pointer text-xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Ubah</span>
                </button>
                {onDeleteProduct && (
                  <button
                    onClick={() => {
                      if (confirm(`Yakin ingin menghapus ${prod.name}?`)) {
                        onDeleteProduct(prod.id);
                      }
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Hapus Produk"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}

      {/* Modal Tambah / Ubah Produk */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingProductId ? "Ubah Data Produk & Satuan" : "Tambah Produk & Satuan Baru"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Gunakan pilihan cepat di bawah tanpa perlu mengetik manual satu per satu.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* 1-Click Package Templates (Instant Preset) */}
              {!editingProductId && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Pilih Paket Satuan Cepat (Otomatis Isi Semua):
                    </span>
                    <span className="text-[10px] text-amber-700 font-medium">Klik salah satu &darr;</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPackageTemplate("rokok")}
                      className="p-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 text-left transition shadow-2xs group cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-800 block group-hover:text-amber-700">
                        🚬 Paket Rokok
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Bungkus + Slop (10)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPackageTemplate("mie")}
                      className="p-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 text-left transition shadow-2xs group cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-800 block group-hover:text-amber-700">
                        🍜 Paket Mie
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Pcs + Dus (40)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPackageTemplate("kopi")}
                      className="p-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 text-left transition shadow-2xs group cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-800 block group-hover:text-amber-700">
                        ☕ Paket Kopi
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Sachet + Renteng + Dus</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPackageTemplate("minuman")}
                      className="p-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 text-left transition shadow-2xs group cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-800 block group-hover:text-amber-700">
                        🥤 Paket Minuman
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Botol + Dus (24)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPackageTemplate("sabun")}
                      className="p-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 text-left transition shadow-2xs group cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-800 block group-hover:text-amber-700">
                        🧼 Paket Sabun
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Sachet + Renteng (12)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPackageTemplate("ecer")}
                      className="p-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 text-left transition shadow-2xs group cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-800 block group-hover:text-amber-700">
                        📦 Satuan Tunggal
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Hanya 1 Satuan (Pcs)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Nama Produk */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Produk / Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Sampoerna Mild 16, Indomie Goreng, Le Minerale 600ml..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Kategori, Satuan Dasar & Stok Awal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Kategori */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Product["category"])}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  >
                    <option value="Rokok">Rokok</option>
                    <option value="Mie & Sembako">Mie & Sembako</option>
                    <option value="Minuman Dingin">Minuman Dingin</option>
                    <option value="Jajanan & Kopi">Jajanan & Kopi</option>
                    <option value="Gas & Galon">Gas & Galon</option>
                    <option value="Kebutuhan Harian">Kebutuhan Harian</option>
                  </select>
                </div>

                {/* Satuan Dasar (Base Unit) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satuan Terkecil (Dasar)
                  </label>
                  <select
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-semibold"
                  >
                    {BASE_UNIT_PRESETS.map((b) => (
                      <option key={b} value={b}>
                        {b.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stok Awal */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Stok Awal ({baseUnit})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={initialStock}
                    onChange={(e) => setInitialStock(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Units Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Daftar Satuan Jual & Barcode:
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Tiap satuan punya barcode unik dan harga jual sendiri.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddUnitRow}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Satuan</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {units.map((u, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2"
                    >
                      {/* Row 1: Nama Satuan & Pilihan Cepat */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {idx === 0 ? "Satuan Ecer / Terkecil" : "Satuan Bertingkat (Grosir)"}
                          </span>
                        </div>

                        {/* Quick Presets for this unit row */}
                        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                          <span className="text-[10px] text-slate-400 font-medium mr-1">Pilih Cepat:</span>
                          {UNIT_PRESETS.slice(idx === 0 ? 0 : 4, idx === 0 ? 4 : 15).map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => handleApplyUnitPresetToRow(idx, preset)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition cursor-pointer whitespace-nowrap ${u.unitName.includes(preset.name) && u.conversionRatio === preset.ratio
                                  ? "bg-slate-900 text-white border-slate-900"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Row 2: Form Inputs (Termasuk Modal/HPP dan Barcode) */}
                      <div className="grid grid-cols-12 gap-2 items-start text-xs">
                        {/* Nama Satuan */}
                        <div className="col-span-12 sm:col-span-3">
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                            Nama Satuan
                          </label>
                          <input
                            type="text"
                            required
                            value={u.unitName}
                            onChange={(e) => handleUnitChange(idx, "unitName", e.target.value)}
                            placeholder="Contoh: Dus / Slop"
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900"
                          />
                        </div>

                        {/* Rasio Konversi */}
                        <div className="col-span-6 sm:col-span-2">
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                            Isi ({baseUnit})
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            disabled={idx === 0}
                            value={idx === 0 ? 1 : u.conversionRatio}
                            onChange={(e) =>
                              handleUnitChange(idx, "conversionRatio", Number(e.target.value))
                            }
                            className={`w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-mono font-bold ${idx === 0 ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white text-slate-900"
                              }`}
                          />
                        </div>

                        {/* Modal / HPP */}
                        <div className="col-span-6 sm:col-span-2">
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                            Modal HPP (Rp)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={u.costPrice || ""}
                            onChange={(e) => handleUnitChange(idx, "costPrice", Number(e.target.value))}
                            placeholder="Opsional..."
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-700"
                            title="Harga modal beli / kulakan dari agen"
                          />
                        </div>

                        {/* Harga Jual Satuan */}
                        <div className="col-span-6 sm:col-span-2">
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                            Harga Jual (Rp)
                          </label>
                          <input
                            type="number"
                            required
                            min={0}
                            value={u.price}
                            onChange={(e) => handleUnitChange(idx, "price", Number(e.target.value))}
                            placeholder="Harga jual..."
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>

                        {/* Barcode & Generate Button */}
                        <div className="col-span-6 sm:col-span-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] text-slate-500 font-semibold">Barcode</label>
                            <button
                              type="button"
                              onClick={() =>
                                handleUnitChange(idx, "barcode", generateRandomBarcode("899"))
                              }
                              className="text-[9px] text-amber-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                              title="Buat barcode acak jika tidak ada barcode pabrik"
                            >
                              <Zap className="w-2.5 h-2.5" />
                              <span>Acak</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            required
                            value={u.barcode}
                            onChange={(e) => handleUnitChange(idx, "barcode", e.target.value)}
                            placeholder="Scan / ketik..."
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-700"
                          />
                        </div>

                        {/* Delete Unit Row */}
                        <div className="col-span-12 sm:col-span-1 text-center pt-2 sm:pt-4">
                          {units.length > 1 && idx > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveUnitRow(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Hapus Satuan Ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Expandable Section: Harga Bertingkat & Grosir (PRD F3.2) */}
                      <div className="mt-2 pt-2 border-t border-slate-200/60">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleToggleTierExpand(idx)}
                            className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-amber-800 transition cursor-pointer"
                          >
                            <Tag className="w-3.5 h-3.5 text-amber-600" />
                            <span>Harga Bertingkat & Grosir</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition ${
                                (u.priceTiers || []).length > 0
                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                  : "bg-slate-200/80 text-slate-600"
                              }`}
                            >
                              {(u.priceTiers || []).length} Tier
                            </span>
                            {expandedTiers[idx] ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>

                          {!expandedTiers[idx] && (u.priceTiers || []).length > 0 && (
                            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                              Termurah: Rp {Math.min(...(u.priceTiers || []).map((t) => t.price)).toLocaleString("id-ID")}
                            </span>
                          )}
                        </div>

                        {/* Panel Pengaturan Tier Grosir */}
                        {expandedTiers[idx] && (
                          <div className="mt-2.5 p-3 rounded-xl bg-white border border-amber-200/80 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
                              <span>
                                Atur harga diskon untuk pembelian partai banyak (grosir) atau kelompok khusus reseller:
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAddTier(idx, { minQty: 6, tierName: "Grosir ≥ 6", price: Math.max(0, Math.round(u.price * 0.95)), customerGroup: "umum" })}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
                                  title="Preset cepat: Grosir 6 pcs (diskon 5%)"
                                >
                                  + Grosir ≥ 6 (-5%)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddTier(idx, { minQty: 12, tierName: "Grosir Lusin", price: Math.max(0, Math.round(u.price * 0.9)), customerGroup: "umum" })}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
                                  title="Preset cepat: Grosir 12 pcs (diskon 10%)"
                                >
                                  + Grosir Lusin (-10%)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddTier(idx, { minQty: 5, tierName: "Khusus Reseller", price: Math.max(0, Math.round(u.price * 0.88)), customerGroup: "reseller" })}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 transition cursor-pointer"
                                  title="Preset cepat: Khusus pelanggan Reseller"
                                >
                                  + Reseller (-12%)
                                </button>
                              </div>
                            </div>

                            {/* Daftar Baris Tier */}
                            {(u.priceTiers || []).length === 0 ? (
                              <div className="py-4 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                                <span>Belum ada tier harga grosir untuk satuan ini.</span>
                                <div className="mt-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleAddTier(idx)}
                                    className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Tambah Tier Grosir Pertama</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {(u.priceTiers || []).map((tier, tIdx) => {
                                  const isBelowCost = u.costPrice > 0 && tier.price < u.costPrice;
                                  return (
                                    <div
                                      key={tIdx}
                                      className={`p-2.5 rounded-xl border text-xs transition ${
                                        isBelowCost
                                          ? "bg-rose-50/60 border-rose-300"
                                          : "bg-slate-50/80 border-slate-200"
                                      }`}
                                    >
                                      <div className="grid grid-cols-12 gap-2 items-center">
                                        {/* Nama Tier */}
                                        <div className="col-span-12 sm:col-span-4">
                                          <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">
                                            Nama Tier Label
                                          </label>
                                          <input
                                            type="text"
                                            value={tier.tierName}
                                            onChange={(e) => handleTierChange(idx, tIdx, "tierName", e.target.value)}
                                            placeholder="Contoh: Grosir Lusinan"
                                            className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800"
                                          />
                                        </div>

                                        {/* Min Qty */}
                                        <div className="col-span-4 sm:col-span-2">
                                          <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">
                                            Min. Qty ({u.unitName})
                                          </label>
                                          <input
                                            type="number"
                                            min={2}
                                            value={tier.minQty}
                                            onChange={(e) => handleTierChange(idx, tIdx, "minQty", Number(e.target.value))}
                                            className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800"
                                          />
                                        </div>

                                        {/* Harga Tier per Satuan */}
                                        <div className="col-span-4 sm:col-span-3">
                                          <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">
                                            Harga Satuan (Rp)
                                          </label>
                                          <input
                                            type="number"
                                            min={0}
                                            value={tier.price}
                                            onChange={(e) => handleTierChange(idx, tIdx, "price", Number(e.target.value))}
                                            className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900"
                                          />
                                        </div>

                                        {/* Tipe Pelanggan */}
                                        <div className="col-span-3 sm:col-span-2">
                                          <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">
                                            Target Pelanggan
                                          </label>
                                          <select
                                            value={tier.customerGroup || "umum"}
                                            onChange={(e) => handleTierChange(idx, tIdx, "customerGroup", e.target.value as CustomerGroupType)}
                                            className="w-full px-1.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-800"
                                          >
                                            <option value="umum">Umum (Semua)</option>
                                            <option value="langganan">Langganan</option>
                                            <option value="reseller">Reseller</option>
                                          </select>
                                        </div>

                                        {/* Hapus Tier */}
                                        <div className="col-span-1 text-right pt-2 sm:pt-4">
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveTier(idx, tIdx)}
                                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                            title="Hapus Tier Ini"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Peringatan di bawah HPP (PRD F3.5) */}
                                      {isBelowCost && (
                                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-600 font-semibold">
                                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                          <span>
                                            Peringatan: Harga jual grosir Rp {tier.price.toLocaleString("id-ID")} berada di bawah modal HPP (Rp {u.costPrice.toLocaleString("id-ID")})!
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                <button
                                  type="button"
                                  onClick={() => handleAddTier(idx)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Tambah Baris Tier Lain</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shadow-md active:scale-95"
                >
                  {editingProductId ? "Simpan Perubahan" : "Simpan Produk & Satuan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
