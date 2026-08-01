'use client';

import { useTransition, useState, useEffect, useRef } from 'react';
import { ThemePresets } from '@/components/shared/ThemePresets';
import { isGradient } from '@/lib/theme/presets';
import { pinBrandSwatchAction, type BrandSwatch } from '@/lib/theme/swatches';

/**
 * Color picker que auto-aplica al elegir, con DEBOUNCE.
 *
 * Por qué debounce: el `<input type="color">` dispara onChange por cada
 * pixel que se mueve el cursor mientras el owner navega la rueda de
 * colores. Sin debounce, eso genera 20+ saves seguidos a Supabase y la
 * UI termina mostrando un color intermedio (el que estaba seleccionado
 * cuando el último save se terminó de procesar) en vez del color final
 * que el owner realmente quería.
 *
 * Con 400ms de debounce: el owner mueve el cursor libremente y solo el
 * color final (cuando se queda quieto) se postea.
 */
export function ColorAutoSave({
  label,
  fieldName,
  sectionKey,
  initial,
  action,
  brandHex,
  brandSwatches = []
}: {
  label: string;
  fieldName: 'bg_color' | 'text_color';
  sectionKey: string;
  initial: string | null;
  action: (fd: FormData) => Promise<void>;
  /** Hex del brand color del tenant. Se usa para mostrar el swatch
   *  "Usar el color/gradient de mi sitio" arriba de los presets. */
  brandHex?: string;
  /** Swatches persistidos del sitio — se pasan al ThemePresets. */
  brandSwatches?: BrandSwatch[];
}) {
  const [value, setValue] = useState(initial ?? defaultForField(fieldName));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El bg_color de sección acepta gradientes CSS; text_color debe ser hex sólido.
  const supportsGradient = fieldName === 'bg_color';
  const valueIsGradient = isGradient(value);

  // Si el server re-renderiza con otro initial (después de un save), sync.
  useEffect(() => {
    setValue(initial ?? defaultForField(fieldName));
  }, [initial, fieldName]);

  // Cleanup del timer al desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handlePick(newColor: string) {
    setValue(newColor);            // UI optimista: el swatch refleja al toque
    setSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      start(async () => {
        const fd = new FormData();
        fd.set('section', sectionKey);
        fd.set(fieldName, newColor);
        await action(fd);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        // Auto-pin al brand swatches — así el owner puede reusar este
        // color en otras secciones sin adivinar el hex. Silencioso si
        // ya está guardado. Skip para valores especiales tipo var().
        if (newColor && !newColor.includes('var(') && !/^(inherit|transparent|currentcolor|initial)$/i.test(newColor)) {
          pinBrandSwatchAction(newColor).catch(() => {});
        }
      });
    }, 400);
  }

  function reset() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    start(async () => {
      const fd = new FormData();
      fd.set('section', sectionKey);
      fd.set(fieldName, '');
      await action(fd);
    });
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-white/50">{label}:</label>
        {/* Swatch: si es gradiente, mostramos un div con la preview
            porque <input type="color"> sólo acepta hex sólido. */}
        {valueIsGradient ? (
          <div
            className="w-7 h-7 rounded border border-white/15 cursor-pointer"
            style={{ background: value }}
            onClick={() => setShowPresets((v) => !v)}
            title="Abrir presets"
          />
        ) : (
          <input
            type="color"
            value={value}
            onChange={(e) => handlePick(e.target.value)}
            className="w-7 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
          />
        )}
        <button
          type="button"
          onClick={() => setShowPresets((v) => !v)}
          className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 hover:bg-white/5 text-white/60"
          title="Elegir de un tema">
          🎨
        </button>
        {pending && <span className="text-[10px] text-white/40">…</span>}
        {saved && !pending && <span className="text-[10px] text-emerald-300">✓</span>}
        {initial && (
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 hover:bg-white/5 text-white/50 disabled:opacity-50"
            title={`Quitar ${label.toLowerCase()}`}
          >
            ✕
          </button>
        )}
      </div>
      {showPresets && (
        <div className="absolute z-20 top-full mt-1 p-2 rounded-lg border border-white/15 bg-neutral-900 shadow-2xl min-w-[260px]">
          <ThemePresets
            mode={supportsGradient ? 'all' : 'solids'}
            currentValue={value}
            compact
            showBrandSwatch={!!brandHex && supportsGradient}
            brandHex={brandHex}
            brandSwatches={brandSwatches}
            onPick={(hex, grad) => {
              const applied = supportsGradient && grad ? grad : hex;
              handlePick(applied);
              setShowPresets(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function defaultForField(f: 'bg_color' | 'text_color'): string {
  return f === 'bg_color' ? '#ffffff' : '#000000';
}
