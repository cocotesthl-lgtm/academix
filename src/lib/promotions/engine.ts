/**
 * Motor de aplicación de promociones al carrito.
 *
 * Se invoca en el server-side del checkout — no confiamos en el cliente
 * para calcular descuentos (tampering trivial). Toma los items ya
 * validados (product_id, qty, unit_price_cents) y las promos activas del
 * tenant, y devuelve descuentos + total actualizado.
 *
 * Estrategia:
 *  · Se ordenan las promos por prioridad (mayor primero).
 *  · Cada promo evalúa su scope (all / category / products) y decide
 *    qué items del cart le corresponden.
 *  · Aplica el descuento y lo suma al resultado.
 *  · No hay stacking exclusivo — todas las promos aplicables suman
 *    (mismo comportamiento que Shopify por default). Si en el futuro
 *    el owner quiere "solo una promo por producto", agregamos un flag.
 */

import type {
  Promotion, CartItem, PromotionsResult, AppliedPromotion
} from './types';
import { isPromotionActive } from './types';

/** Filtra los cart items que le corresponden a una promo según su scope. */
function itemsInScope(promo: Promotion, cart: CartItem[]): CartItem[] {
  switch (promo.scope) {
    case 'all':
      return cart;
    case 'category':
      return cart.filter((i) =>
        i.category_id && promo.target_ids.includes(i.category_id)
      );
    case 'products':
      return cart.filter((i) => promo.target_ids.includes(i.product_id));
  }
}

/**
 * Nx1 / Nx2: comprá N, pagás M. El descuento es el precio de los (N-M)
 * items más baratos entre cada grupo de N. Ej: 3x2 con [$100, $80, $60]
 * → grupo de 3 completo → 1 gratis → descuenta $60 (el más barato).
 *
 * Si N=3 y hay 7 items (uno de cada precio), se forman 2 grupos completos
 * de 3 + 1 item suelto que no aplica. Descuenta 2 items (uno por grupo).
 */
function applyNxPayM(
  promo: Promotion,
  scoped: CartItem[]
): { discount: number; freeCount: number } {
  const buy = promo.buy_qty ?? 0;
  const pay = promo.pay_qty ?? 0;
  if (buy <= 0 || pay <= 0 || pay >= buy) return { discount: 0, freeCount: 0 };
  const freePerGroup = buy - pay;
  // Expandimos por qty y ordenamos por precio DESCENDENTE (los más caros
  // pagan, los más baratos son los que quedan "gratis" — mejor para el
  // buyer, es el estándar de mercado).
  const prices: number[] = [];
  for (const it of scoped) {
    for (let i = 0; i < it.qty; i++) prices.push(it.unit_price_cents);
  }
  prices.sort((a, b) => b - a);
  const groups = Math.floor(prices.length / buy);
  if (groups === 0) return { discount: 0, freeCount: 0 };
  // Los últimos (freePerGroup × groups) items (los más baratos) son gratis.
  const freeCount = freePerGroup * groups;
  const startFree = prices.length - freeCount - (prices.length - buy * groups);
  // Aclaración: los items sobrantes fuera de grupo (prices.length - buy*groups)
  // no reciben descuento, se descartan del rango. Los free son los últimos.
  const freePrices = prices.slice(prices.length - (prices.length - buy * groups) - freeCount,
                                  prices.length - (prices.length - buy * groups));
  // Simplificación: como buy*groups + resto = total, si sobra R:
  //   items pagados = pay * groups, items gratis = freePerGroup * groups, items sueltos = R
  //   los gratis son los MÁS BARATOS dentro de los buy*groups.
  // Recalculo directo (más simple y correcto):
  const inGroups = buy * groups;
  const paidPrices = prices.slice(0, pay * groups); // los caros pagan
  const freePricesFixed = prices.slice(pay * groups, inGroups); // los baratos free
  const discount = freePricesFixed.reduce((s, p) => s + p, 0);
  // (paidPrices no se usa acá, es solo referencia mental)
  void paidPrices; void startFree; void freePrices;
  return { discount, freeCount };
}

/**
 * % off por cantidad: si el total de qty de items scoped >= min_qty,
 * aplica el % a la suma de esos items.
 */
function applyQtyPercent(promo: Promotion, scoped: CartItem[]): number {
  const minQty = promo.min_qty ?? 0;
  const percent = promo.discount_percent ?? 0;
  if (minQty <= 0 || percent <= 0) return 0;
  const totalQty = scoped.reduce((s, i) => s + i.qty, 0);
  if (totalQty < minQty) return 0;
  const subtotal = scoped.reduce((s, i) => s + i.qty * i.unit_price_cents, 0);
  return Math.round(subtotal * (percent / 100));
}

/**
 * % off por monto: si el subtotal del cart (o del scope) >= min_amount,
 * aplica % a los items del scope.
 */
function applyMinAmountPercent(
  promo: Promotion,
  scoped: CartItem[],
  cartTotal: number
): number {
  const min = promo.min_amount_cents ?? 0;
  const percent = promo.discount_percent ?? 0;
  if (min <= 0 || percent <= 0) return 0;
  if (cartTotal < min) return 0;
  const subtotal = scoped.reduce((s, i) => s + i.qty * i.unit_price_cents, 0);
  return Math.round(subtotal * (percent / 100));
}

/** Envío gratis por monto: no descuenta items, marca free_shipping=true. */
function applyMinAmountFreeShipping(promo: Promotion, cartTotal: number): boolean {
  const min = promo.min_amount_cents ?? 0;
  return min > 0 && cartTotal >= min;
}

/**
 * Aplicar todas las promociones activas a un cart.
 * @param cart items del carrito
 * @param promos promociones del tenant (activas o no — el engine filtra)
 * @param now hora actual, inyectable para tests
 */
export function computePromotions(
  cart: CartItem[],
  promos: Promotion[],
  now: Date = new Date()
): PromotionsResult {
  const items_total_cents = cart.reduce((s, i) => s + i.qty * i.unit_price_cents, 0);
  const applied: AppliedPromotion[] = [];
  let discount_cents = 0;
  let free_shipping = false;

  const activePromos = promos
    .filter((p) => isPromotionActive(p, now))
    .sort((a, b) => b.priority - a.priority);

  for (const p of activePromos) {
    const scoped = itemsInScope(p, cart);
    if (scoped.length === 0 && p.type !== 'min_amount_free_shipping') continue;

    switch (p.type) {
      case 'nx_pay_m': {
        const { discount, freeCount } = applyNxPayM(p, scoped);
        if (discount > 0) {
          discount_cents += discount;
          applied.push({
            promotion_id: p.id, title: p.title, type: p.type,
            discount_cents: discount,
            detail: `${freeCount} × gratis`
          });
        }
        break;
      }
      case 'qty_percent': {
        const d = applyQtyPercent(p, scoped);
        if (d > 0) {
          discount_cents += d;
          applied.push({
            promotion_id: p.id, title: p.title, type: p.type,
            discount_cents: d,
            detail: `${p.discount_percent}% off · ${scoped.reduce((s, i) => s + i.qty, 0)} unidades`
          });
        }
        break;
      }
      case 'min_amount_percent': {
        const d = applyMinAmountPercent(p, scoped, items_total_cents);
        if (d > 0) {
          discount_cents += d;
          applied.push({
            promotion_id: p.id, title: p.title, type: p.type,
            discount_cents: d,
            detail: `${p.discount_percent}% off`
          });
        }
        break;
      }
      case 'min_amount_free_shipping': {
        if (applyMinAmountFreeShipping(p, items_total_cents)) {
          free_shipping = true;
          applied.push({
            promotion_id: p.id, title: p.title, type: p.type,
            discount_cents: 0,   // el descuento real depende del rate, se aplica en el checkout
            detail: 'Envío gratis',
            free_shipping: true
          });
        }
        break;
      }
    }
  }

  return { items_total_cents, discount_cents, applied, free_shipping };
}

/**
 * ¿Qué producto/categoría aparece en alguna promo activa?
 * Útil para el storefront: le mandamos esta info a los renderers y ellos
 * ponen un badge "3x2" en las cards que corresponden.
 * Retorna un Map product_id → primer título de promo que lo afecta.
 */
export function promotionBadges(
  productIdsInCategory: Map<string, string | null>, // product_id → category_id
  promos: Promotion[],
  now: Date = new Date()
): Map<string, { title: string; type: string }> {
  const badges = new Map<string, { title: string; type: string }>();
  const active = promos.filter((p) => isPromotionActive(p, now));
  for (const [productId, categoryId] of productIdsInCategory) {
    for (const p of active) {
      if (p.scope === 'all') {
        badges.set(productId, { title: p.title, type: p.type });
        break;
      }
      if (p.scope === 'products' && p.target_ids.includes(productId)) {
        badges.set(productId, { title: p.title, type: p.type });
        break;
      }
      if (p.scope === 'category' && categoryId && p.target_ids.includes(categoryId)) {
        badges.set(productId, { title: p.title, type: p.type });
        break;
      }
    }
  }
  return badges;
}
