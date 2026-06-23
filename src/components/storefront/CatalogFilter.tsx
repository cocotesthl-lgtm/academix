'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { addToCart } from './cart/CartWidget';

export type ManualCard = {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  image_url?: string | null;
  price?: string;
  old_price?: string;
  stock_label?: string;
  ribbon_text?: string;
  ribbon_tone?: 'featured' | 'sale' | 'urgent' | 'new' | 'info';
  cta_text?: string;
  cta_href?: string;
};

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
  ctaCustomHref = '',
  manualCards = [],
  manualCardsPosition = 'before',
  showAutoCourses = true,
  cardStyle = 'classic',
  cartEnabled = false,
  tenantId = ''
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
  manualCards?: ManualCard[];
  manualCardsPosition?: 'before' | 'after';
  showAutoCourses?: boolean;
  cardStyle?: 'classic' | 'compact';
  cartEnabled?: boolean;
  tenantId?: string;
}) {
  const gridCls = cardStyle === 'compact'
    ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 catalog-fade-in'
    : 'grid md:grid-cols-2 lg:grid-cols-3 gap-6 catalog-fade-in';
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
    if (!showAutoCourses) return [];
    if (!selectedCat) return courses;
    return courses.filter((c) => c.category_id === selectedCat.id);
  }, [selectedCat, courses, showAutoCourses]);

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

      {catalog.length === 0 && manualCards.length === 0 ? (
        <div className="rounded-xl border border-black/10 p-12 text-center text-black/50">
          {selectedCat ? `No hay publicaciones en "${selectedCat.name}" todavía.` : 'Todavía no hay publicaciones publicados.'}
        </div>
      ) : (
        <>
          <div
            key={fadeKey}
            className={gridCls}
          >
            {manualCardsPosition === 'before' && manualCards.map((m) => (
              <ManualCardItem key={m.id} card={m} primary={primary} cardStyle={cardStyle} />
            ))}
            {catalog.map((c) => (
              <CourseCard
                key={c.id}
                c={c}
                primary={primary}
                category={c.category_id ? catById.get(c.category_id) : null}
                ctaMode={ctaMode}
                ctaCustomHref={ctaCustomHref}
                cardStyle={cardStyle}
                cartEnabled={cartEnabled}
                tenantId={tenantId}
              />
            ))}
            {manualCardsPosition === 'after' && manualCards.map((m) => (
              <ManualCardItem key={m.id} card={m} primary={primary} cardStyle={cardStyle} />
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
                  Ver más ({hiddenCount} {hiddenCount === 1 ? 'publicación' : 'publicaciones'} más)
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
  c, primary, category, ctaMode, ctaCustomHref, cardStyle = 'classic',
  cartEnabled = false, tenantId = ''
}: {
  c: Course; primary: string; category?: Category | null;
  ctaMode: CtaMode; ctaCustomHref: string; cardStyle?: 'classic' | 'compact';
  cartEnabled?: boolean; tenantId?: string;
}) {
  const [adding, setAdding] = useState(false);
  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addToCart(tenantId, {
      id: c.id, slug: c.slug, title: c.title,
      price_cents: c.price_cents, currency: c.currency,
      cover_url: c.cover_url
    });
    setAdding(true);
    setTimeout(() => setAdding(false), 1200);
  }
  const ribbonCls = c.ribbon_text ? (RIBBON_TONE_CLS[c.ribbon_tone ?? 'featured'] ?? RIBBON_TONE_CLS.featured) : '';

  // Resolver href según mode
  const href = ctaMode === 'no_button' ? null
    : ctaMode === 'custom_url' ? (ctaCustomHref || '#')
    : `/c/${c.slug}`;

  const compact = cardStyle === 'compact';
  const imgWrapCls = compact ? 'aspect-square relative' : 'h-40 relative';
  const padCls = compact ? 'p-3' : 'p-5';
  const titleCls = compact ? 'font-semibold text-sm mb-1 line-clamp-2' : 'font-semibold mb-1';

  const inner = (
    <>
      <div className={imgWrapCls} style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
        {c.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.cover_url} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {c.ribbon_text ? (
          <span className={`absolute ${compact ? 'top-2 left-2 text-[9px] px-1.5 py-0.5' : 'top-3 left-3 text-[10px] px-2 py-1'} font-bold tracking-wider rounded uppercase ${ribbonCls}`}>
            {c.ribbon_text}
          </span>
        ) : c.is_featured && (
          <span className={`absolute ${compact ? 'top-2 left-2 text-[9px] px-1.5 py-0.5' : 'top-3 left-3 text-xs px-2 py-1'} bg-white text-black font-semibold rounded`}>
            ⭐
          </span>
        )}
      </div>
      <div className={padCls}>
        {category && !compact && (
          <div className="text-xs font-medium mb-1.5" style={{ color: primary }}>
            {category.name}
          </div>
        )}
        <h3 className={titleCls}>{c.title}</h3>
        {c.description && !compact && <p className="text-sm text-black/60 line-clamp-2 mb-3">{c.description}</p>}
        <div className={compact ? 'flex flex-col gap-1.5' : 'flex items-center justify-between'}>
          <span className={compact ? 'font-bold text-sm' : 'font-bold'}>
            {c.price_cents === 0 ? 'Gratis' : `$ ${(c.price_cents / 100).toLocaleString('es-AR')} ${c.currency}`}
          </span>
          {ctaMode !== 'no_button' && (
            cartEnabled && c.price_cents > 0 && ctaMode === 'course_link' ? (
              <button
                type="button"
                onClick={handleAdd}
                className={`${compact ? 'text-[10px] px-2 py-1' : 'text-xs px-2 py-1'} font-medium rounded text-white transition`}
                style={{ background: adding ? '#10b981' : primary }}
              >
                {adding ? '✓ Agregado' : '🛒 Agregar'}
              </button>
            ) : (
              <span className={`${compact ? 'text-[10px] px-2 py-1 text-center' : 'text-xs px-2 py-1'} font-medium rounded text-white`} style={{ background: primary }}>
                {ctaMode === 'custom_url' ? 'Ver más →' : 'Ver publicación →'}
              </span>
            )
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

function ManualCardItem({ card, primary, cardStyle = 'classic' }: {
  card: ManualCard; primary: string; cardStyle?: 'classic' | 'compact';
}) {
  const ribbonCls = card.ribbon_text ? (RIBBON_TONE_CLS[card.ribbon_tone ?? 'featured'] ?? RIBBON_TONE_CLS.featured) : '';
  const hasButton = !!card.cta_text?.trim();
  const href = hasButton ? (card.cta_href?.trim() || '#') : null;

  const compact = cardStyle === 'compact';
  const imgWrapCls = compact ? 'aspect-square relative' : 'h-40 relative';
  const padCls = compact ? 'p-3' : 'p-5';
  const titleCls = compact ? 'font-semibold text-sm mb-1 line-clamp-2' : 'font-semibold mb-1';

  const inner = (
    <>
      <div className={imgWrapCls} style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
        {card.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image_url} alt={card.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {card.ribbon_text && (
          <span className={`absolute ${compact ? 'top-2 left-2 text-[9px] px-1.5 py-0.5' : 'top-3 left-3 text-[10px] px-2 py-1'} font-bold tracking-wider rounded uppercase ${ribbonCls}`}>
            {card.ribbon_text}
          </span>
        )}
        {card.stock_label && (
          <span className={`absolute ${compact ? 'top-2 right-2 text-[9px] px-1.5 py-0.5' : 'top-3 right-3 text-[10px] px-2 py-1'} bg-black/70 text-white font-semibold rounded uppercase tracking-wide`}>
            {card.stock_label}
          </span>
        )}
      </div>
      <div className={padCls}>
        {card.subtitle && !compact && (
          <div className="text-xs font-medium mb-1.5" style={{ color: primary }}>
            {card.subtitle}
          </div>
        )}
        <h3 className={titleCls}>{card.title}</h3>
        {card.body && !compact && <p className="text-sm text-black/60 line-clamp-2 mb-3">{card.body}</p>}
        <div className={compact ? 'flex flex-col gap-1.5' : 'flex items-center justify-between'}>
          {card.price ? (
            <div className={compact ? 'flex flex-col' : 'flex items-baseline gap-2'}>
              <span className={compact ? 'font-bold text-sm' : 'font-bold'}>{card.price}</span>
              {card.old_price && (
                <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-black/40 line-through`}>{card.old_price}</span>
              )}
            </div>
          ) : <span />}
          {hasButton && (
            <span className={`${compact ? 'text-[10px] px-2 py-1 text-center' : 'text-xs px-2 py-1'} font-medium rounded text-white`} style={{ background: primary }}>
              {card.cta_text} →
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (href) {
    const isExternal = /^https?:\/\//i.test(href);
    if (isExternal) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-black/10 overflow-hidden hover:shadow-lg transition bg-white">
          {inner}
        </a>
      );
    }
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
