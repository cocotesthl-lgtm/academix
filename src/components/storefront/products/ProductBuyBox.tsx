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
  walletBonus = null,
  selectedVariantId,
  onSelectVariant
}: {
  tenantId: string;
  product: PhysicalProduct;
  variants: ProductVariant[];
  walletBonus?: { cents: number; symbol: string; label: string; logoUrl?: string | null } | null;
  /** Estado controlado opcional (para compartir con ProductGallery). */
  selectedVariantId?: string;
  onSelectVariant?: (id: string) => void;
}) {
  const hasVariants = variants.length > 0;
  const [localId, setLocalId] = useState<string>(
    hasVariants ? (variants.find((v) => v.stock_qty > 0)?.id ?? variants[0].id) : ''
  );
  const selectedId = selectedVariantId ?? localId;
  const setSelectedId = (id: string) => {
    if (onSelectVariant) onSelectVariant(id);
    else setLocalId(id);
  };
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState<number>(1);

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
    // Repetir el add N veces respetando la qty seleccionada (el carrito
    // agrupa por cartId y suma quantity internamente).
    const n = Math.max(1, Math.min(qty, product.track_stock ? displayStock : 99));
    for (let i = 0; i < n; i++) {
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
    }
    trackEvent(tenantId, 'add_to_cart', {
      product_id: product.id,
      amount_cents: displayPrice * n,
      content_kind: 'physical'
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
      {/* Condition + rating hints — arriba del precio, estilo ML */}
      {product.condition && (
        <div className="text-xs text-black/55">
          {product.condition === 'new' ? 'Nuevo' : 'Usado'}
          {typeof product.rating === 'number' && product.rating > 0 && (
            <> · <span className="text-blue-600 hover:underline cursor-pointer">
              {product.reviews_count.toLocaleString('es-AR')} opiniones
            </span></>
          )}
        </div>
      )}
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

      {/* Cuotas — debajo del precio, estilo ML */}
      {product.installments_max && product.installments_max > 0 && (
        <InstallmentsInfo
          price={displayPrice}
          currency={product.currency}
          max={product.installments_max}
          interestFree={product.installments_interest_free ?? null}
        />
      )}

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
        <VariantSwatches
          variants={variants}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}

      {/* Selector de cantidad — estilo ML: "Cantidad: 1 ˅ (+10 disponibles)" */}
      {product.qty_selector_enabled !== false && product.track_stock && displayStock > 0 && (
        <QtySelector
          value={qty}
          max={displayStock}
          onChange={setQty}
        />
      )}

      {/* Stack de CTAs estilo ML: Comprar ahora arriba (primary), Agregar al
          carrito debajo (secondary con outline). Amazon los muestra al revés
          pero ML es la referencia local — voy con ese orden. */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={outOfStock}
          className={`w-full py-3.5 cp-radius text-base font-semibold transition ${
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
          className={`w-full py-3.5 cp-radius text-base font-semibold transition border ${
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

/**
 * Swatches de variantes estilo MercadoLibre / Amazon.
 * Header dinámico "Color: **Nombre seleccionado**", grilla de chips debajo.
 * Los chips muestran (en este orden de prioridad): swatch_image_url →
 * swatch_color → image_url thumb → fallback texto. Sin stock aparecen
 * grisados y con tachado sobre el label.
 */
function VariantSwatches({
  variants,
  selectedId,
  onSelect
}: {
  variants: ProductVariant[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  // option_key explícito gana (ej. 'color', 'talle', 'sabor'). Si no está,
  // fallback a la heurística vieja sobre options.<key>. Sino "Opción".
  const firstKey = variants.find((v) => v.option_key)?.option_key ?? null;
  const groupLabel = firstKey
    ? capitalize(firstKey)
    : (variants.every((v) => v.options && 'color' in v.options)
        ? 'Color'
        : variants.every((v) => v.options && 'talle' in v.options)
          ? 'Talle'
          : 'Opción');

  return (
    <div>
      <div className="text-sm text-black/75 mb-2">
        {groupLabel}: <strong className="text-black">{selected?.name ?? '—'}</strong>
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const isSelected = v.id === selectedId;
          const disabled = v.stock_qty <= 0;
          const swatchBg = v.swatch_image_url
            ? `url(${v.swatch_image_url}) center/cover no-repeat`
            : v.image_url
              ? `url(${v.image_url}) center/cover no-repeat`
              : (v.swatch_color ?? undefined);
          const hasVisual = !!(v.swatch_image_url || v.image_url || v.swatch_color);
          return (
            <button
              key={v.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(v.id)}
              title={disabled ? `${v.name} — sin stock` : v.name}
              aria-label={v.name}
              aria-pressed={isSelected}
              className={`relative cp-radius border-2 transition ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                  : disabled
                    ? 'border-black/10'
                    : 'border-black/15 hover:border-black/50'
              } ${hasVisual ? 'p-0.5 bg-white' : 'px-3 py-2 bg-white'}`}
            >
              {hasVisual ? (
                <span
                  className={`block w-12 h-12 rounded-md ${disabled ? 'opacity-30' : ''}`}
                  style={{ background: swatchBg }}
                  aria-hidden="true"
                />
              ) : (
                <span className={`text-xs font-medium ${disabled ? 'text-black/30 line-through' : 'text-black/85'}`}>
                  {v.name}
                </span>
              )}
              {disabled && hasVisual && (
                <span
                  className="absolute inset-0 flex items-center justify-center text-[10px] text-black/50 font-semibold"
                  aria-hidden="true"
                >
                  ⛌
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected && selected.stock_qty > 0 && selected.stock_qty <= 5 && (
        <div className="text-[11px] text-amber-700 mt-1.5">
          Últimas {selected.stock_qty} unidades en {selected.name}
        </div>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Info de cuotas debajo del precio. Estilo ML.
 * Prioriza el mensaje de "sin interés" si lo hay, sino muestra el máximo.
 */
function InstallmentsInfo({
  price, currency, max, interestFree
}: {
  price: number; currency: string; max: number; interestFree: number | null;
}) {
  const perInstallment = (n: number) => {
    const cents = Math.round(price / n);
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency, maximumFractionDigits: 0
    }).format(cents / 100);
  };

  // "Sin interés" es más atractivo comercialmente — priorizar
  if (interestFree && interestFree > 0) {
    return (
      <div className="text-sm text-emerald-700">
        En <strong>{interestFree} cuotas de {perInstallment(interestFree)} sin interés</strong>
      </div>
    );
  }
  return (
    <div className="text-sm text-black/70">
      Hasta <strong>{max} cuotas</strong> de {perInstallment(max)}
    </div>
  );
}

/**
 * Selector de cantidad estilo ML: pill "Cantidad: N ˅" con dropdown
 * de opciones (1..min(stock,10)) y hint "(+X disponibles)" cuando hay más.
 */
function QtySelector({
  value, max, onChange
}: {
  value: number; max: number; onChange: (n: number) => void;
}) {
  const shownMax = Math.min(max, 10);
  const remaining = Math.max(0, max - shownMax);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-black/60">Cantidad:</span>
      <div className="relative inline-block">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="appearance-none bg-white border border-black/25 rounded pl-3 pr-7 py-1.5 font-semibold text-sm hover:border-black cursor-pointer focus:outline-none focus:border-blue-500"
        >
          {Array.from({ length: shownMax }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n} unidad{n === 1 ? '' : 'es'}</option>
          ))}
        </select>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-black/50 pointer-events-none">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {remaining > 0 && (
        <span className="text-xs text-black/50">(+{remaining} disponibles)</span>
      )}
    </div>
  );
}
