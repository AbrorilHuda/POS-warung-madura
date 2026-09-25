import { WebSocketServer, WebSocket } from "ws";

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

console.log(`[WebSocket Scanner] Server aktif di port ws://0.0.0.0:${PORT}`);

wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket Scanner] Klien terhubung dari ${clientIp}`);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`[WebSocket Scanner] Pesan diterima (${data.type}):`, data);

      // Broadcast pesan ke seluruh klien lain (misal dari HP ke Laptop POS)
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (err) {
      console.error("[WebSocket Scanner] Format pesan salah:", err.message);
    }
  });

  ws.on("close", () => {
    console.log(`[WebSocket Scanner] Klien terputus (${clientIp})`);
    // Beri tahu klien tersisa jika perangkat HP terputus
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "CLIENT_DISCONNECTED" }));
      }
    });
  });
});
