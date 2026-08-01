'use client';

import { useState } from 'react';
import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/presets';
import { GradientBuilder } from './GradientBuilder';
import { BrandSwatchesStrip } from './BrandSwatchesStrip';
import { HexInput } from './HexInput';
import type { BrandSwatch } from '@/lib/theme/swatches';

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
  theme = 'dark',
  showBrandSwatch = false,
  brandHex,
  brandSwatches = []
}: {
  onPick: (color: string, gradient?: string) => void;
  mode?: 'all' | 'solids' | 'gradients';
  currentValue?: string | null;
  compact?: boolean;
  /** 'dark' (default) para BrandingForm en fondo oscuro; 'light' para
   * Onboarding en fondo blanco. Cambia los colores del + custom, tabs
   * y textos para que se vean con contraste en cada contexto. */
  theme?: 'dark' | 'light';
  /** Si true, arriba de las tabs muestra un swatch "Usar brand del sitio"
   * que aplica literalmente la CSS var --brand-bg. Al elegirlo, el fondo/
   * botón de la sección hereda automáticamente lo que el owner tenga
   * configurado en /owner/branding (hex o gradient). Si después cambia
   * el brand, todo lo marcado como "brand" se actualiza solo. */
  showBrandSwatch?: boolean;
  /** Hex del brand actual — se usa como preview del swatch y como
   *  fallback en el CSS var. Requerido si showBrandSwatch=true. */
  brandHex?: string;
  /** Swatches guardados del sitio — persistidos en tenants.brand_swatches.
   *  Se muestran arriba de los presets como "Colores de mi sitio" y
   *  también dentro del GradientBuilder cuando hay algún gradient guardado. */
  brandSwatches?: BrandSwatch[];
}) {
  const [activeTab, setActiveTab] = useState<ThemePreset['category']>(
    mode === 'gradients' ? 'gradientes' : 'sólidos'
  );
  const [showGradientBuilder, setShowGradientBuilder] = useState(false);
  const [showCustomSolid, setShowCustomSolid] = useState(false);
  const [customSolid, setCustomSolid] = useState(
    typeof currentValue === 'string' && /^#/.test(currentValue) ? currentValue : '#f97316'
  );

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
      {/* Swatch "brand del sitio" — guarda literal var(--brand-bg) para
          que el color/gradient elegido en /owner/branding se propague
          automáticamente. Cuando el owner cambie el brand, todo lo que
          marcó como "mi brand" se actualiza sin re-editar. */}
      {showBrandSwatch && brandHex && (
        <button type="button"
          onClick={() => onPick(brandHex, `var(--brand-bg, ${brandHex})`)}
          className={`w-full flex items-center gap-2 p-2 rounded border transition text-xs ${
            currentValue?.includes('--brand-bg')
              ? isDark ? 'border-white bg-white/10' : 'border-neutral-900 bg-neutral-100'
              : isDark ? 'border-white/20 hover:bg-white/5' : 'border-neutral-300 hover:bg-neutral-50'
          }`}>
          <span className="w-6 h-6 rounded border border-black/10 shrink-0"
            style={{ background: `var(--brand-bg, ${brandHex})` }} />
          <span className={isDark ? 'text-white/80' : 'text-neutral-700'}>
            Usar el color/gradient de mi sitio
          </span>
        </button>
      )}

      {/* Swatches guardados: click reusa el color/gradient sin adivinar hex.
          Auto-persistidos cuando el owner aplica un valor + botón "+ guardar". */}
      {brandSwatches.length > 0 && (
        <BrandSwatchesStrip
          initialSwatches={brandSwatches}
          currentValue={typeof currentValue === 'string' ? currentValue : undefined}
          onPick={(v) => {
            const isGrad = /gradient\(/i.test(v);
            onPick(isGrad ? (brandHex ?? '#000000') : v, isGrad ? v : undefined);
          }}
          filterKind={mode === 'solids' ? 'solid' : mode === 'gradients' ? 'gradient' : undefined}
        />
      )}

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
          <button
            type="button"
            title="Color custom (hex + gotero)"
            onClick={() => setShowCustomSolid((v) => !v)}
            className={`aspect-square rounded border-2 border-dashed flex items-center justify-center text-xl font-light transition ${
              showCustomSolid ? plusActive : plusIdle
            }`}
          >
            +
          </button>
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

      {/* Custom solid: HexInput visible con eyedropper */}
      {activeTab === 'sólidos' && showCustomSolid && (
        <div className="p-2 rounded border border-white/10 bg-black/20 flex items-center gap-2">
          <HexInput value={customSolid} onChange={(v) => { setCustomSolid(v); onPick(v); }} />
          <button
            type="button"
            onClick={() => setShowCustomSolid(false)}
            className={`text-[10px] ml-auto px-2 py-0.5 rounded ${isDark ? 'text-white/50 hover:text-white' : 'text-neutral-500 hover:text-neutral-900'}`}
          >
            Listo
          </button>
        </div>
      )}

      {/* Gradient builder inline (solo cuando + está activo en tab gradientes) */}
      {activeTab === 'gradientes' && showGradientBuilder && (
        <GradientBuilder
          initial={typeof currentValue === 'string' && /^(linear|radial|conic)-gradient/.test(currentValue) ? currentValue : undefined}
          brandSwatches={brandSwatches}
          onApply={(gradient, primary) => {
            onPick(primary, gradient);
            setShowGradientBuilder(false);
          }}
        />
      )}
    </div>
  );
}
