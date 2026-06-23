'use client';

/**
 * Mini control reusable para ajustar el "área visible" de una imagen:
 *  - object-fit: cover (recorta para llenar) | contain (ve todo con bandas)
 *  - object-position: top | center | bottom
 *
 * No persiste por sí mismo — recibe value+onChange y lo controla el padre.
 */
export function ImageFitControls({
  fit, position, onChangeFit, onChangePosition, compact = false
}: {
  fit: 'cover' | 'contain' | undefined;
  position: 'top' | 'center' | 'bottom' | undefined;
  onChangeFit: (v: 'cover' | 'contain') => void;
  onChangePosition: (v: 'top' | 'center' | 'bottom') => void;
  compact?: boolean;
}) {
  const f = fit ?? 'cover';
  const p = position ?? 'center';
  return (
    <div className={`rounded-md border border-white/10 bg-white/[0.02] ${compact ? 'p-2' : 'p-3'} space-y-2`}>
      <div className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
        Encuadre de la imagen
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-white/55 mb-1">Ajuste</div>
          <div className="inline-flex rounded border border-white/15 overflow-hidden w-full">
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
          <div className="text-white/55 mb-1">Mostrar</div>
          <div className="inline-flex rounded border border-white/15 overflow-hidden w-full">
            <button type="button" onClick={() => onChangePosition('top')}
              className={`flex-1 px-2 py-1 ${p === 'top' ? 'bg-white text-black font-semibold' : 'text-white/65 hover:bg-white/5'}`}
              title="Mostrar la parte superior">↑</button>
            <button type="button" onClick={() => onChangePosition('center')}
              className={`flex-1 px-2 py-1 border-l border-white/15 ${p === 'center' ? 'bg-white text-black font-semibold' : 'text-white/65 hover:bg-white/5'}`}
              title="Centrar">●</button>
            <button type="button" onClick={() => onChangePosition('bottom')}
              className={`flex-1 px-2 py-1 border-l border-white/15 ${p === 'bottom' ? 'bg-white text-black font-semibold' : 'text-white/65 hover:bg-white/5'}`}
              title="Mostrar la parte inferior">↓</button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-white/40 leading-snug">
        💡 Si la cara queda cortada, probá <strong>Ver todo</strong> o cambiá la posición vertical.
      </p>
    </div>
  );
}
