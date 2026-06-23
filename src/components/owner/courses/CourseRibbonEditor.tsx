'use client';

import { useState, useTransition } from 'react';
import { setCourseRibbonAction } from '@/lib/courses/actions';
import { showToast } from '@/components/owner/ToastBus';

/**
 * Editor de la "cinta" de la publicación — aparece sobre la tarjeta de la publicación
 * en el catálogo del storefront. Ej. "OFERTA", "ÚLTIMOS DÍAS", "NUEVO".
 */

const TONE_OPTIONS = [
  { value: 'featured', label: '★ Destacado', preview: 'bg-fuchsia-500 text-white' },
  { value: 'sale',     label: '💸 Oferta',    preview: 'bg-rose-500 text-white' },
  { value: 'urgent',   label: '⏰ Urgente',   preview: 'bg-amber-500 text-amber-950' },
  { value: 'new',      label: '✨ Nuevo',     preview: 'bg-emerald-500 text-white' },
  { value: 'info',     label: 'ℹ Info',       preview: 'bg-sky-500 text-white' }
];

export function CourseRibbonEditor({
  courseId, initialText, initialTone
}: {
  courseId: string;
  initialText: string | null;
  initialTone: string | null;
}) {
  const [text, setText] = useState(initialText ?? '');
  const [tone, setTone] = useState(initialTone ?? 'featured');
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const fd = new FormData();
      fd.set('id', courseId);
      fd.set('ribbon_text', text);
      fd.set('ribbon_tone', tone);
      await setCourseRibbonAction(fd);
      showToast(text ? `Cinta "${text}" aplicada` : 'Cinta eliminada', 'success');
    });
  }

  const currentToneCls = TONE_OPTIONS.find((t) => t.value === tone)?.preview ?? 'bg-fuchsia-500 text-white';

  return (
    <section className="max-w-3xl pt-8 border-t border-white/10">
      <h2 className="text-lg font-semibold mb-1">Cinta del catálogo</h2>
      <p className="text-sm text-white/60 mb-4">
        Texto destacado que aparece sobre la tarjeta de la publicación en el catálogo público.
        Dejá vacío para no mostrar cinta.
      </p>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/45 mb-1.5">Texto (max 30 chars)</label>
            <input
              type="text"
              value={text}
              maxLength={30}
              onChange={(e) => setText(e.target.value.toUpperCase())}
              placeholder="OFERTA · ÚLTIMOS DÍAS · NUEVO…"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-bold uppercase tracking-wider"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/45 mb-1.5">Color</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/45 mb-2">Vista previa</div>
          <div className="rounded-lg border border-white/10 bg-white p-4">
            <div className="relative w-full aspect-video bg-gradient-to-br from-zinc-700 to-zinc-900 rounded-md overflow-hidden">
              {text && (
                <div className={`absolute top-2 left-2 px-2 py-1 rounded text-[10px] font-bold tracking-wider ${currentToneCls}`}>
                  {text}
                </div>
              )}
            </div>
            <div className="mt-2 text-black text-sm font-semibold">Nombre de la publicación</div>
            <div className="text-black/60 text-xs">$10.000 ARS</div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {text && (
            <button
              type="button"
              onClick={() => { setText(''); start(async () => {
                const fd = new FormData();
                fd.set('id', courseId);
                fd.set('ribbon_text', '');
                fd.set('ribbon_tone', tone);
                await setCourseRibbonAction(fd);
                showToast('Cinta eliminada', 'success');
              }); }}
              disabled={pending}
              className="text-sm rounded border border-white/15 px-3 py-2 hover:bg-white/5"
            >
              Quitar
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="text-sm rounded bg-white text-black px-4 py-2 font-semibold hover:bg-white/90 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar cinta'}
          </button>
        </div>
      </div>
    </section>
  );
}
