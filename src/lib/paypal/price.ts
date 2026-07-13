import 'server-only';

/**
 * Resuelve el precio a cobrar en PayPal aplicando la precedencia:
 *
 *   1. Override manual del producto (paypal_price_cents seteado > 0).
 *   2. Conversión automática global (tenant.paypal_auto_convert + rate).
 *   3. Fallback: price_cents interpretado 1:1 en la moneda de PayPal
 *      (el buyer paga el mismo número, otra moneda).
 *
 * Todo en centavos in/out para preservar precisión.
 */
export function resolvePayPalPriceCents(opts: {
  /** Precio local del producto en centavos. */
  localPriceCents: number;
  /** Override manual configurado por el owner en el editor del producto. */
  productOverrideCents?: number | null;
  /** Config del tenant. */
  tenantAutoConvert: boolean;
  tenantConversionRate: number | null;
  tenantRoundCents: boolean;
}): number {
  // 1. Override manual gana siempre
  if (opts.productOverrideCents != null && opts.productOverrideCents > 0) {
    return opts.productOverrideCents;
  }

  // 2. Conversión automática
  if (opts.tenantAutoConvert && opts.tenantConversionRate && opts.tenantConversionRate > 0) {
    const converted = opts.localPriceCents / opts.tenantConversionRate;
    if (opts.tenantRoundCents) {
      // Redondear al entero más cercano (14.87 → 15 → 1500 cents)
      return Math.round(converted / 100) * 100;
    }
    // Sin redondeo: truncar a centavos exactos
    return Math.round(converted);
  }

  // 3. Fallback 1:1
  return opts.localPriceCents;
}
