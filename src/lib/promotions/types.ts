/**
 * Promociones automáticas del carrito.
 * Se aplican SOLAS al llegar a la condición (a diferencia de los cupones,
 * que requieren código escrito por el buyer).
 */

export type PromotionType =
  | 'nx_pay_m'                   // 3x2 / 4x3 / 2x1
  | 'qty_percent'                // "10% off comprando 3+"
  | 'min_amount_free_shipping'   // "Envío gratis desde $80.000"
  | 'min_amount_percent';        // "15% off en compras +$50.000"

export type PromotionScope = 'all' | 'category' | 'products';

export type Promotion = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  type: PromotionType;
  buy_qty: number | null;
  pay_qty: number | null;
  min_qty: number | null;
  min_amount_cents: number | null;
  discount_percent: number | null;
  scope: PromotionScope;
  target_ids: string[];      // uuids de categorías o productos según scope
  starts_at: string | null;
  ends_at: string | null;
  enabled: boolean;
  priority: number;
};

/**
 * Item del carrito para el engine. Simplificado — no necesita todos los
 * campos del producto, solo lo esencial para calcular descuentos.
 */
export type CartItem = {
  product_id: string;
  variant_id?: string | null;
  qty: number;
  unit_price_cents: number;
  category_id?: string | null;   // para scope='category'
};

/**
 * Descuento aplicado por una promoción a un cart. Se muestra al buyer
 * ("3x2 aplicado — $X off") y se guarda en la orden para reporting.
 */
export type AppliedPromotion = {
  promotion_id: string;
  title: string;
  type: PromotionType;
  discount_cents: number;
  /** Info extra por tipo, para mostrar en el UI ("3x2: 1 gratis"). */
  detail?: string | null;
  /** Si es free shipping, marca que el shipping cost debe pasar a 0. */
  free_shipping?: boolean;
};

export type PromotionsResult = {
  items_total_cents: number;    // total pre-promo (por si el caller no lo tenía)
  discount_cents: number;       // suma de descuentos aplicables al items_total
  applied: AppliedPromotion[];
  free_shipping: boolean;       // alguna promo dio envío gratis
};

/** Label legible por tipo para tarjetas y sidebar. */
export const PROMOTION_TYPE_LABEL: Record<PromotionType, string> = {
  nx_pay_m: 'Nx1 · Nx2 · Descuento por cantidad (Buy X Get Y)',
  qty_percent: '% off por cantidad',
  min_amount_free_shipping: 'Envío gratis desde monto',
  min_amount_percent: '% off desde monto'
};

/** Descripción one-liner por tipo para el form. */
export const PROMOTION_TYPE_DESC: Record<PromotionType, string> = {
  nx_pay_m: 'Comprá N unidades, pagás M. El más barato entre cada grupo queda gratis.',
  qty_percent: 'Al llegar a N unidades del producto/categoría, se aplica X% off en esos ítems.',
  min_amount_free_shipping: 'Cuando el subtotal del cart llega a $X, el envío pasa a costar 0.',
  min_amount_percent: 'Cuando el subtotal del cart llega a $X, se aplica X% off a los ítems del scope.'
};

/** Emoji por tipo para cards. */
export const PROMOTION_TYPE_EMOJI: Record<PromotionType, string> = {
  nx_pay_m: '🎁',
  qty_percent: '🏷️',
  min_amount_free_shipping: '🚚',
  min_amount_percent: '💰'
};

/** ¿Está vigente ahora? Considera starts_at, ends_at y enabled. */
export function isPromotionActive(p: Promotion, now: Date = new Date()): boolean {
  if (!p.enabled) return false;
  if (p.starts_at && new Date(p.starts_at) > now) return false;
  if (p.ends_at && new Date(p.ends_at) < now) return false;
  return true;
}

/** Formato humano de la regla ("Comprá 3, pagás 2"). */
export function promotionSummary(p: Promotion): string {
  switch (p.type) {
    case 'nx_pay_m':
      return `Comprá ${p.buy_qty ?? '?'} · Pagás ${p.pay_qty ?? '?'}`;
    case 'qty_percent':
      return `${p.discount_percent ?? '?'}% off desde ${p.min_qty ?? '?'} unidades`;
    case 'min_amount_free_shipping':
      return `Envío gratis desde $${((p.min_amount_cents ?? 0) / 100).toLocaleString('es-AR')}`;
    case 'min_amount_percent':
      return `${p.discount_percent ?? '?'}% off desde $${((p.min_amount_cents ?? 0) / 100).toLocaleString('es-AR')}`;
  }
}
