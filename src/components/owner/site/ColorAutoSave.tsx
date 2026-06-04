'use client';

import { useTransition, useState, useEffect } from 'react';

/**
 * Color picker que auto-aplica al elegir, sin botón "Aplicar".
 * Cualquier cambio en el `<input type="color">` dispara debounce → action.
 * El owner pickea y listo, sin click extra que olvidarse.
 *
 * Recibe la action directo (form action), el nombre del campo, el value
 * inicial guardado, y un label para mostrar al lado.
 */
export function ColorAutoSave({
  label,
  fieldName,
  sectionKey,
  initial,
  action,
  onReset
}: {
  label: string;
  fieldName: 'bg_color' | 'text_color';
  sectionKey: string;
  initial: string | null;
  action: (fd: FormData) => Promise<void>;
  onReset?: () => void;
}) {
  // Estado controlado del picker → sobrevive re-renders y sincroniza con
  // el valor guardado (initial). Usamos un default seguro cuando initial
  // es null para no confundir al browser nativo.
  const [value, setValue] = useState(initial ?? defaultForField(fieldName));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  // Si el server re-renderiza con otro initial (después de un save), sync.
  useEffect(() => {
    setValue(initial ?? defaultForField(fieldName));
  }, [initial, fieldName]);

  function save(newColor: string) {
    setValue(newColor);
    setSaved(false);
    start(async () => {
      const fd = new FormData();
      fd.set('section', sectionKey);
      fd.set(fieldName, newColor);
      await action(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function reset() {
    start(async () => {
      const fd = new FormData();
      fd.set('section', sectionKey);
      fd.set(fieldName, '');
      await action(fd);
      if (onReset) onReset();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-white/50">{label}:</label>
      <input
        type="color"
        value={value}
        onChange={(e) => save(e.target.value)}
        disabled={pending}
        className="w-7 h-7 rounded bg-transparent border border-white/15 cursor-pointer disabled:opacity-50"
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
