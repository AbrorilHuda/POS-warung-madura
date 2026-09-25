import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, type Plugin } from "vite";
import { WebSocketServer, WebSocket } from "ws";

function scannerWebSocketPlugin(): Plugin {
  let wss: WebSocketServer | null = null;
  return {
    name: "scanner-websocket",
    configureServer(server) {
      wss = new WebSocketServer({ noServer: true });

      wss.on("connection", (ws, req) => {
        const clientIp = req.socket.remoteAddress;
        console.log(`[Vite WSS Scanner] Klien terhubung dari ${clientIp}`);

        ws.on("message", (msg) => {
          try {
            const data = JSON.parse(msg.toString());
            wss?.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
              }
            });
          } catch (e) {}
        });

        ws.on("close", () => {
          console.log(`[Vite WSS Scanner] Klien terputus (${clientIp})`);
          wss?.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "CLIENT_DISCONNECTED" }));
            }
          });
        });
      });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        if (req.url === "/ws-scanner") {
          wss?.handleUpgrade(req, socket, head, (ws) => {
            wss?.emit("connection", ws, req);
          });
        }
      });
    },
  };
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5174,
  },
  plugins: [
    tailwindcss(),
    basicSsl(),
    scannerWebSocketPlugin(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
