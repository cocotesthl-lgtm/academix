'use client';

import { useRef, useState, useEffect } from 'react';

/**
 * Control preciso de encuadre. Muestra un thumbnail real de la imagen con
 * un punto azul que el owner arrastra (o clickea) para fijar el "focal point".
 * La posición se persiste como string CSS object-position "X% Y%".
 *
 * Soporta backwards-compat: si position viene como 'top'|'center'|'bottom'
 * (string viejo), se parsea como "50% 0%" / "50% 50%" / "50% 100%".
 */
export function ImageFitControls({
  fit, position, imageUrl, onChangeFit, onChangePosition, compact = false
}: {
  fit: 'cover' | 'contain' | undefined;
  position: string | undefined;
  imageUrl: string | null | undefined;
  onChangeFit: (v: 'cover' | 'contain') => void;
  onChangePosition: (v: string) => void;
  compact?: boolean;
}) {
  const f = fit ?? 'cover';
  const { x, y } = parsePosition(position);
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  function pickFromEvent(clientX: number, clientY: number) {
    const box = boxRef.current; if (!box) return;
    const r = box.getBoundingClientRect();
    const nx = Math.min(100, Math.max(0, Math.round(((clientX - r.left) / r.width) * 100)));
    const ny = Math.min(100, Math.max(0, Math.round(((clientY - r.top) / r.height) * 100)));
    onChangePosition(`${nx}% ${ny}%`);
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) { pickFromEvent(e.clientX, e.clientY); }
    function onUp() { setDragging(false); }
    function onTouchMove(e: TouchEvent) {
      if (e.touches[0]) pickFromEvent(e.touches[0].clientX, e.touches[0].clientY);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  return (
    <div className={`rounded-md border border-white/10 bg-white/[0.02] ${compact ? 'p-2' : 'p-3'} space-y-2.5`}>
      <div className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
        Encuadre de la imagen
      </div>

      <div>
        <div className="text-[11px] text-white/55 mb-1">Ajuste</div>
        <div className="inline-flex rounded border border-white/15 overflow-hidden w-full text-xs">
          <button type="button" onClick={() => onChangeFit('cover')}
            className={`flex-1 px-2 py-1 ${f === 'cover' ? 'bg-white text-black font-semibold' : 'text-white/65 hover:bg-white/5'}`}>
            Recortar
          </button>
          <button type="button" onClick={() => onChangeFit('contain')}
            className={`flex-1 px-2 py-1 border-l border-white/15 ${f === 'contain' ? 'bg-white text-black font-semibold' : 'text-white/65 hover:bg-white/5'}`}>
            Ver todo
          </button>
        </div>
      </div>

      <div>
        <div className="text-[11px] text-white/55 mb-1.5">
          Punto focal {f === 'contain' && <span className="text-white/35">(no aplica con &quot;Ver todo&quot;)</span>}
        </div>
        <div
          ref={boxRef}
          onMouseDown={(e) => { setDragging(true); pickFromEvent(e.clientX, e.clientY); }}
          onTouchStart={(e) => {
            const t = e.touches[0]; if (!t) return;
            setDragging(true); pickFromEvent(t.clientX, t.clientY);
          }}
          className={`relative w-full aspect-square rounded overflow-hidden border-2 ${dragging ? 'border-orange-400' : 'border-white/15'} bg-black/30 cursor-crosshair select-none`}
          style={{ maxWidth: compact ? 180 : 220 }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: `${x}% ${y}%`, objectFit: f }} draggable={false} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/35 text-xs">
              (sin imagen)
            </div>
          )}
          {/* Punto focal */}
          {imageUrl && (
            <div
              className="absolute w-5 h-5 rounded-full bg-orange-400 border-2 border-white shadow-lg pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          )}
          {/* Líneas guía */}
          {imageUrl && (
            <>
              <div className="absolute inset-y-0 pointer-events-none border-l border-white/20" style={{ left: `${x}%` }} />
              <div className="absolute inset-x-0 pointer-events-none border-t border-white/20" style={{ top: `${y}%` }} />
            </>
          )}
        </div>
        <div className="text-[10px] text-white/40 mt-1.5">
          Arrastrá el punto a la cara o detalle que quieras mantener visible.
          <span className="text-white/60 font-mono ml-1">X={x}% Y={y}%</span>
        </div>
        <div className="flex gap-1 mt-1.5">
          <button type="button" onClick={() => onChangePosition('50% 50%')}
            className="text-[10px] px-2 py-0.5 rounded border border-white/15 text-white/55 hover:bg-white/5">
            Centrar
          </button>
          <button type="button" onClick={() => onChangePosition('50% 25%')}
            className="text-[10px] px-2 py-0.5 rounded border border-white/15 text-white/55 hover:bg-white/5">
            Cara (¼ arriba)
          </button>
        </div>
      </div>
    </div>
  );
}

/** Acepta keywords viejos o "X% Y%" nuevo. Devuelve % numéricos. */
function parsePosition(raw: string | undefined): { x: number; y: number } {
  if (!raw) return { x: 50, y: 50 };
  const s = raw.trim().toLowerCase();
  if (s === 'top') return { x: 50, y: 0 };
  if (s === 'bottom') return { x: 50, y: 100 };
  if (s === 'center') return { x: 50, y: 50 };
  if (s === 'left') return { x: 0, y: 50 };
  if (s === 'right') return { x: 100, y: 50 };
  // "X% Y%"
  const m = s.match(/^(\d+)%\s+(\d+)%$/);
  if (m) return { x: Math.min(100, Math.max(0, parseInt(m[1], 10))), y: Math.min(100, Math.max(0, parseInt(m[2], 10))) };
  return { x: 50, y: 50 };
}
