'use client';

import { useState } from 'react';
import { addToCart } from '@/components/storefront/cart/CartWidget';
import { trackEvent } from '@/lib/analytics/client';
import type { PhysicalProduct, ProductVariant } from '@/lib/products/actions';

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

export function ProductBuyBox({
  tenantId,
  product,
  variants,
  walletBonus = null
}: {
  tenantId: string;
  product: PhysicalProduct;
  variants: ProductVariant[];
  walletBonus?: { cents: number; symbol: string; label: string; logoUrl?: string | null } | null;
}) {
  const hasVariants = variants.length > 0;
  const [selectedId, setSelectedId] = useState<string>(
    hasVariants ? (variants.find((v) => v.stock_qty > 0)?.id ?? variants[0].id) : ''
  );
  const [added, setAdded] = useState(false);

  const currentVariant = hasVariants ? variants.find((v) => v.id === selectedId) ?? null : null;
  const displayPrice = currentVariant?.price_cents ?? product.price_cents;
  const displayStock = currentVariant?.stock_qty ?? product.stock_qty;
  const displayImage = currentVariant?.image_url ?? product.cover_url;
  const outOfStock = product.track_stock && displayStock <= 0;

  const discount = product.compare_at_price_cents && product.compare_at_price_cents > displayPrice
    ? Math.round((1 - displayPrice / product.compare_at_price_cents) * 100)
    : null;

  function pushToCart() {
    if (outOfStock) return;
    const cartId = hasVariants
      ? `phys:${product.id}:${selectedId}`
      : `phys:${product.id}:default`;
    addToCart(tenantId, {
      id: cartId,
      slug: product.slug,
      title: hasVariants && currentVariant
        ? `${product.title} · ${currentVariant.name}`
        : product.title,
      price_cents: displayPrice,
      currency: product.currency,
      cover_url: displayImage,
      kind: 'physical',
      product_id: product.id,
      variant_id: currentVariant?.id ?? null,
      variant_label: currentVariant?.name ?? null,
      max_stock: product.track_stock ? displayStock : undefined,
      requires_shipping: product.requires_shipping,
      weight_g: product.weight_g ?? undefined
    });
    trackEvent(tenantId, 'add_to_cart', {
      product_id: product.id,
      amount_cents: displayPrice
    });
  }

  function handleAdd() {
    pushToCart();
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuyNow() {
    if (outOfStock) return;
    pushToCart();
    // Salteo el "Agregado" y voy directo al checkout (comportamiento Amazon/ML).
    if (typeof window !== 'undefined') {
      window.location.href = '/tienda/checkout';
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-3">
        <div className="text-3xl font-bold">{formatMoney(displayPrice, product.currency)}</div>
        {product.compare_at_price_cents && product.compare_at_price_cents > displayPrice && (
          <>
            <div className="text-lg text-black/40 line-through">
              {formatMoney(product.compare_at_price_cents, product.currency)}
            </div>
            {discount !== null && (
              <div className="text-sm font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                -{discount}%
              </div>
            )}
          </>
        )}
      </div>

      {product.track_stock && !outOfStock && displayStock <= 5 && (
        <div className="text-xs text-amber-700 font-medium">
          Últimas {displayStock} unidades
        </div>
      )}

      {/* Bonus wallet — al comprar el buyer gana saldo en la wallet del sitio.
          Solo visible si el owner configuró wallet_bonus_cents > 0. */}
      {walletBonus && walletBonus.cents > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {walletBonus.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={walletBonus.logoUrl} alt={walletBonus.label} className="w-5 h-5 rounded object-cover shrink-0" />
          ) : (
            <span className="text-lg leading-none">🎁</span>
          )}
          <div className="min-w-0">
            Ganás <strong className="font-mono">
              {walletBonus.symbol} {(walletBonus.cents / 100).toLocaleString('es-AR')} {walletBonus.label}
            </strong> en tu saldo al comprar
          </div>
        </div>
      )}

      {hasVariants && (
        <div>
          <label className="block text-xs uppercase tracking-wider text-black/55 font-semibold mb-2">
            Opción
          </label>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const isSelected = v.id === selectedId;
              const disabled = v.stock_qty <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedId(v.id)}
                  className={`text-sm px-3 py-2 rounded-md border transition ${
                    disabled
                      ? 'border-black/10 text-black/25 line-through cursor-not-allowed'
                      : isSelected
                        ? 'border-black bg-black text-white'
                        : 'border-black/20 text-black/80 hover:border-black/50'
                  }`}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stack de CTAs estilo ML: Comprar ahora arriba (primary), Agregar al
          carrito debajo (secondary con outline). Amazon los muestra al revés
          pero ML es la referencia local — voy con ese orden. */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={outOfStock}
          className={`w-full py-3.5 rounded-lg text-base font-semibold transition ${
            outOfStock
              ? 'bg-black/10 text-black/40 cursor-not-allowed'
              : 'bg-black text-white hover:bg-black/85'
          }`}
        >
          {outOfStock ? 'Sin stock' : 'Comprar ahora'}
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={outOfStock}
          className={`w-full py-3.5 rounded-lg text-base font-semibold transition border ${
            outOfStock
              ? 'border-black/10 text-black/30 cursor-not-allowed'
              : added
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-black/25 text-black hover:bg-black/[0.03]'
          }`}
        >
          {added ? '✓ Agregado al carrito' : '🛒 Agregar al carrito'}
        </button>
        {added && (
          <a
            href="/tienda/checkout"
            className="block text-center text-sm text-blue-600 font-semibold hover:underline pt-1"
          >
            Ir al checkout →
          </a>
        )}
      </div>

      {product.requires_shipping && !outOfStock && (
        <div className="text-xs text-black/55 flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="1" y="3" width="15" height="13"/>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
          Envío disponible. Costo se calcula en el checkout según tu provincia.
        </div>
      )}
    </div>
  );
}
