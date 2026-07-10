'use client';

import { useRef, useState } from 'react';

/**
 * Galería de producto estilo Amazon/MercadoLibre.
 *
 * · Miniaturas VERTICALES a la izquierda (desktop lg+) o horizontales
 *   abajo (mobile/tablet).
 * · Al clickear una mini, cambia la imagen principal.
 * · Hover sobre imagen principal → zoom que sigue el cursor (2×).
 *   Amazon usa una "lente" con panel separado; ML zoomea in-place con
 *   transform-origin dinámico. Optamos por el segundo (más simple, sin
 *   layout shift, sin panel extra que ocupa espacio).
 * · Auto-desactiva el zoom en touch devices (no hay hover natural).
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
  // Combinamos cover + gallery, deduplicando (cover suele repetirse en gallery)
  const images: string[] = [];
  if (cover) images.push(cover);
  for (const g of gallery) if (g && g !== cover) images.push(g);
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const activeUrl = images[activeIdx] ?? cover;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = mainRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-3">
      {/* Miniaturas — arriba en mobile, columna izquierda en desktop */}
      {images.length > 1 && (
        <div className="order-2 lg:order-1 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:max-h-[560px] lg:overflow-y-auto lg:pr-1 shrink-0">
          {images.slice(0, 8).map((url, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setActiveIdx(i)}
              onFocus={() => setActiveIdx(i)}
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 w-14 h-14 lg:w-16 lg:h-16 rounded-md overflow-hidden border-2 transition ${
                i === activeIdx
                  ? 'border-blue-500'
                  : 'border-transparent hover:border-black/25'
              }`}
              aria-label={`Ver imagen ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Imagen principal — order-1 en mobile, order-2 en desktop */}
      <div
        ref={mainRef}
        className="order-1 lg:order-2 relative aspect-square rounded-2xl bg-zinc-100 overflow-hidden flex-1"
        onMouseEnter={(e) => handleMove(e)}
        onMouseMove={handleMove}
        onMouseLeave={() => setZoom(null)}
        style={{ cursor: activeUrl && zoom ? 'zoom-in' : 'default' }}
      >
        {activeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-200 ease-out"
            style={
              zoom
                ? {
                    transform: 'scale(2)',
                    transformOrigin: `${zoom.x}% ${zoom.y}%`
                  }
                : undefined
            }
            draggable={false}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-black/25 text-6xl">📦</div>
        )}
      </div>
    </div>
  );
}
