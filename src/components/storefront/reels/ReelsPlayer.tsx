'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type ReelVideo = {
  slug: string;
  title: string;
  description: string | null;
  youtube_id: string;
};

/**
 * Player de shorts estilo Reels/TikTok, MINIMALISTA.
 *
 * Decisiones de diseño:
 *   - Autoplay MUTED cuando el video entra en viewport (browsers lo
 *     permiten). El usuario ve el video reproduciéndose sin sonido.
 *     Un click en el botón de volumen lo activa (user gesture → OK).
 *   - Controls nativos de YouTube OCULTOS via controls=0. Nosotros
 *     dibujamos nuestros propios: play/pause center, mute/unmute,
 *     share, todo minimalista.
 *   - Control del iframe via postMessage (YouTube iframe API). No
 *     necesitamos cargar el SDK completo, solo mandamos comandos.
 *   - No tenant name en header, solo back arrow.
 *
 * Trade-off honesto: YouTube fuerza el logo "Watch on YouTube" y
 * el título flotante en shorts embebidos. No hay forma limpia de
 * ocultarlos desde el iframe. Los tapamos parcialmente con nuestro
 * overlay pero pueden asomarse en zonas.
 */
export function ReelsPlayer({
  videos,
  initialSlug
}: {
  videos: ReelVideo[];
  initialSlug: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSlug, setActiveSlug] = useState<string>(() =>
    initialSlug && videos.some((v) => v.slug === initialSlug)
      ? initialSlug
      : videos[0]?.slug ?? ''
  );
  // Mute preference PERSISTENTE en toda la sesión. Cuando el usuario
  // desmutea uno, los siguientes vienen desmuteados también. Se restaura
  // desde localStorage para persistir entre navegaciones dentro del sitio.
  const [globalMuted, setGlobalMuted] = useState(true);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('reels-muted');
      if (saved === 'false') setGlobalMuted(false);
    } catch { /* localStorage bloqueado */ }
  }, []);
  const setMutedPersist = useCallback((v: boolean) => {
    setGlobalMuted(v);
    try { window.localStorage.setItem('reels-muted', String(v)); } catch { /* ignore */ }
  }, []);

  // Scroll al video inicial al mount
  useEffect(() => {
    if (!containerRef.current || !initialSlug) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-slug="${initialSlug}"]`);
    el?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [initialSlug]);

  // IntersectionObserver — track cuál está visible
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

  return (
    <div className="w-full h-svh flex items-center justify-center bg-black text-white overflow-hidden">
      {/* Header solo con back button (sin tenant name) */}
      <header className="absolute top-0 left-0 right-0 z-30 p-3 pointer-events-none">
        <Link href="/" className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center hover:bg-black/70 pointer-events-auto">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
      </header>

      {/* Navigation buttons a la derecha — solo desktop */}
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
            globalMuted={globalMuted}
            setGlobalMuted={setMutedPersist}
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
  video, isActive, globalMuted, setGlobalMuted
}: {
  video: ReelVideo;
  isActive: boolean;
  globalMuted: boolean;
  setGlobalMuted: (v: boolean) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [paused, setPaused] = useState(false);
  const [shareOk, setShareOk] = useState(false);

  const shouldRenderIframe = isActive;

  // URL del embed. La mute inicial depende de globalMuted (persiste sesión).
  const embedSrc = useMemo(() => {
    if (!shouldRenderIframe) return '';
    const mute = globalMuted ? '1' : '0';
    // autoplay=1 con mute=0 sólo funciona si browser YA tiene consent
    // (user interactuó). Como globalMuted arranca true por default,
    // el primer video siempre autoplaya muted → siempre funciona.
    return `https://www.youtube.com/embed/${video.youtube_id}?autoplay=1&mute=${mute}&playsinline=1&loop=1&playlist=${video.youtube_id}&controls=0&modestbranding=1&rel=0&enablejsapi=1&iv_load_policy=3&fs=0&disablekb=1`;
  }, [shouldRenderIframe, video.youtube_id, globalMuted]);

  // Reset paused cuando cambia de video (empieza reproduciendo)
  useEffect(() => {
    if (isActive) setPaused(false);
  }, [isActive, video.slug]);

  // Helper para mandar comandos al iframe via postMessage
  const sendCommand = useCallback((func: string, args: unknown[] = []) => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
  }, []);

  function toggleMute() {
    if (globalMuted) {
      sendCommand('unMute');
      sendCommand('setVolume', [100]);
      setGlobalMuted(false);
    } else {
      sendCommand('mute');
      setGlobalMuted(true);
    }
  }

  function togglePlay() {
    if (paused) {
      sendCommand('playVideo');
      setPaused(false);
    } else {
      sendCommand('pauseVideo');
      setPaused(true);
    }
  }

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.origin + window.location.pathname + '?v=' + video.slug : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: video.title, url });
        return;
      } catch { /* user cancelled */ }
    }
    // Fallback clipboard
    try {
      await navigator.clipboard.writeText(url);
      setShareOk(true);
      setTimeout(() => setShareOk(false), 2000);
    } catch { /* ignore */ }
  }

  return (
    <section
      data-slug={video.slug}
      className="h-svh w-full flex items-center justify-center snap-start relative bg-black"
    >
      {/* Video 9:16 estricto */}
      <div className="relative bg-black" style={{ aspectRatio: '9 / 16', height: 'min(90svh, 720px)', maxWidth: '100vw' }}>
        {embedSrc ? (
          <>
            <iframe
              ref={iframeRef}
              src={embedSrc}
              title={video.title}
              className="absolute inset-0 w-full h-full pointer-events-none"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen={false}
              frameBorder="0"
            />
            {/* Overlays opacos que tapan el chrome de YouTube shorts:
                - Top: canal + título flotante (~72px)
                - Bottom: "Watch on YouTube" + logo (~50px)
                Sin estos overlays se ve el profile "Dev_gabo" y el título
                superpuesto que el owner reportó. */}
            <div className="absolute top-0 left-0 right-0 h-[72px] bg-black pointer-events-none z-[5]" />
            <div className="absolute bottom-0 left-0 right-0 h-[50px] bg-black pointer-events-none z-[5]" />
            {/* Overlay tap-area: click centro = play/pause. pointer-events-auto
                encima del iframe para intercepar clicks (iframe está en
                pointer-events-none para no interferir). */}
            <button
              type="button"
              onClick={togglePlay}
              className="absolute inset-0 z-10"
              aria-label={paused ? 'Reproducir' : 'Pausar'}
            />
            {/* Play button visible solo cuando está pausado */}
            {paused && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur border-2 border-white/80 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}
          </>
        ) : (
          // Poster estático cuando no está activo (video off-screen)
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`}
              alt={video.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;
              }}
            />
          </>
        )}

        {/* Controles custom bottom-right (mute + share) — solo si iframe está mounted */}
        {shouldRenderIframe && (
          <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-3">
            {/* Mute/unmute */}
            <button
              type="button"
              onClick={toggleMute}
              className="w-11 h-11 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 flex items-center justify-center transition"
              aria-label={globalMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {globalMuted ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/>
                  <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
              )}
            </button>
            {/* Share */}
            <button
              type="button"
              onClick={share}
              className="w-11 h-11 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 flex items-center justify-center transition relative"
              aria-label="Compartir"
            >
              {shareOk ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Info sobre el video */}
      <div className="absolute bottom-0 left-0 right-24 z-20 pt-16 pb-6 px-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none">
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
