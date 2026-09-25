import type { Sale } from "../types/pos";

export interface DisplayCartItem {
  productName: string;
  unitName: string;
  price: number;
  qty: number;
  subtotal: number;
}

export type CustomerDisplayState =
  | {
      type: "STANDBY";
      timestamp: number;
    }
  | {
      type: "CART_UPDATE";
      invoiceCode: string;
      items: DisplayCartItem[];
      totalAmount: number;
      itemCount: number;
      timestamp: number;
    }
  | {
      type: "SALE_COMPLETED";
      sale: Sale;
      timestamp: number;
    };

export type CustomerDisplayEvent =
  | CustomerDisplayState
  | {
      type: "REQUEST_STATE";
      timestamp: number;
    };

const CHANNEL_NAME = "pos_customer_display_channel";
const STORAGE_KEY = "pos_customer_display_state";
const LOCAL_EVENT_NAME = "pos_customer_display_local_event";

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      console.warn("[CustomerDisplaySync] BroadcastChannel init error:", e);
    }
  }
  return broadcastChannel;
}

/**
 * Mengirimkan event perubahan status transaksi ke Layar Pelanggan (Secondary Display)
 */
export function sendCustomerDisplayEvent(event: CustomerDisplayEvent): void {
  if (typeof window === "undefined") return;

  // 1. BroadcastChannel (0ms delay antar tab/jendela di browser modern)
  try {
    const channel = getBroadcastChannel();
    if (channel) {
      channel.postMessage(event);
    }
  } catch (e) {}

  // 2. LocalStorage (hanya simpan data state tampilan aktual, JANGAN simpan ping REQUEST_STATE)
  if (event.type !== "REQUEST_STATE") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
    } catch (e) {}

    // Dispatch event lokal untuk jendela yang sama jika ada
    try {
      window.dispatchEvent(
        new CustomEvent(LOCAL_EVENT_NAME, { detail: event })
      );
    } catch (e) {}
  }

  // 3. WebSocket ke /ws-scanner (jika layar sekunder menggunakan tablet/HP via LAN)
  try {
    if (
      (window as any).__pos_ws_client &&
      (window as any).__pos_ws_client.readyState === WebSocket.OPEN
    ) {
      (window as any).__pos_ws_client.send(
        JSON.stringify({
          type: "CUSTOMER_DISPLAY_MESSAGE",
          payload: event,
        })
      );
    }
  } catch (e) {}
}

/**
 * Meminta kasir untuk memancarkan status terkininya
 */
export function requestCustomerDisplayState(): void {
  sendCustomerDisplayEvent({
    type: "REQUEST_STATE",
    timestamp: Date.now(),
  });
}

/**
 * Mendengarkan pembaruan tampilan di Layar Pelanggan (/display).
 * Hanya menerima state tampilan valid: STANDBY, CART_UPDATE, SALE_COMPLETED.
 */
export function listenCustomerDisplay(
  onEvent: (state: CustomerDisplayState) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleValidState = (data: any) => {
    if (!data || !data.type) return;
    if (
      data.type === "STANDBY" ||
      data.type === "CART_UPDATE" ||
      data.type === "SALE_COMPLETED"
    ) {
      onEvent(data as CustomerDisplayState);
    }
  };

  // 1. Dengar via BroadcastChannel
  const channel = getBroadcastChannel();
  const handleChannelMsg = (ev: MessageEvent) => {
    handleValidState(ev.data);
  };
  if (channel) {
    channel.addEventListener("message", handleChannelMsg);
  }

  // 2. Dengar via Storage Event (antar jendela monitor)
  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === STORAGE_KEY && ev.newValue) {
      try {
        const parsed = JSON.parse(ev.newValue);
        handleValidState(parsed);
      } catch (e) {}
    }
  };
  window.addEventListener("storage", handleStorage);

  // 3. Dengar via CustomEvent lokal
  const handleLocalEvent = (ev: Event) => {
    const customEv = ev as CustomEvent;
    if (customEv.detail) {
      handleValidState(customEv.detail);
    }
  };
  window.addEventListener(LOCAL_EVENT_NAME, handleLocalEvent);

  // 4. Inisialisasi awal dari LocalStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed &&
        parsed.type === "CART_UPDATE" &&
        Date.now() - (parsed.timestamp || 0) < 5 * 60 * 1000
      ) {
        handleValidState(parsed);
      } else if (
        parsed &&
        parsed.type === "SALE_COMPLETED" &&
        Date.now() - (parsed.timestamp || 0) < 2 * 60 * 1000
      ) {
        handleValidState(parsed);
      } else {
        onEvent({ type: "STANDBY", timestamp: Date.now() });
      }
    } else {
      onEvent({ type: "STANDBY", timestamp: Date.now() });
    }
  } catch (e) {
    onEvent({ type: "STANDBY", timestamp: Date.now() });
  }

  // Minta kasir mengirim status terkini secara instan
  requestCustomerDisplayState();

  return () => {
    if (channel) {
      channel.removeEventListener("message", handleChannelMsg);
    }
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LOCAL_EVENT_NAME, handleLocalEvent);
  };
}

/**
 * Mendengarkan permintaan status dari layar pelanggan di sisi Kasir (KasirPOS).
 * Hanya dipasang SEKALI di KasirPOS.
 */
export function listenKasirRequestState(onRequest: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const channel = getBroadcastChannel();
  const handleChannelMsg = (ev: MessageEvent) => {
    if (ev.data && ev.data.type === "REQUEST_STATE") {
      onRequest();
    }
  };

  if (channel) {
    channel.addEventListener("message", handleChannelMsg);
  }

  return () => {
    if (channel) {
      channel.removeEventListener("message", handleChannelMsg);
    }
  };
}
