'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

type Slide = {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  cta_label?: string;
  cta_href?: string;
  text_color?: string;
  overlay?: number;
};

/**
 * Hero rotativo tipo MercadoLibre: imagen full-width con overlay + texto + CTA.
 * Rota automáticamente cada N segundos. Bullets para navegar manual. Pausa
 * al hover. Reanuda al leave.
 */
export function HeroSlider({
  slides,
  intervalSec = 5,
  primary
}: {
  slides: Slide[];
  intervalSec?: number;
  primary: string;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const ms = Math.max(2, Math.min(20, intervalSec)) * 1000;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, ms);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, intervalSec, paused]);

  if (slides.length === 0) return null;

  return (
    <section
      className="relative overflow-hidden max-w-[1580px] mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/*
        Banner tipo MercadoLibre: aspect ratio 1580/500 = 3.16:1.
        Cargá imágenes de 1580×500 y quedan sin recorte.
        · Desktop (≥1580px): 500px de alto (cap por max-w-[1580px]).
        · Tablets 768-1580px: escala proporcional (~245-500px).
        · Mobile (<768px): aspect más cuadrado (4:3) para que no quede
          una banda mini ilegible. Podés usar imágenes 800×600 o solo
          confiar en el object-cover para el recorte.
      */}
      <div className="relative w-full aspect-[4/3] md:aspect-[1580/500]">
        {slides.map((s, i) => {
          const active = i === idx;
          const overlay = s.overlay ?? 0.35;
          const textColor = s.text_color ?? '#ffffff';
          return (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-700 ${active ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              aria-hidden={!active}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image_url}
                alt={s.title}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: `rgba(0, 0, 0, ${overlay})` }}
              />
              <div className="absolute inset-0 flex items-center">
                <div className="max-w-6xl w-full mx-auto px-6 md:px-10">
                  <div className="max-w-xl" style={{ color: textColor }}>
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
                      {s.title}
                    </h1>
                    {s.subtitle && (
                      <p className="mt-4 text-base md:text-lg opacity-90">
                        {s.subtitle}
                      </p>
                    )}
                    {s.cta_label && (
                      <Link
                        href={s.cta_href || '#'}
                        className="inline-block mt-6 rounded-md bg-white text-black px-6 py-3 font-semibold shadow-lg hover:bg-neutral-100 transition"
                        style={{ color: primary }}
                      >
                        {s.cta_label} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controles de navegación (bullets) */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${
                i === idx ? 'bg-white w-8' : 'bg-white/50 w-2 hover:bg-white/80'
              }`}
              aria-label={`Ir al slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Flechas prev/next */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIdx((i) => (i - 1 + slides.length) % slides.length)}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 items-center justify-center shadow-lg hover:bg-white transition z-10"
            aria-label="Anterior"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % slides.length)}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 items-center justify-center shadow-lg hover:bg-white transition z-10"
            aria-label="Siguiente"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}
    </section>
  );
}
