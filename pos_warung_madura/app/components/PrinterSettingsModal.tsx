import React, { useState, useEffect } from "react";
import {
  Printer,
  X,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Scissors,
  DollarSign,
  Copy,
  Phone,
  FileText,
  Wifi,
  Monitor,
  Sparkles,
  Eye,
  Info,
  Download,
} from "lucide-react";

interface WindowsPrinter {
  name: string;
  isDefault: boolean;
  portName: string;
}

interface PrinterSettingsData {
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

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const PrinterSettingsModal: React.FC<PrinterSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [printers, setPrinters] = useState<WindowsPrinter[]>([]);
  const [settings, setSettings] = useState<PrinterSettingsData>({
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
  });

  const [testStatus, setTestStatus] = useState<{
    type: "success" | "error" | "loading";
    message: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [showTestPreview, setShowTestPreview] = useState(false);

  const isVirtualPrinter = (name: string) => {
    const lower = (name || "").toLowerCase();
    return (
      lower.includes("microsoft print to pdf") ||
      lower.includes("print to pdf") ||
      lower.includes("xps document writer") ||
      lower.includes("onenote") ||
      lower.includes("fax")
    );
  };

  // Ambil daftar printer & settings dari API
  const fetchPrinterData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/printer");
      const json = await res.json();
      if (json.ok) {
        if (json.printers) setPrinters(json.printers);
        if (json.settings) {
          setSettings(json.settings);
          // Jika printerName belum dipilih, pilih default printer jika ada
          if (!json.settings.printerName && json.printers.length > 0) {
            const def = json.printers.find((p: WindowsPrinter) => p.isDefault) || json.printers[0];
            setSettings((prev) => ({ ...prev, printerName: def.name }));
          }
        }
      }
    } catch (e: any) {
      console.warn("Gagal memuat printer:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPrinterData();
      setTestStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("intent", "save_settings");
      fd.append("printer_type", settings.printerType);
      fd.append("printer_name", settings.printerName);
      fd.append("network_ip", settings.networkIp);
      fd.append("network_port", String(settings.networkPort));
      fd.append("paper_width", String(settings.paperWidth));
      fd.append("auto_print", settings.autoPrint ? "1" : "0");
      fd.append("auto_cut", settings.autoCut ? "1" : "0");
      fd.append("cash_drawer", settings.openCashDrawer ? "1" : "0");
      fd.append("copies", String(settings.copies));
      fd.append("store_phone", settings.storePhone);
      fd.append("custom_footer", settings.customFooter);

      const res = await fetch("/api/printer", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();

      if (json.ok) {
        setTestStatus({
          type: "success",
          message: "Pengaturan printer berhasil disimpan!",
        });
        if (onSettingsSaved) onSettingsSaved();
        setTimeout(() => setTestStatus(null), 3000);
      } else {
        setTestStatus({
          type: "error",
          message: json.message || "Gagal menyimpan pengaturan.",
        });
      }
    } catch (err: any) {
      setTestStatus({
        type: "error",
        message: err.message || "Gagal menghubungi server printer.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRunTestPrint = async () => {
    if (settings.printerType === "browser") {
      setShowTestPreview(true);
      return;
    }

    if (settings.printerType === "windows" && isVirtualPrinter(settings.printerName)) {
      setTestStatus({
        type: "error",
        message: `'${settings.printerName}' adalah printer virtual Windows, bukan printer thermal kasir (ESC/POS). Driver PDF Windows tidak mendukung data biner RAW printer thermal (akan menghasilkan file .pdf rusak). Gunakan tombol 'Pratinjau / Simpan PDF' di sebelah kiri untuk melihat dan mencetak PDF yang valid.`,
      });
      return;
    }

    try {
      setTestStatus({ type: "loading", message: "Sedang mengirim tes cetak..." });
      const fd = new FormData();
      fd.append("intent", "test_print");
      fd.append("paper_width", String(settings.paperWidth));
      fd.append("printer_name", settings.printerName);
      fd.append("printer_type", settings.printerType);

      const res = await fetch("/api/printer", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();

      if (json.ok) {
        setTestStatus({
          type: "success",
          message: json.message || "Tes cetak berhasil dikirim ke printer!",
        });
      } else {
        setTestStatus({
          type: "error",
          message: json.message || "Gagal melakukan tes cetak.",
        });
      }
    } catch (err: any) {
      setTestStatus({
        type: "error",
        message: err.message || "Terjadi kesalahan koneksi ke printer.",
      });
    }
  };

  const handleOpenCashDrawer = async () => {
    try {
      setTestStatus({ type: "loading", message: "Mengirim sinyal buka laci..." });
      const fd = new FormData();
      fd.append("intent", "open_cash_drawer");

      const res = await fetch("/api/printer", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();

      if (json.ok) {
        setTestStatus({
          type: "success",
          message: json.message || "Perintah buka laci uang terkirim!",
        });
      } else {
        setTestStatus({
          type: "error",
          message: json.message || "Gagal membuka laci kasir.",
        });
      }
    } catch (err: any) {
      setTestStatus({
        type: "error",
        message: err.message || "Terjadi kesalahan saat memicu laci kasir.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight flex items-center gap-2">
                Pengaturan Printer Thermal ESC/POS
                <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  F9 PRD
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Hubungkan printer kasir 58mm / 80mm untuk cetak struk nota instan & potong kertas otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Toast */}
        {testStatus && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between transition-all ${
              testStatus.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
                : testStatus.type === "error"
                ? "bg-rose-50 text-rose-800 border-b border-rose-200"
                : "bg-amber-50 text-amber-800 border-b border-amber-200"
            }`}
          >
            <span className="flex items-center gap-2">
              {testStatus.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {testStatus.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-600" />}
              {testStatus.type === "loading" && <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />}
              {testStatus.message}
            </span>
            <button
              onClick={() => setTestStatus(null)}
              className="text-[10px] opacity-70 hover:opacity-100 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-slate-800 text-sm">
          {/* 1. Tipe Koneksi Printer */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              1. Jalur Koneksi Printer
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, printerType: "windows" }))}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  settings.printerType === "windows"
                    ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold shadow-xs"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs">USB / Windows Driver</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal leading-tight">
                  Kabel USB langsung via Windows Print Spooler (Rekomendasi).
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, printerType: "network" }))}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  settings.printerType === "network"
                    ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold shadow-xs"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs">Jaringan (LAN / Wi-Fi)</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal leading-tight">
                  Kabel LAN atau Wi-Fi langsung ke IP port 9100.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, printerType: "browser" }))}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  settings.printerType === "browser"
                    ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold shadow-xs"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs">Dialog Browser</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal leading-tight">
                  Gunakan jendela cetak sistem (Ctrl+P standar).
                </span>
              </button>
            </div>
          </div>

          {/* 2. Pemilihan Target Printer */}
          {settings.printerType === "windows" && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  Pilih Printer Windows yang Terpasang
                </label>
                <button
                  type="button"
                  onClick={fetchPrinterData}
                  disabled={loading}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                  Segarkan Daftar
                </button>
              </div>

              {printers.length > 0 ? (
                <>
                  <select
                    value={settings.printerName}
                    onChange={(e) => setSettings((s) => ({ ...s, printerName: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} {p.isDefault ? "★ (Default Windows)" : ""}
                      </option>
                    ))}
                  </select>

                  {isVirtualPrinter(settings.printerName) && (
                    <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-900 text-xs space-y-1.5 animate-fadeIn">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <Info className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Printer Virtual Terdeteksi: {settings.printerName}</span>
                      </div>
                      <p className="text-[11px] text-amber-800/90 leading-relaxed">
                        Printer ini bukan printer thermal kasir fisik. Mengirim perintah cetak biner RAW langsung ke driver PDF Windows akan menghasilkan file <code>.pdf</code> yang <b>rusak / tidak bisa dibuka</b> (karena driver PDF mengharapkan grafis dokumen, bukan kontrol teks thermal POS).
                      </p>
                      <div className="pt-1 flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setShowTestPreview(true)}
                          className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Buka Pratinjau & Simpan PDF Asli</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, printerType: "browser" }))}
                          className="text-xs text-amber-800 hover:underline font-semibold cursor-pointer"
                        >
                          Pindah ke Mode "Dialog Browser"
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                  Tidak ditemukan printer yang terpasang di Windows. Pastikan kabel printer USB sudah tercolok dan driver printer terinstal.
                </div>
              )}
            </div>
          )}

          {settings.printerType === "network" && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat IP Printer
                </label>
                <input
                  type="text"
                  value={settings.networkIp}
                  onChange={(e) => setSettings((s) => ({ ...s, networkIp: e.target.value }))}
                  placeholder="192.168.1.200"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Port RAW (Default: 9100)
                </label>
                <input
                  type="number"
                  value={settings.networkPort}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, networkPort: parseInt(e.target.value, 10) || 9100 }))
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* 3. Lebar Kertas Struk (PRD F9.1: 58mm vs 80mm) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              2. Lebar Kertas Struk Thermal
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, paperWidth: 58 }))}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
                  settings.paperWidth === 58
                    ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold shadow-xs"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-medium"
                }`}
              >
                <div>
                  <div className="text-xs">Lebar 58 mm (32 Kolom)</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Standar printer struk warung & bluetooth portabel
                  </div>
                </div>
                {settings.paperWidth === 58 && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, paperWidth: 80 }))}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
                  settings.paperWidth === 80
                    ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold shadow-xs"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-medium"
                }`}
              >
                <div>
                  <div className="text-xs">Lebar 80 mm (48 Kolom)</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Format lebar minimarket, cetak item lebih leluasa
                  </div>
                </div>
                {settings.paperWidth === 80 && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
              </button>
            </div>
          </div>

          {/* 4. Fitur Otomasi & Hardware (PRD F9.2, F9.5) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              3. Otomatisasi Kasir & Perangkat Keras
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Auto Print */}
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoPrint}
                  onChange={(e) => setSettings((s) => ({ ...s, autoPrint: e.target.checked }))}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Cetak Otomatis (Auto-Print)
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    Langsung mencetak struk thermal saat tombol bayar ditekan
                  </div>
                </div>
              </label>

              {/* Auto Cut */}
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoCut}
                  onChange={(e) => setSettings((s) => ({ ...s, autoCut: e.target.checked }))}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-indigo-500" />
                    Potong Kertas Otomatis
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    Perintah autocutter (feed & cut) di akhir nota
                  </div>
                </div>
              </label>

              {/* Cash Drawer Kick */}
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.openCashDrawer}
                  onChange={(e) => setSettings((s) => ({ ...s, openCashDrawer: e.target.checked }))}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    Buka Laci Uang Kasir
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    Kirim sinyal pulse buka laci uang untuk pembayaran tunai
                  </div>
                </div>
              </label>

              {/* Salinan Struk */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5 text-blue-500" />
                    Jumlah Salinan
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    Rangkap cetak per transaksi
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, copies: 1 }))}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold cursor-pointer transition ${
                      settings.copies === 1
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    1
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, copies: 2 }))}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold cursor-pointer transition ${
                      settings.copies === 2
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    2
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Teks Header & Footer Struk (PRD F9.3) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              4. Informasi Kontak & Pesan Nota
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  Nomor HP / WhatsApp Toko
                </label>
                <input
                  type="text"
                  value={settings.storePhone}
                  onChange={(e) => setSettings((s) => ({ ...s, storePhone: e.target.value }))}
                  placeholder="0812-3456-7890"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-400" />
                  Pesan Kaki Struk (Footer)
                </label>
                <input
                  type="text"
                  value={settings.customFooter}
                  onChange={(e) => setSettings((s) => ({ ...s, customFooter: e.target.value }))}
                  placeholder="Matur Sembah Nuwun! Buka 24 Jam Non-Stop"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunTestPrint}
              disabled={loading || saving}
              className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              Uji Cetak (Test Print)
            </button>

            <button
              type="button"
              onClick={() => setShowTestPreview(true)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-white text-slate-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Pratinjau tampilan struk kertas dan simpan sebagai file PDF resmi yang valid"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>Pratinjau / Simpan PDF</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCashDrawer}
              disabled={loading || saving}
              className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              Tes Buka Laci
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simpan Pengaturan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Pratinjau Struk Uji Virtual (Cocok untuk yang belum punya printer thermal fisik) */}
        {showTestPreview && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-4">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-900 text-white">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-xs font-bold block">Pratinjau Struk Thermal Virtual</span>
                    <span className="text-[10px] text-slate-300">Format Kertas: {settings.paperWidth} mm</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTestPreview(false)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 bg-slate-100 flex justify-center max-h-[65vh] overflow-y-auto">
                <div
                  id="printable-test-receipt"
                  className={`receipt-paper text-slate-900 rounded-2xl p-5 shadow-xs font-mono text-xs border border-slate-200 bg-white ${
                    settings.paperWidth === 80 ? "w-full max-w-[80mm]" : "w-full max-w-[58mm]"
                  }`}
                >
                  <div className="text-center pb-2.5 border-b border-dashed border-slate-300">
                    <h4 className="font-black text-sm tracking-wider uppercase text-slate-900">
                      WARUNG MADURA BERKAH
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Buka 24 Jam Non-Stop &bull; Madura
                    </p>
                    <p className="text-[9px] text-slate-400">
                      Jl. Raya Warung Madura No. 24
                    </p>
                    <p className="text-[9px] text-slate-400">
                      Telp: {settings.storePhone}
                    </p>
                  </div>

                  <div className="py-2.5 border-b border-dashed border-slate-300 text-[10px] space-y-1">
                    <div className="text-center font-bold text-emerald-700 bg-emerald-50 py-1 rounded border border-emerald-200">
                      UJI CETAK STRUK THERMAL
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Waktu Uji:</span>
                      <span>{new Date().toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Format Kertas:</span>
                      <span className="font-bold">{settings.paperWidth} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tipe Driver:</span>
                      <span>{settings.printerType.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status Sistem:</span>
                      <span className="text-emerald-600 font-bold">TERKONEKSI OK</span>
                    </div>
                  </div>

                  <div className="py-2.5 border-b border-dashed border-slate-300 text-[10px] space-y-1">
                    <div className="text-slate-500 font-semibold">Uji Karakter Standar:</div>
                    <div className="font-mono text-[9px] tracking-widest text-slate-700">
                      ABCDEFGHIJKLMNOPQRSTUVWXYZ
                    </div>
                    <div className="font-mono text-[9px] tracking-widest text-slate-700">
                      0123456789 !@#$%^&*()
                    </div>
                    <div className="pt-1 font-bold text-slate-900">
                      Uji Gaya Font Tebal (Bold): PASSED
                    </div>
                  </div>

                  <div className="pt-3 text-center space-y-1">
                    <p className="text-[10px] text-slate-800 font-bold">
                      {settings.customFooter}
                    </p>
                    <p className="text-[8px] text-slate-400">
                      Simpan file PDF ini atau cetak sebagai bukti tes nota yang sah
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowTestPreview(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Cetak struk ke printer atau simpan sebagai PDF resmi (Ctrl+P)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Simpan PDF / Cetak (Ctrl+P)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
