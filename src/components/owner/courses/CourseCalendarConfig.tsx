'use client';

import { useState, useTransition } from 'react';
import { setCourseCalendarAction, setCourseCalendarSourceAction } from '@/lib/calendar/actions';
import type { CalendarMode } from '@/lib/calendar/types';

/**
 * Editor del modo de calendario para una publicación. 3 opciones:
 *  - none: no se pide nada en el checkout (default).
 *  - start_date: el comprador elige una fecha de inicio (sin checks de disponibilidad).
 *  - mentorship_slot: el comprador elige un slot puntual de la disponibilidad
 *    declarada por el owner en /owner/availability.
 */
export function CourseCalendarConfig({
  courseId,
  initialMode,
  initialLabel,
  initialRequired,
  initialHorizon,
  initialSource = 'instructor'
}: {
  courseId: string;
  initialMode: CalendarMode;
  initialLabel: string | null;
  initialRequired: boolean;
  initialHorizon: number;
  initialSource?: 'instructor' | 'owner';
}) {
  const [mode, setMode] = useState<CalendarMode>(initialMode);
  const [label, setLabel] = useState(initialLabel ?? '');
  const [required, setRequired] = useState(initialRequired);
  const [horizon, setHorizon] = useState(initialHorizon);
  const [source, setSource] = useState<'instructor' | 'owner'>(initialSource);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function saveSource(next: 'instructor' | 'owner') {
    setSource(next);
    const fd = new FormData();
    fd.set('course_id', courseId);
    fd.set('source', next);
    start(async () => { await setCourseCalendarSourceAction(fd); });
  }

  function save(next?: Partial<{ mode: CalendarMode; label: string; required: boolean; horizon: number }>) {
    const fd = new FormData();
    fd.set('course_id', courseId);
    fd.set('mode', next?.mode ?? mode);
    fd.set('label', next?.label ?? label);
    fd.set('required', (next?.required ?? required) ? 'true' : 'false');
    fd.set('horizon_days', String(next?.horizon ?? horizon));
    start(async () => {
      await setCourseCalendarAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {([
          { v: 'none', icon: '🚫', t: 'Sin calendario' },
          { v: 'start_date', icon: '📅', t: 'Fecha de inicio' },
          { v: 'mentorship_slot', icon: '🗓️', t: 'Slot de mentoría' },
          { v: 'event_tickets', icon: '🎫', t: 'Tickets de evento' }
        ] as Array<{ v: CalendarMode; icon: string; t: string }>).map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => { setMode(opt.v); save({ mode: opt.v }); }}
            disabled={pending}
            className={`text-left rounded-lg border p-4 transition ${
              mode === opt.v
                ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
                : 'border-white/15 hover:bg-white/[0.03]'
            }`}
          >
            <div className="text-2xl mb-1">{opt.icon}</div>
            <div className="font-semibold text-sm">{opt.t}</div>
            <div className="text-[11px] text-white/50 mt-1">
              {opt.v === 'none' && 'No se pide nada en el checkout.'}
              {opt.v === 'start_date' && 'Comprador elige una fecha simple.'}
              {opt.v === 'mentorship_slot' && 'Slots según tu disponibilidad semanal.'}
              {opt.v === 'event_tickets' && 'Eventos con fecha + cupo. Compra N tickets.'}
            </div>
          </button>
        ))}
      </div>

      {mode !== 'none' && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
              Texto que ve el comprador
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => save()}
              maxLength={120}
              placeholder={mode === 'start_date' ? 'Ej: ¿Cuándo querés empezar?' : 'Ej: Elegí tu sesión de mentoría'}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
            />
            <p className="text-[11px] text-white/45 mt-1">Si lo dejás vacío, mostramos un texto por defecto.</p>
          </div>

          {mode === 'mentorship_slot' && (
            <>
              <div className="border-t border-white/10 pt-3">
                <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">
                  ¿De dónde salen los slots?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => saveSource('instructor')}
                    disabled={pending}
                    className={`text-left rounded border p-3 text-xs ${
                      source === 'instructor' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/15 hover:bg-white/5'
                    }`}
                  >
                    <div className="font-semibold">👨‍🏫 Disponibilidad del instructor</div>
                    <div className="text-white/55 mt-0.5">Slots de los instructores asignados al publicación.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => saveSource('owner')}
                    disabled={pending}
                    className={`text-left rounded border p-3 text-xs ${
                      source === 'owner' ? 'border-fuchsia-500/50 bg-fuchsia-500/10' : 'border-white/15 hover:bg-white/5'
                    }`}
                  >
                    <div className="font-semibold">🏫 Calendario del owner</div>
                    <div className="text-white/55 mt-0.5">Vos definís los días/fechas, sin importar quién dicta.</div>
                  </button>
                </div>
                <p className="text-[11px] text-white/45 mt-2">
                  {source === 'instructor'
                    ? 'Configurá los slots desde /availability (tenant-wide) o cada instructor desde /instructor/availability.'
                    : 'Configurá los slots desde /availability (recurrente + fechas puntuales). Los instructores asignados pueden venir o no.'}
                </p>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
                  Cuántos días hacia adelante mostrar disponibilidad
                </label>
              <input
                type="number"
                min={1} max={180}
                value={horizon}
                onChange={(e) => setHorizon(parseInt(e.target.value || '30', 10))}
                onBlur={() => save()}
                className="w-32 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
              />
              <span className="text-white/45 text-sm ml-2">días</span>
              </div>
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => { setRequired(e.target.checked); save({ required: e.target.checked }); }}
            />
            Obligatorio (no puede comprar sin elegir)
          </label>

          {saved && <p className="text-xs text-emerald-300">✓ Guardado</p>}
        </div>
      )}
    </div>
  );
}
