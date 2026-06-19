'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Carrito del storefront persistido en localStorage.
 * Solo se monta cuando el tenant tiene cart_enabled=true.
 *
 * Las API públicas para que otros componentes interactúen con el carrito:
 *   - addToCurplatCart(item) → fuerza re-render del widget via 'storage' event
 *   - dispatcha custom event 'curplat-cart-changed' que el widget escucha
 */

export type CartItem = {
  id: string;          // course_id (o pack/event id)
  slug: string;
  title: string;
  price_cents: number;
  currency: string;
  cover_url?: string | null;
  qty: number;
};

const STORAGE_KEY_PREFIX = 'curplat_cart_';

function storageKey(tenantId: string) {
  return `${STORAGE_KEY_PREFIX}${tenantId}`;
}

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

export function addToCart(tenantId: string, item: Omit<CartItem, 'qty'>) {
  const current = readCart(tenantId);
  const existingIdx = current.findIndex((c) => c.id === item.id);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], qty: current[existingIdx].qty + 1 };
  } else {
    current.push({ ...item, qty: 1 });
  }
  writeCart(tenantId, current);
}

export function removeFromCart(tenantId: string, itemId: string) {
  const next = readCart(tenantId).filter((c) => c.id !== itemId);
  writeCart(tenantId, next);
}

export function clearCart(tenantId: string) {
  writeCart(tenantId, []);
}

export function CartWidget({ tenantId, primary }: { tenantId: string; primary: string }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState('');

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
  const count = items.reduce((s, i) => s + i.qty, 0);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 rounded-full w-14 h-14 shadow-2xl flex items-center justify-center text-2xl hover:scale-105 transition"
        style={{ background: primary, color: 'white' }}
        aria-label="Carrito"
      >
        🛒
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center border-2 border-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)] bg-white text-black rounded-2xl shadow-2xl border border-black/10 overflow-hidden flex flex-col"
          style={{ maxHeight: 'min(640px, calc(100vh - 7rem))' }}>
          <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between"
            style={{ background: primary, color: 'white' }}>
            <div>
              <div className="font-bold text-sm">🛒 Tu carrito</div>
              <div className="text-[10px] opacity-80">{count} {count === 1 ? 'producto' : 'productos'}</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-xl leading-none opacity-80 hover:opacity-100">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-8 text-center text-black/45 text-sm">
                Tu carrito está vacío.
                <br />
                Agregá productos desde el catálogo.
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {items.map((item) => (
                  <li key={item.id} className="p-3 flex gap-3">
                    <div className="w-14 h-14 rounded bg-zinc-100 overflow-hidden flex-shrink-0">
                      {item.cover_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="text-xs text-black/55">
                        ${(item.price_cents / 100).toLocaleString('es-AR')} {item.currency}
                        {item.qty > 1 && <span className="ml-1 text-black/40">× {item.qty}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(tenantId, item.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 flex-shrink-0"
                      title="Quitar"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <div className="p-4 border-t border-black/10 space-y-3 bg-zinc-50">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-black/65">Total</span>
                <span className="text-2xl font-bold">
                  ${(total / 100).toLocaleString('es-AR')}
                </span>
              </div>
              <input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="Tu email (para recibir el acceso)"
                className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={checkout}
                disabled={submitting}
                className="w-full rounded-md py-3 font-bold text-white shadow hover:shadow-lg transition disabled:opacity-60"
                style={{ background: primary }}
              >
                {submitting ? 'Procesando…' : '💳 Pagar todo'}
              </button>
              <button
                onClick={() => { if (confirm('¿Vaciar el carrito?')) clearCart(tenantId); }}
                className="w-full text-xs text-black/55 hover:text-black"
              >
                Vaciar carrito
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
