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

export type CalendarDate = {
  id: string;
  date: string;            // 'YYYY-MM-DD'
  start_min: number;
  end_min: number;
  slot_duration_min: number;
  timezone: string;
  instructor_user_id: string | null;
};

export type AvailabilityOverride = {
  id: string;
  start_at: string;        // ISO
  end_at: string;          // ISO
  instructor_user_id: string | null;
  course_id: string | null;
  reason: string | null;
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
 * Devuelve el offset (en minutos) de una timezone IANA en un momento dado.
 * Positivo si la tz está ADELANTADA respecto a UTC, negativo si atrás.
 * Ej: America/Argentina/Buenos_Aires (UTC-3) → -180.
 *
 * Usamos Intl.DateTimeFormat con timeZoneName: 'shortOffset' que en
 * navegadores modernos (>=2022) devuelve strings tipo "GMT-3" o "GMT-03:00".
 */
function tzOffsetMinutes(tz: string, atUtc: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    });
    const parts = dtf.formatToParts(atUtc);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    const match = offsetPart.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!match) return 0;
    const sign = match[1] === '+' ? 1 : -1;
    const h = parseInt(match[2], 10);
    const m = parseInt(match[3] ?? '0', 10);
    return sign * (h * 60 + m);
  } catch {
    return 0;
  }
}

/**
 * Construye un Date UTC cuya hora-de-pared en la timezone `tz` coincide con
 * year/month/day/hour/minute. Ej: si tz=Argentina, hour=9 → devuelve un
 * Date que al formatearse en Argentina muestra 09:00, internamente 12:00Z.
 */
function utcFromWallTime(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMin = tzOffsetMinutes(tz, new Date(naive));
  return new Date(naive - offsetMin * 60_000);
}

/**
 * Genera los slots disponibles a partir de las reglas + las reservas tomadas,
 * para los próximos N días.
 *
 * IMPORTANTE: respeta la timezone declarada en cada rule. Si el owner dice
 * "lunes 9:00 Argentina", el slot UTC se construye correctamente y el
 * cliente en cualquier parte del mundo lo verá en su hora local
 * correspondiente (via toLocaleString del browser).
 */
export function generateSlots(opts: {
  rules: AvailabilityRule[];
  takenSlotStarts: Set<string>;     // ISO strings de slots tomados
  horizonDays: number;
  /** Fechas puntuales (one-off). Se SUMAN a los slots recurrentes. */
  oneOffDates?: CalendarDate[];
  /** Pausas / cancelaciones. Se RESTAN del set final (cualquier slot que
   *  caiga dentro de [start_at, end_at] queda fuera). */
  overrides?: AvailabilityOverride[];
  now?: Date;
}): BookingSlot[] {
  const out: BookingSlot[] = [];
  const nowMs = (opts.now ?? new Date()).getTime();
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };

  // ─── Slots recurrentes ───
  for (let dayOffset = 0; dayOffset < opts.horizonDays; dayOffset++) {
    for (const rule of opts.rules) {
      const targetMs = nowMs + dayOffset * 86_400_000;
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: rule.timezone,
        year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
      });
      const parts = fmt.formatToParts(new Date(targetMs));
      const year = parseInt(parts.find((p) => p.type === 'year')?.value ?? '0', 10);
      const month = parseInt(parts.find((p) => p.type === 'month')?.value ?? '0', 10);
      const day = parseInt(parts.find((p) => p.type === 'day')?.value ?? '0', 10);
      const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? '';
      const weekdayInTz = weekdayMap[weekdayStr] ?? 0;
      if (rule.weekday !== weekdayInTz) continue;

      for (let m = rule.start_min; m + rule.slot_duration_min <= rule.end_min; m += rule.slot_duration_min) {
        const hour = Math.floor(m / 60);
        const min = m % 60;
        const slotStart = utcFromWallTime(year, month, day, hour, min, rule.timezone);
        if (slotStart.getTime() <= nowMs) continue;
        const slotEnd = new Date(slotStart.getTime() + rule.slot_duration_min * 60_000);
        const startIso = slotStart.toISOString();
        out.push({
          start: startIso,
          end: slotEnd.toISOString(),
          taken: opts.takenSlotStarts.has(startIso)
        });
      }
    }
  }

  // ─── Slots de fechas puntuales (one-off) ───
  for (const dt of opts.oneOffDates ?? []) {
    const [yStr, mStr, dStr] = dt.date.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const day = parseInt(dStr, 10);
    if (!year || !month || !day) continue;
    for (let m = dt.start_min; m + dt.slot_duration_min <= dt.end_min; m += dt.slot_duration_min) {
      const hour = Math.floor(m / 60);
      const min = m % 60;
      const slotStart = utcFromWallTime(year, month, day, hour, min, dt.timezone);
      if (slotStart.getTime() <= nowMs) continue;
      const slotEnd = new Date(slotStart.getTime() + dt.slot_duration_min * 60_000);
      const startIso = slotStart.toISOString();
      out.push({
        start: startIso,
        end: slotEnd.toISOString(),
        taken: opts.takenSlotStarts.has(startIso)
      });
    }
  }

  // ─── Aplicar overrides (pausas/cancelaciones) ───
  // Cualquier slot cuyo start cae dentro de [override.start_at, override.end_at]
  // se descarta.
  const overrides = opts.overrides ?? [];
  const filtered = overrides.length === 0 ? out : out.filter((slot) => {
    const slotMs = new Date(slot.start).getTime();
    return !overrides.some((ov) => {
      const a = new Date(ov.start_at).getTime();
      const b = new Date(ov.end_at).getTime();
      return slotMs >= a && slotMs < b;
    });
  });

  return filtered.sort((a, b) => a.start.localeCompare(b.start));
}
