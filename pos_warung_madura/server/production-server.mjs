import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import https from "node:https";
import selfsigned from "selfsigned";
import { WebSocketServer, WebSocket } from "ws";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import compression from "compression";

// Resolusi path absolut berbasis lokasi file saat ini (bukan cwd proses)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root aplikasi (satu level di atas folder server/)
const rootDir = path.resolve(__dirname, "..");
const clientBuildDir = path.join(rootDir, "build", "client");
const serverBuildFile = path.join(rootDir, "build", "server", "index.js");

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";
const certDir = process.env.CERT_DIR || path.join(rootDir, "certs");

// ----------------------------------------------------------------------------
// GENERATE ATAU BACA SERTIFIKAT SSL (HTTPS) PERSISTEN
// ----------------------------------------------------------------------------
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.log("[Production Server] Menyiapkan self-signed certificate SSL untuk HTTPS LAN...");
  fs.mkdirSync(certDir, { recursive: true });

  const altNames = [
    { type: 2, value: "localhost" },
    { type: 7, ip: "127.0.0.1" },
  ];

  try {
    const hostname = os.hostname();
    if (hostname) {
      altNames.push({ type: 2, value: hostname });
    }

    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const net of netList) {
        if (net.family === "IPv4" && !net.internal) {
          altNames.push({ type: 7, ip: net.address });
        }
      }
    }
  } catch (err) {
    console.warn("[Production Server] Peringatan saat mendeteksi interface jaringan:", err);
  }

  const attrs = [{ name: "commonName", value: "pos-warung.local" }];
  const pems = await selfsigned.generate(attrs, {
    days: 3650,
    keySize: 2048,
    extensions: [
      {
        name: "subjectAltName",
        altNames,
      },
    ],
  });

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  console.log("[Production Server] Sertifikat SSL berhasil dibuat di:", certDir);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

const app = express();
app.use(compression());

// Alias rute scanner HP jika diketik manual
app.get("/kasir/scanner", (req, res) => {
  res.redirect("/scanner");
});

// Layani static asset client
app.use(
  "/assets",
  express.static(path.join(clientBuildDir, "assets"), { immutable: true, maxAge: "1y" })
);
app.use(express.static(clientBuildDir, { maxAge: "1h" }));

// Dynamic import server build React Router v8
// Gunakan pathToFileURL agar kompatibel dengan Node ESM loader di Windows
const serverBuildUrl = pathToFileURL(serverBuildFile).href;
const build = await import(serverBuildUrl);

// Handler untuk seluruh request menggunakan request handler React Router Express
// Catatan: Express 5 menggunakan path-to-regexp v8 yang memerlukan named parameter untuk wildcard (*splat)
app.all(
  "*splat",
  createRequestHandler({
    build,
  })
);

// ----------------------------------------------------------------------------
// SERVER HTTPS & ATTACHED SECURE WEBSOCKET (WSS)
// ----------------------------------------------------------------------------
// Menggunakan server HTTPS yang sama dan sertifikat SSL yang sama pada port 4000
const httpsServer = https.createServer(httpsOptions, app);

const wss = new WebSocketServer({ noServer: true });

// Intersep permintaan Upgrade HTTP -> WebSocket untuk endpoint /ws-scanner dan /scanner-feed
httpsServer.on("upgrade", (req, socket, head) => {
  const url = req.url || "";
  if (url.startsWith("/ws-scanner") || url.startsWith("/scanner-feed")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }
});

wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket Server] Klien terhubung dari ${clientIp} (${req.url})`);

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      console.log(`[WebSocket Server] Pesan broadcast (${data.type}) dari ${clientIp}`);

      // Broadcast pesan ke seluruh klien lain (misal dari HP ke Laptop POS)
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (e) {
      console.warn("[WebSocket Server] Pesan non-JSON:", msg.toString());
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[WebSocket Server] Klien terputus (${clientIp}): code=${code} reason=${reason}`);
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "CLIENT_DISCONNECTED" }));
      }
    });
  });

  ws.on("error", (err) => {
    console.error(`[WebSocket Server] Error koneksi klien (${clientIp}):`, err.message);
  });
});

httpsServer.listen(PORT, HOST, () => {
  console.log(`Server (HTTPS) listening on https://${HOST}:${PORT}`);
  console.log(`WebSocket Server (WSS) terpasang pada https://${HOST}:${PORT}/ws-scanner`);
});
