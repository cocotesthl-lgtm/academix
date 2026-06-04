'use client';

import { useMemo, useState } from 'react';
import type { BookingSlot, CalendarMode } from '@/lib/calendar/types';

/**
 * Renderiza el paso de calendario del checkout.
 * Hace POST con name="booking_date" (start_date) o "booking_slot_start" (mentorship_slot)
 * dentro del form padre del CouponInput — por eso solo emite los hidden inputs
 * + UI, no un form propio.
 *
 * Lo importante: si `required && empty`, devuelve un wrapper que indica al
 * padre que el form no debe enviarse. Lo hacemos vía un input invisible
 * con required + value vacío (HTML5 valida).
 */
export function CalendarPicker({
  mode,
  label,
  required,
  primary,
  slots
}: {
  mode: Exclude<CalendarMode, 'none'>;
  label: string;
  required: boolean;
  primary: string;
  slots?: BookingSlot[];   // solo para mentorship_slot
}) {
  if (mode === 'start_date') {
    return <StartDatePicker label={label} required={required} />;
  }
  return <SlotPicker label={label} required={required} primary={primary} slots={slots ?? []} />;
}

/* ─────────── Start date simple ─────────── */

function StartDatePicker({ label, required }: { label: string; required: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState('');
  return (
    <div>
      <label className="block text-xs text-black/60 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        name="booking_date"
        type="date"
        required={required}
        min={today}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
      />
    </div>
  );
}

/* ─────────── Mentorship slot picker ─────────── */

function SlotPicker({
  label, required, primary, slots
}: {
  label: string; required: boolean; primary: string; slots: BookingSlot[];
}) {
  const [selected, setSelected] = useState<string>('');

  // Agrupamos por día (YYYY-MM-DD) para mostrar como acordeón
  const groups = useMemo(() => {
    const m = new Map<string, BookingSlot[]>();
    for (const s of slots) {
      const d = s.start.slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(s);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const [openDay, setOpenDay] = useState<string | null>(groups[0]?.[0] ?? null);

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠️ Por ahora no hay slots disponibles para reservar.
        {required && <div className="mt-1">El curso requiere reserva — pediles a los compradores que vuelvan más tarde o avisale al instructor.</div>}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-black/60 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type="hidden"
        name="booking_slot_start"
        value={selected}
        required={required}
      />
      <div className="rounded-lg border border-black/15 bg-white max-h-[280px] overflow-y-auto">
        {groups.map(([day, daySlots]) => {
          const isOpen = openDay === day;
          const dateObj = new Date(day + 'T12:00:00');
          const dayLabel = dateObj.toLocaleDateString('es-AR', {
            weekday: 'short', day: '2-digit', month: 'short'
          });
          const availableCount = daySlots.filter((s) => !s.taken).length;
          return (
            <div key={day} className="border-b border-black/5 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenDay(isOpen ? null : day)}
                className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-black/[0.02] text-sm"
              >
                <span className="font-medium capitalize">{dayLabel}</span>
                <span className="text-xs text-black/45">
                  {availableCount} {availableCount === 1 ? 'slot' : 'slots'} {isOpen ? '▾' : '▸'}
                </span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                  {daySlots.map((s) => {
                    const time = new Date(s.start).toLocaleTimeString('es-AR', {
                      hour: '2-digit', minute: '2-digit'
                    });
                    const isSelected = selected === s.start;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        disabled={s.taken}
                        onClick={() => setSelected(isSelected ? '' : s.start)}
                        className={`text-xs px-3 py-1.5 rounded border transition ${
                          isSelected
                            ? 'text-white border-transparent'
                            : s.taken
                              ? 'border-black/10 text-black/30 line-through cursor-not-allowed'
                              : 'border-black/15 hover:border-black/40'
                        }`}
                        style={isSelected ? { background: primary } : undefined}
                        title={s.taken ? 'Ocupado' : ''}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selected && (
        <p className="text-xs text-emerald-700 mt-1">
          ✓ Reservaste: {new Date(selected).toLocaleString('es-AR', {
            weekday: 'short', day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit'
          })}
        </p>
      )}
    </div>
  );
}
