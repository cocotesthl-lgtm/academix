'use client';

import { useRef } from 'react';
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
 * "Inspirado en lo último que viste". Flechas a los costados para
 * scroll con animación smooth. Sin autoplay — el usuario decide.
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

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector<HTMLElement>('[data-product-card]')?.offsetWidth ?? 220;
    const step = (cardWidth + 12) * 3; // 3 cards por click
    el.scrollBy({ left: dir === 'right' ? step : -step, behavior: 'smooth' });
  }

  if (products.length === 0) return null;

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
            {ctaLabel && ctaHref && (
              <Link
                href={ctaHref}
                className="hidden md:inline-block text-sm text-blue-600 font-semibold hover:underline shrink-0 mt-1"
              >
                {ctaLabel} →
              </Link>
            )}
          </div>

          <div className="relative">
            {/* Flechas prev/next (solo desktop) */}
            <button
              type="button"
              onClick={() => scroll('left')}
              className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white items-center justify-center shadow-lg hover:shadow-xl transition border border-black/5"
              aria-label="Anterior"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white items-center justify-center shadow-lg hover:shadow-xl transition border border-black/5"
              aria-label="Siguiente"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Track scrolleable */}
            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1"
              style={{ scrollbarWidth: 'thin' }}
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

          {ctaLabel && ctaHref && (
            <div className="md:hidden text-center mt-4">
              <Link href={ctaHref} className="text-sm text-blue-600 font-semibold hover:underline">
                {ctaLabel} →
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
