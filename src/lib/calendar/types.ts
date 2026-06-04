export type CalendarMode = 'none' | 'start_date' | 'mentorship_slot';

export type AvailabilityRule = {
  id: string;
  tenant_id: string;
  weekday: number;          // 0=domingo, 6=sábado
  start_min: number;        // 540 = 09:00
  end_min: number;          // 1080 = 18:00
  slot_duration_min: number;
  timezone: string;
};

export type BookingSlot = {
  start: string;  // ISO
  end: string;    // ISO
  taken: boolean;
};

export const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Convierte 540 → "09:00" */
export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convierte "09:00" → 540 */
export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.min(1440, Math.max(0, h * 60 + m));
}

/**
 * Genera los slots disponibles a partir de las reglas + las reservas tomadas,
 * para los próximos N días. Marca taken=true en los que ya hay booking.
 *
 * NOTA dev: usamos la timezone del rule para construir el slot_start. En prod
 * Argentina (UTC-3 todo el año) esto funciona bien. Para tenants con horario
 * de verano hay que ajustar.
 */
export function generateSlots(opts: {
  rules: AvailabilityRule[];
  takenSlotStarts: Set<string>;  // ISO strings de slots tomados
  horizonDays: number;
  now?: Date;
}): BookingSlot[] {
  const out: BookingSlot[] = [];
  const start = opts.now ?? new Date();
  start.setSeconds(0, 0);

  for (let dayOffset = 0; dayOffset < opts.horizonDays; dayOffset++) {
    const day = new Date(start);
    day.setDate(day.getDate() + dayOffset);
    const weekday = day.getDay();

    const dayRules = opts.rules.filter((r) => r.weekday === weekday);
    for (const rule of dayRules) {
      for (let m = rule.start_min; m + rule.slot_duration_min <= rule.end_min; m += rule.slot_duration_min) {
        const slotStart = new Date(day);
        slotStart.setHours(Math.floor(m / 60), m % 60, 0, 0);
        // Slots en el pasado (mismo día) los salteamos.
        if (slotStart.getTime() <= Date.now()) continue;
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + rule.slot_duration_min);
        const startIso = slotStart.toISOString();
        out.push({
          start: startIso,
          end: slotEnd.toISOString(),
          taken: opts.takenSlotStarts.has(startIso)
        });
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
