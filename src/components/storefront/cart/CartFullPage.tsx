'use client';

import { useEffect, useState, useCallback } from 'react';
import { type CartItem } from './CartWidget';

const STORAGE_KEY_PREFIX = 'curplat_cart_';
const storageKey = (tenantId: string) => `${STORAGE_KEY_PREFIX}${tenantId}`;

function readCart(tenantId: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function writeCart(tenantId: string, items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(tenantId), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('curplat-cart-changed', { detail: { tenantId } }));
}

/**
 * Vista completa del carrito (estilo MercadoLibre/Amazon checkout).
 * Render usado por /carrito cuando cart_display='page'.
 */
export function CartFullPage({ tenantId, primary }: { tenantId: string; primary: string }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => setItems(readCart(tenantId)), [tenantId]);

  useEffect(() => {
    refresh();
    function onChanged(e: Event) {
      const detail = (e as CustomEvent).detail as { tenantId?: string } | undefined;
      if (!detail || detail.tenantId === tenantId) refresh();
    }
    window.addEventListener('curplat-cart-changed', onChanged);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('curplat-cart-changed', onChanged);
      window.removeEventListener('storage', refresh);
    };
  }, [tenantId, refresh]);

  const total = items.reduce((s, i) => s + i.price_cents * i.qty, 0);

  function remove(itemId: string) {
    writeCart(tenantId, items.filter((i) => i.id !== itemId));
  }
  function changeQty(itemId: string, delta: number) {
    const next = items
      .map((i) => i.id === itemId ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
      .filter((i) => i.qty > 0);
    writeCart(tenantId, next);
  }
  function clearAll() {
    if (!confirm('¿Vaciar el carrito?')) return;
    writeCart(tenantId, []);
  }

  async function checkout() {
    if (items.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cart/${tenantId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, qty: i.qty })),
          buyer_email: buyerEmail.trim() || undefined
        })
      });
      const data = await res.json() as { init_point?: string; error?: string };
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert(`No se pudo procesar: ${data.error ?? 'error desconocido'}`);
        setSubmitting(false);
      }
    } catch {
      alert('Error de red. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-12 text-center text-black/45">
        <div className="text-4xl mb-3">🛒</div>
        <div className="text-lg font-medium text-black/65">Tu carrito está vacío</div>
        <div className="text-sm mt-1">Agregá productos desde el catálogo y vuelven acá.</div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Lista de items */}
      <ul className="md:col-span-2 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-black/10 bg-white p-4 flex gap-4">
            <div className="w-20 h-20 rounded-lg bg-zinc-100 overflow-hidden flex-shrink-0">
              {item.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{item.title}</div>
              <div className="text-sm text-black/55 mt-1">
                $ {(item.price_cents / 100).toLocaleString('es-AR')} {item.currency}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="inline-flex items-center border border-black/15 rounded">
                  <button type="button" onClick={() => changeQty(item.id, -1)}
                    className="px-2.5 py-1 text-sm hover:bg-black/5 disabled:opacity-40"
                    disabled={item.qty <= 1}>−</button>
                  <span className="px-3 text-sm font-medium tabular-nums">{item.qty}</span>
                  <button type="button" onClick={() => changeQty(item.id, 1)}
                    className="px-2.5 py-1 text-sm hover:bg-black/5">+</button>
                </div>
                <button type="button" onClick={() => remove(item.id)}
                  className="text-xs text-rose-600 hover:text-rose-800">
                  Quitar
                </button>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg font-mono">
                $ {((item.price_cents * item.qty) / 100).toLocaleString('es-AR')}
              </div>
            </div>
          </li>
        ))}
        <button type="button" onClick={clearAll}
          className="text-xs text-black/45 hover:text-black px-1">
          Vaciar carrito
        </button>
      </ul>

      {/* Resumen + checkout */}
      <aside className="md:col-span-1">
        <div className="sticky top-24 rounded-xl border border-black/10 bg-white p-5 space-y-4">
          <div className="text-xs uppercase tracking-wider text-black/45 font-semibold">Resumen</div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-black/65">Total</span>
            <span className="text-3xl font-bold font-mono">
              $ {(total / 100).toLocaleString('es-AR')}
            </span>
          </div>
          <label className="block">
            <span className="text-xs text-black/55">Email (para recibir el acceso)</span>
            <input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="vos@email.com"
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={checkout} disabled={submitting}
            className="w-full rounded-md py-3 font-bold text-white shadow hover:shadow-lg transition disabled:opacity-60"
            style={{ background: primary }}>
            {submitting ? 'Procesando…' : '💳 Pagar con MercadoPago'}
          </button>
          <p className="text-[10px] text-center text-black/40">
            Vas a ser redirigido a MercadoPago para completar el pago.
          </p>
        </div>
      </aside>
    </div>
  );
}
