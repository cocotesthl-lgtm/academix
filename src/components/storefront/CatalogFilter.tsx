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
  ribbon_text?: string | null;
  ribbon_tone?: string | null;
};

type Category = { id: string; name: string; slug: string };

type PaginationMode = 'show_more' | 'paginated';
type CtaMode = 'course_link' | 'no_button' | 'custom_url';

const RIBBON_TONE_CLS: Record<string, string> = {
  featured: 'bg-fuchsia-500 text-white',
  sale:     'bg-rose-500 text-white',
  urgent:   'bg-amber-500 text-amber-950',
  new:      'bg-emerald-500 text-white',
  info:     'bg-sky-500 text-white'
};

/**
 * Catálogo con filtros client-side. Sin recarga, sin scroll-jump.
 * Cuando el user clickea una categoría, filtramos en memoria + actualizamos
 * la URL via history.replaceState (no scroll).
 *
 * Dos modos de paginación, elegidos por el owner en /owner/site:
 *  - 'show_more': muestra los primeros N, botón "Ver más" expande todo,
 *    botón "Ver menos" colapsa de nuevo.
 *  - 'paginated': muestra exactamente N por página + navegador ← 1 2 3 →
 *    al final. Cambiar de filtro vuelve a página 1.
 */
export function CatalogFilter({
  title,
  showFilters,
  maxVisible,
  paginationMode,
  courses,
  categories,
  primary,
  initialCatSlug,
  ctaMode = 'course_link',
  ctaCustomHref = ''
}: {
  title: string;
  showFilters: boolean;
  maxVisible: number;
  paginationMode: PaginationMode;
  courses: Course[];
  categories: Category[];
  primary: string;
  initialCatSlug: string | null;
  ctaMode?: CtaMode;
  ctaCustomHref?: string;
}) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialCatSlug);
  const [expanded, setExpanded] = useState(false);   // solo modo 'show_more'
  const [page, setPage] = useState(1);               // solo modo 'paginated'
  const containerRef = useRef<HTMLDivElement>(null);
  const [fadeKey, setFadeKey] = useState(0);

  const selectedCat = useMemo(
    () => selectedSlug ? categories.find((c) => c.slug === selectedSlug) ?? null : null,
    [selectedSlug, categories]
  );

  const fullCatalog = useMemo(() => {
    if (!selectedCat) return courses;
    return courses.filter((c) => c.category_id === selectedCat.id);
  }, [selectedCat, courses]);

  const totalPages = Math.max(1, Math.ceil(fullCatalog.length / maxVisible));

  const catalog = useMemo(() => {
    if (paginationMode === 'paginated') {
      const start = (page - 1) * maxVisible;
      return fullCatalog.slice(start, start + maxVisible);
    }
    return expanded ? fullCatalog : fullCatalog.slice(0, maxVisible);
  }, [paginationMode, page, maxVisible, expanded, fullCatalog]);

  const hiddenCount = paginationMode === 'show_more'
    ? Math.max(0, fullCatalog.length - catalog.length)
    : 0;

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // Sync URL sin scroll
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedSlug) url.searchParams.set('cat', selectedSlug);
    else url.searchParams.delete('cat');
    if (paginationMode === 'paginated' && page > 1) url.searchParams.set('p', String(page));
    else url.searchParams.delete('p');
    window.history.replaceState(null, '', url.toString());
  }, [selectedSlug, page, paginationMode]);

  function selectCategory(slug: string | null) {
    setSelectedSlug(slug);
    setExpanded(false);
    setPage(1);
    setFadeKey((k) => k + 1);
  }

  function goToPage(p: number) {
    const clamped = Math.min(totalPages, Math.max(1, p));
    setPage(clamped);
    setFadeKey((k) => k + 1);
    // Scroll suave al inicio del catálogo (solo en paginated, donde el user
    // cambia "de página")
    const section = containerRef.current?.closest('section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
        <>
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
                ctaMode={ctaMode}
                ctaCustomHref={ctaCustomHref}
              />
            ))}
          </div>

          {/* ─── Modo show_more: Ver más / Ver menos ─── */}
          {paginationMode === 'show_more' && (
            <div className="text-center mt-8">
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => { setExpanded(true); setFadeKey((k) => k + 1); }}
                  className="rounded-full border border-black/15 px-6 py-2.5 text-sm font-medium hover:bg-black/[0.03] transition"
                >
                  Ver más ({hiddenCount} {hiddenCount === 1 ? 'curso' : 'cursos'} más)
                </button>
              ) : expanded && fullCatalog.length > maxVisible ? (
                <button
                  type="button"
                  onClick={() => { setExpanded(false); setFadeKey((k) => k + 1); }}
                  className="rounded-full border border-black/15 px-6 py-2.5 text-sm font-medium hover:bg-black/[0.03] transition"
                >
                  Ver menos
                </button>
              ) : null}
            </div>
          )}

          {/* ─── Modo paginated: ← 1 2 3 → ─── */}
          {paginationMode === 'paginated' && totalPages > 1 && (
            <nav className="flex flex-wrap items-center justify-center gap-1.5 mt-8" aria-label="Paginación">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="h-9 w-9 rounded-full border border-black/15 text-sm hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition"
                aria-label="Página anterior"
              >
                ←
              </button>
              {getPageNumbers(page, totalPages).map((p, idx) =>
                p === '…' ? (
                  <span key={`gap-${idx}`} className="px-2 text-black/40 text-sm">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    className={`h-9 min-w-[36px] px-3 rounded-full text-sm font-medium transition ${
                      p === page
                        ? 'bg-black text-white'
                        : 'border border-black/15 hover:bg-black/[0.03]'
                    }`}
                    aria-current={p === page ? 'page' : undefined}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
                className="h-9 w-9 rounded-full border border-black/15 text-sm hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition"
                aria-label="Página siguiente"
              >
                →
              </button>
            </nav>
          )}
        </>
      )}

      <style>{`
        @keyframes catalogFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .catalog-fade-in > * {
          animation: catalogFadeIn 280ms ease-out both;
        }
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

/**
 * Devuelve [1, 2, '…', 5, 6, 7, '…', 12] estilo Google.
 * - Siempre mostramos primera y última.
 * - Ventana de ±1 alrededor de la página actual.
 */
function getPageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | '…'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('…');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push('…');
  out.push(total);
  return out;
}

function CourseCard({
  c, primary, category, ctaMode, ctaCustomHref
}: {
  c: Course; primary: string; category?: Category | null;
  ctaMode: CtaMode; ctaCustomHref: string;
}) {
  const ribbonCls = c.ribbon_text ? (RIBBON_TONE_CLS[c.ribbon_tone ?? 'featured'] ?? RIBBON_TONE_CLS.featured) : '';

  // Resolver href según mode
  const href = ctaMode === 'no_button' ? null
    : ctaMode === 'custom_url' ? (ctaCustomHref || '#')
    : `/c/${c.slug}`;

  const inner = (
    <>
      <div className="h-40 relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
        {c.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.cover_url} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {c.ribbon_text ? (
          <span className={`absolute top-3 left-3 text-[10px] font-bold tracking-wider px-2 py-1 rounded uppercase ${ribbonCls}`}>
            {c.ribbon_text}
          </span>
        ) : c.is_featured && (
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
          {ctaMode !== 'no_button' && (
            <span className="text-xs font-medium px-2 py-1 rounded text-white" style={{ background: primary }}>
              {ctaMode === 'custom_url' ? 'Ver más →' : 'Ver curso →'}
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-xl border border-black/10 overflow-hidden hover:shadow-lg transition bg-white">
        {inner}
      </Link>
    );
  }
  return (
    <div className="block rounded-xl border border-black/10 overflow-hidden bg-white">
      {inner}
    </div>
  );
}
