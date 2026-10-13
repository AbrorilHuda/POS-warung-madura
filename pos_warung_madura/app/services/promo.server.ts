import type { RowDataPacket } from "mysql2";
import { pool, query, ensureDatabaseSchema } from "../db.server";
import type { Promotion, CartItem } from "../types/pos";

/**
 * Mengambil semua daftar promosi dari database MySQL lokal
 */
export async function getAllPromotions(): Promise<Promotion[]> {
  await ensureDatabaseSchema();

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT 
      p.*,
      p1.name AS product_name,
      p2.name AS buy_product_name,
      p3.name AS get_product_name
    FROM promotions p
    LEFT JOIN products p1 ON p.product_id = p1.id
    LEFT JOIN products p2 ON p.buy_product_id = p2.id
    LEFT JOIN products p3 ON p.get_product_id = p3.id
    ORDER BY p.priority DESC, p.created_at DESC
  `);

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: r.description ? String(r.description) : undefined,
    promoType: r.promo_type as any,
    isActive: Boolean(r.is_active),
    startDate: r.start_date instanceof Date ? r.start_date.toISOString().slice(0, 10) : String(r.start_date).slice(0, 10),
    endDate: r.end_date instanceof Date ? r.end_date.toISOString().slice(0, 10) : String(r.end_date).slice(0, 10),
    productId: r.product_id ? String(r.product_id) : undefined,
    productName: r.product_name ? String(r.product_name) : undefined,
    unitId: r.unit_id ? String(r.unit_id) : undefined,
    minQty: Number(r.min_qty || 1),
    discountType: r.discount_type || "percentage",
    discountValue: Number(r.discount_value || 0),
    buyProductId: r.buy_product_id ? String(r.buy_product_id) : undefined,
    buyProductName: r.buy_product_name ? String(r.buy_product_name) : undefined,
    buyUnitId: r.buy_unit_id ? String(r.buy_unit_id) : undefined,
    buyQty: Number(r.buy_qty || 1),
    getProductId: r.get_product_id ? String(r.get_product_id) : undefined,
    getProductName: r.get_product_name ? String(r.get_product_name) : undefined,
    getUnitId: r.get_unit_id ? String(r.get_unit_id) : undefined,
    getQty: Number(r.get_qty || 1),
    getDiscountPercent: Number(r.get_discount_percent ?? 100),
    bundlePrice: r.bundle_price !== null ? Number(r.bundle_price) : undefined,
    bundleItems: r.bundle_items ? (typeof r.bundle_items === "string" ? JSON.parse(r.bundle_items) : r.bundle_items) : undefined,
    priority: Number(r.priority || 1),
    createdAt: r.created_at ? new Date(r.created_at).toLocaleString("id-ID") : undefined,
  }));
}

/**
 * Mengambil daftar promosi yang SEDANG AKTIF saat ini
 * (is_active = 1 dan hari ini berada di antara start_date dan end_date)
 */
export async function getActivePromotions(): Promise<Promotion[]> {
  await ensureDatabaseSchema();

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT 
      p.*,
      p1.name AS product_name,
      p2.name AS buy_product_name,
      p3.name AS get_product_name
    FROM promotions p
    LEFT JOIN products p1 ON p.product_id = p1.id
    LEFT JOIN products p2 ON p.buy_product_id = p2.id
    LEFT JOIN products p3 ON p.get_product_id = p3.id
    WHERE p.is_active = TRUE
      AND CURDATE() BETWEEN DATE(p.start_date) AND DATE(p.end_date)
    ORDER BY p.priority DESC, p.created_at DESC
  `);

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: r.description ? String(r.description) : undefined,
    promoType: r.promo_type as any,
    isActive: Boolean(r.is_active),
    startDate: r.start_date instanceof Date ? r.start_date.toISOString().slice(0, 10) : String(r.start_date).slice(0, 10),
    endDate: r.end_date instanceof Date ? r.end_date.toISOString().slice(0, 10) : String(r.end_date).slice(0, 10),
    productId: r.product_id ? String(r.product_id) : undefined,
    productName: r.product_name ? String(r.product_name) : undefined,
    unitId: r.unit_id ? String(r.unit_id) : undefined,
    minQty: Number(r.min_qty || 1),
    discountType: r.discount_type || "percentage",
    discountValue: Number(r.discount_value || 0),
    buyProductId: r.buy_product_id ? String(r.buy_product_id) : undefined,
    buyProductName: r.buy_product_name ? String(r.buy_product_name) : undefined,
    buyUnitId: r.buy_unit_id ? String(r.buy_unit_id) : undefined,
    buyQty: Number(r.buy_qty || 1),
    getProductId: r.get_product_id ? String(r.get_product_id) : undefined,
    getProductName: r.get_product_name ? String(r.get_product_name) : undefined,
    getUnitId: r.get_unit_id ? String(r.get_unit_id) : undefined,
    getQty: Number(r.get_qty || 1),
    getDiscountPercent: Number(r.get_discount_percent ?? 100),
    bundlePrice: r.bundle_price !== null ? Number(r.bundle_price) : undefined,
    bundleItems: r.bundle_items ? (typeof r.bundle_items === "string" ? JSON.parse(r.bundle_items) : r.bundle_items) : undefined,
    priority: Number(r.priority || 1),
    createdAt: r.created_at ? new Date(r.created_at).toLocaleString("id-ID") : undefined,
  }));
}

/**
 * Membuat promosi baru (PRD F6.4)
 */
export async function createPromotion(data: Partial<Promotion>): Promise<Promotion> {
  await ensureDatabaseSchema();

  const id = `promo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const name = String(data.name || "").trim();
  if (!name) throw new Error("Nama promosi wajib diisi");

  const promoType = data.promoType || "product_discount";
  const startDate = data.startDate || new Date().toISOString().slice(0, 10);
  const endDate = data.endDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const isActive = data.isActive ?? true;

  await pool.query(`
    INSERT INTO promotions (
      id, name, description, promo_type, is_active, start_date, end_date,
      product_id, unit_id, min_qty, discount_type, discount_value,
      buy_product_id, buy_unit_id, buy_qty, get_product_id, get_unit_id, get_qty, get_discount_percent,
      bundle_price, bundle_items, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    name,
    data.description || null,
    promoType,
    isActive,
    `${startDate} 00:00:00`,
    `${endDate} 23:59:59`,
    data.productId || null,
    data.unitId || null,
    Number(data.minQty || 1),
    data.discountType || "percentage",
    Number(data.discountValue || 0),
    data.buyProductId || null,
    data.buyUnitId || null,
    Number(data.buyQty || 1),
    data.getProductId || null,
    data.getUnitId || null,
    Number(data.getQty || 1),
    Number(data.getDiscountPercent ?? 100),
    data.bundlePrice !== undefined ? Number(data.bundlePrice) : null,
    data.bundleItems ? JSON.stringify(data.bundleItems) : null,
    Number(data.priority || 1),
  ]);

  return {
    id,
    name,
    promoType,
    isActive,
    startDate,
    endDate,
    ...data,
  } as Promotion;
}

/**
 * Memperbarui data promosi
 */
export async function updatePromotion(id: string, data: Partial<Promotion>): Promise<void> {
  await ensureDatabaseSchema();

  const fields: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    params.push(String(data.name).trim());
  }
  if (data.description !== undefined) {
    fields.push("description = ?");
    params.push(data.description || null);
  }
  if (data.promoType !== undefined) {
    fields.push("promo_type = ?");
    params.push(data.promoType);
  }
  if (data.isActive !== undefined) {
    fields.push("is_active = ?");
    params.push(Boolean(data.isActive));
  }
  if (data.startDate !== undefined) {
    fields.push("start_date = ?");
    params.push(`${data.startDate} 00:00:00`);
  }
  if (data.endDate !== undefined) {
    fields.push("end_date = ?");
    params.push(`${data.endDate} 23:59:59`);
  }
  if (data.productId !== undefined) {
    fields.push("product_id = ?");
    params.push(data.productId || null);
  }
  if (data.minQty !== undefined) {
    fields.push("min_qty = ?");
    params.push(Number(data.minQty));
  }
  if (data.discountType !== undefined) {
    fields.push("discount_type = ?");
    params.push(data.discountType);
  }
  if (data.discountValue !== undefined) {
    fields.push("discount_value = ?");
    params.push(Number(data.discountValue));
  }
  if (data.buyProductId !== undefined) {
    fields.push("buy_product_id = ?");
    params.push(data.buyProductId || null);
  }
  if (data.buyQty !== undefined) {
    fields.push("buy_qty = ?");
    params.push(Number(data.buyQty));
  }
  if (data.getProductId !== undefined) {
    fields.push("get_product_id = ?");
    params.push(data.getProductId || null);
  }
  if (data.getQty !== undefined) {
    fields.push("get_qty = ?");
    params.push(Number(data.getQty));
  }
  if (data.getDiscountPercent !== undefined) {
    fields.push("get_discount_percent = ?");
    params.push(Number(data.getDiscountPercent));
  }
  if (data.bundlePrice !== undefined) {
    fields.push("bundle_price = ?");
    params.push(data.bundlePrice !== null ? Number(data.bundlePrice) : null);
  }
  if (data.bundleItems !== undefined) {
    fields.push("bundle_items = ?");
    params.push(data.bundleItems ? JSON.stringify(data.bundleItems) : null);
  }

  if (fields.length === 0) return;

  params.push(id);
  await pool.query(`UPDATE promotions SET ${fields.join(", ")} WHERE id = ?`, params);
}

/**
 * Toggle status aktif/nonaktif promo
 */
export async function togglePromotion(id: string, isActive: boolean): Promise<void> {
  await ensureDatabaseSchema();
  await pool.query(`UPDATE promotions SET is_active = ? WHERE id = ?`, [isActive, id]);
}

/**
 * Hapus promo
 */
export async function deletePromotion(id: string): Promise<void> {
  await ensureDatabaseSchema();
  await pool.query(`DELETE FROM promotions WHERE id = ?`, [id]);
}

export { evaluateCartPromotions, type PromoEvaluationResult } from "./promo";

