export type UnitType = 'pcs' | 'pack' | 'slop' | 'dus' | 'renteng' | 'karton' | 'kg' | 'liter' | 'butir' | 'batang' | 'tabung';

export interface ProductUnit {
  id: string;
  productId: string;
  unitName: string; // e.g. "Pcs", "Pack", "Slop", "Dus"
  conversionRatio: number; // multiplier to base unit, e.g. Pack = 12 pcs, Slop = 120 pcs, Dus = 40 pcs
  price: number; // selling price for this unit
  costPrice?: number; // estimated purchase price
  barcode: string; // specific barcode for this unit
  isBaseUnit?: boolean;
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
  price: number;
  qty: number;
  barcode: string;
  costPrice?: number;
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
}

export interface Sale {
  id: string;
  invoiceCode: string; // e.g. "WM01-000142"
  timestamp: string;
  items: SaleItemSnapshot[];
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: 'Tunai' | 'QRIS' | 'Hutang';
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
  notes?: string;
}

export interface StockOpnameSession {
  id: string;
  date: string;
  status: 'draft' | 'completed';
  totalDiscrepancyItems: number;
  notes: string;
  items: StockOpnameItem[];
}
