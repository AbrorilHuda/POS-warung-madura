import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch (e) { }
}

async function main() {
  const dbName = process.env.DB_NAME || "pos_warung_madura";
  console.log(`Menghubungkan ke MySQL server lokal (${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 3306})...`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  console.log(`Membuat database ${dbName} jika belum ada...`);
  await connection.query(`
    CREATE DATABASE IF NOT EXISTS \`${dbName}\`
      CHARACTER SET utf8mb4
      COLLATE utf8mb4_unicode_ci;
  `);

  await connection.query(`USE \`${dbName}\`;`);

  console.log("Membaca schema.sql...");
  const schemaPath = path.resolve(__dirname, "../migrations/schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  console.log("Mengeksekusi skema tabel & seed data...");
  await connection.query(schemaSql);

  console.log(`✅ SUKSES! Database ${dbName} dan seluruh tabel berhasil dibuat!`);
  await connection.end();
}

main().catch((err) => {
  console.error("Gagal inisialisasi database:", err.message);
  process.exit(1);
});
