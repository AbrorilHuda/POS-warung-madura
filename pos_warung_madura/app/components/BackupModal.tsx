import React, { useState, useEffect, useRef } from "react";
import {
  Database,
  HardDrive,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Lock,
  FileArchive,
  X,
  Trash2,
  FileText,
  ArrowRight,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { BackupMetadata, BackupStatus, InspectBackupResult } from "../services/backup.server";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose, onRefreshData }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // State pembuatan backup
  const [useEncryption, setUseEncryption] = useState(false);
  const [passphrase, setPassphrase] = useState("");

  // State restore wizard
  const [selectedFileForRestore, setSelectedFileForRestore] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<InspectBackupResult | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // State upload file
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State lokasi direktori penyimpanan custom
  const [customDirectory, setCustomDirectory] = useState("");
  const [isEditingDirectory, setIsEditingDirectory] = useState(false);
  const [savingDirectory, setSavingDirectory] = useState(false);

  // Ambil data status dan list backup
  const loadBackups = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backup");
      const data = await res.json();
      if (data.ok) {
        setStatus(data.status);
        setBackups(data.backups || []);
        if (data.status?.backupDir) {
          setCustomDirectory(data.status.backupDir);
        }
      }
    } catch (err: any) {
      console.error("Gagal mengambil data backup:", err);
      setMessage({ type: "error", text: "Gagal menghubungkan ke service backup" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDirectory = async (dirToSave?: string) => {
    const target = dirToSave || customDirectory;
    if (!target.trim()) return;

    try {
      setSavingDirectory(true);
      setMessage(null);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_directory", target_directory: target }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: data.message || "Lokasi backup berhasil diperbarui!" });
        setStatus(data.status);
        setBackups(data.backups || []);
        setIsEditingDirectory(false);
      } else {
        setMessage({ type: "error", text: data.error || "Gagal mengubah lokasi direktori" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal menghubungi server" });
    } finally {
      setSavingDirectory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBackups();
      setMessage(null);
      setSelectedFileForRestore(null);
      setInspectData(null);
      setIsConfirmingRestore(false);
    }
  }, [isOpen]);

  // Eksekusi Backup 1-Klik (PRD T3.3)
  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          passphrase: useEncryption ? passphrase : "",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: `Backup berhasil dibuat: ${data.backup?.filename}` });
        setPassphrase("");
        setUseEncryption(false);
        await loadBackups();
      } else {
        setMessage({ type: "error", text: data.error || "Gagal membuat backup" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Terjadi kesalahan koneksi" });
    } finally {
      setLoading(false);
    }
  };

  // Uji / Inspect file backup sebelum restore (PRD T3.4 & T3.6)
  const handleInspectBackup = async (filename: string) => {
    try {
      setInspecting(true);
      setSelectedFileForRestore(filename);
      setInspectData(null);
      setIsConfirmingRestore(false);
      setMessage(null);

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "inspect",
          filename,
          passphrase: restorePassphrase,
        }),
      });
      const data = await res.json();
      if (data.ok && data.inspect) {
        setInspectData(data.inspect);
      } else {
        setMessage({ type: "error", text: data.error || "File backup tidak valid atau gagal dibaca" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memeriksa file backup" });
    } finally {
      setInspecting(false);
    }
  };

  // Eksekusi Restore dengan Safety Snapshot (PRD T3.4)
  const handleExecuteRestore = async () => {
    if (!selectedFileForRestore) return;
    try {
      setRestoring(true);
      setMessage(null);

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          filename: selectedFileForRestore,
          passphrase: restorePassphrase,
        }),
      });
      const data = await res.json();
      if (data.ok && data.result?.success) {
        setMessage({
          type: "success",
          text: `${data.result.message} (Safety snapshot tersimpan: ${data.result.safetyBackupFile || "-"})`,
        });
        setIsConfirmingRestore(false);
        setSelectedFileForRestore(null);
        setInspectData(null);
        await loadBackups();
        if (onRefreshData) onRefreshData();
      } else {
        setMessage({ type: "error", text: data.error || "Gagal memulihkan database" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Terjadi kesalahan saat memulihkan database" });
    } finally {
      setRestoring(false);
    }
  };

  // Upload file backup manual (.sql / .sql.gz)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setMessage(null);

      const fd = new FormData();
      fd.append("action", "upload");
      fd.append("backup_file", file);

      const res = await fetch("/api/backup", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (data.ok) {
        setMessage({ type: "success", text: data.message || `File '${file.name}' berhasil diunggah!` });
        await loadBackups();
      } else {
        setMessage({ type: "error", text: data.error || "Gagal mengunggah file backup" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal mengunggah berkas" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Hapus berkas backup
  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Hapus file backup '${filename}' dari penyimpanan laptop?`)) return;

    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", filename }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "info", text: data.message || `File '${filename}' berhasil dihapus` });
        await loadBackups();
        if (selectedFileForRestore === filename) {
          setSelectedFileForRestore(null);
          setInspectData(null);
        }
      } else {
        setMessage({ type: "error", text: data.error || "Gagal menghapus file" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal menghapus file" });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight flex items-center gap-2">
                Pusat Backup & Restore Database
                <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  MySQL Lokal (Port 3307)
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Amankan seluruh data kasir, produk, mutasi stok, dan utang pelanggan dari risiko kerusakan laptop
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

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-slate-800 text-sm">
          {/* Banner Peringatan / Status */}
          {status && (
            <div
              className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 transition-all ${status.isWarning
                  ? "bg-amber-50/80 border-amber-200 text-amber-900"
                  : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                }`}
            >
              <div className="flex items-start gap-3">
                {status.isWarning ? (
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider">
                    {status.lastBackupAt ? (
                      status.isWarning ? (
                        <span>Perhatian: Terakhir backup {status.daysSinceLastBackup} hari yang lalu!</span>
                      ) : (
                        <span>Data Aman: Backup terakhir {status.daysSinceLastBackup === 0 ? "hari ini" : `${status.daysSinceLastBackup} hari lalu`}</span>
                      )
                    ) : (
                      <span>Belum ada file backup database tersimpan!</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Terakhir: <b>{status.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString("id-ID") : "-"}</b></span>
                    <span>Total Arsip: <b>{status.totalBackups} berkas</b></span>
                    <span>Retensi Otomatis: <b>{status.retentionCount} file terakhir</b></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".sql,.sql.gz"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Impor file backup .sql atau .sql.gz dari flashdisk/laptop lain"
                >
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-600" /> : <Upload className="w-3.5 h-3.5 text-slate-600" />}
                  <span>Unggah Berkas</span>
                </button>

                <button
                  type="button"
                  onClick={handleCreateBackup}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                  <span>Backup Sekarang</span>
                </button>
              </div>
            </div>
          )}

          {/* Toast Message Notification */}
          {message && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between ${message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : message.type === "error"
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : "bg-slate-100 text-slate-800 border-slate-200"
                }`}
            >
              <span className="flex items-center gap-2">
                {message.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {message.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-600" />}
                {message.type === "info" && <ShieldCheck className="w-4 h-4 text-blue-600" />}
                {message.text}
              </span>
              <button onClick={() => setMessage(null)} className="text-[10px] opacity-70 hover:opacity-100 cursor-pointer">✕</button>
            </div>
          )}

          {/* Section: Buat Backup Baru dengan Opsi Enkripsi */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Opsi Keamanan Backup
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={useEncryption}
                  onChange={(e) => setUseEncryption(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Enkripsi Kata Sandi (AES-256-GCM)</span>
              </label>
            </div>

            {useEncryption && (
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Masukkan kata sandi pengaman (min. 6 karakter)..."
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-slate-500 max-w-xs">
                  Kata sandi ini wajib diingat saat memulihkan (restore) arsip.
                </span>
              </div>
            )}
          </div>

          {/* Section: Lokasi Penyimpanan Backup (C: / D: / Kustom) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-amber-500" />
                Lokasi Direktori Penyimpanan Backup
              </label>
              {!isEditingDirectory ? (
                <button
                  type="button"
                  onClick={() => setIsEditingDirectory(true)}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                >
                  Ubah Lokasi
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingDirectory(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Batal
                </button>
              )}
            </div>

            {!isEditingDirectory ? (
              <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-mono text-slate-800 truncate font-semibold">
                    {status?.backupDir || customDirectory || "backups/"}
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                  Siap Digunakan
                </span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Folder className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Contoh: D:\POS_Backups atau C:\Warung_Backups..."
                      value={customDirectory}
                      onChange={(e) => setCustomDirectory(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveDirectory()}
                    disabled={savingDirectory || !customDirectory.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {savingDirectory ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Simpan Lokasi
                  </button>
                </div>

                {/* Shortcut Cepat Pilihan Drive */}
                {status?.availableShortcuts && status.availableShortcuts.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] text-slate-500 font-medium mr-1">Pilihan Cepat:</span>
                    {status.availableShortcuts.map((sc) => (
                      <button
                        key={sc.path}
                        type="button"
                        onClick={() => {
                          setCustomDirectory(sc.path);
                          handleSaveDirectory(sc.path);
                        }}
                        className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition cursor-pointer ${status.backupDir === sc.path
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                            : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-500">
                  Tip: Menyimpan di Drive D: atau flashdisk mencegah kehilangan data jika Windows di-install ulang.
                </p>
              </div>
            )}
          </div>

          {/* Section: Wizard Inspeksi & Pulihkan Data (Jika dipilih) */}
          {selectedFileForRestore && (
            <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-blue-900 flex items-center gap-2">
                    <FileArchive className="w-4 h-4 text-blue-600" />
                    Inspeksi & Pemulihan Database
                  </h4>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    Berkas Target: <b>{selectedFileForRestore}</b>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFileForRestore(null);
                    setInspectData(null);
                    setIsConfirmingRestore(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Batal
                </button>
              </div>

              {inspecting && (
                <div className="flex items-center gap-2 text-xs text-blue-700 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sedang memverifikasi integritas struktur tabel dan data SQL...</span>
                </div>
              )}

              {inspectData && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Toko di Backup</div>
                      <div className="font-bold text-slate-800 font-mono">{inspectData.metadata?.storeCode || "-"}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Produk</div>
                      <div className="font-bold text-slate-800">{inspectData.metadata?.totalProducts ?? 0} item</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Transaksi Sales</div>
                      <div className="font-bold text-slate-800">{inspectData.metadata?.totalSales ?? 0} nota</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Jumlah Tabel</div>
                      <div className="font-bold text-emerald-600">{inspectData.tableCount ?? 0} tabel valid</div>
                    </div>
                  </div>

                  {!isConfirmingRestore ? (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingRestore(true)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Lanjutkan ke Konfirmasi Restore
                    </button>
                  ) : (
                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 space-y-3 text-xs text-rose-900">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">PERINGATAN PEMULIHAN DATABASE:</div>
                          <div>
                            Data transaksi di MySQL lokal saat ini akan ditimpa oleh isi berkas backup ini. Sistem akan otomatis membuat <b>Safety Snapshot pra-restore</b> sebelum proses dimulai.
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleExecuteRestore}
                          disabled={restoring}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                          {restoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                          <span>YA, SAYA YAKIN PULIHKAN SEKARANG</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingRestore(false)}
                          className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Section: Riwayat Daftar File Backup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileArchive className="w-3.5 h-3.5 text-slate-400" />
                Daftar Arsip Backup Tersimpan ({backups.length})
              </h4>
              <button
                type="button"
                onClick={loadBackups}
                disabled={loading}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                Segarkan
              </button>
            </div>

            {backups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Belum ada berkas backup yang tersimpan di laptop kasir.
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                        {b.isEncrypted ? (
                          <Lock className="w-4 h-4 text-amber-600" />
                        ) : b.filename.endsWith(".sql") ? (
                          <FileText className="w-4 h-4 text-blue-600" />
                        ) : (
                          <FileArchive className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {b.filename}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {b.formattedSize}
                          </span>
                          {b.isEncrypted && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> Terenkripsi
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {b.reason === "pre_restore" ? "Safety Snapshot" : b.reason === "on_close" ? "Auto Shutdown" : "Manual"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span>Waktu: <b>{new Date(b.createdAt).toLocaleString("id-ID")}</b></span>
                          <span>Toko: <b>{b.storeName} ({b.storeCode})</b></span>
                          <span>Data: <b>{b.totalProducts} Produk, {b.totalSales} Penjualan</b></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleInspectBackup(b.filename)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer shadow-2xs"
                      >
                        Uji & Pulihkan
                      </button>

                      <a
                        href={`/api/backup?download=${encodeURIComponent(b.filename)}`}
                        download={b.filename}
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                        title="Unduh berkas ke flashdisk/komputer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleDeleteBackup(b.filename)}
                        className="p-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                        title="Hapus berkas backup"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Lokasi folder: <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">{status?.backupDir || "backups/"}</code>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
