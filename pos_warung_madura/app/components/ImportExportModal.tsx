import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Users,
  Package,
  Layers,
  ArrowRight,
  Database,
  Info,
  DollarSign,
  Boxes,
} from "lucide-react";
import type {
  ValidatedProductRow,
  ProductImportValidationError,
  ValidatedCustomerRow,
  CustomerImportValidationError,
} from "../services/import-export.server";

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductsImported?: () => void;
  onCustomersImported?: () => void;
  initialTab?: "import_products" | "import_customers" | "export_data";
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  onProductsImported,
  onCustomersImported,
  initialTab = "import_products",
}) => {
  const [activeTab, setActiveTab] = useState<"import_products" | "import_customers" | "export_data">(initialTab);

  // States untuk Impor Produk
  const [productFile, setProductFile] = useState<File | null>(null);
  const [isAnalyzingProducts, setIsAnalyzingProducts] = useState(false);
  const [productValidRows, setProductValidRows] = useState<ValidatedProductRow[]>([]);
  const [productErrorRows, setProductErrorRows] = useState<ProductImportValidationError[]>([]);
  const [productDuplicateCount, setProductDuplicateCount] = useState(0);
  const [productDuplicateAction, setProductDuplicateAction] = useState<"skip" | "update" | "create_new">("update");
  const [isCommittingProducts, setIsCommittingProducts] = useState(false);
  const [productImportSuccessMsg, setProductImportSuccessMsg] = useState<string | null>(null);

  // States untuk Impor Pelanggan
  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [isAnalyzingCustomers, setIsAnalyzingCustomers] = useState(false);
  const [customerValidRows, setCustomerValidRows] = useState<ValidatedCustomerRow[]>([]);
  const [customerErrorRows, setCustomerErrorRows] = useState<CustomerImportValidationError[]>([]);
  const [customerDuplicateCount, setCustomerDuplicateCount] = useState(0);
  const [customerDuplicateAction, setCustomerDuplicateAction] = useState<"skip" | "update" | "create_new">("update");
  const [isCommittingCustomers, setIsCommittingCustomers] = useState(false);
  const [customerImportSuccessMsg, setCustomerImportSuccessMsg] = useState<string | null>(null);

  const productFileInputRef = useRef<HTMLInputElement>(null);
  const customerFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // Handler Unggah & Preview CSV Produk
  // -------------------------------------------------------------
  const handleProductFileSelected = async (file: File) => {
    setProductFile(file);
    setProductImportSuccessMsg(null);
    setIsAnalyzingProducts(true);
    setProductValidRows([]);
    setProductErrorRows([]);
    setProductDuplicateCount(0);

    try {
      const text = await file.text();
      const res = await fetch("/api/data-io", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_products",
          csvContent: text,
        }),
      });

      const data = await res.json();
      if (data.ok && data.preview) {
        setProductValidRows(data.preview.validRows || []);
        setProductErrorRows(data.preview.errorRows || []);
        setProductDuplicateCount(data.preview.duplicateCount || 0);
      } else {
        alert(data.error || "Gagal memproses berkas CSV produk.");
      }
    } catch (err: any) {
      alert("Terjadi kesalahan saat membaca file: " + err.message);
    } finally {
      setIsAnalyzingProducts(false);
    }
  };

  const handleCommitProductImport = async () => {
    if (productValidRows.length === 0) return;
    setIsCommittingProducts(true);

    try {
      const res = await fetch("/api/data-io", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit_products",
          validRows: productValidRows,
          duplicateAction: productDuplicateAction,
        }),
      });

      const data = await res.json();
      if (data.ok && data.result) {
        const { insertedCount, updatedCount, skippedCount } = data.result;
        setProductImportSuccessMsg(
          `Sukses! Berhasil menambahkan ${insertedCount} produk baru, memperbarui ${updatedCount} produk, dan melewati ${skippedCount} baris.`
        );
        setProductValidRows([]);
        setProductErrorRows([]);
        setProductFile(null);
        if (onProductsImported) onProductsImported();
      } else {
        alert("Gagal melakukan impor: " + (data.error || "Terjadi kesalahan server"));
      }
    } catch (err: any) {
      alert("Gagal melakukan impor: " + err.message);
    } finally {
      setIsCommittingProducts(false);
    }
  };

  // -------------------------------------------------------------
  // Handler Unggah & Preview CSV Pelanggan
  // -------------------------------------------------------------
  const handleCustomerFileSelected = async (file: File) => {
    setCustomerFile(file);
    setCustomerImportSuccessMsg(null);
    setIsAnalyzingCustomers(true);
    setCustomerValidRows([]);
    setCustomerErrorRows([]);
    setCustomerDuplicateCount(0);

    try {
      const text = await file.text();
      const res = await fetch("/api/data-io", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_customers",
          csvContent: text,
        }),
      });

      const data = await res.json();
      if (data.ok && data.preview) {
        setCustomerValidRows(data.preview.validRows || []);
        setCustomerErrorRows(data.preview.errorRows || []);
        setCustomerDuplicateCount(data.preview.duplicateCount || 0);
      } else {
        alert(data.error || "Gagal memproses berkas CSV pelanggan.");
      }
    } catch (err: any) {
      alert("Terjadi kesalahan membaca file: " + err.message);
    } finally {
      setIsAnalyzingCustomers(false);
    }
  };

  const handleCommitCustomerImport = async () => {
    if (customerValidRows.length === 0) return;
    setIsCommittingCustomers(true);

    try {
      const res = await fetch("/api/data-io", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit_customers",
          validRows: customerValidRows,
          duplicateAction: customerDuplicateAction,
        }),
      });

      const data = await res.json();
      if (data.ok && data.result) {
        const { insertedCount, updatedCount, skippedCount } = data.result;
        setCustomerImportSuccessMsg(
          `Sukses! Berhasil menambahkan ${insertedCount} pelanggan baru, memperbarui ${updatedCount} pelanggan, dan melewati ${skippedCount} baris.`
        );
        setCustomerValidRows([]);
        setCustomerErrorRows([]);
        setCustomerFile(null);
        if (onCustomersImported) onCustomersImported();
      } else {
        alert("Gagal melakukan impor: " + (data.error || "Terjadi kesalahan server"));
      }
    } catch (err: any) {
      alert("Gagal melakukan impor: " + err.message);
    } finally {
      setIsCommittingCustomers(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Pusat Import & Ekspor Data (Excel / CSV)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Onboarding cepat stok produk, pembukuan saldo awal kasbon, dan pencadangan data offline.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab("import_products")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "import_products"
                ? "bg-white text-indigo-700 border-indigo-600 font-bold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/70"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Impor Katalog Produk</span>
          </button>

          <button
            onClick={() => setActiveTab("import_customers")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "import_customers"
                ? "bg-white text-indigo-700 border-indigo-600 font-bold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/70"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Impor Pelanggan & Kasbon</span>
          </button>

          <button
            onClick={() => setActiveTab("export_data")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "export_data"
                ? "bg-white text-indigo-700 border-indigo-600 font-bold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/70"
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Semua Data (Excel)</span>
          </button>
        </div>

        {/* Konten Tab */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ============================================================== */}
          {/* TAB 1: IMPOR PRODUK */}
          {/* ============================================================== */}
          {activeTab === "import_products" && (
            <div className="space-y-6">
              {/* Notifikasi Berhasil */}
              {productImportSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="flex-1">{productImportSuccessMsg}</div>
                </div>
              )}

              {/* Panduan & Tombol Download Template */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-indigo-950 text-xs flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-600" />
                    <span>Langkah 1: Gunakan Template Resmi Excel/CSV</span>
                  </h4>
                  <p className="text-[11px] text-indigo-800 leading-relaxed max-w-xl">
                    Unduh berkas contoh yang sudah disesuaikan dengan format Warung Madura (Barcode, Kategori,
                    Satuan Dasar, Satuan Tambahan seperti Slop/Dus, Rasio, Harga Beli, Harga Jual, dan Stok Awal).
                  </p>
                </div>

                <a
                  href="/api/data-io?action=template_products"
                  download="template_produk_warung_madura.csv"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template CSV</span>
                </a>
              </div>

              {/* Area Drag and Drop / Pilih Berkas */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800">
                  Langkah 2: Unggah Berkas CSV Produk Anda
                </label>
                <div
                  onClick={() => productFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20 rounded-2xl p-6 text-center transition cursor-pointer group"
                >
                  <input
                    ref={productFileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleProductFileSelected(f);
                    }}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-indigo-100 text-slate-400 group-hover:text-indigo-600 mx-auto flex items-center justify-center transition mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">
                    {productFile ? productFile.name : "Klik untuk memilih berkas CSV atau seret ke sini"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Mendukung berkas CSV dengan pemisah koma (,) atau titik koma (;) khas Excel Indonesia
                  </p>
                </div>
              </div>

              {/* Loading Indikator Analisis */}
              {isAnalyzingProducts && (
                <div className="p-8 text-center space-y-2">
                  <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Menganalisis dan memvalidasi baris berkas CSV...</p>
                </div>
              )}

              {/* Pratinjau Hasil Validasi Baris demi Baris (PRD F10.2) */}
              {(productValidRows.length > 0 || productErrorRows.length > 0) && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Pratinjau Hasil Validasi Data
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        {productValidRows.length} Baris Siap Impor
                      </span>
                      {productDuplicateCount > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold">
                          {productDuplicateCount} Baris Sudah Terdaftar di DB
                        </span>
                      )}
                      {productErrorRows.length > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-bold">
                          {productErrorRows.length} Baris Bermasalah
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Daftar Baris Error dengan Nomor Baris & Alasan (PRD Acceptance Criteria F10) */}
                  {productErrorRows.length > 0 && (
                    <div className="border border-rose-200 bg-rose-50/70 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Baris Bermasalah Ditemukan (Akan Dilewati Otomatis):</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs">
                        {productErrorRows.map((err, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-white border border-rose-200 text-rose-900 flex items-center justify-between gap-3"
                          >
                            <span className="font-mono font-bold text-[11px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md">
                              Baris {err.rowNumber}
                            </span>
                            <span className="font-semibold truncate flex-1">{err.name}</span>
                            <span className="text-[11px] text-rose-700 italic">{err.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Konfigurasi Penanganan Duplikat & Tombol Eksekusi (PRD F10.3 & F10.4) */}
                  {productValidRows.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-800">
                          Langkah 3: Opsi Penanganan Data Duplikat (Barcode / Nama Sama di DB)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label
                            className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                              productDuplicateAction === "update"
                                ? "bg-white border-indigo-600 shadow-2xs font-semibold text-indigo-950"
                                : "bg-white/50 border-slate-200 text-slate-600 hover:bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name="prod_dup_action"
                              value="update"
                              checked={productDuplicateAction === "update"}
                              onChange={() => setProductDuplicateAction("update")}
                              className="mt-0.5"
                            />
                            <div>
                              <div className="font-bold">Perbarui (Update)</div>
                              <div className="text-[10px] text-slate-500">
                                Perbarui harga beli, harga jual, dan stok pada produk yang sudah ada.
                              </div>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                              productDuplicateAction === "skip"
                                ? "bg-white border-indigo-600 shadow-2xs font-semibold text-indigo-950"
                                : "bg-white/50 border-slate-200 text-slate-600 hover:bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name="prod_dup_action"
                              value="skip"
                              checked={productDuplicateAction === "skip"}
                              onChange={() => setProductDuplicateAction("skip")}
                              className="mt-0.5"
                            />
                            <div>
                              <div className="font-bold">Lewati (Skip)</div>
                              <div className="text-[10px] text-slate-500">
                                Jangan ubah produk yang sudah ada di database, hanya masukkan barang baru.
                              </div>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                              productDuplicateAction === "create_new"
                                ? "bg-white border-indigo-600 shadow-2xs font-semibold text-indigo-950"
                                : "bg-white/50 border-slate-200 text-slate-600 hover:bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name="prod_dup_action"
                              value="create_new"
                              checked={productDuplicateAction === "create_new"}
                              onChange={() => setProductDuplicateAction("create_new")}
                              className="mt-0.5"
                            />
                            <div>
                              <div className="font-bold">Buat Baru (Duplikasi)</div>
                              <div className="text-[10px] text-slate-500">
                                Simpan sebagai produk baru dengan nomor barcode otomatis.
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Tombol Eksekusi Atomik */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <div className="text-[11px] text-slate-500">
                          Eksekusi dijalankan dalam 1 transaksi atomik MySQL (aman dari kegagalan parsial).
                        </div>
                        <button
                          onClick={handleCommitProductImport}
                          disabled={isCommittingProducts}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isCommittingProducts ? "animate-spin" : ""}`} />
                          <span>
                            {isCommittingProducts
                              ? "Memproses Database..."
                              : `Impor Sekarang (${productValidRows.length} Produk)`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: IMPOR PELANGGAN & SALDO KASBON AWAL */}
          {/* ============================================================== */}
          {activeTab === "import_customers" && (
            <div className="space-y-6">
              {/* Notifikasi Berhasil */}
              {customerImportSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="flex-1">{customerImportSuccessMsg}</div>
                </div>
              )}

              {/* Panduan & Tombol Download Template */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-indigo-950 text-xs flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-600" />
                    <span>Langkah 1: Gunakan Template CSV Pelanggan & Utang</span>
                  </h4>
                  <p className="text-[11px] text-indigo-800 leading-relaxed max-w-xl">
                    Unduh format resmi untuk memasukkan daftar pelanggan warung, nomor kontak WhatsApp, limit kasbon,
                    serta <strong>Saldo Utang Awal</strong> yang otomatis dibukukan ke buku besar kasbon (PRD F10.6).
                  </p>
                </div>

                <a
                  href="/api/data-io?action=template_customers"
                  download="template_pelanggan_warung_madura.csv"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template CSV</span>
                </a>
              </div>

              {/* Area Drag and Drop Pelanggan */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800">
                  Langkah 2: Unggah Berkas CSV Pelanggan
                </label>
                <div
                  onClick={() => customerFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20 rounded-2xl p-6 text-center transition cursor-pointer group"
                >
                  <input
                    ref={customerFileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCustomerFileSelected(f);
                    }}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-indigo-100 text-slate-400 group-hover:text-indigo-600 mx-auto flex items-center justify-center transition mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">
                    {customerFile ? customerFile.name : "Klik untuk memilih berkas CSV pelanggan atau seret ke sini"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Format: Nama, No HP, Alamat, Grup (Umum/Langganan/Reseller), Limit, Saldo Utang Awal
                  </p>
                </div>
              </div>

              {/* Loading Indikator Analisis */}
              {isAnalyzingCustomers && (
                <div className="p-8 text-center space-y-2">
                  <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Menganalisis berkas CSV pelanggan...</p>
                </div>
              )}

              {/* Pratinjau Hasil Validasi Pelanggan */}
              {(customerValidRows.length > 0 || customerErrorRows.length > 0) && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Pratinjau Hasil Validasi Pelanggan
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        {customerValidRows.length} Pelanggan Valid
                      </span>
                      {customerDuplicateCount > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold">
                          {customerDuplicateCount} Nama Sudah Ada
                        </span>
                      )}
                      {customerErrorRows.length > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-bold">
                          {customerErrorRows.length} Baris Error
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Error List */}
                  {customerErrorRows.length > 0 && (
                    <div className="border border-rose-200 bg-rose-50/70 rounded-2xl p-4 space-y-2">
                      <div className="font-bold text-xs text-rose-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Baris Bermasalah:</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs">
                        {customerErrorRows.map((err, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-white border border-rose-200 text-rose-900 flex items-center justify-between gap-3"
                          >
                            <span className="font-mono font-bold text-[11px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md">
                              Baris {err.rowNumber}
                            </span>
                            <span className="font-semibold">{err.name}</span>
                            <span className="text-[11px] text-rose-700 italic">{err.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action & Commit Pelanggan */}
                  {customerValidRows.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-800">
                          Opsi Pelanggan dengan Nama yang Sudah Ada
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label
                            className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                              customerDuplicateAction === "update"
                                ? "bg-white border-indigo-600 shadow-2xs font-semibold text-indigo-950"
                                : "bg-white/50 border-slate-200 text-slate-600 hover:bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name="cust_dup_action"
                              value="update"
                              checked={customerDuplicateAction === "update"}
                              onChange={() => setCustomerDuplicateAction("update")}
                              className="mt-0.5"
                            />
                            <div>
                              <div className="font-bold">Perbarui Data Pelanggan</div>
                              <div className="text-[10px] text-slate-500">
                                Perbarui nomor HP, alamat, dan tambahkan saldo utang awal jika ada.
                              </div>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                              customerDuplicateAction === "skip"
                                ? "bg-white border-indigo-600 shadow-2xs font-semibold text-indigo-950"
                                : "bg-white/50 border-slate-200 text-slate-600 hover:bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name="cust_dup_action"
                              value="skip"
                              checked={customerDuplicateAction === "skip"}
                              onChange={() => setCustomerDuplicateAction("skip")}
                              className="mt-0.5"
                            />
                            <div>
                              <div className="font-bold">Lewati (Hanya Tambah Baru)</div>
                              <div className="text-[10px] text-slate-500">
                                Lewati nama yang sudah ada di database pelanggan.
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <div className="text-[11px] text-slate-500">
                          Saldo utang awal otomatis dicatat sebagai piutang terbuka (PRD F10.6).
                        </div>
                        <button
                          onClick={handleCommitCustomerImport}
                          disabled={isCommittingCustomers}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isCommittingCustomers ? "animate-spin" : ""}`} />
                          <span>
                            {isCommittingCustomers
                              ? "Menyimpan Data..."
                              : `Impor Sekarang (${customerValidRows.length} Pelanggan)`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: EKSPOR DATA LENGKAP (EXCEL / CSV UTF-8 BOM) */}
          {/* ============================================================== */}
          {activeTab === "export_data" && (
            <div className="space-y-6">
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs text-emerald-900">
                  <span className="font-bold">Kompatibilitas Penuh Microsoft Excel:</span> Semua berkas ekspor
                  disertai UTF-8 BOM sehingga langsung menampilkan teks, barcode, dan angka desimal secara rapi tanpa
                  karakter aneh.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Ekspor Katalog Produk */}
                <div className="border border-slate-200 hover:border-slate-300 rounded-2xl p-4.5 bg-white shadow-2xs flex flex-col justify-between gap-4 transition">
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Katalog Produk & Satuan</h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Seluruh master produk, multi-satuan kemasan, barcode, harga modal, harga jual, dan stok terkini.
                      </p>
                    </div>
                  </div>
                  <a
                    href="/api/data-io?action=export_products"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh CSV Produk</span>
                  </a>
                </div>

                {/* 2. Ekspor Pelanggan & Kasbon */}
                <div className="border border-slate-200 hover:border-slate-300 rounded-2xl p-4.5 bg-white shadow-2xs flex flex-col justify-between gap-4 transition">
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Pelanggan & Buku Kasbon</h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Data pelanggan, kontak WhatsApp, limit kredit, dan total saldo utang kasbon berjalan saat ini.
                      </p>
                    </div>
                  </div>
                  <a
                    href="/api/data-io?action=export_customers"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh CSV Kasbon</span>
                  </a>
                </div>

                {/* 3. Ekspor Riwayat Transaksi */}
                <div className="border border-slate-200 hover:border-slate-300 rounded-2xl p-4.5 bg-white shadow-2xs flex flex-col justify-between gap-4 transition">
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Riwayat Transaksi Penjualan</h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Seluruh nota transaksi, kasir, pelanggan, metode bayar (Tunai/QRIS/Kasbon), diskon, dan total nota.
                      </p>
                    </div>
                  </div>
                  <a
                    href="/api/data-io?action=export_sales"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh CSV Riwayat</span>
                  </a>
                </div>

                {/* 4. Ekspor Rekap Nilai Aset Stok */}
                <div className="border border-slate-200 hover:border-slate-300 rounded-2xl p-4.5 bg-white shadow-2xs flex flex-col justify-between gap-4 transition">
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Rekap Nilai Aset Stok Persediaan</h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Jumlah fisik barang, estimasi harga modal (HPP), batas minimun, dan total nilai aset persediaan.
                      </p>
                    </div>
                  </div>
                  <a
                    href="/api/data-io?action=export_stock"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh CSV Nilai Stok</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="text-[11px] text-slate-400">
            PRD F10 • Import dan Ekspor Data Offline-First
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
