'use client';

import { useTransition, useState, useEffect, useRef } from 'react';

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
  action
}: {
  label: string;
  fieldName: 'bg_color' | 'text_color';
  sectionKey: string;
  initial: string | null;
  action: (fd: FormData) => Promise<void>;
}) {
  const [value, setValue] = useState(initial ?? defaultForField(fieldName));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-white/50">{label}:</label>
      <input
        type="color"
        value={value}
        onChange={(e) => handlePick(e.target.value)}
        className="w-7 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
      />
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
  );
}

function defaultForField(f: 'bg_color' | 'text_color'): string {
  return f === 'bg_color' ? '#ffffff' : '#000000';
}
