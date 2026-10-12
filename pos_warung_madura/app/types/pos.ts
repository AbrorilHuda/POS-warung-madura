export type UnitType = 'pcs' | 'pack' | 'slop' | 'dus' | 'renteng' | 'karton' | 'kg' | 'liter' | 'butir' | 'batang' | 'tabung';

export type CustomerGroupType = 'umum' | 'langganan' | 'reseller';

// ----------------------------------------------------------------------------
// HARGA BERTINGKAT & GROSIR / RESELLER (PRD F3)
// ----------------------------------------------------------------------------
export interface ProductPriceTier {
  id?: string;
  productId?: string;
  unitId?: string;
  tierName: string; // e.g. "Grosir", "Reseller", "Kartonan"
  minQty: number; // minimum quantity to trigger this price (e.g. >= 12)
  price: number; // selling price per unit at this tier
  customerGroup?: CustomerGroupType | null; // target customer group (null/undefined/umum = berlaku untuk semua)
}

export interface ProductUnit {
  id: string;
  productId: string;
  unitName: string; // e.g. "Pcs", "Pack", "Slop", "Dus"
  conversionRatio: number; // multiplier to base unit, e.g. Pack = 12 pcs, Slop = 120 pcs, Dus = 40 pcs
  price: number; // selling price for this unit (base/normal minQty = 1)
  costPrice?: number; // estimated purchase price
  barcode: string; // specific barcode for this unit
  isBaseUnit?: boolean;
  priceTiers?: ProductPriceTier[]; // Tingkat harga grosir & reseller (PRD F3)
}

export interface Product {
  id: string;
  name: string;
  category: 'Rokok' | 'Mie & Sembako' | 'Minuman Dingin' | 'Jajanan & Kopi' | 'Gas & Galon' | 'Kebutuhan Harian';
  baseUnit: string; // e.g. "pcs", "kg", "butir"
  stockInBaseUnit: number; // current stock calculated from ledger
  units: ProductUnit[];
  image?: string;
  minStockAlert?: number;
}

export interface CartItem {
  id: string; // unique cart line id
  productId: string;
  productName: string;
  unitId: string;
  unitName: string;
  conversionRatio: number;
  basePrice: number; // harga normal satuan (sebelum diskon tier)
  price: number; // harga satuan aktif setelah kalkulasi tier
  qty: number;
  barcode: string;
  costPrice?: number;
  appliedTierName?: string; // e.g. "Grosir (Min 12)" atau "Reseller"
  isWholesalePrice?: boolean;
}

export interface SaleItemSnapshot {
  productId: string;
  productName: string;
  unitName: string;
  conversionRatio: number;
  price: number;
  qty: number;
  subtotal: number;
  costPrice?: number;
  basePrice?: number;
  appliedTierName?: string;
  isWholesalePrice?: boolean;
}


export interface Sale {
  id: string;
  invoiceCode: string; // e.g. "WM01-000142"
  timestamp: string;
  items: SaleItemSnapshot[];
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: 'Tunai' | 'QRIS' | 'Hutang' | 'Kasbon' | 'Campuran';
  splitPayments?: Array<{
    method: 'Tunai' | 'QRIS' | 'Transfer' | 'Kasbon';
    amount: number;
    referenceNo?: string;
  }>;
  isVoid?: boolean;
  voidReason?: string;
  discountAmount?: number;
  customerId?: string;
  customerName?: string;
  customerDebtRemaining?: number;
  syncStatus: 'synced' | 'pending' | 'failed';
  cashierName: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjustment';
  quantityInBaseUnit: number;
  unitNameUsed: string;
  unitQtyUsed: number;
  costPerUnit?: number;
  referenceType?: string;
  referenceId?: string;
  batchId?: string;
  notes: string;
  timestamp: string;
}

export interface StockOpnameItem {
  productId: string;
  productName: string;
  baseUnit: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  costPrice?: number;
  financialDiff?: number;
  notes?: string;
}

export interface StockOpnameSession {
  id: string;
  sessionCode?: string;
  date: string;
  status: 'draft' | 'completed';
  categoryFilter?: string | null;
  totalItems?: number;
  totalDiscrepancyItems: number;
  totalFinancialDiff?: number;
  notes: string;
  items: StockOpnameItem[];
  completedAt?: string | null;
}

// ----------------------------------------------------------------------------
// MANAJEMEN STOK LANJUTAN (PRD F7)
// ----------------------------------------------------------------------------
export type ExpiryStatus = 'safe' | 'warning_30' | 'warning_7' | 'expired';

export interface StockBatch {
  id: string;
  productId: string;
  productName?: string;
  category?: string;
  baseUnit?: string;
  batchNo: string;
  qtyBase: number;
  initialQtyBase: number;
  costPrice: number;
  expiryDate: string | null; // YYYY-MM-DD
  receivedAt: string;
  notes?: string | null;
  daysUntilExpiry?: number | null;
  expiryStatus?: ExpiryStatus;
}

export type StockAdjustmentReason =
  | 'rusak'
  | 'hilang'
  | 'kedaluwarsa'
  | 'konsumsi_sendiri'
  | 'koreksi';

export interface StockAdjustmentInput {
  productId: string;
  qtyDiff: number; // negatif untuk keluar, positif untuk masuk
  reasonCategory: StockAdjustmentReason;
  notes?: string;
  batchId?: string;
  approvedBy?: string;
}

export interface StockCardEntry {
  id: string;
  date: string;
  type: 'in' | 'out' | 'adjustment';
  refType: string;
  refId?: string;
  qtyChange: number;
  unitNameUsed: string;
  unitQtyUsed: number;
  runningBalance: number;
  costPerUnit?: number;
  notes: string;
  batchNo?: string;
  batchExpiry?: string | null;
}

export interface ReorderRecommendation {
  productId: string;
  productName: string;
  category: string;
  baseUnit: string;
  currentStock: number;
  minStock: number;
  avgDailySales: number;
  daysOfStockLeft: number;
  suggestedOrderQty: number;
  lastCostPrice: number;
  estimatedTotalCost: number;
  urgency: 'critical' | 'warning' | 'normal';
}

export interface StockOpnameSessionRecord {
  id: string;
  sessionCode: string;
  status: 'draft' | 'completed';
  categoryFilter?: string | null;
  totalItems: number;
  totalDiscrepancyItems: number;
  totalFinancialDiff: number;
  notes?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

// ----------------------------------------------------------------------------
// TIPE DATA PELANGGAN & KASBON (PRD F1)
// ----------------------------------------------------------------------------
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  customerGroup?: CustomerGroupType; // 'umum' | 'langganan' | 'reseller' (PRD F3.3)
  creditLimit: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerSummary extends Customer {
  totalDebt: number;
  unpaidInvoicesCount: number;
  earliestDueDate?: string | null;
  lastReceivableAt?: string | null;
  isOverLimit: boolean;
}

export interface ReceivableItem {
  id: string;
  customerId: string;
  saleId?: string | null;
  invoiceCode?: string | null;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string | null;
  status: 'open' | 'partial' | 'paid' | 'void';
  notes?: string;
  createdAt: string;
}

export interface ReceivablePayment {
  id: string;
  customerId: string;
  receivableId?: string | null;
  amount: number;
  paymentMethod: 'Tunai' | 'Transfer' | 'QRIS';
  notes?: string;
  paidAt: string;
  shiftId?: string | null;
  createdBy: string;
}

export interface CustomerLedgerEntry {
  id: string;
  date: string;
  type: 'kasbon' | 'pelunasan';
  description: string;
  debit: number; // Kasbon bertambah
  credit: number; // Pelunasan dibayar
  balance: number; // Saldo berjalan
  invoiceCode?: string | null;
  paymentMethod?: string | null;
}

// ----------------------------------------------------------------------------
// TIPE DATA SHIFT & KEAMANAN MULTI-USER (PRD F5)
// ----------------------------------------------------------------------------
export interface ShiftSecuritySettings {
  isSetupCompleted: boolean;
  requireCashierPin: boolean;
  hasOwnerPin: boolean;
  ownerName: string;
  ownerHasRecoveryCode: boolean;
}

export interface UserSession {
  id: string;
  name: string;
  role: "owner" | "cashier" | "stock_admin";
}

export interface UserDetail {
  id: string;
  name: string;
  role: "owner" | "cashier" | "stock_admin";
  isActive: boolean;
  hasPin: boolean;
  createdAt: string;
}

export interface ShiftData {
  id: string;
  shiftCode: string;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime: string | null;
  startingCash: number;
  expectedCash: number;
  actualCash: number | null;
  cashDifference: number | null;
  totalCashSales: number;
  totalQrisSales: number;
  totalDebtSales: number;
  totalDebtCollectedCash: number;
  totalCashIn: number;
  totalCashOut: number;
  status: "open" | "closed";
  notes: string | null;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  type: "cash_in" | "cash_out";
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  userName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
}

