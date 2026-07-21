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
  compact = false,
  theme = 'dark'
}: {
  onPick: (color: string, gradient?: string) => void;
  mode?: 'all' | 'solids' | 'gradients';
  currentValue?: string | null;
  compact?: boolean;
  /** 'dark' (default) para BrandingForm en fondo oscuro; 'light' para
   * Onboarding en fondo blanco. Cambia los colores del + custom, tabs
   * y textos para que se vean con contraste en cada contexto. */
  theme?: 'dark' | 'light';
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

  // Palette-aware clases: en fondo oscuro (BrandingForm) usamos white
  // para tabs / borders / + button; en fondo claro (Onboarding) usamos
  // black. Sin esto, el + queda invisible en el onboarding.
  const isDark = theme === 'dark';
  const tabIdle = isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300';
  const tabActive = isDark ? 'bg-white text-black font-semibold' : 'bg-neutral-900 text-white font-semibold';
  const plusIdle = isDark
    ? 'border-white/30 hover:border-white/60 hover:bg-white/5 text-white/60 hover:text-white'
    : 'border-neutral-400 hover:border-neutral-700 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900';
  const plusActive = isDark
    ? 'border-white bg-white/10 text-white'
    : 'border-neutral-900 bg-neutral-100 text-neutral-900';
  const swatchActiveBorder = isDark ? 'border-white' : 'border-neutral-900';
  const swatchHoverBorder = isDark ? 'hover:border-white/40' : 'hover:border-neutral-500';

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
              className={`px-2 py-0.5 rounded transition ${activeTab === cat ? tabActive : tabIdle}`}>
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
                isActive ? `${swatchActiveBorder} shadow-lg` : `border-transparent ${swatchHoverBorder}`
              }`}
              style={{ background: bg }}
            />
          );
        })}

        {/* Tarjeta "+" custom — visible en dark + light theme */}
        {activeTab === 'sólidos' ? (
          <>
            <button
              type="button"
              title="Color custom"
              onClick={() => customColorRef.current?.click()}
              className={`aspect-square rounded border-2 border-dashed flex items-center justify-center text-xl font-light transition ${plusIdle}`}
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
              showGradientBuilder ? plusActive : plusIdle
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
