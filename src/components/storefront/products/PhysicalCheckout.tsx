'use client';

import { useEffect, useState, useMemo } from 'react';
import { type CartItem } from '@/components/storefront/cart/CartWidget';
import { AR_PROVINCES } from '@/lib/shipping/types';
import { trackEvent } from '@/lib/analytics/client';

type RateOption = {
  rate_id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  price_cents: number;
  is_free: boolean;
  delivery_label: string | null;
  is_pickup: boolean;
};

const STORAGE_KEY_PREFIX = 'curplat_cart_';
const GC_KEY_PREFIX = 'curplat_giftcard_';

type SavedGiftCard = {
  code: string;
  amount_cents: number;
  currency: string;
  savedAt: number;
};

function readGiftCard(tenantId: string): SavedGiftCard | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${GC_KEY_PREFIX}${tenantId}`);
    return raw ? (JSON.parse(raw) as SavedGiftCard) : null;
  } catch { return null; }
}

function removeGiftCard(tenantId: string) {
  localStorage.removeItem(`${GC_KEY_PREFIX}${tenantId}`);
}

function readCart(tenantId: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tenantId}`);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch { return []; }
}

function writeCart(tenantId: string, items: CartItem[]) {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantId}`, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('curplat-cart-changed', { detail: { tenantId } }));
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

export type CheckoutDesignInput = {
  cta_color?: string | null;
  accent_color?: string | null;
  card_style?: 'rounded' | 'square' | null;
};

export function PhysicalCheckout({
  tenantId,
  tenantPrimary = '#111827',
  design
}: {
  tenantId: string;
  /** Color primary del tenant (fallback si no hay overrides en design). */
  tenantPrimary?: string;
  /** Overrides del owner para colores y estilo. Todos opcionales. */
  design?: CheckoutDesignInput;
}) {
  // Colores efectivos: override > tenant primary > fallback negro.
  const ctaColor = design?.cta_color || tenantPrimary || '#111827';
  const accentColor = design?.accent_color || ctaColor;
  const cardRadius = design?.card_style === 'square' ? '0.25rem' : '1rem';
  const [items, setItems] = useState<CartItem[]>([]);
  const [giftCard, setGiftCard] = useState<SavedGiftCard | null>(null);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [province, setProvince] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [apt, setApt] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [rateOptions, setRateOptions] = useState<RateOption[]>([]);
  const [selectedRate, setSelectedRate] = useState<string>('');
  const [loadingRates, setLoadingRates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(readCart(tenantId).filter((i) => i.kind === 'physical'));
    setGiftCard(readGiftCard(tenantId));
  }, [tenantId]);

  const currency = items[0]?.currency || 'ARS';
  const itemsTotal = useMemo(
    () => items.reduce((s, i) => s + i.price_cents * i.qty, 0),
    [items]
  );
  const requiresShipping = items.some((i) => i.requires_shipping);
  const totalWeightG = useMemo(
    () => items.reduce((s, i) => s + (i.weight_g ?? 500) * i.qty, 0),
    [items]
  );

  // Fetch shipping options cuando cambia provincia
  useEffect(() => {
    if (!requiresShipping) { setRateOptions([]); return; }
    if (!province) { setRateOptions([]); return; }
    setLoadingRates(true);
    const url = `/api/shipping/${tenantId}/options?province=${province}&subtotal=${itemsTotal}&weight=${totalWeightG}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: { options?: RateOption[] }) => {
        const opts = d.options ?? [];
        setRateOptions(opts);
        if (opts.length > 0 && !opts.find((o) => o.rate_id === selectedRate)) {
          setSelectedRate(opts[0].rate_id);
        }
      })
      .finally(() => setLoadingRates(false));
  }, [province, itemsTotal, totalWeightG, tenantId, requiresShipping, selectedRate]);

  const selectedRateData = rateOptions.find((o) => o.rate_id === selectedRate) ?? null;
  const shippingCost = selectedRateData?.price_cents ?? 0;
  const preDiscount = itemsTotal + shippingCost;
  const giftCardDiscount = giftCard ? Math.min(giftCard.amount_cents, preDiscount) : 0;
  const total = Math.max(0, preDiscount - giftCardDiscount);
  const needsAddress = selectedRateData && !selectedRateData.is_pickup;

  function updateQty(id: string, delta: number) {
    const next = items
      .map((i) => i.id === id ? { ...i, qty: Math.max(1, Math.min(i.max_stock ?? 99, i.qty + delta)) } : i)
      .filter((i) => i.qty > 0);
    setItems(next);
    // Persistir todos los items (courses + physical) — releemos y actualizamos solo los physical
    const allItems = readCart(tenantId);
    const merged = [...allItems.filter((i) => i.kind !== 'physical'), ...next];
    writeCart(tenantId, merged);
  }

  function remove(id: string) {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    const allItems = readCart(tenantId);
    const merged = [...allItems.filter((i) => i.kind !== 'physical'), ...next];
    writeCart(tenantId, merged);
  }

  async function handleCheckout() {
    if (submitting) return;
    setError(null);

    if (!buyerEmail || !buyerEmail.includes('@')) {
      setError('Email válido requerido.');
      return;
    }
    if (requiresShipping && !selectedRateData) {
      setError('Elegí un método de envío.');
      return;
    }
    if (needsAddress) {
      if (!street || !number || !city || !postalCode || !province) {
        setError('Completá la dirección de envío.');
        return;
      }
    }

    setSubmitting(true);
    trackEvent(tenantId, 'checkout_start', { amount_cents: total });
    const payload = {
      items: items.map((i) => ({
        product_id: i.product_id!,
        variant_id: i.variant_id ?? null,
        qty: i.qty
      })),
      buyer_email: buyerEmail.trim(),
      buyer_name: buyerName.trim() || undefined,
      buyer_phone: buyerPhone.trim() || undefined,
      shipping_rate_id: selectedRate || undefined,
      shipping_address: needsAddress ? {
        street: street.trim(), number: number.trim(), apt: apt.trim() || undefined,
        city: city.trim(), province, postal_code: postalCode.trim(),
        country: 'AR'
      } : undefined,
      buyer_notes: notes.trim() || undefined,
      gift_card_code: giftCard?.code
    };

    try {
      const res = await fetch(`/api/checkout/physical/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json() as { init_point?: string; error?: string; detail?: string };
      if (data.init_point) {
        // Limpiar gift card guardada — no queremos re-aplicar si el user
        // vuelve al carrito (ya está redeemed o pending redeem)
        if (giftCard) removeGiftCard(tenantId);
        window.location.href = data.init_point;
      } else {
        setError(data.detail || data.error || 'error al procesar el pago');
        setSubmitting(false);
      }
    } catch {
      setError('Error de red. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-black/10 bg-white p-12 text-center text-black/45">
        <div className="text-4xl mb-3">🛒</div>
        <div className="text-lg font-medium text-black/65">Tu carrito está vacío</div>
        <a href="/tienda" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          Ir a la tienda →
        </a>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Formulario */}
      <div className="md:col-span-2 space-y-6">
        <section className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="text-lg font-semibold mb-4">Tus datos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="email" required placeholder="Email *"
              value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black/50" />
            <input placeholder="Nombre completo"
              value={buyerName} onChange={(e) => setBuyerName(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black/50" />
            <input placeholder="Teléfono / WhatsApp"
              value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black/50 md:col-span-2" />
          </div>
        </section>

        {requiresShipping && (
          <section className="rounded-xl border border-black/10 bg-white p-5">
            <h2 className="text-lg font-semibold mb-4">Envío</h2>
            <div>
              <label className="block text-xs text-black/60 mb-1">Provincia *</label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full rounded-md border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black/50"
              >
                <option value="">— seleccioná —</option>
                {AR_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>

            {loadingRates && <p className="text-xs text-black/50 mt-3">Calculando opciones…</p>}

            {province && !loadingRates && rateOptions.length === 0 && (
              <p className="text-sm text-rose-600 mt-3">
                No tenemos envío disponible para tu provincia. Contactanos para resolverlo.
              </p>
            )}

            {rateOptions.length > 0 && (
              <div className="mt-4 space-y-2">
                <label className="block text-xs text-black/60 mb-1">Método de envío</label>
                {rateOptions.map((o) => {
                  const sel = selectedRate === o.rate_id;
                  return (
                  <label key={o.rate_id}
                    className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition hover:border-black/30"
                    style={sel
                      ? { borderColor: accentColor, background: `${accentColor}0F` }
                      : undefined}>
                    <input type="radio" name="rate" checked={sel}
                      onChange={() => setSelectedRate(o.rate_id)} className="mt-1"
                      style={sel ? { accentColor } : undefined} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{o.zone_name} · {o.name}</div>
                      <div className="text-xs text-black/55 mt-0.5">
                        {o.delivery_label ?? (o.is_pickup ? 'Retiro en local' : 'Envío a domicilio')}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${o.is_free ? 'text-emerald-700' : ''}`}>
                      {o.is_free ? 'Gratis' : formatMoney(o.price_cents, currency)}
                    </div>
                  </label>
                  );
                })}
              </div>
            )}

            {needsAddress && (
              <div className="mt-4 pt-4 border-t border-black/10 space-y-3">
                <h3 className="text-sm font-medium">Dirección</h3>
                <div className="grid grid-cols-3 gap-3">
                  <input placeholder="Calle *" value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="col-span-2 rounded-md border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/50" />
                  <input placeholder="Nº *" value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="rounded-md border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/50" />
                  <input placeholder="Piso / Dpto (opc)" value={apt}
                    onChange={(e) => setApt(e.target.value)}
                    className="rounded-md border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/50" />
                  <input placeholder="Ciudad *" value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-md border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/50" />
                  <input placeholder="CP *" value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="rounded-md border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/50" />
                </div>
                <textarea rows={2} placeholder="Notas de entrega (ej. dejar en portería)"
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/50" />
              </div>
            )}
          </section>
        )}
      </div>

      {/* Resumen */}
      <aside>
        <div className="sticky top-24 rounded-xl border border-black/10 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-black/60">Resumen</h2>

          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id} className="flex gap-3 pb-3 border-b border-black/5 last:border-0">
                <div className="w-12 h-12 rounded bg-zinc-100 overflow-hidden shrink-0">
                  {i.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.cover_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{i.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="inline-flex items-center border border-black/10 rounded text-xs">
                      <button type="button" onClick={() => updateQty(i.id, -1)}
                        className="px-1.5 py-0.5 hover:bg-black/5 disabled:opacity-40"
                        disabled={i.qty <= 1}>−</button>
                      <span className="px-2 tabular-nums">{i.qty}</span>
                      <button type="button" onClick={() => updateQty(i.id, 1)}
                        className="px-1.5 py-0.5 hover:bg-black/5 disabled:opacity-40"
                        disabled={!!i.max_stock && i.qty >= i.max_stock}>+</button>
                    </div>
                    <button type="button" onClick={() => remove(i.id)}
                      className="text-[10px] text-rose-600 hover:underline">quitar</button>
                  </div>
                </div>
                <div className="text-xs font-mono text-right">
                  {formatMoney(i.price_cents * i.qty, currency)}
                </div>
              </li>
            ))}
          </ul>

          {giftCard && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-800">🎁 Gift card aplicada</span>
                <button type="button"
                  onClick={() => { removeGiftCard(tenantId); setGiftCard(null); }}
                  className="text-[10px] text-emerald-700 hover:underline">
                  Quitar
                </button>
              </div>
              <div className="font-mono text-emerald-700 mt-0.5">{giftCard.code}</div>
              <div className="text-emerald-900 mt-1">
                Descuento: <strong>−{formatMoney(giftCardDiscount, currency)}</strong>
              </div>
            </div>
          )}

          <div className="space-y-1 pt-2 border-t border-black/5 text-sm">
            <div className="flex justify-between text-black/60">
              <span>Subtotal</span>
              <span>{formatMoney(itemsTotal, currency)}</span>
            </div>
            {requiresShipping && (
              <div className="flex justify-between text-black/60">
                <span>Envío</span>
                <span>{selectedRateData
                  ? (selectedRateData.is_free ? 'Gratis' : formatMoney(shippingCost, currency))
                  : '—'}</span>
              </div>
            )}
            {giftCardDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Gift card</span>
                <span>−{formatMoney(giftCardDiscount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-black/10">
              <span>Total</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={submitting || (requiresShipping && !selectedRate)}
            className="w-full py-3 text-white font-semibold shadow hover:shadow-lg transition disabled:opacity-50"
            style={{ background: ctaColor, borderRadius: cardRadius }}
          >
            {submitting ? 'Redirigiendo…' : `Pagar ${formatMoney(total, currency)}`}
          </button>

          <p className="text-[10px] text-black/40 text-center">
            Vas a ser redirigido a Mercado Pago para completar el pago.
          </p>
        </div>
      </aside>
    </div>
  );
}
