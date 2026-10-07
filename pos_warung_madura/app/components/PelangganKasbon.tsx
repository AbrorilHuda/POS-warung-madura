import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  Phone,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  CreditCard,
  Banknote,
  QrCode,
  FileText,
  RotateCcw,
  X,
  Edit2,
  Trash2,
  RefreshCw,
  Plus,
  BookOpen,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  ShieldAlert,
  Wallet,
  LayoutGrid,
  List,
  Sparkles,
  Info,
} from "lucide-react";
import type {
  CustomerSummary,
  ReceivableItem,
  CustomerLedgerEntry,
} from "../types/pos";

interface PelangganKasbonProps {
  onRefreshTrigger?: () => void;
}

export const PelangganKasbon: React.FC<PelangganKasbonProps> = () => {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_debt" | "paid" | "over_limit">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Modal Tambah / Edit Pelanggan
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerSummary | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCreditLimit, setFormCreditLimit] = useState<number>(0);
  const [formNotes, setFormNotes] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Modal Pelunasan (FIFO)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeCustomerForPayment, setActiveCustomerForPayment] = useState<CustomerSummary | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"Tunai" | "Transfer" | "QRIS">("Tunai");
  const [customerReceivables, setCustomerReceivables] = useState<ReceivableItem[]>([]);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paying, setPaying] = useState(false);

  // Modal Buku Besar / Riwayat Ledger
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [activeCustomerForLedger, setActiveCustomerForLedger] = useState<CustomerSummary | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Load Data Pelanggan
  const loadCustomers = async () => {
    try {
      setLoading(true);
      const url = searchQuery.trim()
        ? `/api/customers?q=${encodeURIComponent(searchQuery.trim())}`
        : "/api/customers";
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setCustomers(data.customers || []);
      }
    } catch (err: any) {
      console.error("Gagal memuat pelanggan:", err);
      setMessage({ type: "error", text: "Gagal memuat data pelanggan dari server" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [searchQuery]);

  // Statistik Ringkasan
  const totalReceivables = customers.reduce((acc, c) => acc + c.totalDebt, 0);
  const customersInDebtCount = customers.filter((c) => c.totalDebt > 0).length;
  const overLimitCount = customers.filter((c) => c.isOverLimit).length;

  // Filter List Pelanggan
  const filteredCustomers = customers.filter((c) => {
    if (statusFilter === "in_debt") return c.totalDebt > 0;
    if (statusFilter === "paid") return c.totalDebt === 0;
    if (statusFilter === "over_limit") return c.isOverLimit;
    return true;
  });

  // Buka Modal Tambah Baru
  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    setFormCreditLimit(0);
    setFormNotes("");
    setIsCustomerModalOpen(true);
  };

  // Buka Modal Edit
  const handleOpenEditModal = (c: CustomerSummary) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone || "");
    setFormAddress(c.address || "");
    setFormCreditLimit(c.creditLimit || 0);
    setFormNotes(c.notes || "");
    setIsCustomerModalOpen(true);
  };

  // Simpan Pelanggan (Create / Update)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setMessage({ type: "error", text: "Nama pelanggan wajib diisi!" });
      return;
    }

    try {
      setSavingCustomer(true);
      const payload = {
        action: editingCustomer ? "update" : "create",
        id: editingCustomer?.id,
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        creditLimit: formCreditLimit,
        notes: formNotes.trim() || undefined,
      };

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.ok) {
        setMessage({ type: "success", text: data.message || "Data pelanggan berhasil disimpan!" });
        setIsCustomerModalOpen(false);
        await loadCustomers();
      } else {
        setMessage({ type: "error", text: data.error || "Gagal menyimpan data pelanggan" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Terjadi kesalahan koneksi" });
    } finally {
      setSavingCustomer(false);
    }
  };

  // Hapus / Nonaktifkan Pelanggan (PRD F1)
  const handleDeleteCustomer = async (customer: CustomerSummary) => {
    const confirmText =
      customer.totalDebt > 0
        ? `Pelanggan "${customer.name}" masih memiliki sisa utang Rp ${customer.totalDebt.toLocaleString("id-ID")}. Yakin ingin menonaktifkan akun ini?`
        : `Yakin ingin menghapus pelanggan "${customer.name}"?`;

    if (!window.confirm(confirmText)) return;

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: customer.id }),
      });
      const data = await res.json();

      if (data.ok) {
        setMessage({ type: "success", text: data.message || "Pelanggan berhasil diproses" });
        await loadCustomers();
      } else {
        setMessage({ type: "error", text: data.error || "Gagal memproses pelanggan" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Terjadi kesalahan" });
    }
  };

  // Buka Modal Pelunasan Utang
  const handleOpenPaymentModal = async (c: CustomerSummary) => {
    setActiveCustomerForPayment(c);
    setPaymentAmount(c.totalDebt); // Default lunas semua
    setPaymentMethod("Tunai");
    setSelectedReceivableId("");
    setPaymentNotes("");
    setIsPaymentModalOpen(true);

    // Ambil daftar nota belum lunas
    try {
      const res = await fetch(`/api/customers?customerId=${c.id}&receivables=true`);
      const data = await res.json();
      if (data.ok) {
        setCustomerReceivables(data.receivables || []);
      }
    } catch (e) {
      console.warn("Gagal mengambil piutang:", e);
    }
  };

  // Eksekusi Pelunasan FIFO (PRD F1.5)
  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomerForPayment) return;

    if (paymentAmount <= 0) {
      setMessage({ type: "error", text: "Nominal pembayaran harus lebih besar dari 0!" });
      return;
    }

    if (paymentAmount > activeCustomerForPayment.totalDebt) {
      setMessage({
        type: "error",
        text: `Nominal Rp ${paymentAmount.toLocaleString("id-ID")} melebihi sisa utang (Rp ${activeCustomerForPayment.totalDebt.toLocaleString("id-ID")}). Kelebihan pembayaran ditolak.`,
      });
      return;
    }

    try {
      setPaying(true);
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payDebt",
          customerId: activeCustomerForPayment.id,
          amount: paymentAmount,
          paymentMethod,
          specificReceivableId: selectedReceivableId || undefined,
          notes: paymentNotes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setMessage({
          type: "success",
          text: data.result?.message || "Pelunasan berhasil dicatat!",
        });
        setIsPaymentModalOpen(false);
        await loadCustomers();
      } else {
        setMessage({ type: "error", text: data.error || "Gagal memproses pelunasan" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Terjadi kesalahan saat memproses pelunasan" });
    } finally {
      setPaying(false);
    }
  };

  // Buka Modal Buku Besar / Riwayat (PRD F1.8)
  const handleOpenLedgerModal = async (c: CustomerSummary) => {
    setActiveCustomerForLedger(c);
    setIsLedgerModalOpen(true);
    try {
      setLoadingLedger(true);
      const res = await fetch(`/api/customers?customerId=${c.id}&ledger=true`);
      const data = await res.json();
      if (data.ok) {
        setLedgerEntries(data.ledger || []);
      }
    } catch (e) {
      console.warn("Gagal memuat buku besar:", e);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Buka Pengingat WhatsApp wa.me (PRD F1.9)
  const handleOpenWhatsAppReminder = async (c: CustomerSummary) => {
    if (!c.phone) {
      alert("Pelanggan belum memiliki nomor telepon / WhatsApp terdaftar.");
      return;
    }

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reminder", customerId: c.id }),
      });
      const data = await res.json();
      if (data.ok && data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank");
      } else {
        alert(data.error || "Gagal membuat tautan WhatsApp");
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Banner Halaman (Selaras dengan Sistem POS) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20 shadow-2xs shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Kasbon & Piutang Pelanggan
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                F1 PRD &bull; Pelunasan FIFO
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola langganan warung, limit kredit, pelunasan bertahap FIFO, buku besar piutang & pengingat WhatsApp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={loadCustomers}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer shadow-2xs"
            title="Segarkan data pelanggan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Tambah Pelanggan Baru</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between transition-all ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : message.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-slate-100 border-slate-200 text-slate-800"
          }`}
        >
          <span className="flex items-center gap-2">
            {message.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {message.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-600" />}
            {message.type === "info" && <Info className="w-4 h-4 text-blue-600" />}
            {message.text}
          </span>
          <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Kartu Metrik Ringkasan (Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Kasbon Aktif */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Sisa Kasbon Warung
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight truncate">
              Rp {totalReceivables.toLocaleString("id-ID")}
            </div>
            <span className="text-[11px] text-slate-500">Dari seluruh nota yang belum lunas</span>
          </div>
        </div>

        {/* Pelanggan Berutang */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Pelanggan Berutang
            </span>
            <div className="text-2xl font-black text-amber-600 font-mono tracking-tight">
              {customersInDebtCount}{" "}
              <span className="text-xs font-sans font-medium text-slate-500">
                / {customers.length} langganan
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              {customers.length - customersInDebtCount} langganan berstatus lunas
            </span>
          </div>
        </div>

        {/* Melebihi Limit Kredit */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Melebihi Limit Kredit
            </span>
            <div className="text-2xl font-black text-rose-600 font-mono tracking-tight">
              {overLimitCount}{" "}
              <span className="text-xs font-sans font-medium text-slate-500">orang</span>
            </div>
            <span className="text-[11px] text-slate-500">
              {overLimitCount > 0 ? "Perlu persetujuan PIN pemilik" : "Semua akun dalam batas aman"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Input Pencarian */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pelanggan berdasarkan nama atau nomor HP..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua ({customers.length})
          </button>
          <button
            onClick={() => setStatusFilter("in_debt")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              statusFilter === "in_debt"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Ada Kasbon ({customersInDebtCount})
          </button>
          <button
            onClick={() => setStatusFilter("paid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              statusFilter === "paid"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Lunas ({customers.length - customersInDebtCount})
          </button>
          <button
            onClick={() => setStatusFilter("over_limit")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              statusFilter === "over_limit"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Over Limit ({overLimitCount})
          </button>
        </div>

        {/* View Mode Switcher (Grid vs Table) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end md:self-auto shrink-0">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "grid" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }`}
            title="Tampilan Kartu (Grid)"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "table" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }`}
            title="Tampilan Tabel Rekapitulasi (List)"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4. Daftar Konten Pelanggan (Grid / Tabel) */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3.5">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">
            {customers.length === 0 ? "Belum Ada Pelanggan Terdaftar" : "Tidak Ada Pelanggan yang Cocok"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            {customers.length === 0
              ? "Tambahkan langganan warung untuk mulai mencatat kasbon nota, batas plafon utang, dan pelunasan bertahap."
              : "Coba ubah kata kunci pencarian atau ganti filter status di atas."}
          </p>
          {customers.length === 0 && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Tambah Pelanggan Pertama</span>
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* ========================================================================= */
        /* TAMPILAN KARTU (GRID VIEW)                                                */
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((c) => {
            const usagePercent =
              c.creditLimit > 0 ? Math.min(100, Math.round((c.totalDebt / c.creditLimit) * 100)) : 0;

            return (
              <div
                key={c.id}
                className={`bg-white rounded-3xl border transition-all shadow-xs p-5 flex flex-col justify-between space-y-4 ${
                  c.isOverLimit
                    ? "border-rose-300 ring-2 ring-rose-200/60"
                    : c.totalDebt > 0
                    ? "border-amber-200/90 hover:border-amber-300"
                    : "border-slate-200/80 hover:border-slate-300"
                }`}
              >
                {/* Header Kartu: Avatar & Status Badge */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-emerald-400 font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                        {getInitials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 tracking-tight truncate" title={c.name}>
                          {c.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                          {c.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {c.phone}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Tanpa nomor HP</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 flex items-center gap-1">
                      {c.isOverLimit ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                          Over Limit!
                        </span>
                      ) : c.totalDebt > 0 ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Kasbon Aktif
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Lunas
                        </span>
                      )}
                      <button
                        onClick={() => handleOpenEditModal(c)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        title="Edit data pelanggan"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(c)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Hapus / Nonaktifkan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {c.address && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{c.address}</span>
                    </div>
                  )}

                  {/* Panel Ringkasan Saldo & Plafon Limit */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/60 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Sisa Kasbon Berjalan:</span>
                      <span
                        className={`font-mono font-black text-sm tracking-tight ${
                          c.totalDebt > 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        Rp {c.totalDebt.toLocaleString("id-ID")}
                      </span>
                    </div>

                    {/* Progress Bar Limit Kredit */}
                    {c.creditLimit > 0 ? (
                      <div className="space-y-1 pt-1 border-t border-slate-200/60">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Limit: Rp {c.creditLimit.toLocaleString("id-ID")}</span>
                          <span className={c.isOverLimit ? "font-bold text-rose-600" : "font-mono"}>
                            {usagePercent}% Terpakai
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              c.isOverLimit ? "bg-rose-500" : usagePercent > 75 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                        <span>Limit Kredit:</span>
                        <span className="font-medium text-slate-600">Tanpa Batas (Bebas)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tombol Aksi di Bawah Kartu */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenPaymentModal(c)}
                    disabled={c.totalDebt <= 0}
                    className="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-40 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Catat pembayaran pelunasan kasbon"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Lunasi</span>
                  </button>

                  <button
                    onClick={() => handleOpenLedgerModal(c)}
                    className="px-2.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Buku besar riwayat utang piutang"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span>Riwayat</span>
                  </button>

                  <button
                    onClick={() => handleOpenWhatsAppReminder(c)}
                    disabled={c.totalDebt <= 0 || !c.phone}
                    className="px-2.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs disabled:opacity-40 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Kirim pesan rincian tagihan via WhatsApp"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tagih WA</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================================= */
        /* TAMPILAN TABEL REKAPITULASI (LIST VIEW)                                   */
        /* ========================================================================= */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Pelanggan</th>
                  <th className="py-3.5 px-4">Kontak HP</th>
                  <th className="py-3.5 px-4">Alamat</th>
                  <th className="py-3.5 px-4 text-right">Limit Plafon</th>
                  <th className="py-3.5 px-4 text-right">Sisa Kasbon</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {getInitials(c.name)}
                        </div>
                        <span className="font-bold text-slate-900 text-xs">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {c.phone || <span className="text-slate-400 italic">-</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {c.address || "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {c.creditLimit > 0 ? `Rp ${c.creditLimit.toLocaleString("id-ID")}` : "Bebas"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-xs">
                      <span className={c.totalDebt > 0 ? "text-rose-600" : "text-emerald-600"}>
                        Rp {c.totalDebt.toLocaleString("id-ID")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.isOverLimit ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Over Limit
                        </span>
                      ) : c.totalDebt > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Kasbon
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Lunas
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenPaymentModal(c)}
                          disabled={c.totalDebt <= 0}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] disabled:opacity-30 transition cursor-pointer"
                          title="Lunasi Utang"
                        >
                          Lunasi
                        </button>
                        <button
                          onClick={() => handleOpenLedgerModal(c)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition cursor-pointer"
                          title="Lihat Buku Besar"
                        >
                          Riwayat
                        </button>
                        <button
                          onClick={() => handleOpenWhatsAppReminder(c)}
                          disabled={c.totalDebt <= 0 || !c.phone}
                          className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 disabled:opacity-30 transition cursor-pointer"
                          title="Tagih via WA"
                        >
                          <Send className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 1: TAMBAH / EDIT DATA PELANGGAN                                   */}
      {/* ======================================================================= */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-6">
            {/* Header Modal Gradient */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    {editingCustomer ? "Edit Profil Pelanggan" : "Tambah Langganan Warung"}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Atur data kontak dan batas limit kasbon untuk langganan warung
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer}>
              <div className="p-6 space-y-4 text-xs text-slate-800">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">
                    Nama Lengkap / Panggilan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pak RT / Bu Siti / Mas Dimas"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Nomor WhatsApp / HP</label>
                    <input
                      type="text"
                      placeholder="08123456789"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700">Limit Kasbon (Rp)</label>
                      <span className="text-[10px] text-slate-400">0 = tanpa batas</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      value={formCreditLimit || ""}
                      onChange={(e) => setFormCreditLimit(Number(e.target.value))}
                      placeholder="Contoh: 100000"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold shadow-2xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Alamat / Petunjuk Rumah</label>
                  <input
                    type="text"
                    placeholder="Contoh: Rumah seberang pos kamling / Blok C-4"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Catatan Tambahan</label>
                  <textarea
                    rows={2}
                    placeholder="Langganan sembako & rokok, bayar tiap gajian..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Footer Modal */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {savingCustomer ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{editingCustomer ? "Simpan Perubahan" : "Simpan Pelanggan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 2: PELUNASAN KASBON FIFO (PRD F1.5)                               */}
      {/* ======================================================================= */}
      {isPaymentModalOpen && activeCustomerForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-6">
            {/* Header Modal Gradient */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    Pelunasan Kasbon & Piutang (FIFO)
                  </h3>
                  <p className="text-xs text-slate-300">
                    Pelanggan: <b className="text-white">{activeCustomerForPayment.name}</b>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecutePayment}>
              <div className="p-6 space-y-4 text-xs text-slate-800">
                {/* Banner Informasi Total Utang */}
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-amber-900 block text-xs">Total Sisa Utang Saat Ini</span>
                    <span className="text-[11px] text-amber-700">Otomatis melunasi nota tertua lebih dahulu (FIFO)</span>
                  </div>
                  <span className="font-mono font-black text-lg text-amber-950">
                    Rp {activeCustomerForPayment.totalDebt.toLocaleString("id-ID")}
                  </span>
                </div>

                {/* Input Nominal Pembayaran */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">
                    Nominal Pembayaran Diterima (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={activeCustomerForPayment.totalDebt}
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-black shadow-2xs"
                  />

                  {/* Tombol Cepat Nominal */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(activeCustomerForPayment.totalDebt)}
                      className="px-2.5 py-1 text-[11px] bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                    >
                      Bayar Lunas Penuh (Rp {activeCustomerForPayment.totalDebt.toLocaleString("id-ID")})
                    </button>
                    {activeCustomerForPayment.totalDebt > 50000 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(50000)}
                        className="px-2.5 py-1 text-[11px] bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition cursor-pointer"
                      >
                        Rp 50.000
                      </button>
                    )}
                    {activeCustomerForPayment.totalDebt > 100000 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(100000)}
                        className="px-2.5 py-1 text-[11px] bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition cursor-pointer"
                      >
                        Rp 100.000
                      </button>
                    )}
                  </div>
                </div>

                {/* Metode Pembayaran */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Metode Pembayaran</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Tunai", "Transfer", "QRIS"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          paymentMethod === m
                            ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {m === "Tunai" && <Banknote className="w-3.5 h-3.5" />}
                        {m === "Transfer" && <CreditCard className="w-3.5 h-3.5" />}
                        {m === "QRIS" && <QrCode className="w-3.5 h-3.5" />}
                        <span>{m}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opsi Target Nota Spesifik (Opsional) */}
                {customerReceivables.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">
                      Target Nota Pembayaran (Opsional)
                    </label>
                    <select
                      value={selectedReceivableId}
                      onChange={(e) => setSelectedReceivableId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    >
                      <option value="">Otomatis FIFO (Nota Paling Awal Terlebih Dahulu)</option>
                      {customerReceivables.map((r) => (
                        <option key={r.id} value={r.id}>
                          Nota {r.invoiceCode} ({new Date(r.createdAt).toLocaleDateString("id-ID")}) &bull; Sisa: Rp {r.remainingAmount.toLocaleString("id-ID")}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Catatan Pelunasan */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Catatan Tambahan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Diterima oleh kasir..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Footer Modal */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {paying ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Konfirmasi Pelunasan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 3: BUKU BESAR / RIWAYAT LEDGER PELANGGAN (PRD F1.8)                */}
      {/* ======================================================================= */}
      {isLedgerModalOpen && activeCustomerForLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[88vh] flex flex-col">
            {/* Header Modal Gradient */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    Buku Besar Riwayat Utang & Pelunasan
                  </h3>
                  <p className="text-xs text-slate-300">
                    Pelanggan: <b className="text-white">{activeCustomerForLedger.name}</b> ({activeCustomerForLedger.phone || "Tanpa HP"})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLedgerModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body Buku Besar */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Banner Saldo Terkini */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                    Saldo Utang Berjalan Saat Ini
                  </span>
                  <span className="font-mono text-2xl font-black text-emerald-400 tracking-tight">
                    Rp {activeCustomerForLedger.totalDebt.toLocaleString("id-ID")}
                  </span>
                </div>
                {activeCustomerForLedger.phone && (
                  <button
                    onClick={() => handleOpenWhatsAppReminder(activeCustomerForLedger)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim Tagihan WA</span>
                  </button>
                )}
              </div>

              {loadingLedger ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
                  <p className="text-xs">Memuat buku besar riwayat transaksi...</p>
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Belum ada catatan transaksi kasbon atau pelunasan.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-3">Tanggal</th>
                        <th className="p-3">Keterangan</th>
                        <th className="p-3 text-right">Kasbon (+)</th>
                        <th className="p-3 text-right">Pelunasan (-)</th>
                        <th className="p-3 text-right font-mono">Saldo Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerEntries.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 text-[11px] text-slate-500 font-mono">
                            {new Date(item.date).toLocaleDateString("id-ID")}
                          </td>
                          <td className="p-3 text-slate-800 font-medium">
                            <div className="flex items-center gap-1.5">
                              {item.type === "kasbon" ? (
                                <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              ) : (
                                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              )}
                              <span>{item.description}</span>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono text-rose-600 font-bold">
                            {item.debit > 0 ? `+Rp ${item.debit.toLocaleString("id-ID")}` : "-"}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600 font-bold">
                            {item.credit > 0 ? `-Rp ${item.credit.toLocaleString("id-ID")}` : "-"}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-slate-900">
                            Rp {item.balance.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button
                onClick={() => setIsLedgerModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
