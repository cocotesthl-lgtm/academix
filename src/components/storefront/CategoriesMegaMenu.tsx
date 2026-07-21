'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export type MegaCategory = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  is_featured: boolean;
};

/**
 * Mega-menú de categorías estilo MercadoLibre.
 *
 * · Botón "Categorías ▾" en la nav abre panel al hover (desktop) o click (mobile).
 * · Panel dividido: sidebar izquierdo con roots featured; panel derecho
 *   con hijos de la root hoverada (o clickeada en mobile).
 * · Los hijos se agrupan por su parent (nivel 2) — si hay depth 3, se
 *   muestran los nivel 3 en columnas bajo su nivel 2.
 * · Cierra al hacer click afuera, al hacer click en un link, o con Escape.
 * · Todos los links van a /tienda?cat=<slug>. Si necesitás otra ruta,
 *   pasala en el prop hrefBase.
 */
export function CategoriesMegaMenu({
  label = 'Categorías',
  categories,
  hrefBase = '/tienda?cat=',
  primary = '#0a0a0a'
}: {
  label?: string;
  categories: MegaCategory[];
  hrefBase?: string;
  primary?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Divido el árbol
  const roots = categories.filter((c) => !c.parent_id && c.is_featured);
  const childrenByParent = new Map<string, MegaCategory[]>();
  for (const c of categories) {
    if (c.parent_id) {
      const arr = childrenByParent.get(c.parent_id) ?? [];
      arr.push(c);
      childrenByParent.set(c.parent_id, arr);
    }
  }
  // Si no hay ninguna root featured, no mostramos nada (evita popup vacío).
  if (roots.length === 0) return null;

  const activeRoot = hovered ?? roots[0]?.id ?? null;
  const activeChildren = activeRoot ? (childrenByParent.get(activeRoot) ?? []) : [];
  const activeRootObj = roots.find((r) => r.id === activeRoot) ?? roots[0];

  // Nivel 2 puede tener nivel 3 debajo — armamos grupos.
  const groupedL2 = activeChildren.map((l2) => ({
    ...l2,
    grandkids: childrenByParent.get(l2.id) ?? []
  }));

  // Cierre por click afuera + Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function schedClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={schedClose}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-sm text-black/70 hover:text-black"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-50 rounded-lg bg-white border border-black/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2"
          style={{ width: 'min(920px, 90vw)' }}
        >
          <div className="grid grid-cols-[220px_1fr] min-h-[380px]">
            {/* Sidebar de roots */}
            <ul className="bg-neutral-950 text-neutral-200 py-2 overflow-y-auto max-h-[70vh]">
              {roots.map((r) => {
                const isActive = r.id === activeRoot;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHovered(r.id)}
                      onClick={() => setHovered(r.id)}
                      className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                        isActive ? 'text-white' : 'text-neutral-300 hover:text-white hover:bg-white/5'
                      }`}
                      style={isActive ? { background: `var(--brand-bg, ${primary})` } : undefined}
                    >
                      <span className="truncate">{r.name}</span>
                      {(childrenByParent.get(r.id)?.length ?? 0) > 0 && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Panel derecho con hijos del root activo */}
            <div className="p-6 bg-white overflow-y-auto max-h-[70vh]">
              {activeRootObj && (
                <div className="mb-4">
                  <Link
                    href={`${hrefBase}${encodeURIComponent(activeRootObj.slug)}`}
                    onClick={() => setOpen(false)}
                    className="text-xl font-semibold text-neutral-900 hover:underline"
                  >
                    {activeRootObj.name}
                  </Link>
                  <div className="h-px bg-neutral-200 mt-3" />
                </div>
              )}

              {groupedL2.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No hay subcategorías. <Link
                    href={`${hrefBase}${encodeURIComponent(activeRootObj?.slug ?? '')}`}
                    onClick={() => setOpen(false)}
                    className="text-blue-600 hover:underline"
                  >Ver todo</Link>
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                  {groupedL2.map((l2) => (
                    <div key={l2.id}>
                      <Link
                        href={`${hrefBase}${encodeURIComponent(l2.slug)}`}
                        onClick={() => setOpen(false)}
                        className="block font-semibold text-neutral-900 hover:underline"
                      >
                        {l2.name}
                      </Link>
                      {l2.grandkids.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {l2.grandkids.map((l3) => (
                            <li key={l3.id}>
                              <Link
                                href={`${hrefBase}${encodeURIComponent(l3.slug)}`}
                                onClick={() => setOpen(false)}
                                className="text-sm text-blue-700 hover:underline"
                              >
                                {l3.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
