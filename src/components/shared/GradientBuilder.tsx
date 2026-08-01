'use client';

import { useState, useEffect } from 'react';
import { HexInput } from '@/components/shared/HexInput';
import { BrandSwatchesStrip } from '@/components/shared/BrandSwatchesStrip';
import type { BrandSwatch } from '@/lib/theme/swatches';

/**
 * Builder inline de gradient CSS custom. Se muestra cuando el owner
 * hace click en la tarjeta "+" del tab gradientes de ThemePresets.
 *
 * Genera strings tipo:
 *   linear-gradient(135deg, #ff0000 0%, #0000ff 100%)
 *   radial-gradient(circle at center, #ff0000 0%, #0000ff 100%)
 *   conic-gradient(from 0deg, #ff0000, #0000ff)
 *
 * onApply recibe el string armado y opcionalmente el color dominante
 * (usa el color 2 = del medio, o el 1er si solo hay 2) para el hex
 * fallback del brand.
 */
export function GradientBuilder({
  onApply,
  initial,
  brandSwatches = []
}: {
  onApply: (gradient: string, primary: string) => void;
  initial?: string;
  /** Swatches guardados del sitio — se muestran arriba para reusar. */
  brandSwatches?: BrandSwatch[];
}) {
  const [type, setType] = useState<'linear' | 'radial' | 'conic'>('linear');
  const [angle, setAngle] = useState(135);
  const [color1, setColor1] = useState('#f97316');
  const [color2, setColor2] = useState('#ec4899');
  const [color3, setColor3] = useState('#8b5cf6');
  const [use3, setUse3] = useState(true);

  // Parsear initial si viene un gradient existente
  useEffect(() => {
    if (!initial) return;
    // Muy simple: intento detectar type y colores. Si falla, deja defaults.
    const m = initial.match(/^(linear|radial|conic)-gradient/i);
    if (m) setType(m[1].toLowerCase() as 'linear' | 'radial' | 'conic');
    const angleM = initial.match(/(\d+)deg/);
    if (angleM) setAngle(parseInt(angleM[1], 10));
    const colorMatches = initial.match(/#[0-9a-f]{6}/gi);
    if (colorMatches) {
      if (colorMatches[0]) setColor1(colorMatches[0]);
      if (colorMatches[1]) setColor2(colorMatches[1]);
      if (colorMatches[2]) { setColor3(colorMatches[2]); setUse3(true); }
      else setUse3(false);
    }
  }, [initial]);

  // Armar el gradient CSS
  const stops = use3
    ? `${color1} 0%, ${color2} 50%, ${color3} 100%`
    : `${color1} 0%, ${color2} 100%`;
  const gradient =
    type === 'linear' ? `linear-gradient(${angle}deg, ${stops})` :
    type === 'radial' ? `radial-gradient(circle at center, ${stops})` :
    `conic-gradient(from ${angle}deg at 50% 50%, ${stops})`;

  // Color dominante para brand fallback = color del medio si hay 3, sino el 1er
  const dominant = use3 ? color2 : color1;

  return (
    <div className="p-3 space-y-3 border-t border-white/10 bg-black/20">
      {/* Preview grande arriba */}
      <div
        className="w-full h-20 rounded-md border border-white/15"
        style={{ background: gradient }}
      />

      {/* Type + angle */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Tipo</div>
          <div className="flex gap-1">
            {(['linear', 'radial', 'conic'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 text-[10px] px-1.5 py-1 rounded transition ${
                  type === t
                    ? 'bg-white text-black font-semibold'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}>
                {t === 'linear' ? 'Raya' : t === 'radial' ? 'Radial' : 'Cónico'}
              </button>
            ))}
          </div>
        </div>
        {type !== 'radial' && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Ángulo {angle}°</div>
            <input
              type="range" min={0} max={360} value={angle}
              onChange={(e) => setAngle(parseInt(e.target.value, 10))}
              className="w-full accent-white"
            />
          </div>
        )}
      </div>

      {/* Swatches guardados: click en un gradient guardado y se aplica */}
      {brandSwatches.length > 0 && (
        <BrandSwatchesStrip
          initialSwatches={brandSwatches}
          currentValue={gradient}
          onPick={(v) => onApply(v, dominant)}
          filterKind="gradient"
        />
      )}

      {/* Colores — hex editable + eyedropper */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/50 w-14 shrink-0">Color 1</span>
          <HexInput value={color1} onChange={setColor1} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/50 w-14 shrink-0">Color 2</span>
          <HexInput value={color2} onChange={setColor2} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/50 w-14 shrink-0">Color 3</span>
          <div className={use3 ? '' : 'opacity-40 pointer-events-none'}>
            <HexInput value={color3} onChange={(v) => { setColor3(v); setUse3(true); }} />
          </div>
          <label className="flex items-center gap-1 text-[10px] text-white/50 cursor-pointer">
            <input type="checkbox" checked={use3} onChange={(e) => setUse3(e.target.checked)} />
            usar
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onApply(gradient, dominant)}
        className="w-full text-xs px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
        Aplicar gradient
      </button>
    </div>
  );
}
