'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicCategory } from '@/lib/categories/queries';

/**
 * Mega-menú estilo MercadoLibre para explorar categorías.
 * - Sidebar izquierda: solo categorías FEATURED con parent_id=null
 * - Panel derecho: hijos de la categoría hovered
 * - Click en una categoría (padre o hijo) → /tienda?cat=<slug>
 *
 * Se abre con click en el trigger. Se cierra al clickear afuera o Escape.
 */
export function CategoryMegamenu({
  categories,
  triggerLabel = 'Categorías'
}: {
  categories: PublicCategory[];
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hoveredRootId, setHoveredRootId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const featuredRoots = categories.filter((c) => !c.parent_id && c.is_featured);
  const allRoots = categories.filter((c) => !c.parent_id);
  // Si no hay ninguna featured, usamos todas las roots (para nunca mostrar vacío)
  const rootsToShow = featuredRoots.length > 0 ? featuredRoots : allRoots;

  // Default seleccionar la primera root al abrir
  const activeRootId = hoveredRootId ?? rootsToShow[0]?.id ?? null;
  const childrenOfActive = activeRootId
    ? categories.filter((c) => c.parent_id === activeRootId)
    : [];

  function go(slug: string) {
    setOpen(false);
    router.push(`/tienda?cat=${slug}`);
  }

  if (rootsToShow.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={(e) => {
          // Cerrar si el foco sale del megamenú
          if (!panelRef.current?.contains(e.relatedTarget as Node)) {
            setTimeout(() => setOpen(false), 150);
          }
        }}
        className="text-sm text-black/75 hover:text-black flex items-center gap-1.5 px-3 py-2 rounded hover:bg-black/[0.03]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
        {triggerLabel}
      </button>

      {open && (
        <>
          {/* Backdrop para cerrar al clickear afuera */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="absolute left-0 top-full mt-1 z-50 flex bg-white rounded-lg shadow-2xl border border-black/10 overflow-hidden"
            style={{ minWidth: 720, maxWidth: '90vw' }}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          >
            {/* Sidebar de padres */}
            <div className="w-56 bg-zinc-900 text-white py-2 shrink-0">
              {rootsToShow.map((root) => {
                const active = activeRootId === root.id;
                return (
                  <button
                    key={root.id}
                    type="button"
                    onMouseEnter={() => setHoveredRootId(root.id)}
                    onFocus={() => setHoveredRootId(root.id)}
                    onClick={() => go(root.slug)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition ${
                      active ? 'bg-blue-600 text-white font-medium' : 'text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <span>{root.name}</span>
                    <span className={active ? 'opacity-100' : 'opacity-40'}>›</span>
                  </button>
                );
              })}
            </div>

            {/* Panel derecho con hijos */}
            <div className="flex-1 p-6 bg-[#fef6ec]">
              {activeRootId && (
                <div className="border-b border-black/10 pb-3 mb-4">
                  <h3 className="text-lg font-bold text-black">
                    {categories.find((c) => c.id === activeRootId)?.name}
                  </h3>
                </div>
              )}
              {childrenOfActive.length === 0 ? (
                <div className="text-sm text-black/45 italic">
                  Esta categoría no tiene subcategorías. Click en el nombre a la izquierda para ver sus productos.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
                  {childrenOfActive.map((kid) => (
                    <button
                      key={kid.id}
                      type="button"
                      onClick={() => go(kid.slug)}
                      className="text-left text-sm text-black/75 hover:text-black hover:underline py-0.5"
                    >
                      {kid.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
