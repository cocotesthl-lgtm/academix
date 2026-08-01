'use client';

import { useEffect, useState, useTransition } from 'react';
import { pinBrandSwatchAction, unpinBrandSwatchAction, type BrandSwatch } from '@/lib/theme/swatches';

/**
 * Strip horizontal con los colores/gradients guardados del sitio.
 * - Click en swatch → aplica ese valor.
 * - Hover → botón X para quitarlo.
 * - Botón "+ Guardar actual" (si hay currentValue y no está ya).
 *
 * `initialSwatches` viene del server (fetch al montar); actualizamos en
 * local optimistamente al pin/unpin.
 */
export function BrandSwatchesStrip({
  initialSwatches,
  currentValue,
  onPick,
  filterKind
}: {
  initialSwatches: BrandSwatch[];
  currentValue?: string;
  onPick: (value: string) => void;
  /** Si se pasa, solo muestra swatches de este tipo. */
  filterKind?: 'solid' | 'gradient';
}) {
  const [swatches, setSwatches] = useState<BrandSwatch[]>(initialSwatches);
  const [pending, start] = useTransition();

  useEffect(() => setSwatches(initialSwatches), [initialSwatches]);

  const visible = filterKind
    ? swatches.filter((s) => s.kind === filterKind)
    : swatches;

  const canPinCurrent = !!currentValue && !swatches.some((s) => s.value === currentValue);

  function handlePin() {
    if (!currentValue) return;
    // Optimista
    const optimistic: BrandSwatch = {
      id: `tmp-${Date.now()}`,
      value: currentValue,
      kind: currentValue.includes('gradient(') ? 'gradient' : 'solid',
      created_at: new Date().toISOString()
    };
    setSwatches((prev) => [optimistic, ...prev]);
    start(async () => { await pinBrandSwatchAction(currentValue); });
  }

  function handleUnpin(id: string) {
    setSwatches((prev) => prev.filter((s) => s.id !== id));
    start(async () => { await unpinBrandSwatchAction(id); });
  }

  if (visible.length === 0 && !canPinCurrent) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
          Colores de mi sitio
        </span>
        {canPinCurrent && (
          <button
            type="button"
            onClick={handlePin}
            disabled={pending}
            title="Guardar color/gradient actual como swatch"
            className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            + Guardar actual
          </button>
        )}
      </div>
      {visible.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((s) => {
            const isActive = s.value === currentValue;
            return (
              <div key={s.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onPick(s.value)}
                  title={s.value}
                  className={`block w-8 h-8 rounded border-2 transition ${
                    isActive ? 'border-blue-400 ring-2 ring-blue-400/40' : 'border-white/20 hover:border-white/60'
                  }`}
                  style={{ background: s.value }}
                />
                <button
                  type="button"
                  onClick={() => handleUnpin(s.id)}
                  title="Quitar"
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                  aria-label="Quitar swatch"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
