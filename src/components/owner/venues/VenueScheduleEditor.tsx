'use client';

import { useState, useTransition } from 'react';
import { setVenueScheduleAction } from '@/lib/venues/actions';
import { DAY_LABELS, DAY_ORDER, type DayKey, type HourRange, type VenueHours } from '@/lib/venues/slots';

export function VenueScheduleEditor({
  venueId, initialHours, initialBlackouts, initialSlotMinutes
}: {
  venueId: string;
  initialHours: VenueHours;
  initialBlackouts: string[];
  initialSlotMinutes: number;
}) {
  const [hours, setHours] = useState<VenueHours>(initialHours);
  const [blackouts, setBlackouts] = useState<string[]>(initialBlackouts);
  const [slotMinutes, setSlotMinutes] = useState(initialSlotMinutes);
  const [newBlackout, setNewBlackout] = useState('');
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState(0);

  function setDayRanges(day: DayKey, ranges: HourRange[]) {
    setHours((h) => ({ ...h, [day]: ranges }));
  }
  function addRange(day: DayKey) {
    setDayRanges(day, [...(hours[day] ?? []), { from: '10:00', to: '19:00' }]);
  }
  function removeRange(day: DayKey, idx: number) {
    setDayRanges(day, (hours[day] ?? []).filter((_, i) => i !== idx));
  }
  function updateRange(day: DayKey, idx: number, patch: Partial<HourRange>) {
    setDayRanges(day, (hours[day] ?? []).map((r, i) => i === idx ? { ...r, ...patch } : r));
  }
  function addBlackout() {
    if (!newBlackout || !/^\d{4}-\d{2}-\d{2}$/.test(newBlackout)) return;
    if (blackouts.includes(newBlackout)) return;
    setBlackouts([...blackouts, newBlackout].sort());
    setNewBlackout('');
  }
  function removeBlackout(d: string) {
    setBlackouts(blackouts.filter((x) => x !== d));
  }

  function save() {
    start(async () => {
      const fd = new FormData();
      fd.set('id', venueId);
      fd.set('hours_json', JSON.stringify(hours));
      fd.set('blackouts_json', JSON.stringify(blackouts));
      fd.set('slot_minutes', String(slotMinutes));
      await setVenueScheduleAction(fd);
      setSavedAt(Date.now());
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">🕐 Horarios de atención</h4>
        <label className="text-xs flex items-center gap-2">
          Duración de cada slot:
          <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))}
            className="rounded bg-white/5 border border-white/15 px-2 py-1 text-xs">
            <option value={30}>30 min</option>
            <option value={60}>1 hr</option>
            <option value={90}>1.5 hr</option>
            <option value={120}>2 hr</option>
            <option value={180}>3 hr</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        {DAY_ORDER.map((day) => {
          const ranges = hours[day] ?? [];
          return (
            <div key={day} className="grid grid-cols-[80px_1fr_auto] items-start gap-2 text-xs">
              <div className="pt-2 font-semibold text-white/75">{DAY_LABELS[day]}</div>
              <div className="space-y-1.5">
                {ranges.length === 0 && (
                  <div className="text-white/35 italic pt-2">cerrado</div>
                )}
                {ranges.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="time" value={r.from} onChange={(e) => updateRange(day, idx, { from: e.target.value })}
                      className="rounded bg-white/5 border border-white/15 px-2 py-1 text-xs" />
                    <span>a</span>
                    <input type="time" value={r.to} onChange={(e) => updateRange(day, idx, { to: e.target.value })}
                      className="rounded bg-white/5 border border-white/15 px-2 py-1 text-xs" />
                    <button type="button" onClick={() => removeRange(day, idx)}
                      className="text-rose-300 hover:text-rose-100 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => addRange(day)}
                className="text-xs text-amber-400 hover:underline pt-2">+ rango</button>
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-white/10">
        <h4 className="text-sm font-semibold mb-2">🚫 Fechas bloqueadas (feriados, mantenimiento)</h4>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {blackouts.map((d) => (
            <span key={d} className="text-xs bg-rose-500/10 text-rose-200 px-2 py-1 rounded-full inline-flex items-center gap-1">
              {d}
              <button type="button" onClick={() => removeBlackout(d)} className="hover:text-white">✕</button>
            </span>
          ))}
          {blackouts.length === 0 && <span className="text-xs text-white/35 italic">ninguna</span>}
        </div>
        <div className="flex gap-2">
          <input type="date" value={newBlackout} onChange={(e) => setNewBlackout(e.target.value)}
            className="rounded bg-white/5 border border-white/15 px-2 py-1 text-xs" />
          <button type="button" onClick={addBlackout}
            className="text-xs px-3 py-1 rounded border border-white/15 hover:bg-white/5">+ Agregar</button>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="button" onClick={save} disabled={pending}
          className="rounded bg-white text-black text-sm font-semibold px-4 py-1.5 disabled:opacity-50">
          {pending ? 'Guardando…' : 'Guardar horarios'}
        </button>
        {savedAt > 0 && <span className="text-xs text-emerald-300">✓ Guardado</span>}
      </div>
    </div>
  );
}
