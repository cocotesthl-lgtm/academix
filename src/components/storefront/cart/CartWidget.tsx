'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Carrito del storefront persistido en localStorage.
 * Solo se monta cuando el tenant tiene cart_enabled=true.
 *
 * Las API públicas para que otros componentes interactúen con el carrito:
 *   - addToOfferNowCart(item) → fuerza re-render del widget via 'storage' event
 *   - dispatcha custom event 'curplat-cart-changed' que el widget escucha
 */

export type CartItem = {
  /**
   * ID único dentro del carrito. Para cursos = course_id.
   * Para productos físicos = `phys:${product_id}:${variant_id | 'default'}`
   * — así múltiples variantes del mismo producto se contabilizan aparte.
   */
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  currency: string;
  cover_url?: string | null;
  qty: number;
  /** kind default 'course' (retrocompat). Físicos = 'physical'. */
  kind?: 'course' | 'physical';
  /** Solo para físicos: referencias reales que necesita el checkout. */
  product_id?: string;
  variant_id?: string | null;
  variant_label?: string | null;
  /** Stock máximo permitido (para bloquear +qty en cart). */
  max_stock?: number;
  /** True si el producto necesita dirección de envío. */
  requires_shipping?: boolean;
  /** Peso unitario en gramos — usado para tarifas de envío por peso. */
  weight_g?: number;
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

export function CartWidget({
  tenantId,
  primary,
  variant = 'header',
  display = 'dropdown'
}: {
  tenantId: string;
  primary: string;
  /** Dónde se renderiza este botón: inline en el header, o flotante abajo-derecha. */
  variant?: 'header' | 'floating';
  /** Qué hace el click: abrir dropdown inline o navegar a /carrito. */
  display?: 'dropdown' | 'page';
}) {
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

  // Si el modo es 'page', el botón navega a /carrito en vez de abrir dropdown.
  function handleClick(e: React.MouseEvent) {
    if (display === 'page') {
      // Dejar que el <a> haga su trabajo (no preventDefault)
      return;
    }
    e.preventDefault();
    setOpen((o) => !o);
  }

  const isFloating = variant === 'floating';
  const buttonCls = isFloating
    ? 'flex items-center justify-center w-14 h-14 rounded-full shadow-2xl hover:scale-105 transition'
    : 'relative inline-flex items-center justify-center rounded-full p-2 hover:bg-black/5 transition';
  const buttonStyle = isFloating ? { background: primary, color: 'white' } : undefined;
  const buttonTitle = count === 0 ? 'Carrito vacío' : `${count} ${count === 1 ? 'producto' : 'productos'} en el carrito`;

  const inner = (
    <>
      <svg width={isFloating ? 26 : 22} height={isFloating ? 26 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isFloating ? '' : 'text-black/70'}>
        <circle cx="9" cy="21" r="1"/>
        <circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      {count > 0 && (
        <span
          className={`absolute text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center border-2 border-white ${
            isFloating ? '-top-1 -right-1' : '-top-0.5 -right-0.5'
          }`}
          style={{ background: isFloating ? '#ef4444' : primary }}
        >
          {count}
        </span>
      )}
    </>
  );

  return (
    <div className={isFloating ? 'fixed bottom-6 right-6 z-40' : 'relative'}>
      {display === 'page' ? (
        <a href="/carrito" className={buttonCls} style={buttonStyle} aria-label="Carrito" title={buttonTitle}>
          {inner}
        </a>
      ) : (
        <button type="button" onClick={handleClick} className={buttonCls} style={buttonStyle} aria-label="Carrito" title={buttonTitle}>
          {inner}
        </button>
      )}

      {/* Dropdown SOLO si display='dropdown' (en modo page no aparece) */}
      {display === 'dropdown' && open && (
        <div
          className={`absolute z-50 w-96 max-w-[calc(100vw-2rem)] bg-white text-black rounded-2xl shadow-2xl border border-black/10 overflow-hidden flex flex-col ${
            isFloating ? 'bottom-full right-0 mb-2' : 'right-0 top-full mt-2'
          }`}
          style={{ maxHeight: 'min(640px, calc(100vh - 8rem))' }}>
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
    </div>
  );
}
