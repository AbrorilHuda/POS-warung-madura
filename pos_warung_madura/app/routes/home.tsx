import { useState, useEffect, useRef } from "react";
import type { Route } from "./+types/home";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { testDbConnection } from "../db.server";
import {
  getProductsFromDb,
  getSalesFromDb,
  getStockMovementsFromDb,
  createSaleTransaction,
  createProductWithUnits,
  updateProductWithUnits,
  deleteProductInDb,
  createStockKulakan,
  createStockOpnameAdjustment,
  syncSalesInDb,
} from "../services/pos.server";
import { Sidebar } from "../components/Sidebar";
import { KasirPOS } from "../components/KasirPOS";
import { ProductCatalog } from "../components/ProductCatalog";
import { Kulakan } from "../components/Kulakan";
import { StokOpname } from "../components/StokOpname";
import { Laporan } from "../components/Laporan";
import { ReceiptModal } from "../components/ReceiptModal";
import { QuickAddModal } from "../components/QuickAddModal";
import { BarcodeSimulatorModal } from "../components/BarcodeSimulatorModal";
import { ConnectPhoneScannerModal } from "../components/ConnectPhoneScannerModal";
import { sendCustomerDisplayEvent } from "../services/customerDisplaySync";
import {
  initialProducts,
  initialSales,
  initialStockMovements,
} from "../data/sampleData";
import type {
  Product,
  ProductUnit,
  Sale,
  StockMovement,
  StockOpnameItem,
} from "../types/pos";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "POS Warung Madura" },
    {
      name: "description",
      content:
        "Sistem Kasir Warung Madura Fullstack React Router & MySQL Lokal di Laptop Warung",
    },
  ];
}

/**
 * LOADER: Berjalan di Node.js server lokal di laptop warung.
 * Mengambil produk & stok realtime dari MySQL.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const dbStatus = await testDbConnection();

  if (dbStatus.ok) {
    try {
      const [products, sales, stockMovements] = await Promise.all([
        getProductsFromDb(),
        getSalesFromDb(),
        getStockMovementsFromDb(),
      ]);

      return {
        dbConnected: true,
        dbMessage: dbStatus.message,
        products: products.length > 0 ? products : initialProducts,
        sales: sales.length > 0 ? sales : initialSales,
        stockMovements: stockMovements.length > 0 ? stockMovements : initialStockMovements,
      };
    } catch (err: any) {
      console.error("Gagal load data dari MySQL:", err);
      return {
        dbConnected: false,
        dbMessage: err.message,
        products: initialProducts,
        sales: initialSales,
        stockMovements: initialStockMovements,
      };
    }
  }

  return {
    dbConnected: false,
    dbMessage: dbStatus.message,
    products: initialProducts,
    sales: initialSales,
    stockMovements: initialStockMovements,
  };
}

/**
 * ACTION: Berjalan di Node.js server lokal di laptop warung.
 * Menyimpan mutasi data transaksi, kulakan, dan opname langsung ke MySQL lokal.
 */
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "record_sale") {
      const saleJson = formData.get("sale") as string;
      const sale: Sale = JSON.parse(saleJson);
      await createSaleTransaction(sale);
      return { ok: true, intent, message: "Transaksi berhasil dicatat di MySQL" };
    }

    if (intent === "add_product") {
      const productJson = formData.get("product") as string;
      const product: Product = JSON.parse(productJson);
      await createProductWithUnits(product);
      return { ok: true, intent, message: "Produk berhasil ditambahkan ke MySQL" };
    }

    if (intent === "update_product") {
      const productJson = formData.get("product") as string;
      const product: Product = JSON.parse(productJson);
      await updateProductWithUnits(product);
      return { ok: true, intent, message: "Produk berhasil diperbarui di MySQL" };
    }

    if (intent === "delete_product") {
      const productId = formData.get("product_id") as string;
      await deleteProductInDb(productId);
      return { ok: true, intent, message: "Produk berhasil dihapus dari MySQL" };
    }

    if (intent === "kulakan") {
      const kulakanJson = formData.get("kulakan") as string;
      const data = JSON.parse(kulakanJson);
      await createStockKulakan(data);
      return { ok: true, intent, message: "Kulakan berhasil dicatat di ledger MySQL" };
    }

    if (intent === "opname") {
      const sessionCode = (formData.get("session_code") as string) || `OPN-${Date.now()}`;
      const itemsJson = formData.get("items") as string;
      const items: StockOpnameItem[] = JSON.parse(itemsJson);
      await createStockOpnameAdjustment(sessionCode, items);
      return { ok: true, intent, message: "Penyesuaian opname tersimpan di MySQL" };
    }

    if (intent === "sync_cloud") {
      const syncedCount = await syncSalesInDb();
      return { ok: true, intent, syncedCount, message: `${syncedCount} transaksi disinkronkan` };
    }

    return { ok: false, error: "Aksi tidak dikenal" };
  } catch (err: any) {
    console.error("Action error:", err);
    return { ok: false, error: err.message };
  }
}

export default function Home() {
  const loaderData = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<
    "kasir" | "katalog" | "kulakan" | "opname" | "laporan"
  >("kasir");

  // Local synced state from loaderData
  const [products, setProducts] = useState<Product[]>(loaderData.products);
  const [sales, setSales] = useState<Sale[]>(loaderData.sales);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(loaderData.stockMovements);

  // Sync state when loaderData refreshes
  useEffect(() => {
    setProducts(loaderData.products);
    setSales(loaderData.sales);
    setStockMovements(loaderData.stockMovements);
  }, [loaderData]);

  // Modals
  const [activeReceiptSale, setActiveReceiptSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [quickScanTriggerBarcode, setQuickScanTriggerBarcode] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Wireless Phone Scanner (PRD F12)
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [phoneDeviceName, setPhoneDeviceName] = useState<string | null>(null);
  const [isConnectPhoneModalOpen, setIsConnectPhoneModalOpen] = useState(false);
  const [phoneScanToast, setPhoneScanToast] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Sound beep on laptop
  const playLaptopBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
  };

  const lastPhoneScanCodeRef = useRef<string>("");
  const lastPhoneScanTimeRef = useRef<number>(0);

  const handleIncomingPhoneScan = (barcode: string) => {
    const cleanCode = barcode.trim();
    if (!cleanCode) return;

    const now = Date.now();
    // Safety throttle: prevent same barcode repeating within 2000ms
    if (cleanCode === lastPhoneScanCodeRef.current && now - lastPhoneScanTimeRef.current < 2000) {
      return;
    }
    lastPhoneScanCodeRef.current = cleanCode;
    lastPhoneScanTimeRef.current = now;

    playLaptopBeep();
    setActiveTab("kasir");
    setQuickScanTriggerBarcode(cleanCode);

    // Look up product name to display toast & send back confirmation to phone
    let foundProduct: Product | undefined;
    let foundUnit: ProductUnit | undefined;

    for (const p of products) {
      const u = p.units.find(
        (unit) => unit.barcode.toLowerCase() === cleanCode.toLowerCase()
      );
      if (u) {
        foundProduct = p;
        foundUnit = u;
        break;
      }
    }

    if (foundProduct && foundUnit) {
      setPhoneScanToast(`📱 HP Scan: ${foundProduct.name} (${foundUnit.unitName})`);
      setTimeout(() => setPhoneScanToast(null), 3000);

      const confirmMsg = {
        type: "SCAN_CONFIRMED",
        productName: foundProduct.name,
        unitName: foundUnit.unitName,
        price: foundUnit.price,
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(confirmMsg));
      }
      try {
        broadcastChannelRef.current?.postMessage(confirmMsg);
      } catch (e) {}
    } else {
      setPhoneScanToast(`📱 HP Scan: Barcode Baru ${cleanCode}`);
      setTimeout(() => setPhoneScanToast(null), 3000);
    }
  };

  // WebSocket & BroadcastChannel listener for F12
  useEffect(() => {
    // 1. BroadcastChannel (for testing in tabs on same machine)
    try {
      const bc = new BroadcastChannel("pos_scanner_channel");
      broadcastChannelRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data?.type === "DEVICE_CONNECTED") {
          setIsPhoneConnected(true);
          setPhoneDeviceName(event.data.deviceName || "HP Kasir");
        } else if (event.data?.type === "SCAN" && event.data.barcode) {
          handleIncomingPhoneScan(event.data.barcode);
        }
      };
    } catch (e) {}

    // 2. WebSocket connection (supports WSS via Vite /ws-scanner or fallback port 3001)
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    const wsProtocol = isHttps ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "localhost:5174";
    const wsUrl = `${wsProtocol}//${host}/ws-scanner`;

    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "LAPTOP_READY" }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "DEVICE_CONNECTED") {
              setIsPhoneConnected(true);
              setPhoneDeviceName(data.deviceName || "HP Kasir");
            } else if (data.type === "CLIENT_DISCONNECTED") {
              setIsPhoneConnected(false);
            } else if (data.type === "SCAN" && data.barcode) {
              handleIncomingPhoneScan(data.barcode);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          setIsPhoneConnected(false);
          setTimeout(connectWs, 2500);
        };
      } catch (e) {
        setIsPhoneConnected(false);
      }
    };

    connectWs();

    return () => {
      wsRef.current?.close();
      broadcastChannelRef.current?.close();
    };
  }, [products]);

  // Keyboard shortcut listeners (F2..F6, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setActiveTab("kasir");
      } else if (e.key === "F3") {
        e.preventDefault();
        setActiveTab("katalog");
      } else if (e.key === "F4") {
        e.preventDefault();
        setActiveTab("kulakan");
      } else if (e.key === "F5") {
        e.preventDefault();
        setActiveTab("opname");
      } else if (e.key === "F6") {
        e.preventDefault();
        setActiveTab("laporan");
      } else if (e.key === "Escape") {
        setIsReceiptOpen(false);
        setIsQuickAddOpen(false);
        setIsSimulatorOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 1. Simpan Transaksi Penjualan -> Action MySQL
  const handleRecordSale = (newSale: Sale) => {
    // Optimistic UI update
    setSales((prev) => [newSale, ...prev]);
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        const soldItems = newSale.items.filter((it) => it.productId === p.id);
        if (soldItems.length === 0) return p;
        const deduction = soldItems.reduce(
          (sum, it) => sum + it.qty * it.conversionRatio,
          0
        );
        return {
          ...p,
          stockInBaseUnit: Math.max(0, p.stockInBaseUnit - deduction),
        };
      })
    );

    setActiveReceiptSale(newSale);
    setIsReceiptOpen(true);

    // Kirim ke server action untuk disimpan di MySQL
    const formData = new FormData();
    formData.append("intent", "record_sale");
    formData.append("sale", JSON.stringify(newSale));
    submit(formData, { method: "post" });
  };

  // 2. Tambah Produk Baru -> Action MySQL
  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);

    const formData = new FormData();
    formData.append("intent", "add_product");
    formData.append("product", JSON.stringify(newProduct));
    submit(formData, { method: "post" });
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));

    const formData = new FormData();
    formData.append("intent", "update_product");
    formData.append("product", JSON.stringify(updatedProduct));
    submit(formData, { method: "post" });
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));

    const formData = new FormData();
    formData.append("intent", "delete_product");
    formData.append("product_id", productId);
    submit(formData, { method: "post" });
  };

  const handleSaveAndAddToCart = (newProduct: Product, unit: ProductUnit) => {
    handleAddProduct(newProduct);
    setQuickScanTriggerBarcode(unit.barcode);
    setIsQuickAddOpen(false);
  };

  const handleRequestUnknownBarcode = (barcode: string) => {
    setUnknownBarcode(barcode);
    setIsQuickAddOpen(true);
  };

  // 3. Catat Kulakan Masuk -> Action MySQL
  const handleAddStockMovement = (
    productId: string,
    unit: ProductUnit,
    unitQty: number,
    costPrice: number,
    supplier: string
  ) => {
    const qtyInBaseUnit = unitQty * unit.conversionRatio;
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    // Optimistic UI
    const newMov: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      type: "in",
      quantityInBaseUnit: qtyInBaseUnit,
      unitNameUsed: unit.unitName,
      unitQtyUsed: unitQty,
      costPerUnit: costPrice,
      notes: `Kulakan dari ${supplier}`,
      timestamp: new Date().toLocaleString("id-ID"),
    };

    setStockMovements((prev) => [newMov, ...prev]);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, stockInBaseUnit: p.stockInBaseUnit + qtyInBaseUnit }
          : p
      )
    );

    // Kirim ke MySQL
    const formData = new FormData();
    formData.append("intent", "kulakan");
    formData.append(
      "kulakan",
      JSON.stringify({ productId, unit, unitQty, costPrice, supplier })
    );
    submit(formData, { method: "post" });
  };

  // Compute next continuous invoice sequence number from MySQL sales
  const nextInvoiceSeq =
    sales.reduce((max, s) => {
      const match = s.invoiceCode.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 140) + 1;

  // 4. Catat Opname Bulanan -> Action MySQL
  const handleApplyOpnameAdjustment = (items: StockOpnameItem[]) => {
    const sessionCode = `OPN-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-4)}`;

    setProducts((prev) =>
      prev.map((p) => {
        const item = items.find((it) => it.productId === p.id);
        if (!item || item.difference === 0) return p;
        return { ...p, stockInBaseUnit: item.physicalStock };
      })
    );

    const formData = new FormData();
    formData.append("intent", "opname");
    formData.append("session_code", sessionCode);
    formData.append("items", JSON.stringify(items));
    submit(formData, { method: "post" });
  };

  // 5. Sync Cloud -> Action MySQL
  const handleTriggerSync = () => {
    setIsSyncing(true);
    const formData = new FormData();
    formData.append("intent", "sync_cloud");
    submit(formData, { method: "post" });

    setTimeout(() => {
      setSales((prev) =>
        prev.map((s) => ({ ...s, syncStatus: "synced" }))
      );
      setIsSyncing(false);
    }, 1200);
  };

  const pendingSyncCount = sales.filter((s) => s.syncStatus === "pending").length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-row">
      {/* Sleek Minimalist Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingSyncCount={pendingSyncCount}
        onTriggerSync={handleTriggerSync}
        isSyncing={isSyncing || navigation.state === "submitting"}
        onOpenQuickScan={() => setIsSimulatorOpen(true)}
        onOpenPhoneScannerModal={() => setIsConnectPhoneModalOpen(true)}
        isPhoneConnected={isPhoneConnected}
        dbConnected={loaderData.dbConnected}
        dbMessage={loaderData.dbMessage}
      />

      {/* Main Content */}
      <main className="flex-1 min-w-0 min-h-screen overflow-y-auto">
        {/* Realtime Toast when Barcode is scanned from Phone (F12) */}
        {phoneScanToast && (
          <div className="bg-slate-900 text-white px-5 py-2.5 text-xs font-semibold flex items-center justify-between shadow-md border-b border-slate-800 animate-pulse">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {phoneScanToast}
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
              Via WebSocket
            </span>
          </div>
        )}
        {activeTab === "kasir" && (
          <KasirPOS
            products={products}
            nextInvoiceSeq={nextInvoiceSeq}
            onAddNewProduct={handleAddProduct}
            onRecordSale={handleRecordSale}
            onRequestUnknownBarcode={handleRequestUnknownBarcode}
            quickScanTriggerBarcode={quickScanTriggerBarcode}
            onClearQuickScanTrigger={() => setQuickScanTriggerBarcode(null)}
          />
        )}

        {activeTab === "katalog" && (
          <ProductCatalog
            products={products}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        )}

        {activeTab === "kulakan" && (
          <Kulakan
            products={products}
            stockMovements={stockMovements}
            onAddStockMovement={handleAddStockMovement}
          />
        )}

        {activeTab === "opname" && (
          <StokOpname
            products={products}
            onApplyOpnameAdjustment={handleApplyOpnameAdjustment}
          />
        )}

        {activeTab === "laporan" && (
          <Laporan
            sales={sales}
            products={products}
            onViewSaleReceipt={(sale) => {
              setActiveReceiptSale(sale);
              setIsReceiptOpen(true);
              sendCustomerDisplayEvent({
                type: "SALE_COMPLETED",
                sale,
                timestamp: Date.now(),
              });
            }}
            onSyncAllSales={handleTriggerSync}
            isSyncing={isSyncing}
          />
        )}
      </main>

      {/* Modals */}
      <ReceiptModal
        sale={activeReceiptSale}
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          // Jangan langsung reset layar pelanggan agar pembeli tetap bisa men-scan QR code di layar kedua
        }}
        onNewTransaction={() => {
          setIsReceiptOpen(false);
          sendCustomerDisplayEvent({
            type: "STANDBY",
            timestamp: Date.now(),
          });
        }}
      />

      <QuickAddModal
        scannedBarcode={unknownBarcode || ""}
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSaveAndAddToCart={handleSaveAndAddToCart}
      />

      <BarcodeSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        products={products}
        onScanCode={(code) => {
          setActiveTab("kasir");
          setQuickScanTriggerBarcode(code);
        }}
      />

      {/* Connect Wireless Phone Scanner Modal (PRD F12) */}
      <ConnectPhoneScannerModal
        isOpen={isConnectPhoneModalOpen}
        onClose={() => setIsConnectPhoneModalOpen(false)}
        isPhoneConnected={isPhoneConnected}
        phoneDeviceName={phoneDeviceName}
      />
    </div>
  );
}
