'use client';

import { useState, useRef } from 'react';
import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/presets';
import { GradientBuilder } from './GradientBuilder';

/**
 * Grid de swatches clickeables agrupados por categoría. Se muestra
 * arriba/abajo de un color picker existente.
 *
 * En cada tab hay una tarjeta "+" al final:
 *   - En sólidos: abre el input color RGB nativo (color custom)
 *   - En gradientes: expande un GradientBuilder inline con controles
 *     de tipo (linear/radial/conic), ángulo y 2-3 colores
 *
 * onPick recibe:
 *   - color: hex del primary del preset (para inputs type="color")
 *   - gradient: string CSS opcional (los sólidos no tienen)
 * El consumer decide qué usar según el contexto.
 */
export function ThemePresets({
  onPick,
  mode = 'all',
  currentValue,
  compact = false
}: {
  onPick: (color: string, gradient?: string) => void;
  mode?: 'all' | 'solids' | 'gradients';
  currentValue?: string | null;
  compact?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<ThemePreset['category']>(
    mode === 'gradients' ? 'gradientes' : 'sólidos'
  );
  const [showGradientBuilder, setShowGradientBuilder] = useState(false);
  const customColorRef = useRef<HTMLInputElement>(null);

  const availableCats: ThemePreset['category'][] =
    mode === 'solids' ? ['sólidos'] :
    mode === 'gradients' ? ['gradientes'] :
    ['sólidos', 'gradientes'];

  const visible = THEME_PRESETS.filter((p) => {
    if (mode === 'solids' && p.category === 'gradientes') return false;
    if (mode === 'gradients' && p.category !== 'gradientes') return false;
    return p.category === activeTab;
  });

  const gridCls = compact ? 'grid-cols-8' : 'grid-cols-6';

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {/* Tabs de categorías (solo si hay >1) */}
      {availableCats.length > 1 && (
        <div className="flex gap-1 text-xs">
          {availableCats.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { setActiveTab(cat); setShowGradientBuilder(false); }}
              className={`px-2 py-0.5 rounded transition ${
                activeTab === cat
                  ? 'bg-white text-black font-semibold'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid de swatches + tarjeta "+" al final */}
      <div className={`grid gap-1.5 ${gridCls}`}>
        {visible.map((p) => {
          const bg = p.gradient || p.primary;
          const isActive = currentValue === (p.gradient || p.primary);
          return (
            <button
              key={p.id}
              type="button"
              title={p.name}
              onClick={() => onPick(p.primary, p.gradient)}
              className={`aspect-square rounded transition border-2 hover:scale-110 ${
                isActive ? 'border-white shadow-lg' : 'border-transparent hover:border-white/40'
              }`}
              style={{ background: bg }}
            />
          );
        })}

        {/* Tarjeta "+" custom */}
        {activeTab === 'sólidos' ? (
          <>
            <button
              type="button"
              title="Color custom"
              onClick={() => customColorRef.current?.click()}
              className="aspect-square rounded border-2 border-dashed border-white/30 hover:border-white/60 hover:bg-white/5 flex items-center justify-center text-white/60 hover:text-white text-xl font-light transition"
            >
              +
            </button>
            <input
              ref={customColorRef}
              type="color"
              className="sr-only"
              defaultValue={typeof currentValue === 'string' && /^#/.test(currentValue) ? currentValue : '#f97316'}
              onChange={(e) => onPick(e.target.value)}
            />
          </>
        ) : (
          <button
            type="button"
            title="Gradient custom"
            onClick={() => setShowGradientBuilder((v) => !v)}
            className={`aspect-square rounded border-2 border-dashed flex items-center justify-center text-xl font-light transition ${
              showGradientBuilder
                ? 'border-white bg-white/10 text-white'
                : 'border-white/30 hover:border-white/60 hover:bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            +
          </button>
        )}
      </div>

      {/* Gradient builder inline (solo cuando + está activo en tab gradientes) */}
      {activeTab === 'gradientes' && showGradientBuilder && (
        <GradientBuilder
          initial={typeof currentValue === 'string' && /^(linear|radial|conic)-gradient/.test(currentValue) ? currentValue : undefined}
          onApply={(gradient, primary) => {
            onPick(primary, gradient);
            setShowGradientBuilder(false);
          }}
        />
      )}
    </div>
  );
}
