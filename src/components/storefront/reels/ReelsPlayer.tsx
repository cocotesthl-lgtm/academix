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
 * Player TikTok-style de shorts.
 *
 * Cómo funciona:
 *   - Container scroll-snap-y mandatory a full height (h-svh)
 *   - Cada video ocupa una sección de h-svh con snap-start
 *   - IntersectionObserver detecta cuál está visible (>60%)
 *   - El visible carga su iframe con autoplay=1&mute=1 (chrome requiere
 *     muted para autoplay)
 *   - Los demás quedan como placeholder con play icon para ahorrar recursos
 *
 * Nota: YouTube fuerza el logo "Watch on YouTube" en shorts embebidos.
 * No hay forma limpia de ocultarlo desde el iframe. Es un trade-off del
 * uso de shorts como source vs. hostear videos propios.
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

  // Scroll al video inicial al mount (si viene ?v=)
  useEffect(() => {
    if (!containerRef.current || !initialSlug) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-slug="${initialSlug}"]`);
    el?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [initialSlug]);

  // IntersectionObserver — marca activo al que está más del 60% visible
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

  return (
    <div className="w-full h-svh flex items-center justify-center bg-black text-white">
      {/* Header con back button + tenant name */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <Link href="/" className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div className="text-sm font-semibold">{tenantName}</div>
        <div className="w-10" />
      </header>

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
            active={activeSlug === v.slug}
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

function ReelSection({ video, active }: { video: ReelVideo; active: boolean }) {
  // Params de embed: autoplay=1 requiere mute=1 en browsers modernos.
  // playsinline evita fullscreen en iOS. loop=1 requiere playlist=<id>.
  // controls=1 se muestran los controles pero pequeños. modestbranding=1
  // reduce el logo YT (aunque no lo saca del todo en shorts).
  const embedSrc = active
    ? `https://www.youtube.com/embed/${video.youtube_id}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${video.youtube_id}&controls=1&modestbranding=1&rel=0`
    : '';

  return (
    <section
      data-slug={video.slug}
      className="h-svh w-full flex items-center justify-center snap-start relative"
    >
      {/* Iframe — solo se carga cuando active para evitar cargar N videos */}
      <div className="relative w-full max-w-[420px] aspect-[9/16] bg-black">
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
            {/* Poster (visible mientras no está activo) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`}
              alt={video.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                // maxresdefault a veces no existe — fallback a hqdefault
                (e.currentTarget as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="black">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Info sobre el video (overlay inferior) */}
      <div className="absolute bottom-4 left-4 right-4 max-w-[420px] mx-auto text-white pointer-events-none">
        <h2 className="font-serif text-lg font-bold leading-tight drop-shadow-lg">
          {video.title}
        </h2>
        {video.description && (
          <p className="text-xs opacity-90 mt-1 drop-shadow line-clamp-2">
            {video.description}
          </p>
        )}
      </div>

      {/* Hint de scroll (solo en el primero) */}
      <div className="absolute bottom-2 right-2 text-white/50 text-[10px] pointer-events-none animate-pulse">
        ↑ desliza
      </div>
    </section>
  );
}
