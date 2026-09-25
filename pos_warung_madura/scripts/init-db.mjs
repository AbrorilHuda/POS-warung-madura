import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Menghubungkan ke MySQL server lokal...");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  console.log("Membuat database pos_warung_madura jika belum ada...");
  await connection.query(`
    CREATE DATABASE IF NOT EXISTS pos_warung_madura
      CHARACTER SET utf8mb4
      COLLATE utf8mb4_unicode_ci;
  `);

  console.log("Membaca schema.sql...");
  const schemaPath = path.resolve(__dirname, "../schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  console.log("Mengeksekusi skema tabel & seed data...");
  await connection.query(schemaSql);

  console.log("✅ SUKSES! Database pos_warung_madura dan seluruh tabel berhasil dibuat!");
  await connection.end();
}

main().catch((err) => {
  console.error("Gagal inisialisasi database:", err.message);
  process.exit(1);
});
