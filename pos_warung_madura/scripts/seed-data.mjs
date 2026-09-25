import mysql from "mysql2/promise";

const products = [
  {
    id: "p-01",
    name: "Sampoerna A Mild 16",
    category: "Rokok",
    baseUnit: "batang",
    minStockAlert: 80,
    units: [
      { id: "u-01-batang", unitName: "Ketengan (Batang)", conversionRatio: 1, price: 2500, costPrice: 2000, barcode: "001-SMP-BTG", isBaseUnit: true },
      { id: "u-01-pack", unitName: "Bungkus (16 Btg)", conversionRatio: 16, price: 33500, costPrice: 30500, barcode: "899238812039", isBaseUnit: false },
      { id: "u-01-slop", unitName: "Slop (10 Bks)", conversionRatio: 160, price: 330000, costPrice: 300000, barcode: "899238812040", isBaseUnit: false },
    ],
    stock: 480,
  },
  {
    id: "p-02",
    name: "Indomie Goreng Spesial 85g",
    category: "Mie & Sembako",
    baseUnit: "pcs",
    minStockAlert: 40,
    units: [
      { id: "u-02-pcs", unitName: "Pcs", conversionRatio: 1, price: 3500, costPrice: 2950, barcode: "089686010924", isBaseUnit: true },
      { id: "u-02-dus", unitName: "Dus (40 Pcs)", conversionRatio: 40, price: 132000, costPrice: 118000, barcode: "089686010999", isBaseUnit: false },
    ],
    stock: 145,
  },
  {
    id: "p-03",
    name: "Djarum Super 12",
    category: "Rokok",
    baseUnit: "batang",
    minStockAlert: 60,
    units: [
      { id: "u-03-batang", unitName: "Ketengan (Batang)", conversionRatio: 1, price: 2200, costPrice: 1800, barcode: "002-DJR-BTG", isBaseUnit: true },
      { id: "u-03-pack", unitName: "Bungkus (12 Btg)", conversionRatio: 12, price: 24000, costPrice: 21500, barcode: "899277511001", isBaseUnit: false },
      { id: "u-03-slop", unitName: "Slop (10 Bks)", conversionRatio: 120, price: 235000, costPrice: 212000, barcode: "899277511018", isBaseUnit: false },
    ],
    stock: 360,
  },
  {
    id: "p-04",
    name: "Le Minerale Dingin 600ml",
    category: "Minuman Dingin",
    baseUnit: "botol",
    minStockAlert: 24,
    units: [
      { id: "u-04-botol", unitName: "Botol Dingin", conversionRatio: 1, price: 4000, costPrice: 2800, barcode: "899600141401", isBaseUnit: true },
      { id: "u-04-dus", unitName: "Dus (24 Btl)", conversionRatio: 24, price: 88000, costPrice: 66000, barcode: "899600141499", isBaseUnit: false },
    ],
    stock: 58,
  },
  {
    id: "p-05",
    name: "Kopi Kapal Api Spesial Mix 24g",
    category: "Jajanan & Kopi",
    baseUnit: "sachet",
    minStockAlert: 30,
    units: [
      { id: "u-05-sachet", unitName: "Sachet", conversionRatio: 1, price: 2000, costPrice: 1400, barcode: "899100110123", isBaseUnit: true },
      { id: "u-05-renteng", unitName: "Renteng (10 Sachet)", conversionRatio: 10, price: 18500, costPrice: 14000, barcode: "899100110999", isBaseUnit: false },
    ],
    stock: 120,
  },
  {
    id: "p-06",
    name: "Gas Elpiji 3 Kg (Isi Ulang)",
    category: "Gas & Galon",
    baseUnit: "tabung",
    minStockAlert: 5,
    units: [
      { id: "u-06-tabung", unitName: "Tabung Tukar", conversionRatio: 1, price: 22000, costPrice: 19000, barcode: "GAS-3KG-001", isBaseUnit: true },
    ],
    stock: 14,
  },
  {
    id: "p-07",
    name: "Telur Ayam Negeri Fresh",
    category: "Mie & Sembako",
    baseUnit: "butir",
    minStockAlert: 32,
    units: [
      { id: "u-07-butir", unitName: "Per Butir", conversionRatio: 1, price: 2000, costPrice: 1600, barcode: "TLR-BTR-001", isBaseUnit: true },
      { id: "u-07-kg", unitName: "1 Kg (~16 Butir)", conversionRatio: 16, price: 29000, costPrice: 25500, barcode: "TLR-KG-001", isBaseUnit: false },
    ],
    stock: 160,
  },
  {
    id: "p-08",
    name: "Teh Pucuk Harum 350ml Dingin",
    category: "Minuman Dingin",
    baseUnit: "botol",
    minStockAlert: 12,
    units: [
      { id: "u-08-botol", unitName: "Botol Dingin", conversionRatio: 1, price: 4000, costPrice: 3000, barcode: "899600146001", isBaseUnit: true },
      { id: "u-08-dus", unitName: "Dus (24 Btl)", conversionRatio: 24, price: 86000, costPrice: 72000, barcode: "899600146099", isBaseUnit: false },
    ],
    stock: 42,
  },
];

async function main() {
  console.log("Menghubungkan ke MySQL database pos_warung_madura...");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: "pos_warung_madura",
  });

  console.log("Menyinkronkan data 8 produk utama ke tabel products & product_units...");
  for (const p of products) {
    await conn.execute(
      `INSERT INTO products (id, name, category, base_unit, min_stock_alert, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         category = VALUES(category),
         base_unit = VALUES(base_unit),
         min_stock_alert = VALUES(min_stock_alert),
         is_active = TRUE`,
      [p.id, p.name, p.category, p.baseUnit, p.minStockAlert]
    );

    for (const u of p.units) {
      await conn.execute(
        `INSERT INTO product_units (id, product_id, unit_name, conversion_ratio, price, cost_price, barcode, is_base_unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           price = VALUES(price),
           cost_price = VALUES(cost_price),
           barcode = VALUES(barcode),
           unit_name = VALUES(unit_name)`,
        [u.id, p.id, u.unitName, u.conversionRatio, u.price, u.costPrice, u.barcode, u.isBaseUnit]
      );
    }

    await conn.execute(
      `INSERT INTO stock_movements (id, product_id, type, quantity_in_base_unit, unit_name_used, unit_qty_used, notes)
       VALUES (?, ?, 'in', ?, ?, ?, 'Stok Awal')
       ON DUPLICATE KEY UPDATE quantity_in_base_unit = VALUES(quantity_in_base_unit)`,
      [`mov-seed-${p.id}`, p.id, p.stock, p.baseUnit, p.stock]
    );
  }

  const [rows] = await conn.query("SELECT COUNT(*) AS total FROM products");
  console.log(`✅ Berhasil! Total produk di database MySQL sekarang: ${rows[0].total}`);
  await conn.end();
}

main().catch((err) => {
  console.error("Gagal seed:", err.message);
  process.exit(1);
});
