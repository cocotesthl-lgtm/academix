'use client';

import { useMemo, useState } from 'react';
import type { BookingSlot, CalendarMode } from '@/lib/calendar/types';

/**
 * Renderiza el paso de calendario del checkout.
 * Hace POST con name="booking_date" (start_date) o "booking_slot_start" (mentorship_slot)
 * dentro del form padre del CouponInput.
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
  slots?: BookingSlot[];
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

/* ─────────── Mentorship slot picker (con tabs Lista / Almanaque) ─────────── */

type ViewMode = 'list' | 'month';

function SlotPicker({
  label, required, primary, slots
}: {
  label: string; required: boolean; primary: string; slots: BookingSlot[];
}) {
  const [selected, setSelected] = useState<string>('');
  const [view, setView] = useState<ViewMode>('month');

  // Agrupamos por día (YYYY-MM-DD)
  const groups = useMemo(() => {
    const m = new Map<string, BookingSlot[]>();
    for (const s of slots) {
      const d = s.start.slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(s);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  // Set de días que tienen al menos un slot disponible (no tomado)
  const availableDaysSet = useMemo(() => {
    const set = new Set<string>();
    for (const [day, daySlots] of groups) {
      if (daySlots.some((s) => !s.taken)) set.add(day);
    }
    return set;
  }, [groups]);

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠️ Por ahora no hay slots disponibles para reservar.
        {required && <div className="mt-1">La publicación requiere reserva — pediles a los compradores que vuelvan más tarde o avisale al instructor.</div>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs text-black/60">
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
        <div className="inline-flex rounded-md border border-black/15 overflow-hidden text-[11px]">
          <button type="button" onClick={() => setView('month')}
            className={`px-2.5 py-1 ${view === 'month' ? 'bg-black text-white' : 'bg-white text-black/60 hover:bg-black/5'}`}>
            📅 Almanaque
          </button>
          <button type="button" onClick={() => setView('list')}
            className={`px-2.5 py-1 border-l border-black/15 ${view === 'list' ? 'bg-black text-white' : 'bg-white text-black/60 hover:bg-black/5'}`}>
            ☰ Lista
          </button>
        </div>
      </div>

      <input
        type="hidden"
        name="booking_slot_start"
        value={selected}
        required={required}
      />

      {view === 'list' ? (
        <ListView groups={groups} selected={selected} setSelected={setSelected} primary={primary} />
      ) : (
        <MonthView groups={groups} availableDaysSet={availableDaysSet}
          selected={selected} setSelected={setSelected} primary={primary} />
      )}

      {selected && (
        <p className="text-xs text-emerald-700 mt-2">
          ✓ Reservaste: {new Date(selected).toLocaleString('es-AR', {
            weekday: 'short', day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit'
          })}
        </p>
      )}
    </div>
  );
}

/* ─────────── Vista lista (acordeón por día) ─────────── */

function ListView({
  groups, selected, setSelected, primary
}: {
  groups: Array<[string, BookingSlot[]]>;
  selected: string;
  setSelected: (s: string) => void;
  primary: string;
}) {
  const [openDay, setOpenDay] = useState<string | null>(groups[0]?.[0] ?? null);
  return (
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
                {daySlots.map((s) => (
                  <TimeChip key={s.start} slot={s} selected={selected === s.start}
                    onClick={() => setSelected(selected === s.start ? '' : s.start)} primary={primary} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── Vista almanaque (grid de mes, navegación con flechas) ─────────── */

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

function MonthView({
  groups, availableDaysSet, selected, setSelected, primary
}: {
  groups: Array<[string, BookingSlot[]]>;
  availableDaysSet: Set<string>;
  selected: string;
  setSelected: (s: string) => void;
  primary: string;
}) {
  // Empezamos el mes en el primer día con slots disponibles, o el mes actual
  const firstAvailable = groups[0]?.[0];
  const initialDate = firstAvailable
    ? new Date(firstAvailable + 'T12:00:00')
    : new Date();
  const [cursorYM, setCursorYM] = useState<{ y: number; m: number }>({
    y: initialDate.getFullYear(),
    m: initialDate.getMonth()
  });
  const [pickedDay, setPickedDay] = useState<string | null>(
    selected ? selected.slice(0, 10) : null
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function prevMonth() {
    setCursorYM((c) => {
      if (c.m === 0) return { y: c.y - 1, m: 11 };
      return { y: c.y, m: c.m - 1 };
    });
  }
  function nextMonth() {
    setCursorYM((c) => {
      if (c.m === 11) return { y: c.y + 1, m: 0 };
      return { y: c.y, m: c.m + 1 };
    });
  }

  // Generar grid del mes: empieza en Lunes
  const firstOfMonth = new Date(cursorYM.y, cursorYM.m, 1);
  // 0 = domingo, queremos lunes=0, así que ajustamos
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(cursorYM.y, cursorYM.m + 1, 0).getDate();

  const cells: Array<{ day: number; ymd: string; isPast: boolean; isAvailable: boolean } | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(cursorYM.y, cursorYM.m, d);
    const ymd = `${cursorYM.y}-${String(cursorYM.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      ymd,
      isPast: dateObj < today,
      isAvailable: availableDaysSet.has(ymd)
    });
  }

  const pickedSlots = pickedDay
    ? (groups.find(([k]) => k === pickedDay)?.[1] ?? [])
    : [];

  return (
    <div className="rounded-lg border border-black/15 bg-white p-3 space-y-3">
      {/* Header con navegación */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth}
          className="p-1.5 rounded hover:bg-black/5 text-black/60"
          aria-label="Mes anterior">
          ←
        </button>
        <div className="font-semibold text-sm capitalize">
          {MONTH_NAMES[cursorYM.m]} {cursorYM.y}
        </div>
        <button type="button" onClick={nextMonth}
          className="p-1.5 rounded hover:bg-black/5 text-black/60"
          aria-label="Mes siguiente">
          →
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 text-[10px] text-black/45 text-center font-semibold">
        {WEEKDAY_LABELS.map((w) => <div key={w}>{w}</div>)}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={`e${i}`} className="aspect-square" />;
          const isSelected = pickedDay === c.ymd;
          const disabled = c.isPast || !c.isAvailable;
          return (
            <button
              key={c.ymd}
              type="button"
              disabled={disabled}
              onClick={() => setPickedDay(isSelected ? null : c.ymd)}
              className={`aspect-square rounded text-sm font-medium transition relative ${
                isSelected
                  ? 'text-white shadow'
                  : disabled
                    ? 'text-black/25 cursor-not-allowed'
                    : 'hover:bg-black/5 text-black border border-transparent hover:border-black/15'
              }`}
              style={isSelected ? { background: primary } : undefined}
            >
              {c.day}
              {c.isAvailable && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: primary }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Slots del día seleccionado */}
      {pickedDay && (
        <div className="pt-2 border-t border-black/10">
          <div className="text-xs text-black/55 mb-2">
            Horarios para <strong className="capitalize">
              {new Date(pickedDay + 'T12:00:00').toLocaleDateString('es-AR', {
                weekday: 'long', day: '2-digit', month: 'long'
              })}
            </strong>:
          </div>
          {pickedSlots.length === 0 ? (
            <div className="text-xs text-black/45 italic">Sin horarios.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {pickedSlots.map((s) => (
                <TimeChip key={s.start} slot={s} selected={selected === s.start}
                  onClick={() => setSelected(selected === s.start ? '' : s.start)} primary={primary} />
              ))}
            </div>
          )}
        </div>
      )}
      {!pickedDay && (
        <p className="text-[11px] text-black/45 text-center pt-1">
          Tocá un día con punto para ver los horarios.
        </p>
      )}
    </div>
  );
}

/* ─────────── Chip de horario reutilizable ─────────── */

function TimeChip({
  slot, selected, onClick, primary
}: {
  slot: BookingSlot; selected: boolean; onClick: () => void; primary: string;
}) {
  const time = new Date(slot.start).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit'
  });
  return (
    <button
      type="button"
      disabled={slot.taken}
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded border transition ${
        selected
          ? 'text-white border-transparent'
          : slot.taken
            ? 'border-black/10 text-black/30 line-through cursor-not-allowed'
            : 'border-black/15 hover:border-black/40'
      }`}
      style={selected ? { background: primary } : undefined}
      title={slot.taken ? 'Ocupado' : ''}
    >
      {time}
    </button>
  );
}
