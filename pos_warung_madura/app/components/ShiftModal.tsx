import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Clock,
  User,
  Users,
  Shield,
  ShieldCheck,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Receipt,
  Printer,
  History,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  Key,
  Edit2,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Crown,
  LogOut,
  Repeat,
} from "lucide-react";
import type {
  ShiftData,
  CashMovement,
  AuditLogItem,
  UserSession,
  UserDetail,
  ShiftSecuritySettings,
} from "../types/pos";

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserSession | null;
  onShiftStatusChange?: (shift: ShiftData | null) => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onShiftStatusChange,
}) => {
  const [activeTab, setActiveTab] = useState<"shift" | "movement" | "cashiers" | "audit">("shift");
  const [activeShift, setActiveShift] = useState<ShiftData | null>(null);
  const [lastClosedShift, setLastClosedShift] = useState<ShiftData | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [users, setUsers] = useState<UserSession[]>([]);
  const [allUsers, setAllUsers] = useState<UserDetail[]>([]);
  const [securitySettings, setSecuritySettings] = useState<ShiftSecuritySettings | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Ref untuk callback agar fetchShiftData memiliki dependencies stabil
  const onShiftStatusChangeRef = React.useRef(onShiftStatusChange);
  useEffect(() => {
    onShiftStatusChangeRef.current = onShiftStatusChange;
  }, [onShiftStatusChange]);

  // Form Buka Shift
  const [selectedCashierId, setSelectedCashierId] = useState<string>("");
  const [cashierPinInput, setCashierPinInput] = useState<string>("");
  const [startingCashInput, setStartingCashInput] = useState<string>("100000"); // default modal Rp 100.000

  // Form Tutup Shift
  const [actualCashInput, setActualCashInput] = useState<string>("");
  const [closeNotes, setCloseNotes] = useState<string>("");

  // Form Kas Gerak
  const [movementType, setMovementType] = useState<"cash_in" | "cash_out">("cash_out");
  const [movementAmount, setMovementAmount] = useState<string>("");
  const [movementReason, setMovementReason] = useState<string>("");

  // Kelola Kasir State (Owner Protected)
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState(false);
  const [ownerPinInput, setOwnerPinInput] = useState("");
  const [showAddCashierModal, setShowAddCashierModal] = useState(false);
  const [newCashierName, setNewCashierName] = useState("");
  const [newCashierPin, setNewCashierPin] = useState("");

  // Ganti PIN Pemilik State
  const [showChangeOwnerPin, setShowChangeOwnerPin] = useState(false);
  const [oldOwnerPin, setOldOwnerPin] = useState("");
  const [newOwnerPin, setNewOwnerPin] = useState("");

  // Ganti Kasir / Ambil Alih Shift Berjalan (PRD F5)
  const [showSwitchCashierModal, setShowSwitchCashierModal] = useState(false);
  const [switchCashierId, setSwitchCashierId] = useState<string>("");
  const [switchPinInput, setSwitchPinInput] = useState<string>("");

  // Handler Cetak Struk Ringkasan Shift Kasir (PRD F5.6)
  const handlePrintShiftReceipt = (s: ShiftData) => {
    const printWindow = window.open("", "_blank", "width=380,height=600");
    if (!printWindow) return;

    const diffText =
      s.cashDifference === null
        ? "Belum ditutup"
        : s.cashDifference === 0
        ? "Pas (Rp 0)"
        : s.cashDifference > 0
        ? `Lebih (+Rp ${s.cashDifference.toLocaleString("id-ID")})`
        : `Kurang (-Rp ${Math.abs(s.cashDifference).toLocaleString("id-ID")})`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rekap Shift - ${s.shiftCode}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 12px; color: #000; width: 280px; }
          .text-center { text-align: center; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .bold { font-weight: bold; }
          .sign { margin-top: 24px; display: flex; justify-content: space-between; text-align: center; font-size: 10px; }
          @media print { body { width: 100%; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="text-center bold">WARUNG MADURA</div>
        <div class="text-center" style="font-size: 10px;">LAPORAN SHIFT & KAS LACI</div>
        <div class="divider"></div>
        <div class="row"><span>Kode Shift:</span><span class="bold">${s.shiftCode}</span></div>
        <div class="row"><span>Kasir:</span><span>${s.cashierName}</span></div>
        <div class="row"><span>Buka:</span><span>${s.startTime}</span></div>
        <div class="row"><span>Tutup:</span><span>${s.endTime || "Masih Berjalan"}</span></div>
        <div class="divider"></div>
        <div class="row"><span>Modal Awal:</span><span>Rp ${s.startingCash.toLocaleString("id-ID")}</span></div>
        <div class="row"><span>Penjualan Tunai:</span><span>Rp ${s.totalCashSales.toLocaleString("id-ID")}</span></div>
        <div class="row"><span>Pelunasan Kasbon:</span><span>Rp ${s.totalDebtCollectedCash.toLocaleString("id-ID")}</span></div>
        <div class="row"><span>Kas Masuk (+):</span><span>Rp ${s.totalCashIn.toLocaleString("id-ID")}</span></div>
        <div class="row"><span>Kas Keluar (-):</span><span>Rp ${s.totalCashOut.toLocaleString("id-ID")}</span></div>
        <div class="divider"></div>
        <div class="row bold"><span>Uang Laci Harapan:</span><span>Rp ${s.expectedCash.toLocaleString("id-ID")}</span></div>
        ${s.actualCash !== null ? `<div class="row bold"><span>Hitungan Fisik:</span><span>Rp ${s.actualCash.toLocaleString("id-ID")}</span></div>` : ""}
        ${s.cashDifference !== null ? `<div class="row bold"><span>Selisih Kas:</span><span>${diffText}</span></div>` : ""}
        <div class="divider"></div>
        <div class="row"><span>Penjualan QRIS:</span><span>Rp ${s.totalQrisSales.toLocaleString("id-ID")}</span></div>
        <div class="row"><span>Kasbon Terbit:</span><span>Rp ${s.totalDebtSales.toLocaleString("id-ID")}</span></div>
        ${s.notes ? `<div class="divider"></div><div style="font-size: 10px;">Catatan: ${s.notes}</div>` : ""}
        <div class="sign">
          <div>Kasir Bertugas<br><br><br>( ${s.cashierName} )</div>
          <div>Pemilik Toko<br><br><br>( ............ )</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  const fetchShiftData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [shiftRes, allUsersRes, auditRes] = await Promise.all([
        fetch("/api/shift"),
        fetch("/api/shift?all_users=true"),
        fetch("/api/shift?audit=true"),
      ]);

      const shiftData = await shiftRes.json();
      const allUsersData = await allUsersRes.json();
      const auditData = await auditRes.json();

      if (shiftData.ok) {
        setActiveShift(shiftData.activeShift);
        setMovements(shiftData.movements || []);
        if (shiftData.settings) {
          setSecuritySettings(shiftData.settings);
        }
        if (onShiftStatusChangeRef.current) {
          onShiftStatusChangeRef.current(shiftData.activeShift);
        }
      }

      if (allUsersData.ok && allUsersData.users) {
        setAllUsers(allUsersData.users);
        const activeUsers = allUsersData.users.filter((u: UserDetail) => u.isActive);
        setUsers(activeUsers);
        setSelectedCashierId((prev) => prev || activeUsers[0]?.id || "");
      }

      if (auditData.ok && auditData.auditLogs) {
        setAuditLogs(auditData.auditLogs);
      }
    } catch (err: any) {
      console.error("Gagal memuat data shift:", err);
      setErrorMsg("Gagal menghubungi server database lokal");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchShiftData();
      setErrorMsg(null);
      setSuccessMsg(null);
      setCashierPinInput("");
    } else {
      // Auto-lock sesi pemilik setiap kali modal ditutup demi privasi & keamanan kasir
      setIsOwnerUnlocked(false);
      setOwnerPinInput("");
      setShowAddCashierModal(false);
      setShowChangeOwnerPin(false);
      setShowSwitchCashierModal(false);
    }
  }, [isOpen, fetchShiftData]);

  if (!isOpen) return null;

  // Handler Buka Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cashier = allUsers.find((u) => u.id === selectedCashierId) || {
      id: "usr-cashier-01",
      name: "Kasir",
    };
    const startingCash = parseInt(startingCashInput.replace(/\D/g, "") || "0", 10);

    try {
      setIsLoading(true);
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          cashierId: cashier.id,
          cashierName: cashier.name,
          startingCash,
          pin: cashierPinInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok && data.shift) {
        setActiveShift(data.shift);
        setSuccessMsg(`Shift ${data.shift.shiftCode} berhasil dibuka untuk ${cashier.name}!`);
        if (onShiftStatusChangeRef.current) {
          onShiftStatusChangeRef.current(data.shift);
        }
      } else {
        setErrorMsg(data.error || "Gagal membuka shift baru");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem saat membuka shift");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Tutup Shift
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    const actualCash = parseInt(actualCashInput.replace(/\D/g, "") || "0", 10);

    try {
      setIsLoading(true);
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          shiftId: activeShift.id,
          actualCash,
          notes: closeNotes.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok && data.shift) {
        setLastClosedShift(data.shift);
        setActiveShift(null);
        setActualCashInput("");
        setCloseNotes("");
        setSuccessMsg(`Shift ${data.shift.shiftCode} berhasil ditutup. Selisih kas tercatat.`);
        if (onShiftStatusChangeRef.current) {
          onShiftStatusChangeRef.current(null);
        }
      } else {
        setErrorMsg(data.error || "Gagal menutup shift");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat menutup shift");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Catat Kas Masuk / Keluar Laci (Kas Kecil)
  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    const amount = parseInt(movementAmount.replace(/\D/g, "") || "0", 10);

    if (amount <= 0 || !movementReason.trim()) {
      setErrorMsg("Nominal uang dan alasan transaksi laci wajib diisi");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cash_movement",
          shiftId: activeShift.id,
          type: movementType,
          amount,
          reason: movementReason.trim(),
          createdBy: activeShift.cashierName,
        }),
      });

      const data = await res.json();
      if (data.ok && data.movement) {
        setSuccessMsg(
          `${movementType === "cash_in" ? "Kas Masuk" : "Pengeluaran Kas"} Rp ${amount.toLocaleString("id-ID")} berhasil dicatat!`
        );
        setMovementAmount("");
        setMovementReason("");
        fetchShiftData();
      } else {
        setErrorMsg(data.error || "Gagal mencatat mutasi kas");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan jaringan");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Ganti Kasir / Ambil Alih Shift Berjalan (PRD F5)
  const handleSwitchCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetUser = allUsers.find((u) => u.id === switchCashierId);
    if (!targetUser) {
      setErrorMsg("Pilih kasir atau akun Pemilik terlebih dahulu.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "switch_cashier",
          shiftId: activeShift.id,
          cashierId: targetUser.id,
          cashierName: targetUser.name,
          pin: switchPinInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok && data.shift) {
        setActiveShift(data.shift);
        if (onShiftStatusChangeRef.current) {
          onShiftStatusChangeRef.current(data.shift);
        }
        setSuccessMsg(`Kasir aktif berhasil dialihkan ke '${data.shift.cashierName}'!`);
        setShowSwitchCashierModal(false);
        setSwitchPinInput("");
        fetchShiftData();
      } else {
        setErrorMsg(data.error || "Gagal mengganti kasir bertugas.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat mengganti kasir.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Logout Akses Pemilik (Kunci Tab Kelola Kasir & PIN)
  const handleOwnerLogout = () => {
    setIsOwnerUnlocked(false);
    setOwnerPinInput("");
    setShowAddCashierModal(false);
    setShowChangeOwnerPin(false);
    setSuccessMsg("Sesi Pemilik berhasil dikunci kembali demi keamanan.");
  };

  // Handler Verifikasi PIN Pemilik untuk Buka Tab Manajemen Kasir
  const handleUnlockOwnerTab = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!ownerPinInput.trim()) return;

    try {
      setIsLoading(true);
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_owner_pin",
          pin: ownerPinInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setIsOwnerUnlocked(true);
        setOwnerPinInput("");
      } else {
        setErrorMsg(data.error || "PIN Pemilik salah. Akses ditolak.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memverifikasi PIN.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Toggle Wajibkan PIN Kasir 4 Digit
  const handleToggleRequirePin = async () => {
    if (!securitySettings) return;
    const nextVal = !securitySettings.requireCashierPin;
    try {
      setIsLoading(true);
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_cashier_pin",
          required: nextVal,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSecuritySettings({
          ...securitySettings,
          requireCashierPin: nextVal,
        });
        setSuccessMsg(
          nextVal
            ? "Mode PIN 4 Digit Diaktifkan. Kasir wajib memasukkan PIN."
            : "Mode Cepat Warung Diaktifkan. Kasir cukup memilih nama profil tanpa sandi."
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengubah mode PIN kasir");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Tambah Kasir Baru
  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCashierName.trim()) return;

    try {
      setIsLoading(true);
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_cashier",
          name: newCashierName.trim(),
          pin: newCashierPin.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAllUsers(data.users);
        const activeCashiers = data.users.filter((u: UserDetail) => u.isActive && u.role === "cashier");
        setUsers(activeCashiers);
        setShowAddCashierModal(false);
        setNewCashierName("");
        setNewCashierPin("");
        setSuccessMsg(`Kasir '${data.cashier?.name}' berhasil ditambahkan!`);
      } else {
        setErrorMsg(data.error || "Gagal menambahkan kasir.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat menambah kasir.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Ubah PIN Pemilik
  const handleChangeOwnerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerPin || newOwnerPin.length < 4) {
      setErrorMsg("PIN baru minimal 4-6 digit angka.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_owner_pin",
          oldPin: oldOwnerPin.trim(),
          newPin: newOwnerPin.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowChangeOwnerPin(false);
        setOldOwnerPin("");
        setNewOwnerPin("");
        setSuccessMsg("PIN Pemilik berhasil diperbarui!");
      } else {
        setErrorMsg(data.error || "Gagal memperbarui PIN Pemilik.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat mengubah PIN.");
    } finally {
      setIsLoading(false);
    }
  };

  const parsedActualCash = actualCashInput ? parseInt(actualCashInput.replace(/\D/g, "") || "0", 10) : 0;
  const diff = activeShift ? parsedActualCash - activeShift.expectedCash : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header with Gradient */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 sm:px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                <Clock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                  <span>Shift Kasir &amp; Kas Laci</span>
                  {activeShift ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      SHIFT AKTIF
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600">
                      LACI TERTUTUP
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {securitySettings?.requireCashierPin
                    ? "Mode Keamanan: Wajib PIN 4 Digit Kasir"
                    : "Mode Cepat Warung: Cukup Pilih Nama Kasir"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 mt-4 text-xs font-bold overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab("shift")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                activeTab === "shift"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Operasional Shift
            </button>

            {activeShift && (
              <button
                onClick={() => setActiveTab("movement")}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                  activeTab === "movement"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Kas Masuk / Keluar
              </button>
            )}

            <button
              onClick={() => setActiveTab("cashiers")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === "cashiers"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-orange-400" />
              <span>Kelola Kasir &amp; PIN</span>
            </button>

            <button
              onClick={() => setActiveTab("audit")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                activeTab === "audit"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Audit Trail
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: OPERASIONAL SHIFT */}
          {activeTab === "shift" && (
            <>
              {activeShift ? (
                /* Shift Sedang Berjalan -> Tampilkan Statistik & Formulir Tutup Shift */
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <div>
                        <p className="font-bold text-emerald-950 text-sm">
                          Shift Sedang Aktif ({activeShift.shiftCode})
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          Kasir: <strong className="font-extrabold">{activeShift.cashierName}</strong> &bull; Dibuka: {activeShift.startTime}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSwitchCashierId(activeShift.cashierId || "");
                          setSwitchPinInput("");
                          setShowSwitchCashierModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Ganti Kasir yang bertugas atau Pemilik mengambil alih layanan shift ini"
                      >
                        <Repeat className="w-3.5 h-3.5" />
                        <span>Ganti Kasir / Pemilik</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintShiftReceipt(activeShift)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        title="Cetak Struk Rekap Shift Thermal"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Cetak Rekap</span>
                      </button>
                      <button
                        onClick={fetchShiftData}
                        disabled={isLoading}
                        className="p-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition cursor-pointer"
                        title="Hitung Ulang Saldo Kasir"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Dialog Ganti Kasir / Ambil Alih Shift */}
                  {showSwitchCashierModal && (
                    <div className="p-4 rounded-2xl bg-orange-50/90 border border-orange-200 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center">
                            <Repeat className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-extrabold text-orange-950 text-xs">
                              Ganti Kasir Bertugas / Pemilik Ambil Alih
                            </h5>
                            <p className="text-[10px] text-orange-700">
                              Laci kasir tetap berjalan. Transaksi selanjutnya akan tercatat atas nama kasir baru.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSwitchCashierModal(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {users.map((u) => {
                          const isSelected = switchCashierId === u.id;
                          const isOwner = u.role === "owner";
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => setSwitchCashierId(u.id)}
                              className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                                isSelected
                                  ? isOwner
                                    ? "bg-indigo-100 border-indigo-600 ring-2 ring-indigo-400 text-indigo-950 shadow-xs"
                                    : "bg-white border-orange-600 ring-2 ring-orange-400 text-orange-950 shadow-xs"
                                  : isOwner
                                  ? "bg-indigo-50/60 border-indigo-200 text-indigo-900 hover:bg-indigo-100/50"
                                  : "bg-white/80 border-slate-200 text-slate-800 hover:bg-white"
                              }`}
                            >
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isOwner ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {isOwner ? <Crown className="w-3.5 h-3.5 text-amber-300" /> : u.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-xs truncate">{u.name}</p>
                                <span className={`text-[9px] font-semibold block ${isOwner ? "text-indigo-600 font-bold" : "text-slate-500"}`}>
                                  {isOwner ? "👑 Pemilik" : "Kasir"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Input PIN jika kasir yang dipilih butuh PIN */}
                      {(() => {
                        const target = allUsers.find((u) => u.id === switchCashierId);
                        const needPin =
                          (target?.role === "cashier" && securitySettings?.requireCashierPin && target?.hasPin) ||
                          (target?.role === "owner" && target?.hasPin);

                        if (!needPin) return null;

                        return (
                          <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-orange-200">
                            <label className="text-[11px] font-bold text-slate-700 shrink-0">
                              {target?.role === "owner" ? "PIN Pemilik / Kode Reset:" : "PIN Kasir (4 Digit):"}
                            </label>
                            <input
                              type="password"
                              maxLength={target?.role === "owner" ? 20 : 6}
                              value={switchPinInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSwitchPinInput(target?.role === "owner" ? val : val.replace(/\D/g, ""));
                              }}
                              placeholder={target?.role === "owner" ? "PIN / REC-..." : "••••"}
                              className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-center text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                          </div>
                        );
                      })()}

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowSwitchCashierModal(false)}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleSwitchCashier}
                          disabled={isLoading || !switchCashierId}
                          className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isLoading ? "Mengganti..." : "Konfirmasi Kasir Baru"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rincian Kas Laci */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-medium">Modal Awal Laci</span>
                      <p className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                        Rp {activeShift.startingCash.toLocaleString("id-ID")}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-medium">Penjualan Tunai (+)</span>
                      <p className="text-sm font-bold text-emerald-600 font-mono mt-0.5">
                        Rp {activeShift.totalCashSales.toLocaleString("id-ID")}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-medium">Pelunasan Kasbon (+)</span>
                      <p className="text-sm font-bold text-blue-600 font-mono mt-0.5">
                        Rp {activeShift.totalDebtCollectedCash.toLocaleString("id-ID")}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-medium">Kas Masuk Laci (+)</span>
                      <p className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                        Rp {activeShift.totalCashIn.toLocaleString("id-ID")}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-medium">Pengeluaran Laci (-)</span>
                      <p className="text-sm font-bold text-rose-600 font-mono mt-0.5">
                        Rp {activeShift.totalCashOut.toLocaleString("id-ID")}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200">
                      <span className="text-[10px] text-indigo-700 font-bold">Total Laci Harapan</span>
                      <p className="text-sm font-bold text-indigo-950 font-mono mt-0.5">
                        Rp {activeShift.expectedCash.toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>

                  {/* Formulir Penutupan Shift */}
                  <form onSubmit={handleCloseShift} className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3.5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold pb-2 border-b border-slate-100">
                      <Lock className="w-4 h-4 text-slate-700" />
                      <span>Tutup Shift &amp; Hitung Fisik Laci (Ganti Kasir)</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Hitung Uang Fisik Nyata di Laci (Wajib dihitung manual):
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 font-bold text-slate-400 font-mono">
                          Rp
                        </span>
                        <input
                          type="text"
                          required
                          value={
                            actualCashInput
                              ? parseInt(actualCashInput.replace(/\D/g, "") || "0", 10).toLocaleString("id-ID")
                              : ""
                          }
                          onChange={(e) => setActualCashInput(e.target.value)}
                          placeholder="Masukkan total uang riil di laci..."
                          className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>

                    {actualCashInput && (
                      <div
                        className={`p-3 rounded-xl border flex items-center justify-between font-semibold ${
                          diff === 0
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : diff > 0
                            ? "bg-blue-50 border-blue-200 text-blue-800"
                            : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}
                      >
                        <span>
                          {diff === 0
                            ? "Uang Pas (Sesuai perhitungan sistem)"
                            : diff > 0
                            ? "Uang Fisik Lebih (+)"
                            : "Uang Fisik Kurang (-)"}
                        </span>
                        <span className="font-mono font-bold text-sm">
                          {diff >= 0 ? "+" : "-"} Rp {Math.abs(diff).toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Catatan Tutup Shift (Opsional):
                      </label>
                      <input
                        type="text"
                        value={closeNotes}
                        onChange={(e) => setCloseNotes(e.target.value)}
                        placeholder="Contoh: Titip uang setoran ke Pemilik Rp 300.000..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !actualCashInput}
                      className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{isLoading ? "Menutup Shift..." : "Konfirmasi & Tutup Shift Sekarang"}</span>
                    </button>
                  </form>
                </div>
              ) : (
                /* Shift Belum Dibuka -> Tampilkan Formulir Buka Shift Cepat */
                <div className="space-y-4">
                  {lastClosedShift && (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shadow-md border border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <p className="font-bold text-xs">
                            Shift {lastClosedShift.shiftCode} Baru Ditutup
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Kasir: {lastClosedShift.cashierName} &bull; Selisih:{" "}
                          {lastClosedShift.cashDifference === 0
                            ? "Pas (Rp 0)"
                            : (lastClosedShift.cashDifference ?? 0) > 0
                            ? `Lebih (+Rp ${(lastClosedShift.cashDifference ?? 0).toLocaleString("id-ID")})`
                            : `Kurang (-Rp ${Math.abs(lastClosedShift.cashDifference ?? 0).toLocaleString("id-ID")})`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrintShiftReceipt(lastClosedShift)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Cetak Rekap</span>
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleOpenShift} className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center gap-3 text-amber-900">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="leading-relaxed">
                        Laci kasir saat ini tertutup. Pilih kasir yang bertugas dan masukkan uang modal awal untuk memulai penjualan.
                      </p>
                    </div>

                    {/* Pemilihan Kasir Bertugas */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-2">
                        Pilih Kasir yang Bertugas:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {users.map((u) => {
                          const isSelected = selectedCashierId === u.id;
                          const isOwner = u.role === "owner";
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => setSelectedCashierId(u.id)}
                              className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                                isSelected
                                  ? isOwner
                                    ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-400 text-indigo-950 shadow-xs"
                                    : "bg-orange-50 border-orange-500 ring-2 ring-orange-400 text-orange-950 shadow-xs"
                                  : isOwner
                                  ? "bg-indigo-50/50 border-indigo-200 hover:bg-indigo-100/60 text-indigo-950"
                                  : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800"
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                  isSelected
                                    ? isOwner
                                      ? "bg-indigo-600 text-white"
                                      : "bg-orange-600 text-white"
                                    : isOwner
                                    ? "bg-indigo-100 text-indigo-800"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {isOwner ? <Crown className="w-4 h-4 text-amber-300" /> : u.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-xs truncate">{u.name}</p>
                                <span className={`text-[10px] font-semibold block ${isOwner ? "text-indigo-600 font-bold" : "text-slate-500"}`}>
                                  {isOwner ? "👑 Pemilik Toko" : "Kasir"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Jika Mode PIN Diwajibkan -> Tampilkan Input PIN Kasir / Pemilik */}
                    {(() => {
                      const selectedUser = allUsers.find((u) => u.id === selectedCashierId);
                      const isOwner = selectedUser?.role === "owner";
                      const showPinBox =
                        (isOwner && selectedUser?.hasPin) ||
                        (!isOwner && securitySettings?.requireCashierPin);

                      if (!showPinBox) return null;

                      return (
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 animate-in fade-in duration-150">
                          <label className="block text-[11px] font-bold text-slate-700">
                            {isOwner ? "Masukkan PIN Pemilik atau Kode Reset:" : "Masukkan PIN 4 Digit Kasir:"}{" "}
                            <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="password"
                            maxLength={isOwner ? 20 : 6}
                            value={cashierPinInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCashierPinInput(isOwner ? val : val.replace(/\D/g, ""));
                            }}
                            placeholder={isOwner ? "PIN / REC-..." : "••••"}
                            className="w-40 px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono font-bold tracking-wider text-center text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                          />
                        </div>
                      );
                    })()}

                    {/* Modal Awal Laci */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Uang Modal Awal di Laci (Uang Kembalian):
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 font-bold text-slate-400 font-mono">
                          Rp
                        </span>
                        <input
                          type="text"
                          required
                          value={parseInt(startingCashInput.replace(/\D/g, "") || "0", 10).toLocaleString("id-ID")}
                          onChange={(e) => setStartingCashInput(e.target.value)}
                          placeholder="Contoh: 100000"
                          className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                      {/* Quick Chips */}
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {[50000, 100000, 200000, 300000].map((nom) => (
                          <button
                            key={nom}
                            type="button"
                            onClick={() => setStartingCashInput(String(nom))}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-semibold cursor-pointer"
                          >
                            Rp {nom.toLocaleString("id-ID")}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Unlock className="w-3.5 h-3.5 text-orange-400" />
                      <span>{isLoading ? "Membuka Shift..." : "Buka Shift & Siap Melayani"}</span>
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* TAB 2: KAS MASUK / KELUAR LACI (PETTY CASH) */}
          {activeTab === "movement" && activeShift && (
            <div className="space-y-4">
              <form onSubmit={handleRecordMovement} className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-orange-600" />
                  <span>Catat Arus Kas Keluar / Masuk Laci Selama Shift</span>
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType("cash_out")}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer ${
                      movementType === "cash_out"
                        ? "bg-rose-50 border-rose-300 text-rose-700 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    <span>Kas Keluar (Beli es, galon, dll)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType("cash_in")}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer ${
                      movementType === "cash_in"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                    <span>Kas Masuk (Tambah modal)</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Nominal (Rp):</label>
                  <input
                    type="text"
                    required
                    value={
                      movementAmount
                        ? parseInt(movementAmount.replace(/\D/g, "") || "0", 10).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="Contoh: 20000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Alasan / Keperluan Wajib:</label>
                  <input
                    type="text"
                    required
                    value={movementReason}
                    onChange={(e) => setMovementReason(e.target.value)}
                    placeholder="Contoh: Beli es batu kristal 2 kantong..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  {isLoading ? "Menyimpan..." : "Simpan Mutasi Kas Laci"}
                </button>
              </form>

              {/* Riwayat Mutasi Shift Ini */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-700 text-xs">Riwayat Mutasi Shift Berjalan:</h5>
                {movements.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-4">Belum ada kas masuk atau kas keluar.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {movements.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          {m.type === "cash_in" ? (
                            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-rose-600" />
                          )}
                          <div>
                            <p className="font-bold text-slate-800">{m.reason}</p>
                            <span className="text-[10px] text-slate-400">{m.createdAt}</span>
                          </div>
                        </div>
                        <span
                          className={`font-mono font-bold text-xs ${
                            m.type === "cash_in" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {m.type === "cash_in" ? "+" : "-"} Rp {m.amount.toLocaleString("id-ID")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: KELOLA KASIR & PIN (PROTECTED BY OWNER PIN) */}
          {activeTab === "cashiers" && (
            <div className="space-y-4">
              {!isOwnerUnlocked ? (
                /* Kunci Otoritas Pemilik */
                <form
                  onSubmit={handleUnlockOwnerTab}
                  className="p-6 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-4 max-w-md mx-auto"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Akses Khusus Pemilik Toko</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Masukkan PIN Pemilik atau Kode Pemulihan Darurat untuk mengelola profil kasir &amp; pengaturan keamanan.
                    </p>
                  </div>
                  <input
                    type="password"
                    maxLength={20}
                    value={ownerPinInput}
                    onChange={(e) => setOwnerPinInput(e.target.value)}
                    placeholder="PIN atau REC-XXXX-XXXX..."
                    className="w-56 px-3 py-2.5 rounded-xl border border-slate-300 text-center font-mono font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none mx-auto block"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !ownerPinInput}
                    className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isLoading ? "Memeriksa..." : "Buka Menu Pemilik"}
                  </button>
                </form>
              ) : (
                /* Halaman Manajemen Kasir & PIN Aktif */
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Status Sesi Pemilik & Tombol Logout (Kunci Akses) */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-indigo-900/50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-xs text-white">Sesi Pemilik Terbuka</p>
                          <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Terverifikasi
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-0.5">
                          Klik Logout setelah selesai agar akses pengaturan kasir tidak terbuka di laptop warung.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOwnerLogout}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
                      title="Kunci kembali menu pemilik dan bersihkan sesi"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout / Kunci Menu</span>
                    </button>
                  </div>

                  {/* Mode Toggle PIN Kasir */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <h5 className="font-bold text-xs text-slate-900">
                        Wajibkan PIN 4 Digit untuk Kasir?
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {securitySettings?.requireCashierPin
                          ? "Status: AKTIF (Kasir wajib masukkan 4 digit PIN saat buka/ganti shift)."
                          : "Status: NONAKTIF (Mode Cepat Warung: Kasir cukup pilih profil namanya tanpa kata sandi)."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleRequirePin}
                      disabled={isLoading}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer shadow-2xs transition ${
                        securitySettings?.requireCashierPin
                          ? "bg-orange-600 text-white hover:bg-orange-700"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      {securitySettings?.requireCashierPin ? "Aktif (Wajib PIN)" : "Nonaktif (Cepat)"}
                    </button>
                  </div>

                  {/* Header Daftar Kasir */}
                  <div className="flex items-center justify-between pt-1">
                    <h5 className="font-bold text-slate-900 text-xs">Daftar Pengguna &amp; Kasir Toko:</h5>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddCashierModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Tambah Kasir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowChangeOwnerPin(true)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Ubah PIN Pemilik</span>
                      </button>
                    </div>
                  </div>

                  {/* List Pengguna */}
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {allUsers.map((u) => (
                      <div
                        key={u.id}
                        className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              u.role === "owner"
                                ? "bg-indigo-600 text-white"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-xs">{u.name}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                  u.role === "owner"
                                    ? "bg-indigo-100 text-indigo-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {u.role === "owner" ? "Pemilik" : "Kasir"}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {u.hasPin ? "PIN Terpasang" : "Tanpa PIN"} &bull; {u.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                        </div>

                        {u.role !== "owner" && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const newName = prompt("Ubah Nama Kasir:", u.name);
                                if (newName && newName.trim()) {
                                  await fetch("/api/shift", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      action: "update_cashier",
                                      id: u.id,
                                      name: newName.trim(),
                                      isActive: u.isActive,
                                    }),
                                  });
                                  fetchShiftData();
                                }
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                              title="Ubah Nama"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const newPin = prompt("Masukkan PIN 4 digit baru (kosongkan jika tanpa PIN):");
                                if (newPin !== null) {
                                  await fetch("/api/shift", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      action: "update_cashier",
                                      id: u.id,
                                      name: u.name,
                                      isActive: u.isActive,
                                      pin: newPin.trim(),
                                    }),
                                  });
                                  fetchShiftData();
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-bold cursor-pointer"
                            >
                              Reset PIN
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Modal Tambah Kasir */}
                  {showAddCashierModal && (
                    <div className="p-4 rounded-2xl bg-orange-50/80 border border-orange-200 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <h6 className="font-bold text-xs text-orange-950">Tambah Profil Kasir Baru</h6>
                        <button
                          type="button"
                          onClick={() => setShowAddCashierModal(false)}
                          className="text-orange-600 hover:text-orange-900 text-xs font-bold"
                        >
                          Batal
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-orange-900 mb-1">
                            Nama Kasir:
                          </label>
                          <input
                            type="text"
                            value={newCashierName}
                            onChange={(e) => setNewCashierName(e.target.value)}
                            placeholder="Contoh: Slamet"
                            className="w-full px-3 py-1.5 rounded-xl bg-white border border-orange-200 text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-orange-900 mb-1">
                            PIN 4 Digit (Opsional):
                          </label>
                          <input
                            type="password"
                            maxLength={4}
                            value={newCashierPin}
                            onChange={(e) => setNewCashierPin(e.target.value.replace(/\D/g, ""))}
                            placeholder="Contoh: 1234"
                            className="w-full px-3 py-1.5 rounded-xl bg-white border border-orange-200 text-xs font-mono outline-none"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCashier}
                        disabled={isLoading || !newCashierName}
                        className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        Simpan Kasir
                      </button>
                    </div>
                  )}

                  {/* Modal Ganti PIN Pemilik */}
                  {showChangeOwnerPin && (
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <h6 className="font-bold text-xs text-indigo-950">Perbarui PIN Pemilik Toko</h6>
                        <button
                          type="button"
                          onClick={() => setShowChangeOwnerPin(false)}
                          className="text-indigo-600 hover:text-indigo-900 text-xs font-bold"
                        >
                          Batal
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-900 mb-1">
                            PIN Lama / Kode Pemulihan:
                          </label>
                          <input
                            type="password"
                            maxLength={20}
                            value={oldOwnerPin}
                            onChange={(e) => setOldOwnerPin(e.target.value)}
                            placeholder="PIN lama atau REC-XXXX-XXXX..."
                            className="w-full px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-900 mb-1">
                            PIN Baru (4–6 Angka):
                          </label>
                          <input
                            type="password"
                            maxLength={6}
                            value={newOwnerPin}
                            onChange={(e) => setNewOwnerPin(e.target.value.replace(/\D/g, ""))}
                            placeholder="Ketik PIN baru..."
                            className="w-full px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-mono outline-none"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleChangeOwnerPin}
                        disabled={isLoading || !newOwnerPin}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        Perbarui PIN Pemilik
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL LOG */}
          {activeTab === "audit" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-slate-800 text-xs">Jejak Rekam Aktivitas Sensitif Toko:</h5>
                <button
                  type="button"
                  onClick={fetchShiftData}
                  className="text-slate-500 hover:text-slate-800 text-[11px] font-bold flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-slate-400 italic text-center py-6">Belum ada aktivitas tercatat.</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-[11px] text-slate-900">{log.action}</span>
                          <span className="text-[10px] text-slate-500">&bull; Oleh: {log.userName}</span>
                        </div>
                        {log.details && (
                          <p className="text-[11px] text-slate-600 mt-0.5">{log.details}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{log.createdAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {activeShift
              ? `Shift aktif: ${activeShift.cashierName} (${activeShift.shiftCode})`
              : "Laci Kasir Tertutup"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
          >
            Tutup Jendela
          </button>
        </div>
      </div>
    </div>
  );
};
