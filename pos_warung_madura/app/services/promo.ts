import type { CartItem, Promotion } from "../types/pos";

export interface PromoEvaluationResult {
  itemDiscounts: Map<
    string,
    {
      promoId: string;
      promoName: string;
      discountAmount: number;
    }
  >;
  totalPromoDiscount: number;
  appliedPromos: Array<{
    promoId: string;
    promoName: string;
    savingAmount: number;
  }>;
}

/**
 * Engine Evaluasi Promo Keranjang Kasir (PRD F6.4)
 * Aturan bisnis:
 * 1. Promo dievaluasi jika kuantiti & syarat terpenuhi.
 * 2. Promo yang bertabrakan: promo dengan diskon terbesar menang (tidak ditumpuk).
 */
export function evaluateCartPromotions(
  cart: CartItem[],
  activePromotions: Promotion[]
): PromoEvaluationResult {
  const itemDiscounts = new Map<
    string,
    { promoId: string; promoName: string; discountAmount: number }
  >();
  const appliedPromosMap = new Map<string, { promoId: string; promoName: string; savingAmount: number }>();

  if (!cart.length || !activePromotions.length) {
    return { itemDiscounts, totalPromoDiscount: 0, appliedPromos: [] };
  }

  for (const promo of activePromotions) {
    if (!promo.isActive) continue;

    // 1. Promo Diskon Produk (Persen / Nominal)
    if (promo.promoType === "product_discount" && promo.productId) {
      const targetItems = cart.filter((it) => it.productId === promo.productId);
      for (const it of targetItems) {
        if (it.qty >= (promo.minQty || 1)) {
          let disc = 0;
          if (promo.discountType === "percentage") {
            disc = Math.round((it.price * it.qty * (promo.discountValue || 0)) / 100);
          } else {
            disc = Math.min(it.price * it.qty, (promo.discountValue || 0) * it.qty);
          }

          if (disc > 0) {
            const current = itemDiscounts.get(it.id);
            // PRD: Promo terbesar menang (tidak ditumpuk)
            if (!current || disc > current.discountAmount) {
              itemDiscounts.set(it.id, {
                promoId: promo.id,
                promoName: promo.name,
                discountAmount: disc,
              });

              appliedPromosMap.set(promo.id, {
                promoId: promo.id,
                promoName: promo.name,
                savingAmount: (appliedPromosMap.get(promo.id)?.savingAmount || 0) + disc,
              });
            }
          }
        }
      }
    }

    // 2. Promo Beli X Gratis Y (Buy X Get Y)
    else if (promo.promoType === "buy_x_get_y" && promo.buyProductId) {
      const buyItem = cart.find((it) => it.productId === promo.buyProductId);
      const buyQtyReq = promo.buyQty || 1;
      const getQtyBonus = promo.getQty || 1;
      const discPercent = promo.getDiscountPercent ?? 100;

      if (buyItem && buyItem.qty >= buyQtyReq) {
        const bonusMultiplier = Math.floor(buyItem.qty / buyQtyReq);
        const totalBonusUnits = bonusMultiplier * getQtyBonus;

        // Cek apakah produk bonus sama dengan produk yang dibeli
        const bonusProductId = promo.getProductId || promo.buyProductId;
        const targetBonusItem = cart.find((it) => it.productId === bonusProductId);

        if (targetBonusItem && totalBonusUnits > 0) {
          // Diskon dihitung untuk sejumlah unit bonus yang ada di keranjang
          const unitsToDiscount = Math.min(targetBonusItem.qty, totalBonusUnits);
          const disc = Math.round((targetBonusItem.price * unitsToDiscount * discPercent) / 100);

          if (disc > 0) {
            const current = itemDiscounts.get(targetBonusItem.id);
            if (!current || disc > current.discountAmount) {
              itemDiscounts.set(targetBonusItem.id, {
                promoId: promo.id,
                promoName: promo.name,
                discountAmount: disc,
              });

              appliedPromosMap.set(promo.id, {
                promoId: promo.id,
                promoName: promo.name,
                savingAmount: (appliedPromosMap.get(promo.id)?.savingAmount || 0) + disc,
              });
            }
          }
        }
      }
    }

    // 3. Promo Bundling Paket
    else if (promo.promoType === "bundle" && promo.bundlePrice !== undefined && promo.bundleItems?.length) {
      let canFulfill = true;
      let regularBundlePrice = 0;

      for (const bi of promo.bundleItems) {
        const found = cart.find((c) => c.productId === bi.productId);
        if (!found || found.qty < bi.qty) {
          canFulfill = false;
          break;
        }
        regularBundlePrice += found.price * bi.qty;
      }

      if (canFulfill && regularBundlePrice > promo.bundlePrice) {
        const bundleSavings = regularBundlePrice - promo.bundlePrice;
        appliedPromosMap.set(promo.id, {
          promoId: promo.id,
          promoName: promo.name,
          savingAmount: bundleSavings,
        });

        for (const bi of promo.bundleItems) {
          const found = cart.find((c) => c.productId === bi.productId);
          if (found) {
            const itemShare = Math.round(
              bundleSavings * ((found.price * bi.qty) / regularBundlePrice)
            );
            const current = itemDiscounts.get(found.id);
            if (!current || itemShare > current.discountAmount) {
              itemDiscounts.set(found.id, {
                promoId: promo.id,
                promoName: promo.name,
                discountAmount: itemShare,
              });
            }
          }
        }
      }
    }
  }

  let totalPromoDiscount = 0;
  for (const it of itemDiscounts.values()) {
    totalPromoDiscount += it.discountAmount;
  }

  return {
    itemDiscounts,
    totalPromoDiscount,
    appliedPromos: Array.from(appliedPromosMap.values()),
  };
}
