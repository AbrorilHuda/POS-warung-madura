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
