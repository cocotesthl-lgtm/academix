'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export type ReelVideo = {
  slug: string;
  title: string;
  description: string | null;
  youtube_id: string;
};

/**
 * Player de shorts estilo NYT / TikTok / Reels.
 *
 * UX decisiones clave:
 *   - Videos EMPIEZAN PAUSADOS con play button center visible.
 *     Cuando el usuario clickea play, es un user gesture → autoplay
 *     con AUDIO funciona (browsers permiten unmuted playback tras
 *     interacción). Evita el problema de "todo muteado por default"
 *     que reportó el owner.
 *   - Controles UNOBTRUSIVOS a la derecha: up/down arrow en círculos
 *     semitransparentes tipo NYT. Nada de overlay grande en el
 *     centro del video como el diseño anterior.
 *   - Aspect ratio 9:16 fijo y estricto — el iframe respeta el
 *     tamaño del container y YouTube shorts nativos también son 9:16
 *     así que no hay letterbox ni deformación.
 *   - Solo el video activo tiene iframe cargado. Los demás son
 *     posters estáticos.
 *
 * El "audio muteado por default" del código anterior venía de forzar
 * autoplay. Al no autoplay, ese problema desaparece — el usuario
 * inicia el video con click y ya viene con sonido.
 */
export function ReelsPlayer({
  videos,
  initialSlug,
  tenantName
}: {
  videos: ReelVideo[];
  initialSlug: string | null;
  tenantName: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSlug, setActiveSlug] = useState<string>(() =>
    initialSlug && videos.some((v) => v.slug === initialSlug)
      ? initialSlug
      : videos[0]?.slug ?? ''
  );
  // "Playing" = el usuario apretó play en el video activo. Cambia el
  // src del iframe para hacer autoplay real (con sonido, porque es
  // resultado de un user gesture).
  const [playing, setPlaying] = useState<Set<string>>(new Set());

  // Scroll al video inicial al mount
  useEffect(() => {
    if (!containerRef.current || !initialSlug) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-slug="${initialSlug}"]`);
    el?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [initialSlug]);

  // Track cuál está visible (para up/down navigation)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const slug = (e.target as HTMLElement).dataset.slug;
            if (slug) setActiveSlug(slug);
          }
        }
      },
      { root: containerRef.current, threshold: [0.6] }
    );
    const items = containerRef.current.querySelectorAll<HTMLElement>('[data-slug]');
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [videos]);

  const activeIdx = videos.findIndex((v) => v.slug === activeSlug);

  function scrollToIdx(idx: number) {
    if (!containerRef.current) return;
    if (idx < 0 || idx >= videos.length) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-slug="${videos[idx].slug}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function play(slug: string) {
    setPlaying((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });
  }

  return (
    <div className="w-full h-svh flex items-center justify-center bg-black text-white overflow-hidden">
      {/* Header con back + tenant name (top overlay gradient) */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <Link href="/" className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 pointer-events-auto">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div className="text-sm font-semibold">{tenantName}</div>
        <div className="w-10" />
      </header>

      {/* Navigation controls RIGHT SIDE (estilo NYT) — sólo desktop */}
      <div className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-3">
        <button
          type="button"
          onClick={() => scrollToIdx(activeIdx - 1)}
          disabled={activeIdx <= 0}
          className="w-12 h-12 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
          aria-label="Video anterior"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 15-6-6-6 6"/>
          </svg>
        </button>
        <button
          type="button"
          onClick={() => scrollToIdx(activeIdx + 1)}
          disabled={activeIdx >= videos.length - 1}
          className="w-12 h-12 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
          aria-label="Video siguiente"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
      </div>

      {/* Container scroll-snap vertical */}
      <div
        ref={containerRef}
        className="h-svh w-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {videos.map((v) => (
          <ReelSection
            key={v.slug}
            video={v}
            isActive={activeSlug === v.slug}
            isPlaying={playing.has(v.slug)}
            onPlay={() => play(v.slug)}
          />
        ))}
      </div>

      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        html, body { overscroll-behavior-y: contain; }
      `}</style>
    </div>
  );
}

function ReelSection({
  video, isActive, isPlaying, onPlay
}: {
  video: ReelVideo;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  // Solo cargamos el iframe cuando el usuario dio play y el video está
  // activo. Antes de eso mostramos solo el poster + play button.
  // Autoplay CON SONIDO (mute=0) es válido porque isPlaying=true
  // significa que hubo click del usuario (user gesture).
  const embedSrc = isActive && isPlaying
    ? `https://www.youtube.com/embed/${video.youtube_id}?autoplay=1&mute=0&playsinline=1&loop=1&playlist=${video.youtube_id}&controls=1&modestbranding=1&rel=0`
    : '';

  return (
    <section
      data-slug={video.slug}
      className="h-svh w-full flex items-center justify-center snap-start relative bg-black"
    >
      {/* Contenedor del video con aspect 9:16 estricto.
          max-height evita que en pantallas muy altas el video se
          estire más allá del viewport. */}
      <div className="relative bg-black" style={{ aspectRatio: '9 / 16', height: 'min(90svh, 720px)', maxWidth: '100vw' }}>
        {embedSrc ? (
          <iframe
            src={embedSrc}
            title={video.title}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            frameBorder="0"
          />
        ) : (
          <>
            {/* Poster estático mientras no está en play */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`}
              alt={video.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;
              }}
            />
            {/* Play button center — click reproduce con audio */}
            <button
              type="button"
              onClick={onPlay}
              className="absolute inset-0 flex items-center justify-center group"
              aria-label="Reproducir video"
            >
              <div className="w-20 h-20 rounded-full bg-white/25 backdrop-blur-sm border-2 border-white/60 flex items-center justify-center group-hover:bg-white/40 group-hover:scale-110 transition">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Info sobre el video (overlay inferior con gradient) */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pt-16 pb-6 px-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none">
        <div className="max-w-[420px] mx-auto text-white">
          <h2 className="font-serif text-lg font-bold leading-tight drop-shadow-lg">
            {video.title}
          </h2>
          {video.description && (
            <p className="text-xs opacity-90 mt-1 drop-shadow line-clamp-2">
              {video.description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
