'use client';

import { useState } from 'react';
import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/presets';

/**
 * Grid de presets clickeables agrupados por categoría. Se muestra
 * arriba de un color picker existente.
 *
 * onPick recibe:
 *   - color: hex del primary del preset (para inputs type="color")
 *   - gradient: string CSS opcional (los sólidos no tienen)
 * El consumer decide qué usar según el contexto:
 *   - Brand color / input type="color": usa color
 *   - Bg de sección que soporta gradientes: prefiere gradient, cae a color
 *
 * `mode` filtra qué presets mostrar:
 *   - 'all': todo (default)
 *   - 'solids': sólo colores puros — para pickers que sólo aceptan hex
 *   - 'gradients': sólo gradientes — para picker de fondos de sección
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

  // 2 categorías reales: Sólidos y Gradientes. Simple, sin ruido.
  // El input color RGB nativo cubre el caso "custom" (cualquier hex).
  const availableCats: ThemePreset['category'][] =
    mode === 'solids' ? ['sólidos'] :
    mode === 'gradients' ? ['gradientes'] :
    ['sólidos', 'gradientes'];

  const visible = THEME_PRESETS.filter((p) => {
    if (mode === 'solids' && p.category === 'gradientes') return false;
    if (mode === 'gradients' && p.category !== 'gradientes') return false;
    return p.category === activeTab;
  });

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {/* Tabs de categorías (solo si hay >1) */}
      {availableCats.length > 1 && (
        <div className="flex gap-1 text-xs">
          {availableCats.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTab(cat)}
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

      {/* Grid de swatches */}
      <div className={`grid gap-1.5 ${compact ? 'grid-cols-8' : 'grid-cols-6'}`}>
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
      </div>
    </div>
  );
}
