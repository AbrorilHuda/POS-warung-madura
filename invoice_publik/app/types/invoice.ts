export interface PublicInvoiceItem {
  id: string;
  invoiceId: string;
  productName: string;
  unitName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface PublicInvoice {
  id: string; // contoh: WM01-000141
  storeName: string;
  storeAddress: string;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: "Tunai" | "QRIS" | "Hutang" | string;
  cashierName: string;
  createdAt: string;
  items: PublicInvoiceItem[];
  isDemoMock?: boolean;
  retentionHours?: number;
  expiresAt?: string;
  remainingMinutes?: number;
  isExpired?: boolean;
}

export interface InvoiceQueryResult {
  invoice: PublicInvoice | null;
  status: "found" | "not_found" | "expired" | "invalid_code";
  message?: string;
  retentionHours: number;
}

export interface SyncPayload {
  secretKey: string;
  invoice: {
    id: string;
    invoiceCode?: string;
    storeName?: string;
    storeAddress?: string;
    totalAmount: number;
    paidAmount: number;
    changeAmount: number;
    paymentMethod: string;
    cashierName: string;
    createdAt?: string;
    items: Array<{
      productName: string;
      unitName: string;
      qty: number;
      price: number;
      subtotal: number;
    }>;
  };
}
