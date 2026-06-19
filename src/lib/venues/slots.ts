/** Generación de slots disponibles por sede + fecha (sin acceso a DB). */

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type HourRange = { from: string; to: string }; // "HH:MM"
export type VenueHours = Partial<Record<DayKey, HourRange[]>>;

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves',
  fri: 'Viernes', sat: 'Sábado', sun: 'Domingo'
};
export const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function dayKeyForDate(yyyyMmDd: string): DayKey {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // 0=domingo, 1=lunes, ..., 6=sábado
  const map: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[dt.getUTCDay()];
}

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}
function minutesToHhmm(n: number): string {
  const h = Math.floor(n / 60).toString().padStart(2, '0');
  const m = (n % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Genera los slots de inicio para un venue + fecha, excluyendo:
 * - Fechas bloqueadas (blackouts)
 * - Días sin horarios configurados → devuelve [] (vacío = todo el día disponible
 *   sería peligroso, mejor obligar al owner a configurar al menos algo)
 * - Slots ya tomados (takenStartTimes)
 *
 * Si el venue no tiene NINGÚN día configurado (hours = {}), asume disponibilidad
 * abierta y genera slots cada slot_minutes entre 10:00 y 22:00 como fallback.
 */
export function generateVenueSlots(opts: {
  date: string;                          // YYYY-MM-DD
  hours: VenueHours;
  blackoutDates: string[];
  slotMinutes: number;
  takenStartTimes?: string[];
}): string[] {
  const { date, hours, blackoutDates, slotMinutes, takenStartTimes = [] } = opts;
  if (blackoutDates.includes(date)) return [];

  const hasAnyHours = Object.keys(hours).some((k) => (hours[k as DayKey]?.length ?? 0) > 0);
  let ranges: HourRange[];
  if (!hasAnyHours) {
    ranges = [{ from: '10:00', to: '22:00' }]; // fallback abierto
  } else {
    const k = dayKeyForDate(date);
    ranges = hours[k] ?? [];
  }
  if (ranges.length === 0) return [];

  const taken = new Set(takenStartTimes);
  const out: string[] = [];
  for (const r of ranges) {
    const from = hhmmToMinutes(r.from);
    const to = hhmmToMinutes(r.to);
    for (let t = from; t + slotMinutes <= to; t += slotMinutes) {
      const s = minutesToHhmm(t);
      if (!taken.has(s)) out.push(s);
    }
  }
  return out;
}
