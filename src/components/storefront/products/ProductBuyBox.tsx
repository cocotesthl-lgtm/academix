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
  variants
}: {
  tenantId: string;
  product: PhysicalProduct;
  variants: ProductVariant[];
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

  function handleAdd() {
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
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={outOfStock}
          className={`flex-1 py-3.5 rounded-lg text-base font-semibold transition ${
            outOfStock
              ? 'bg-black/10 text-black/40 cursor-not-allowed'
              : added
                ? 'bg-emerald-600 text-white'
                : 'bg-black text-white hover:bg-black/85'
          }`}
        >
          {outOfStock ? 'Sin stock' : added ? '✓ Agregado' : 'Agregar al carrito'}
        </button>
        {added && (
          <a
            href="/tienda/checkout"
            className="py-3.5 px-5 rounded-lg text-base font-semibold border border-black text-black hover:bg-black/[0.03] transition"
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
