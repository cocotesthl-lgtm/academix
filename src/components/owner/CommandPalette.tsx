'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Búsqueda global tipo Linear / Notion / Stripe (Cmd+K).
 *
 * - Trigger: Cmd+K / Ctrl+K en cualquier lugar, o click del botón en sidebar.
 * - Fuzzy search sobre nombres + keywords de cada item.
 * - ↑↓ navegan, Enter ejecuta, ESC cierra.
 * - Items: páginas internas + acciones rápidas + abrir storefront público.
 *
 * Decisión de scope: no busca CONTENIDO (clientes, publicaciones por nombre, etc).
 * Solo navegación + acciones. Buscar contenido tiene cada página su propio
 * input — mantenemos el palette enfocado en "moverse rápido".
 */

type CmdItem = {
  id: string;
  label: string;
  hint?: string;
  keywords: string;
  group: string;
  icon: string;
  href?: string;          // navega internamente
  url?: string;           // abre en nueva pestaña (storefront externo)
};

const items: CmdItem[] = [
  // Navegación
  { id: 'nav-inicio', label: 'Inicio', group: 'Ir a', icon: '🏠', href: '/dashboard', keywords: 'home dashboard panel resumen' },
  { id: 'nav-publicaciones', label: 'Productos', group: 'Ir a', icon: '🛍️', href: '/courses', keywords: 'publicaciones products productos ventas ecommerce' },
  { id: 'nav-cats', label: 'Categorías', group: 'Ir a', icon: '🏷️', href: '/categories', keywords: 'categorias tags' },
  { id: 'nav-cal', label: 'Calendario de eventos', group: 'Ir a', icon: '🗓️', href: '/eventos/calendario', keywords: 'disponibilidad fechas eventos calendar slots' },
  { id: 'nav-validar', label: 'Validar entradas', group: 'Ir a', icon: '🎟️', href: '/eventos/validar', keywords: 'scanner qr tickets entradas validacion molinete' },
  { id: 'nav-asistencia', label: 'Asistencia', group: 'Ir a', icon: '✅', href: '/eventos/asistencia', keywords: 'asistencia uso tickets check-in' },
  { id: 'nav-clientes', label: 'Clientes', group: 'Ir a', icon: '👥', href: '/clientes', keywords: 'alumnos personas compradores contactos crm' },
  { id: 'nav-ventas', label: 'Ventas', group: 'Ir a', icon: '💰', href: '/ventas', keywords: 'ventas transacciones sales orders pedidos' },
  { id: 'nav-instructores', label: 'Instructores', group: 'Ir a', icon: '👨‍🏫', href: '/instructors', keywords: 'profesores docentes equipo team' },
  { id: 'nav-afiliados', label: 'Afiliados', group: 'Ir a', icon: '🔗', href: '/affiliates', keywords: 'afiliados referidos comisiones partner' },
  { id: 'nav-site', label: 'Editor de páginas', group: 'Ir a', icon: '🎨', href: '/site', keywords: 'sitio editor landing builder paginas web' },
  { id: 'nav-brand', label: 'Identidad (logo + color)', group: 'Ir a', icon: '🖌️', href: '/branding', keywords: 'branding marca logo color identidad' },
  { id: 'nav-checkout', label: 'Checkout', group: 'Ir a', icon: '🛒', href: '/checkout', keywords: 'checkout pago campos datos compra' },
  { id: 'nav-cupones', label: 'Cupones', group: 'Ir a', icon: '🎫', href: '/coupons', keywords: 'cupones descuentos codigos promo' },
  { id: 'nav-integraciones', label: 'Integraciones', group: 'Ir a', icon: '🔌', href: '/integrations', keywords: 'mercadopago mp shopify drive oauth conectar' },
  { id: 'nav-finance', label: 'Finanzas', group: 'Ir a', icon: '💼', href: '/finance', keywords: 'finanzas comision deuda saldo' },
  { id: 'nav-soporte', label: 'Soporte', group: 'Ir a', icon: '📨', href: '/soporte', keywords: 'soporte tickets ayuda help' },
  // Acciones
  { id: 'act-course-new', label: 'Crear publicación nueva', group: 'Acciones', icon: '➕', href: '/courses/new', keywords: 'crear nueva publicación producto evento' },
  { id: 'act-ticket-new', label: 'Crear ticket de soporte', group: 'Acciones', icon: '➕', href: '/soporte/new', keywords: 'crear ticket soporte ayuda reportar problema' },
  { id: 'act-event-new', label: 'Programar evento (fecha + capacidad)', group: 'Acciones', icon: '➕', href: '/eventos/calendario', keywords: 'crear evento fecha tickets nuevo programar' }
];

function score(item: CmdItem, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const hay = `${item.label} ${item.keywords} ${item.group}`.toLowerCase();
  let s = 0;
  if (hay.startsWith(q)) s += 100;
  if (item.label.toLowerCase().startsWith(q)) s += 50;
  if (hay.includes(q)) s += 30;
  // Char-by-char subsequence match (fuzzy básico)
  let j = 0;
  for (let i = 0; i < hay.length && j < q.length; i++) {
    if (hay[i] === q[j]) j++;
  }
  if (j === q.length) s += 10;
  return s;
}

export function CommandPalette({ storefrontUrl }: { storefrontUrl: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Storefront item se compone con la URL del tenant que viene del server
  const allItems = useMemo<CmdItem[]>(() => [
    ...items,
    { id: 'nav-storefront', label: 'Ver mi sitio público', group: 'Ir a', icon: '↗', url: storefrontUrl, keywords: 'storefront ver publico web sitio publico' }
  ], [storefrontUrl]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    return allItems
      .map((it) => ({ it, s: score(it, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.it);
  }, [query, allItems]);

  // Cmd+K shortcut global
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    // Custom event para que botón del sidebar también abra
    function onOpen() { setOpen(true); }
    window.addEventListener('open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-palette', onOpen);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setActive(0);
      setQuery('');
      // Focus input al abrir
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function navigate(item: CmdItem) {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener');
    } else if (item.href) {
      router.push(item.href);
    }
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[active];
      if (item) navigate(item);
    }
  }

  if (!open) return null;

  // Agrupar por group manteniendo orden de filtered
  const grouped: Record<string, CmdItem[]> = {};
  for (const it of filtered) {
    if (!grouped[it.group]) grouped[it.group] = [];
    grouped[it.group].push(it);
  }

  // Index global de cada item en la lista plana para active state
  const flatIndex = new Map<string, number>();
  filtered.forEach((it, i) => flatIndex.set(it.id, i));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl rounded-xl border border-white/15 bg-[#0a0a0a] shadow-2xl overflow-hidden">
        <div className="border-b border-white/10 p-3 flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="Buscar página, acción…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/35"
            autoComplete="off"
          />
          <kbd className="text-[10px] text-white/40 border border-white/15 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-white/45 py-10">Sin resultados para "{query}"</div>
          ) : (
            Object.entries(grouped).map(([group, list]) => (
              <div key={group} className="mb-2 last:mb-0">
                <div className="text-[10px] uppercase tracking-wider text-white/40 px-2 py-1.5">{group}</div>
                {list.map((it) => {
                  const isActive = flatIndex.get(it.id) === active;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => navigate(it)}
                      onMouseEnter={() => setActive(flatIndex.get(it.id) ?? 0)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm ${
                        isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'
                      }`}
                    >
                      <span className="w-5 text-center text-base">{it.icon}</span>
                      <span className="flex-1 truncate">{it.label}</span>
                      {isActive && (
                        <kbd className="text-[10px] text-white/55 border border-white/15 rounded px-1.5 py-0.5">↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="border-t border-white/10 px-3 py-2 flex items-center justify-between text-[10px] text-white/40">
          <span>{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</span>
          <span>↑↓ navegar · ↵ abrir · ESC cerrar</span>
        </div>
      </div>
    </div>
  );
}

/** Botón compacto que dispara el palette (usable en sidebar / topbar). */
export function CommandPaletteTrigger({ compact = false }: { compact?: boolean }) {
  function open() {
    window.dispatchEvent(new CustomEvent('open-command-palette'));
  }
  return (
    <button
      type="button"
      onClick={open}
      title="Buscar (Cmd+K)"
      className={
        compact
          ? 'w-9 h-9 grid place-items-center rounded-lg hover:bg-white/5 text-white/55'
          : 'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/55 hover:text-white text-sm transition'
      }
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      {!compact && (
        <>
          <span className="flex-1 text-left">Buscar…</span>
          <kbd className="text-[10px] border border-white/15 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
        </>
      )}
    </button>
  );
}
