import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

let pool: Pool;

declare global {
  // Prevent multiple connection pools during Vite HMR
  var __dbPool: Pool | undefined;
}

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "pos_warung_madura",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+07:00", // Waktu Indonesia Barat (WIB)
};

if (process.env.NODE_ENV === "production") {
  pool = mysql.createPool(dbConfig);
} else {
  if (!global.__dbPool) {
    global.__dbPool = mysql.createPool(dbConfig);
  }
  pool = global.__dbPool;
}

export { pool };

/**
 * Eksekusi query dengan parameter aman
 */
export async function query<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[]
): Promise<T> {
  const [results] = await pool.execute<T>(sql, params);
  return results;
}

/**
 * Tes koneksi ke MySQL lokal
 */
export async function testDbConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    await pool.query("SELECT 1");
    return { ok: true, message: "Terhubung ke MySQL lokal pos_warung_madura" };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Gagal menghubungi MySQL lokal" };
  }
}
