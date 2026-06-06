'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';

type Course = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  currency: string;
  is_featured: boolean;
  featured_position: number;
  category_id: string | null;
};

type Category = { id: string; name: string; slug: string };

/**
 * Catálogo con filtros client-side. Sin recarga, sin scroll-jump.
 * Cuando el user clickea una categoría, filtramos en memoria + actualizamos
 * la URL via history.replaceState (no scroll). Transición fade en las cards.
 *
 * Inicializa el filtro desde ?cat=<slug> en la URL para compatibilidad
 * con links externos.
 */
export function CatalogFilter({
  title,
  showFilters,
  courses,
  categories,
  primary,
  initialCatSlug
}: {
  title: string;
  showFilters: boolean;
  courses: Course[];
  categories: Category[];
  primary: string;
  initialCatSlug: string | null;
}) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialCatSlug);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fadeKey, setFadeKey] = useState(0);

  const selectedCat = useMemo(
    () => selectedSlug ? categories.find((c) => c.slug === selectedSlug) ?? null : null,
    [selectedSlug, categories]
  );

  const catalog = useMemo(() => {
    if (!selectedCat) return courses;
    return courses.filter((c) => c.category_id === selectedCat.id);
  }, [selectedCat, courses]);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // Actualizar URL sin recargar ni scrollear
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedSlug) url.searchParams.set('cat', selectedSlug);
    else url.searchParams.delete('cat');
    window.history.replaceState(null, '', url.toString());
  }, [selectedSlug]);

  function selectCategory(slug: string | null) {
    setSelectedSlug(slug);
    setFadeKey((k) => k + 1);  // bump key para re-disparar la animación
  }

  return (
    <div ref={containerRef} className="max-w-6xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold mb-6">{title}</h2>

      {showFilters && categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => selectCategory(null)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors duration-200 ${
              !selectedSlug
                ? 'bg-black text-white border-black'
                : 'border-black/15 text-black/70 hover:bg-black/[0.03]'
            }`}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCategory(c.slug)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors duration-200 ${
                selectedSlug === c.slug
                  ? 'bg-black text-white border-black'
                  : 'border-black/15 text-black/70 hover:bg-black/[0.03]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {catalog.length === 0 ? (
        <div className="rounded-xl border border-black/10 p-12 text-center text-black/50">
          {selectedCat ? `No hay cursos en "${selectedCat.name}" todavía.` : 'Todavía no hay cursos publicados.'}
        </div>
      ) : (
        <div
          key={fadeKey}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 catalog-fade-in"
        >
          {catalog.map((c) => (
            <CourseCard
              key={c.id}
              c={c}
              primary={primary}
              category={c.category_id ? catById.get(c.category_id) : null}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes catalogFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .catalog-fade-in > * {
          animation: catalogFadeIn 280ms ease-out both;
        }
        /* Stagger sutil para que entren escalonadas */
        .catalog-fade-in > *:nth-child(1) { animation-delay: 0ms; }
        .catalog-fade-in > *:nth-child(2) { animation-delay: 40ms; }
        .catalog-fade-in > *:nth-child(3) { animation-delay: 80ms; }
        .catalog-fade-in > *:nth-child(4) { animation-delay: 120ms; }
        .catalog-fade-in > *:nth-child(5) { animation-delay: 160ms; }
        .catalog-fade-in > *:nth-child(6) { animation-delay: 200ms; }
        .catalog-fade-in > *:nth-child(n+7) { animation-delay: 240ms; }
      `}</style>
    </div>
  );
}

function CourseCard({
  c, primary, category
}: {
  c: Course; primary: string; category?: Category | null;
}) {
  return (
    <Link href={`/c/${c.slug}`} className="block rounded-xl border border-black/10 overflow-hidden hover:shadow-lg transition bg-white">
      <div className="h-40 relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
        {c.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.cover_url} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {c.is_featured && (
          <span className="absolute top-3 left-3 bg-white text-black text-xs font-semibold px-2 py-1 rounded">
            ⭐ Destacado
          </span>
        )}
      </div>
      <div className="p-5">
        {category && (
          <div className="text-xs font-medium mb-1.5" style={{ color: primary }}>
            {category.name}
          </div>
        )}
        <h3 className="font-semibold mb-1">{c.title}</h3>
        {c.description && <p className="text-sm text-black/60 line-clamp-2 mb-3">{c.description}</p>}
        <div className="flex items-center justify-between">
          <span className="font-bold">
            {c.price_cents === 0 ? 'Gratis' : `$ ${(c.price_cents / 100).toLocaleString('es-AR')} ${c.currency}`}
          </span>
          <span className="text-xs font-medium px-2 py-1 rounded text-white" style={{ background: primary }}>
            Ver curso →
          </span>
        </div>
      </div>
    </Link>
  );
}
