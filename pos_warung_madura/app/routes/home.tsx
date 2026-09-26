import { useState, useEffect, useRef } from "react";
import type { Route } from "./+types/home";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
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
  testCloudConnection,
  getStoreConfig,
  type StoreConfig,
} from "../services/pos.server";
import { Sidebar } from "../components/Sidebar";
import { KasirPOS } from "../components/KasirPOS";
import { ProductCatalog } from "../components/ProductCatalog";
import { Kulakan } from "../components/Kulakan";
import { StokOpname } from "../components/StokOpname";
import { Laporan } from "../components/Laporan";
import { ReceiptModal } from "../components/ReceiptModal";
import { QuickAddModal } from "../components/QuickAddModal";
import { ConnectPhoneScannerModal } from "../components/ConnectPhoneScannerModal";
import { sendCustomerDisplayEvent } from "../services/customerDisplaySync";
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

import os from "node:os";

function getLocalIpAddress(): string {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (e) {}
  return "192.168.1.12";
}

/**
 * LOADER: Berjalan di Node.js server lokal di laptop warung.
 * Mengambil produk & stok realtime dari MySQL.
 * Tidak ada auto-seed atau dummy data otomatis; murni dari database MySQL lokal.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const dbStatus = await testDbConnection();
  const cloudStatus = await testCloudConnection();
  const localIp = getLocalIpAddress();
  const storeConfig = getStoreConfig();

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
        cloudConnected: cloudStatus.ok,
        cloudMessage: cloudStatus.message,
        products: products,
        sales: sales,
        stockMovements: stockMovements,
        detectedIp: localIp,
        storeConfig,
      };
    } catch (err: any) {
      console.error("Gagal load data dari MySQL:", err);
      return {
        dbConnected: false,
        dbMessage: err.message,
        cloudConnected: cloudStatus.ok,
        cloudMessage: cloudStatus.message,
        products: [] as Product[],
        sales: [] as Sale[],
        stockMovements: [] as StockMovement[],
        detectedIp: localIp,
        storeConfig,
      };
    }
  }

  return {
    dbConnected: false,
    dbMessage: dbStatus.message,
    cloudConnected: cloudStatus.ok,
    cloudMessage: cloudStatus.message,
    products: [] as Product[],
    sales: [] as Sale[],
    stockMovements: [] as StockMovement[],
    detectedIp: localIp,
    storeConfig,
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
      const syncResult = await syncSalesInDb();
      return {
        ok: syncResult.syncedCount > 0 || (syncResult.cloudOnline && syncResult.totalPending === 0),
        intent,
        ...syncResult,
      };
    }

    return { ok: false, error: "Aksi tidak dikenal" };
  } catch (err: any) {
    console.error("Action error:", err);
    return { ok: false, error: err.message };
  }
}

export default function Home() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
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
  const [quickScanTriggerBarcode, setQuickScanTriggerBarcode] = useState<string | null>(null);
  const [quickScanKulakanBarcode, setQuickScanKulakanBarcode] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (actionData && actionData.intent === "sync_cloud") {
      setIsSyncing(false);
      const syncRes = actionData as any;
      if (syncRes.syncedCount > 0) {
        setSyncToast({
          type: "success",
          message: syncRes.message || `${syncRes.syncedCount} transaksi berhasil disinkronkan ke cloud.`,
        });
      } else if (!syncRes.cloudOnline) {
        setSyncToast({
          type: "error",
          message: syncRes.message || "Server Cloud Offline (port 5175). Jalankan invoice_publik.",
        });
      } else {
        setSyncToast({
          type: "info",
          message: syncRes.message || "Semua transaksi sudah tersinkron ke cloud.",
        });
      }
      const timer = setTimeout(() => setSyncToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionData]);

  // Wireless Phone Scanner (PRD F12)
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [phoneDeviceName, setPhoneDeviceName] = useState<string | null>(null);
  const [isConnectPhoneModalOpen, setIsConnectPhoneModalOpen] = useState(false);
  const [phoneScanToast, setPhoneScanToast] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Keep activeTab & products in refs to eliminate stale closure in WebSocket message listener
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const productsRef = useRef(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

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

  const handleIncomingPhoneScanRef = useRef<(barcode: string) => void>(() => {});

  const handleIncomingPhoneScan = (barcode: string) => {
    const cleanCode = barcode.trim();
    if (!cleanCode) return;

    const currentTab = activeTabRef.current;
    const now = Date.now();
    // Safety throttle: 1000ms on kulakan for rapid carton scanning, 2000ms on kasir
    const throttleMs = currentTab === "kulakan" ? 1000 : 2000;
    if (cleanCode === lastPhoneScanCodeRef.current && now - lastPhoneScanTimeRef.current < throttleMs) {
      return;
    }
    lastPhoneScanCodeRef.current = cleanCode;
    lastPhoneScanTimeRef.current = now;

    playLaptopBeep();

    // ROUTE ACCORDING TO CURRENT ACTIVE TAB VIA REF
    if (currentTab === "kulakan") {
      setQuickScanKulakanBarcode(cleanCode);
    } else {
      setActiveTab("kasir");
      setQuickScanTriggerBarcode(cleanCode);
    }

    // Look up product name to display toast & send back confirmation to phone
    let foundProduct: Product | undefined;
    let foundUnit: ProductUnit | undefined;

    for (const p of productsRef.current) {
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
      const tabLabel = currentTab === "kulakan" ? "Kulakan" : "Kasir";
      setPhoneScanToast(`📱 HP Scan [${tabLabel}]: ${foundProduct.name} (${foundUnit.unitName})`);
      setTimeout(() => setPhoneScanToast(null), 3000);

      const confirmMsg = {
        type: "SCAN_CONFIRMED",
        productName: foundProduct.name,
        unitName: foundUnit.unitName,
        price: currentTab === "kulakan" ? (foundUnit.costPrice || 0) : foundUnit.price,
        mode: currentTab,
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
      if (currentTab === "kulakan") {
        setUnknownBarcode(cleanCode);
        setIsQuickAddOpen(true);
      }
    }
  };

  // Sync ref on every render so WebSocket always invokes latest version
  handleIncomingPhoneScanRef.current = handleIncomingPhoneScan;

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
          handleIncomingPhoneScanRef.current(event.data.barcode);
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
              handleIncomingPhoneScanRef.current(data.barcode);
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
  }, []);

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
    submit(formData, { method: "post", action: "/?index" });
  };

  // 2. Tambah Produk Baru -> Action MySQL
  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);

    const formData = new FormData();
    formData.append("intent", "add_product");
    formData.append("product", JSON.stringify(newProduct));
    submit(formData, { method: "post", action: "/?index" });
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));

    const formData = new FormData();
    formData.append("intent", "update_product");
    formData.append("product", JSON.stringify(updatedProduct));
    submit(formData, { method: "post", action: "/?index" });
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));

    const formData = new FormData();
    formData.append("intent", "delete_product");
    formData.append("product_id", productId);
    submit(formData, { method: "post", action: "/?index" });
  };

  const handleSaveAndAddToCart = (newProduct: Product, unit: ProductUnit) => {
    handleAddProduct(newProduct);
    if (activeTabRef.current === "kulakan") {
      setQuickScanKulakanBarcode(unit.barcode);
    } else {
      setQuickScanTriggerBarcode(unit.barcode);
    }
    setIsQuickAddOpen(false);
  };

  const handleAddUnitToExistingProduct = (productId: string, newUnit: ProductUnit) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const updatedProd: Product = {
      ...prod,
      units: [...prod.units, newUnit],
    };
    handleUpdateProduct(updatedProd);
    if (activeTabRef.current === "kulakan") {
      setQuickScanKulakanBarcode(newUnit.barcode);
    } else {
      setQuickScanTriggerBarcode(newUnit.barcode);
    }
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
    submit(formData, { method: "post", action: "/?index" });
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
    submit(formData, { method: "post", action: "/?index" });
  };

  // 5. Sync Cloud -> Action MySQL
  const handleTriggerSync = () => {
    setIsSyncing(true);
    const formData = new FormData();
    formData.append("intent", "sync_cloud");
    submit(formData, { method: "post", action: "/?index" });
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
        onOpenPhoneScannerModal={() => setIsConnectPhoneModalOpen(true)}
        isPhoneConnected={isPhoneConnected}
        dbConnected={loaderData.dbConnected}
        dbMessage={loaderData.dbMessage}
        cloudConnected={loaderData.cloudConnected}
        cloudMessage={loaderData.cloudMessage}
        storeConfig={loaderData.storeConfig}
      />

      {/* Main Content */}
      <main className="flex-1 min-w-0 min-h-screen overflow-y-auto">
        {/* Realtime Toast for Cloud Sync result */}
        {syncToast && (
          <div
            className={`px-5 py-2.5 text-xs font-semibold flex items-center justify-between shadow-md border-b transition-all ${
              syncToast.type === "success"
                ? "bg-emerald-900 text-emerald-100 border-emerald-800"
                : syncToast.type === "error"
                ? "bg-rose-900 text-rose-100 border-rose-800"
                : "bg-slate-900 text-slate-100 border-slate-800"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  syncToast.type === "success"
                    ? "bg-emerald-400"
                    : syncToast.type === "error"
                    ? "bg-rose-400 animate-pulse"
                    : "bg-amber-400"
                }`}
              ></span>
              {syncToast.message}
            </span>
            <button
              onClick={() => setSyncToast(null)}
              className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-0.5 rounded cursor-pointer transition"
            >
              Tutup
            </button>
          </div>
        )}
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
            storeConfig={loaderData.storeConfig}
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
            quickScanTriggerBarcode={quickScanKulakanBarcode}
            onClearQuickScanTrigger={() => setQuickScanKulakanBarcode(null)}
            onRequestUnknownBarcode={handleRequestUnknownBarcode}
            onOpenPhoneModal={() => setIsConnectPhoneModalOpen(true)}
            isPhoneConnected={isPhoneConnected}
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
        storeConfig={loaderData.storeConfig}
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
        onAddUnitToExistingProduct={handleAddUnitToExistingProduct}
        products={products}
        mode={activeTab === "kulakan" ? "kulakan" : "kasir"}
      />

      {/* Connect Wireless Phone Scanner Modal (PRD F12) */}
      <ConnectPhoneScannerModal
        isOpen={isConnectPhoneModalOpen}
        onClose={() => setIsConnectPhoneModalOpen(false)}
        isPhoneConnected={isPhoneConnected}
        phoneDeviceName={phoneDeviceName}
        detectedIp={(loaderData as any).detectedIp}
      />
    </div>
  );
}
