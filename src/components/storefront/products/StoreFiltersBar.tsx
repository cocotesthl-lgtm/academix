'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

type Category = { id: string; slug: string; name: string };

type SortKey = 'recent' | 'price_asc' | 'price_desc' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Más recientes',
  price_asc: 'Precio: menor a mayor',
  price_desc: 'Precio: mayor a menor',
  name: 'Alfabético'
};

/**
 * Barra de filtros y búsqueda de la /tienda. Client component que actualiza
 * la URL (searchParams) — el server component re-renderea con los filtros
 * aplicados.
 *
 * UX:
 *   · Búsqueda: input con debounce 300ms → push a URL
 *   · Categoría: pills clickeables, la seleccionada se toglea
 *   · Precio: min + max con "Aplicar" (no push por cada tecla)
 *   · Orden: select nativo con onChange
 *   · Solo con stock: checkbox toggle
 *   · Botón "Limpiar" cuando hay filtros activos
 */
export function StoreFiltersBar({
  categories,
  initialQ,
  initialCat,
  initialMin,
  initialMax,
  initialSort,
  initialInStock
}: {
  categories: Category[];
  initialQ: string;
  initialCat: string;
  initialMin: string;
  initialMax: string;
  initialSort: SortKey;
  initialInStock: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(initialQ);
  const [min, setMin] = useState(initialMin);
  const [max, setMax] = useState(initialMax);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search — evita push por cada tecla.
  useEffect(() => {
    if (q === initialQ) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushWith({ q: q.trim() || null, page: null });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function pushWith(patch: Record<string, string | null>) {
    const usp = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') usp.delete(k);
      else usp.set(k, v);
    }
    // Cualquier cambio de filtro resetea a página 1
    if (!('page' in patch)) usp.delete('page');
    const qs = usp.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function applyPriceRange() {
    pushWith({
      min: min.trim() || null,
      max: max.trim() || null
    });
  }

  function toggleCategory(slug: string) {
    pushWith({ cat: initialCat === slug ? null : slug });
  }

  function clearAll() {
    setQ(''); setMin(''); setMax('');
    startTransition(() => router.push(pathname));
  }

  const hasFilters = !!(initialQ || initialCat || initialMin || initialMax || initialInStock);

  return (
    <div className="mb-8 space-y-4">
      {/* Fila 1: search + sort */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40"
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar productos…"
            className="w-full rounded-lg border border-black/15 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-black/50 bg-white"
          />
        </div>
        <select
          value={initialSort}
          onChange={(e) => pushWith({ sort: e.target.value })}
          className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black/50 bg-white"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>{SORT_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* Fila 2: categorías (si hay) */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button"
            onClick={() => pushWith({ cat: null })}
            className={`text-sm px-3 py-1.5 rounded-full border transition ${
              !initialCat
                ? 'bg-black text-white border-black'
                : 'border-black/15 text-black/70 hover:border-black/40'
            }`}>
            Todas
          </button>
          {categories.map((c) => (
            <button key={c.id} type="button"
              onClick={() => toggleCategory(c.slug)}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                initialCat === c.slug
                  ? 'bg-black text-white border-black'
                  : 'border-black/15 text-black/70 hover:border-black/40'
              }`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Fila 3: precio + stock + limpiar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-black/55 uppercase tracking-wider">Precio</span>
          <input
            type="number"
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="Min"
            min={0}
            className="w-20 rounded border border-black/15 px-2 py-1 text-sm focus:outline-none focus:border-black/50 bg-white"
          />
          <span className="text-black/40">–</span>
          <input
            type="number"
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="Max"
            min={0}
            className="w-20 rounded border border-black/15 px-2 py-1 text-sm focus:outline-none focus:border-black/50 bg-white"
          />
          <button type="button"
            onClick={applyPriceRange}
            disabled={min === initialMin && max === initialMax}
            className="text-xs px-2.5 py-1 rounded border border-black/15 text-black/70 hover:bg-black/[0.03] disabled:opacity-40">
            Aplicar
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={initialInStock}
            onChange={(e) => pushWith({ in_stock: e.target.checked ? '1' : null })}
          />
          <span>Solo con stock</span>
        </label>

        {hasFilters && (
          <button type="button"
            onClick={clearAll}
            className="ml-auto text-xs text-rose-600 hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
