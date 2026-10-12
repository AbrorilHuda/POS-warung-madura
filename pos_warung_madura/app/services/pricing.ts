import type { ProductUnit, ProductPriceTier, CustomerGroupType } from "../types/pos";

export interface TierCalculationResult {
  price: number;
  basePrice: number;
  appliedTierName?: string;
  isWholesalePrice: boolean;
  savingsPerUnit: number;
  totalSavings: number;
}

export interface NextTierUpsellResult {
  nextTier: ProductPriceTier;
  qtyNeeded: number;
  nextPrice: number;
  savingsPerUnit: number;
  message: string;
}

/**
 * Menghitung harga aktif satuan berdasarkan kuantitas dan grup pelanggan (PRD F3.3 / F3.4)
 * - Jika memenuhi minQty dari beberapa tier, memilih tier dengan minQty tertinggi yang terpenuhi
 * - Prioritas grup pelanggan: jika tier khusus grup pelanggan cocok (e.g. reseller), diutamakan di atas tier umum
 */
export function calculateTieredPrice(params: {
  unit: ProductUnit;
  qty: number;
  customerGroup?: CustomerGroupType | null;
}): TierCalculationResult {
  const { unit, qty, customerGroup } = params;
  const basePrice = unit.price;
  const tiers = unit.priceTiers || [];

  if (tiers.length === 0 || qty <= 0) {
    return {
      price: basePrice,
      basePrice,
      isWholesalePrice: false,
      savingsPerUnit: 0,
      totalSavings: 0,
    };
  }

  // Filter tier yang kuantitasnya memenuhi syarat min_qty
  const eligibleTiers = tiers.filter((t) => qty >= t.minQty);

  if (eligibleTiers.length === 0) {
    return {
      price: basePrice,
      basePrice,
      isWholesalePrice: false,
      savingsPerUnit: 0,
      totalSavings: 0,
    };
  }

  let bestTier: ProductPriceTier | undefined;

  // 1. Cek tier khusus untuk customerGroup (mis. 'reseller' atau 'langganan')
  if (customerGroup && customerGroup !== "umum") {
    const groupSpecificTiers = eligibleTiers.filter(
      (t) => t.customerGroup === customerGroup
    );
    if (groupSpecificTiers.length > 0) {
      // Urutkan min_qty tertinggi
      groupSpecificTiers.sort((a, b) => b.minQty - a.minQty);
      bestTier = groupSpecificTiers[0];
    }
  }

  // 2. Jika tidak ada tier khusus grup, ambil tier umum (customerGroup null atau 'umum')
  if (!bestTier) {
    const genericTiers = eligibleTiers.filter(
      (t) => !t.customerGroup || t.customerGroup === "umum"
    );
    if (genericTiers.length > 0) {
      genericTiers.sort((a, b) => b.minQty - a.minQty);
      bestTier = genericTiers[0];
    }
  }

  if (bestTier && bestTier.price < basePrice) {
    const activePrice = bestTier.price;
    const savingsPerUnit = Math.max(0, basePrice - activePrice);
    return {
      price: activePrice,
      basePrice,
      appliedTierName: bestTier.tierName || `Grosir >= ${bestTier.minQty}`,
      isWholesalePrice: true,
      savingsPerUnit,
      totalSavings: savingsPerUnit * qty,
    };
  }

  return {
    price: basePrice,
    basePrice,
    isWholesalePrice: false,
    savingsPerUnit: 0,
    totalSavings: 0,
  };
}

/**
 * Mencari tier berikutnya di atas kuantitas saat ini untuk upsell rekomendasi kasir (PRD F3.3)
 * Contoh: jika kuantitas saat ini 10 dan tier grosir ada di min_qty 12, tampilkan 'Beli 2 lagi...'
 */
export function getNextTierUpsell(params: {
  unit: ProductUnit;
  qty: number;
  customerGroup?: CustomerGroupType | null;
}): NextTierUpsellResult | null {
  const { unit, qty, customerGroup } = params;
  const tiers = unit.priceTiers || [];
  if (tiers.length === 0) return null;

  // Filter tier yang minQty > qty saat ini
  const higherTiers = tiers.filter((t) => {
    if (t.minQty <= qty) return false;
    // Cek kesesuaian grup pelanggan
    if (t.customerGroup && t.customerGroup !== "umum") {
      return t.customerGroup === customerGroup;
    }
    return true;
  });

  if (higherTiers.length === 0) return null;

  // Ambil tier terdekat (minQty terkecil di antara higherTiers)
  higherTiers.sort((a, b) => a.minQty - b.minQty);
  const nextTier = higherTiers[0];

  const qtyNeeded = nextTier.minQty - qty;
  const savingsPerUnit = Math.max(0, unit.price - nextTier.price);

  return {
    nextTier,
    qtyNeeded,
    nextPrice: nextTier.price,
    savingsPerUnit,
    message: `Beli ${qtyNeeded} ${unit.unitName} lagi untuk dapat harga grosir Rp ${nextTier.price.toLocaleString("id-ID")}/${unit.unitName}!`,
  };
}

/**
 * Validasi konfigurasi daftar tier (PRD F3.2 & F3.5)
 */
export function validateTierList(
  tiers: ProductPriceTier[],
  costPrice?: number
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenCombos = new Set<string>();

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const groupKey = t.customerGroup || "umum";

    if (!t.minQty || t.minQty <= 1) {
      errors.push(`Tier #${i + 1}: Minimal kuantitas (min_qty) harus lebih besar dari 1.`);
    }

    if (!t.price || t.price <= 0) {
      errors.push(`Tier #${i + 1}: Harga jual grosir harus lebih besar dari Rp 0.`);
    }

    const comboKey = `${t.minQty}-${groupKey}`;
    if (seenCombos.has(comboKey)) {
      errors.push(
        `Tier #${i + 1} duplikat: Sudah ada tier dengan kuantitas minimal ${t.minQty} untuk grup '${groupKey}'.`
      );
    }
    seenCombos.add(comboKey);

    // Warning jika harga tier di bawah modal (HPP)
    if (costPrice && costPrice > 0 && t.price < costPrice) {
      warnings.push(
        `Tier '${t.tierName || `#${i + 1}`}': Harga jual grosir (Rp ${t.price.toLocaleString("id-ID")}) di bawah modal/HPP (Rp ${costPrice.toLocaleString("id-ID")}).`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
