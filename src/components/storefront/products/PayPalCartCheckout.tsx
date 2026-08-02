'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { type CartItem } from '@/components/storefront/cart/CartWidget';
import { AR_PROVINCES } from '@/lib/shipping/types';

const STORAGE_KEY_PREFIX = 'curplat_cart_';

/**
 * Checkout PayPal-only para carrito físico. Se usa cuando el owner
 * conectó PayPal pero NO MP. Scope reducido:
 *   - Sin promociones, gift cards ni cálculo de shipping rate
 *   - El owner arregla envío por fuera (contacta al buyer con el email
 *     que dejó al pagar y coordina)
 *   - Total = suma de (paypal_price_cents ?? price_cents) × qty
 *
 * Flow:
 *   1. Buyer llena email + dirección (mínima)
 *   2. Renderiza Smart Buttons con el total
 *   3. onApprove → capture endpoint crea physical_order + items y
 *      marca stock. Devuelve success.
 */
declare global {
  interface Window {
    paypal?: {
      Buttons: (config: unknown) => { render: (selector: string | HTMLElement) => Promise<void> };
    };
  }
}

type Props = {
  tenantId: string;
  primary: string;
  paypalClientId: string;
  paypalSandbox: boolean;
  paypalCurrency: string;
};

let sdkLoaded = new Map<string, Promise<void>>();

function loadPayPalSdk(clientId: string, currency: string): Promise<void> {
  const key = `${clientId}-${currency}`;
  const existing = sdkLoaded.get(key);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no_window'));
    if (window.paypal?.Buttons) return resolve();
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('sdk_load_failed'));
    document.head.appendChild(s);
  });
  sdkLoaded.set(key, p);
  return p;
}

function readCart(tenantId: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tenantId}`);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch { return []; }
}

function clearCart(tenantId: string) {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tenantId}`);
  window.dispatchEvent(new CustomEvent('curplat-cart-changed', { detail: { tenantId } }));
}

export function PayPalCartCheckout({
  tenantId, primary, paypalClientId, paypalSandbox, paypalCurrency
}: Props) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [numberF, setNumberF] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('AR-C');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setItems(readCart(tenantId)); }, [tenantId]);

  const requiresShipping = items.some((i) => i.requires_shipping !== false && i.kind === 'physical');
  const formOk = email.includes('@') && (!requiresShipping || (
    name.trim().length > 2 && street.trim() && city.trim() && postalCode.trim()
  ));

  // Total local (para mostrar). El server recalcula con paypal_price_cents.
  const localTotal = items.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const localCurrency = items[0]?.currency ?? 'ARS';

  // Load SDK + render buttons cuando el form está listo
  useEffect(() => {
    if (!formOk || items.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        await loadPayPalSdk(paypalClientId, paypalCurrency);
        if (cancelled || !window.paypal?.Buttons || !containerRef.current) return;
        containerRef.current.innerHTML = '';

        await window.paypal.Buttons({
          style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
          createOrder: async () => {
            setError(null);
            const payload = {
              items: items.map((i) => ({
                product_id: i.product_id ?? null,
                variant_id: i.variant_id ?? null,
                qty: i.qty
              })),
              buyer_email: email.trim(),
              buyer_name: name.trim() || undefined,
              buyer_phone: phone.trim() || undefined,
              shipping_address: requiresShipping ? {
                street: street.trim(), number: numberF.trim() || undefined,
                city: city.trim(), province, postal_code: postalCode.trim(),
                country: 'AR'
              } : undefined,
              buyer_notes: notes.trim() || undefined
            };
            const res = await fetch(`/api/paypal/${tenantId}/create-cart-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'create_failed');
            return data.paypal_order_id;
          },
          onApprove: async (data: { orderID: string }) => {
            const res = await fetch(`/api/paypal/${tenantId}/capture-cart-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paypal_order_id: data.orderID })
            });
            const done = await res.json();
            if (!res.ok) {
              setError(done.error || 'capture_failed');
              return;
            }
            clearCart(tenantId);
            window.location.href = '/mi-cuenta?paypal=1';
          },
          onError: (err: unknown) => {
            setError(err instanceof Error ? err.message : 'paypal_error');
          }
        }).render(containerRef.current);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'init_failed');
      }
    })();
    return () => { cancelled = true; };
  }, [formOk, items, email, name, phone, street, numberF, city, province, postalCode, notes, requiresShipping, tenantId, paypalClientId, paypalCurrency]);

  if (items.length === 0) {
    return (
      <div className="cp-radius border border-black/10 bg-white p-12 text-center text-black/45">
        <div className="text-4xl mb-3">🛒</div>
        <div className="text-lg font-medium text-black/65">Tu carrito está vacío</div>
        <a href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          Ir a la tienda →
        </a>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <section className="cp-radius border border-black/10 bg-white p-5">
          <h2 className="text-lg font-semibold mb-4">Tus datos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="email" required placeholder="Email *"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black/50 md:col-span-2" />
            <input placeholder="Nombre completo"
              value={name} onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black/50" />
            <input placeholder="Teléfono / WhatsApp"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black/50" />
          </div>
        </section>

        {requiresShipping && (
          <section className="cp-radius border border-black/10 bg-white p-5">
            <h2 className="text-lg font-semibold mb-1">Dirección de envío</h2>
            <p className="text-xs text-black/55 mb-4">
              El vendedor te contactará al email que dejaste para coordinar el envío y su costo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3 mb-3">
              <input placeholder="Calle *" value={street} onChange={(e) => setStreet(e.target.value)}
                className="rounded-md border border-black/15 px-3 py-2.5 text-sm" />
              <input placeholder="Número"
                value={numberF} onChange={(e) => setNumberF(e.target.value)}
                className="rounded-md border border-black/15 px-3 py-2.5 text-sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3">
              <input placeholder="Ciudad *"
                value={city} onChange={(e) => setCity(e.target.value)}
                className="rounded-md border border-black/15 px-3 py-2.5 text-sm" />
              <select value={province} onChange={(e) => setProvince(e.target.value)}
                className="rounded-md border border-black/15 px-3 py-2.5 text-sm bg-white">
                {AR_PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
              <input placeholder="CP *"
                value={postalCode} onChange={(e) => setPostalCode(e.target.value)}
                className="rounded-md border border-black/15 px-3 py-2.5 text-sm" />
            </div>
            <textarea rows={2} placeholder="Notas (opcional)"
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="mt-3 w-full rounded-md border border-black/15 px-3 py-2.5 text-sm" />
          </section>
        )}
      </div>

      <aside className="md:col-span-1">
        <div className="sticky top-24 cp-radius border border-black/10 bg-white p-5 space-y-4">
          <div className="text-xs uppercase tracking-wider text-black/45 font-semibold">Resumen</div>
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{i.title} <span className="text-black/45">× {i.qty}</span></span>
                <span className="font-mono whitespace-nowrap">$ {((i.price_cents * i.qty) / 100).toLocaleString('es-AR')}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-black/10 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-black/65">Total local</span>
              <span className="font-mono">$ {(localTotal / 100).toLocaleString('es-AR')} {localCurrency}</span>
            </div>
            <p className="text-[10px] text-black/50 leading-snug">
              PayPal cobra el monto en <strong>{paypalCurrency}</strong> definido por el vendedor para cada producto.
              El total exacto que se cobra aparece en el botón oficial de PayPal.
            </p>
          </div>

          {!formOk && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Completá tus datos {requiresShipping ? 'y dirección' : ''} para ver el botón de pago.
            </div>
          )}

          {paypalSandbox && (
            <div className="text-[10px] text-center text-amber-700 font-semibold uppercase tracking-wider">
              Modo sandbox — pagos de prueba
            </div>
          )}

          <div ref={containerRef} />

          {error && (
            <div className="rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">
              ❌ {error}
            </div>
          )}

          <a href="/carrito" className="block text-center text-xs text-black/45 hover:text-black">
            ← Volver al carrito
          </a>
          <p className="text-[10px] text-black/40 text-center">
            Pago seguro vía PayPal · Método aceptado: {paypalCurrency}
          </p>
          <p className="text-[10px] text-black/40 text-center leading-snug">
            Este sitio cobra por PayPal. El vendedor te contacta al email para coordinar el envío.
          </p>
          <a href="/" className="block text-center rounded-md py-2 text-sm font-medium border border-black/15 hover:bg-black/[0.02]">
            Seguir comprando
          </a>
        </div>
      </aside>
    </div>
  );
}
