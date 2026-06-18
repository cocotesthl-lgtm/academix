'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { updateSectionFieldsAction } from '@/lib/site/actions';

/**
 * Input chico para editar el "eyebrow" (pre-título en mayúsculas chico) de
 * cada sección. Auto-save con debounce — no requiere botón "Guardar".
 *
 * Vacío explícito = oculta el eyebrow. Si nunca tocaste el campo y la sección
 * tiene un default hardcodeado (ej. "SOBRE NOSOTROS"), ese sigue mostrándose.
 */
export function EyebrowAutoSave({
  sectionKey,
  initial,
  placeholder
}: {
  sectionKey: string;
  initial: string | null | undefined;
  placeholder: string;
}) {
  const [value, setValue] = useState(initial ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(initial ?? ''), [initial]);
  useEffect(() => () => { if (debRef.current) clearTimeout(debRef.current); }, []);

  function save(v: string) {
    setValue(v);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      start(async () => {
        const fd = new FormData();
        fd.set('section', sectionKey);
        fd.set('eyebrow_text', v);
        await updateSectionFieldsAction(fd);
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      });
    }, 500);
  }

  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider text-white/45 flex items-center justify-between">
        <span>Pre-título (eyebrow chico)</span>
        {pending && <span className="text-white/40">…</span>}
        {saved && !pending && <span className="text-emerald-300">✓</span>}
      </label>
      <input
        value={value}
        onChange={(e) => save(e.target.value)}
        placeholder={placeholder}
        maxLength={60}
        className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:border-white/40"
      />
      <p className="text-[10px] text-white/40">Vacío = oculta el eyebrow. Tipea para personalizarlo.</p>
    </div>
  );
}
