'use client';

import { useEffect, useRef, useState } from 'react';

type GalleryItem = {
  url: string;
  kind: 'image' | 'video';
  embedUrl?: string;  // solo videos: URL para iframe (YouTube/Vimeo) o el mismo url para <video>
};

/**
 * Detecta si una URL es un video y devuelve una URL para embebido.
 * Soporta YouTube (varias formas), Vimeo, y links directos a mp4/webm/mov.
 */
function detectGalleryItem(url: string): GalleryItem {
  const u = url.trim();
  if (!u) return { url, kind: 'image' };
  // YouTube
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { url, kind: 'video', embedUrl: `https://www.youtube.com/embed/${yt[1]}` };
  // Vimeo
  const vm = u.match(/vimeo\.com\/(\d+)/);
  if (vm) return { url, kind: 'video', embedUrl: `https://player.vimeo.com/video/${vm[1]}` };
  // Direct video file
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)) return { url, kind: 'video', embedUrl: u };
  return { url, kind: 'image' };
}

/**
 * Galería de producto estilo Amazon/MercadoLibre.
 *
 * Layout:
 *  · Desktop lg+: mini-columna vertical a la izquierda + imagen principal.
 *  · Mobile/tablet: imagen principal arriba + fila horizontal de minis abajo.
 *
 * Interacciones:
 *  · Hover en imagen principal → aparece LENTE (rectángulo translúcido) sobre
 *    la imagen original + PANEL DE ZOOM 2× flotante a la derecha con la
 *    porción bajo la lente. Igual que ML y Amazon.
 *  · Click en imagen principal → abre MODAL fullscreen con navegación entre
 *    imágenes (arrows + swipe con teclado).
 *  · Videos (URLs de YouTube/Vimeo/mp4 en la gallery) se detectan solos y
 *    muestran ▶ overlay en las minis. En vista principal renderean iframe
 *    o <video> según corresponda.
 *  · Auto-desactiva el zoom en items de tipo video (no aplica).
 */
export function ProductGallery({
  cover,
  gallery,
  title
}: {
  cover: string | null;
  gallery: string[];
  title: string;
}) {
  const items: GalleryItem[] = [];
  if (cover) items.push(detectGalleryItem(cover));
  for (const g of gallery) {
    if (g && g !== cover) items.push(detectGalleryItem(g));
  }
  const [activeIdx, setActiveIdx] = useState(0);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const active = items[activeIdx];

  // Config del zoom: cuánto amplia y qué tamaño ocupa la lente.
  const ZOOM = 2;                        // × factor de aumento
  const LENS_PCT = 100 / ZOOM;           // ancho/alto de la lente sobre la imagen (%). 2× → 50%

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (active?.kind !== 'image') return;
    const el = mainRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setLens({
      x: Math.max(LENS_PCT / 2, Math.min(100 - LENS_PCT / 2, x)),
      y: Math.max(LENS_PCT / 2, Math.min(100 - LENS_PCT / 2, y))
    });
  }

  // Teclado en el modal: ← → para navegar, Esc para cerrar.
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
      if (e.key === 'ArrowLeft') setActiveIdx((i) => (i - 1 + items.length) % items.length);
      if (e.key === 'ArrowRight') setActiveIdx((i) => (i + 1) % items.length);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen, items.length]);

  const hasZoom = active?.kind === 'image' && lens !== null;

  return (
    <>
      <div className="relative flex flex-col lg:flex-row gap-3">
        {/* Miniaturas — fila abajo en mobile, columna izquierda en desktop */}
        {items.length > 1 && (
          <div className="order-2 lg:order-1 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:max-h-[560px] lg:overflow-y-auto lg:pr-1 shrink-0">
            {items.slice(0, 10).map((it, i) => (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onFocus={() => setActiveIdx(i)}
                onClick={() => setActiveIdx(i)}
                className={`shrink-0 w-14 h-14 lg:w-16 lg:h-16 rounded-md overflow-hidden border-2 transition relative ${
                  i === activeIdx
                    ? 'border-blue-500'
                    : 'border-transparent hover:border-black/25'
                }`}
                aria-label={`Ver ${it.kind === 'video' ? 'video' : 'imagen'} ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.kind === 'image' ? it.url : `https://img.youtube.com/vi/${it.embedUrl?.match(/embed\/([\w-]+)/)?.[1] ?? ''}/mqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback si el thumb del video no carga
                    (e.currentTarget as HTMLImageElement).style.background = '#111';
                    (e.currentTarget as HTMLImageElement).style.opacity = '0';
                  }}
                />
                {it.kind === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-6 h-6 rounded-full bg-white/95 flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6 4 20 12 6 20" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Imagen principal */}
        <div
          ref={mainRef}
          className="order-1 lg:order-2 relative aspect-square rounded-2xl bg-zinc-100 overflow-hidden flex-1"
          onMouseEnter={handleMove}
          onMouseMove={handleMove}
          onMouseLeave={() => setLens(null)}
          onClick={() => setModalOpen(true)}
          style={{ cursor: active?.kind === 'image' ? 'zoom-in' : 'default' }}
        >
          {!active ? (
            <div className="flex items-center justify-center h-full text-black/25 text-6xl">📦</div>
          ) : active.kind === 'video' ? (
            <div className="absolute inset-0">
              {active.embedUrl && /youtube|vimeo/.test(active.embedUrl) ? (
                <iframe
                  src={active.embedUrl}
                  title={`Video de ${title}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={active.embedUrl} controls className="w-full h-full object-contain bg-black" />
              )}
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.url}
                alt={title}
                className="w-full h-full object-cover"
                draggable={false}
              />
              {/* LENTE — rectángulo translúcido bajo el cursor. Solo visible en hover. */}
              {hasZoom && lens && (
                <div
                  className="absolute pointer-events-none border-2 border-white/80 bg-white/10 shadow-lg"
                  style={{
                    width: `${LENS_PCT}%`,
                    height: `${LENS_PCT}%`,
                    left: `${lens.x - LENS_PCT / 2}%`,
                    top: `${lens.y - LENS_PCT / 2}%`
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* PANEL DE ZOOM — solo desktop lg+, aparece a la derecha en hover.
            Se posiciona absolute sobre el buy box para no empujar layout. */}
        {hasZoom && lens && active?.kind === 'image' && (
          <div
            className="hidden lg:block absolute top-0 left-full ml-4 w-[440px] h-[440px] rounded-2xl overflow-hidden border border-black/10 bg-white shadow-2xl z-30 pointer-events-none"
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt=""
              className="absolute"
              style={{
                width: `${ZOOM * 100}%`,
                height: `${ZOOM * 100}%`,
                left: `${-(lens.x - LENS_PCT / 2) * ZOOM}%`,
                top: `${-(lens.y - LENS_PCT / 2) * ZOOM}%`,
                maxWidth: 'none'
              }}
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* ─── Modal fullscreen ─── */}
      {modalOpen && active && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setModalOpen(false); }}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-4xl leading-none"
            aria-label="Cerrar"
          >×</button>

          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => (i - 1 + items.length) % items.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                aria-label="Anterior"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => (i + 1) % items.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                aria-label="Siguiente"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          )}

          <div
            className="max-w-5xl w-full max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {active.kind === 'video' && active.embedUrl ? (
              /youtube|vimeo/.test(active.embedUrl) ? (
                <iframe
                  src={active.embedUrl}
                  title={`Video de ${title}`}
                  className="w-full aspect-video max-h-[85vh]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={active.embedUrl} controls autoPlay className="max-w-full max-h-[85vh] bg-black" />
              )
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.url}
                alt={title}
                className="max-w-full max-h-[85vh] object-contain"
              />
            )}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">
            {activeIdx + 1} / {items.length}
          </div>
        </div>
      )}
    </>
  );
}
