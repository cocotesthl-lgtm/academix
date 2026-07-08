'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Product = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: string;
  cover_url: string | null;
  stock_qty: number;
  track_stock: boolean;
};

/**
 * Carrusel horizontal scrolleable de productos, estilo MercadoLibre
 * "Inspirado en lo último que viste". Sin scrollbar visible — se navega
 * con las flechas y con los puntitos arriba a la derecha que indican
 * la página actual.
 *
 * Paginación: divide el track en "páginas" según cuántas cards entran en
 * el viewport. Al llegar al final se marca la última página como activa.
 * Los dots reaccionan al scroll manual también (para trackpads).
 */
export function ProductsStrip({
  products,
  title,
  subtitle,
  ctaLabel,
  ctaHref
}: {
  products: Product[];
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [activePage, setActivePage] = useState(0);
  const [cardsPerPage, setCardsPerPage] = useState(1);

  // Recalcular páginas y página activa. Se corre al montar, al resize y al scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function measure() {
      const track = scrollRef.current;
      if (!track) return;
      const card = track.querySelector<HTMLElement>('[data-product-card]');
      const cardWidth = card?.offsetWidth ?? 220;
      const gap = 12; // corresponds to gap-3 (0.75rem = 12px)
      const step = cardWidth + gap;
      const visible = Math.max(1, Math.floor(track.clientWidth / step));
      setCardsPerPage(visible);
      const totalPages = Math.max(1, Math.ceil(products.length / visible));
      setPages(totalPages);
      // Cual página está a la vista según scrollLeft
      const pageIdx = Math.round(track.scrollLeft / (visible * step));
      setActivePage(Math.min(totalPages - 1, Math.max(0, pageIdx)));
    }

    measure();
    const onScroll = () => measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, [products.length]);

  function scrollToPage(pageIdx: number) {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-product-card]');
    const cardWidth = card?.offsetWidth ?? 220;
    const gap = 12;
    const step = cardWidth + gap;
    el.scrollTo({ left: pageIdx * cardsPerPage * step, behavior: 'smooth' });
  }

  function scrollByArrow(dir: 'left' | 'right') {
    const targetPage = activePage + (dir === 'right' ? 1 : -1);
    scrollToPage(Math.min(pages - 1, Math.max(0, targetPage)));
  }

  if (products.length === 0) return null;

  const showPagination = pages > 1;

  return (
    <section className="px-4 md:px-6 py-10 md:py-14">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-2xl border border-black/10 bg-white p-4 md:p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-black">{title}</h2>
              {subtitle && (
                <p className="text-sm text-black/55 mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {/* Puntitos de paginación (top-right, ML-style) — solo si hay >1 página */}
              {showPagination && (
                <div className="hidden md:flex items-center gap-1.5" aria-hidden="true">
                  {Array.from({ length: pages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => scrollToPage(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === activePage ? 'w-2 bg-blue-600' : 'w-2 bg-black/25 hover:bg-black/40'
                      }`}
                      aria-label={`Página ${i + 1}`}
                    />
                  ))}
                </div>
              )}
              {ctaLabel && ctaHref && (
                <Link
                  href={ctaHref}
                  className="hidden md:inline-block text-sm text-blue-600 font-semibold hover:underline mt-0.5"
                >
                  {ctaLabel} →
                </Link>
              )}
            </div>
          </div>

          <div className="relative">
            {/* Flechas prev/next (solo desktop, solo si hay >1 página) */}
            {showPagination && (
              <>
                <button
                  type="button"
                  onClick={() => scrollByArrow('left')}
                  disabled={activePage === 0}
                  className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white items-center justify-center shadow-lg hover:shadow-xl transition border border-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Anterior"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => scrollByArrow('right')}
                  disabled={activePage >= pages - 1}
                  className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white items-center justify-center shadow-lg hover:shadow-xl transition border border-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Siguiente"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
            )}

            {/* Track scrolleable — scrollbar OCULTA (webkit + firefox + IE) */}
            <div
              ref={scrollRef}
              className="products-strip-track flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory -mx-1 px-1"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              } as React.CSSProperties}
            >
              {products.map((p) => {
                const price = new Intl.NumberFormat('es-AR', {
                  style: 'currency', currency: p.currency || 'ARS', maximumFractionDigits: 0
                }).format(p.price_cents / 100);
                const compareAt = p.compare_at_price_cents
                  ? new Intl.NumberFormat('es-AR', {
                      style: 'currency', currency: p.currency || 'ARS', maximumFractionDigits: 0
                    }).format(p.compare_at_price_cents / 100)
                  : null;
                const off = p.compare_at_price_cents && p.compare_at_price_cents > p.price_cents
                  ? Math.round((1 - p.price_cents / p.compare_at_price_cents) * 100)
                  : null;

                return (
                  <Link
                    key={p.id}
                    href={`/p/${p.slug}`}
                    data-product-card
                    className="snap-start shrink-0 w-[42vw] sm:w-[240px] md:w-[220px] group relative"
                  >
                    <div className="aspect-square rounded-lg bg-zinc-100 overflow-hidden relative">
                      {p.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.cover_url}
                          alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-black/25 text-4xl">📦</div>
                      )}
                    </div>
                    <div className="pt-2.5 pr-1">
                      <div className="text-sm text-blue-600 group-hover:underline line-clamp-2 min-h-[2.5rem] leading-tight">
                        {p.title}
                      </div>
                      <div className="flex items-baseline gap-2 mt-1.5">
                        {compareAt && (
                          <span className="text-xs text-black/40 line-through">{compareAt}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-lg md:text-xl font-bold text-black tabular-nums">{price}</span>
                        {off !== null && (
                          <span className="text-xs text-emerald-600 font-semibold">{off}% OFF</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Puntitos + CTA versión mobile */}
          {(showPagination || (ctaLabel && ctaHref)) && (
            <div className="md:hidden flex items-center justify-between mt-4">
              {showPagination ? (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: pages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => scrollToPage(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === activePage ? 'w-2 bg-blue-600' : 'w-2 bg-black/25'
                      }`}
                      aria-label={`Página ${i + 1}`}
                    />
                  ))}
                </div>
              ) : <div />}
              {ctaLabel && ctaHref && (
                <Link href={ctaHref} className="text-sm text-blue-600 font-semibold hover:underline">
                  {ctaLabel} →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Estilos globales para ocultar scrollbar del track en WebKit (Chrome/Safari) */}
      <style>{`
        .products-strip-track::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}
