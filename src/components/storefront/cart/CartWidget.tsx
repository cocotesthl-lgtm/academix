'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Carrito del storefront persistido en localStorage.
 * Solo se monta cuando el tenant tiene cart_enabled=true.
 *
 * UI: DRAWER lateral (slide-in desde la derecha) tipo Amazon / MercadoLibre.
 * Antes era un dropdown adosado al botón; ocupaba poco y el email input se
 * mezclaba con el checkout. Ahora el checkout vive en /tienda/checkout
 * donde el buyer entra email + dirección + shipping tranquilo.
 */

export type CartItem = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  currency: string;
  cover_url?: string | null;
  qty: number;
  kind?: 'course' | 'physical';
  product_id?: string;
  variant_id?: string | null;
  variant_label?: string | null;
  max_stock?: number;
  requires_shipping?: boolean;
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

/** Cambiar cantidad de un item (clamp a max_stock si aplica). */
export function setItemQty(tenantId: string, itemId: string, qty: number) {
  const current = readCart(tenantId);
  const idx = current.findIndex((c) => c.id === itemId);
  if (idx < 0) return;
  const item = current[idx];
  const max = item.max_stock ?? 99;
  const next = Math.max(1, Math.min(max, Math.floor(qty)));
  current[idx] = { ...item, qty: next };
  writeCart(tenantId, current);
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
  variant?: 'header' | 'floating';
  /** 'dropdown' abre el drawer lateral. 'page' navega a /carrito directo. */
  display?: 'dropdown' | 'page';
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);

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

  // Escape cierra el drawer + bloquea scroll del body mientras está abierto.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const total = items.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const currency = items[0]?.currency || 'ARS';

  function handleClick(e: React.MouseEvent) {
    if (display === 'page') return;
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

      {/* Drawer lateral + backdrop — solo si display='dropdown' */}
      {display === 'dropdown' && (
        <>
          {/* Backdrop oscuro */}
          <div
            className={`fixed inset-0 z-[90] bg-black/40 transition-opacity duration-200 ${
              open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer que entra desde la derecha */}
          <aside
            className={`fixed top-0 right-0 bottom-0 z-[100] w-full sm:w-[420px] max-w-full bg-white text-black flex flex-col shadow-2xl transform transition-transform duration-300 ease-out ${
              open ? 'translate-x-0' : 'translate-x-full'
            }`}
            role="dialog"
            aria-label="Carrito"
            aria-hidden={!open}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between shrink-0"
              style={{ background: primary, color: 'white' }}>
              <div>
                <div className="font-bold text-base flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"/>
                    <circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  Tu carrito
                </div>
                <div className="text-xs opacity-80 mt-0.5">
                  {count === 0 ? 'vacío' : `${count} ${count === 1 ? 'producto' : 'productos'}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center text-xl leading-none"
                aria-label="Cerrar carrito"
              >×</button>
            </div>

            {/* Lista de items */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-black/45">
                  <div className="w-16 h-16 rounded-full bg-black/[0.04] flex items-center justify-center mb-3 text-3xl">🛒</div>
                  <div className="text-sm font-semibold text-black/70">Tu carrito está vacío</div>
                  <p className="text-xs mt-1">Agregá productos desde la tienda para verlos acá.</p>
                </div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {items.map((item) => (
                    <li key={item.id} className="p-4 flex gap-3">
                      <div className="w-16 h-16 rounded-lg bg-zinc-100 overflow-hidden shrink-0">
                        {item.cover_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="text-sm font-medium leading-snug line-clamp-2">{item.title}</div>
                        {item.variant_label && (
                          <div className="text-[11px] text-black/50">{item.variant_label}</div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          {/* Qty stepper */}
                          <div className="flex items-center border border-black/15 rounded-md overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setItemQty(tenantId, item.id, item.qty - 1)}
                              disabled={item.qty <= 1}
                              className="w-7 h-7 flex items-center justify-center text-sm hover:bg-black/5 disabled:opacity-30"
                              aria-label="Menos"
                            >−</button>
                            <span className="w-8 text-center text-sm tabular-nums">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => setItemQty(tenantId, item.id, item.qty + 1)}
                              disabled={item.max_stock !== undefined && item.qty >= item.max_stock}
                              className="w-7 h-7 flex items-center justify-center text-sm hover:bg-black/5 disabled:opacity-30"
                              aria-label="Más"
                            >+</button>
                          </div>
                          <div className="text-sm font-bold tabular-nums">
                            ${((item.price_cents * item.qty) / 100).toLocaleString('es-AR')}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(tenantId, item.id)}
                        className="text-black/40 hover:text-rose-600 shrink-0 self-start"
                        title="Quitar del carrito"
                        aria-label="Quitar"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer sticky con total + CTA */}
            {items.length > 0 && (
              <div className="border-t border-black/10 px-5 py-4 space-y-3 bg-white shrink-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-black/65">Total</span>
                  <span className="text-2xl font-bold tabular-nums">
                    ${(total / 100).toLocaleString('es-AR')}
                    <span className="text-xs font-normal text-black/40 ml-1">{currency}</span>
                  </span>
                </div>
                <p className="text-[11px] text-black/45 leading-snug">
                  Envío y datos de contacto se completan en el próximo paso.
                </p>
                <a
                  href="/tienda/checkout"
                  className="w-full rounded-lg py-3.5 font-bold text-white shadow hover:shadow-lg transition flex items-center justify-center gap-2"
                  style={{ background: primary }}
                >
                  Iniciar compra →
                </a>
                <button
                  type="button"
                  onClick={() => { if (confirm('¿Vaciar el carrito?')) clearCart(tenantId); }}
                  className="w-full text-xs text-black/55 hover:text-black underline underline-offset-2"
                >
                  Vaciar carrito
                </button>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
