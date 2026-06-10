import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import {
  addAvailabilityRuleAction, deleteAvailabilityRuleAction,
  addOwnerCalendarDateAction, deleteOwnerCalendarDateAction,
  addOwnerOverrideAction, deleteOwnerOverrideAction
} from "@/lib/calendar/actions";
import { WEEKDAY_LABELS, minToHHMM, type AvailabilityRule } from "@/lib/calendar/types";

export const dynamic = "force-dynamic";

const TZ_OPTIONS = [
  'America/Argentina/Buenos_Aires',
  'America/Argentina/Cordoba',
  'America/Argentina/Mendoza',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Montevideo',
  'UTC'
];

export default async function AvailabilityPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  let rules: AvailabilityRule[] = [];
  let migrationMissing = false;
  try {
    const { data, error } = await svc
      .from('availability_rules')
      .select('id, tenant_id, weekday, start_min, end_min, slot_duration_min, timezone')
      .eq('tenant_id', tenant.id)
      .order('weekday', { ascending: true }).order('start_min', { ascending: true });
    if (error) migrationMissing = true;
    else rules = (data ?? []) as AvailabilityRule[];
  } catch {
    migrationMissing = true;
  }

  if (migrationMissing) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Disponibilidad</h1>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
          <p className="font-semibold mb-2">⚠️ Migración pendiente</p>
          <p className="text-sm">
            Falta correr la migración 0012_calendar.sql en Supabase.
            Pegá <code className="bg-black/30 px-1 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en
            el SQL Editor de tu proyecto Supabase y dale RUN. Después recargá esta página.
          </p>
        </div>
      </div>
    );
  }

  // Bookings activos (próximos 60 días) para que el owner los vea
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 60);
  const { data: bkRaw } = await svc
    .from('bookings')
    .select('id, course_id, slot_start, slot_end, status, buyer_email, buyer_name')
    .eq('tenant_id', tenant.id)
    .gte('slot_start', new Date().toISOString())
    .lte('slot_start', horizon.toISOString())
    .neq('status', 'cancelled')
    .order('slot_start', { ascending: true })
    .limit(100);
  const bookings = (bkRaw ?? []) as Array<{
    id: string; course_id: string; slot_start: string; slot_end: string;
    status: string; buyer_email: string | null; buyer_name: string | null;
  }>;

  // Cursos para mostrar nombre en la lista de bookings + dropdown
  const { data: coursesRaw } = await svc
    .from('courses').select('id, title').eq('tenant_id', tenant.id)
    .order('title', { ascending: true });
  const courses = (coursesRaw ?? []) as Array<{ id: string; title: string }>;
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  // Fechas puntuales + pausas (defensivo: si migration 0017 no corrió, vacío)
  let dates: Array<{
    id: string; course_id: string | null; date: string;
    start_min: number; end_min: number; slot_duration_min: number;
    timezone: string; notes: string | null;
  }> = [];
  let overrides: Array<{
    id: string; course_id: string | null; start_at: string; end_at: string;
    reason: string | null;
  }> = [];
  try {
    const [datesRes, ovRes] = await Promise.all([
      svc.from('calendar_dates')
        .select('id, course_id, date, start_min, end_min, slot_duration_min, timezone, notes')
        .eq('tenant_id', tenant.id)
        .is('instructor_user_id', null)
        .gte('date', new Date().toISOString().slice(0, 10))
        .order('date', { ascending: true }).limit(50),
      svc.from('availability_overrides')
        .select('id, course_id, start_at, end_at, reason')
        .eq('tenant_id', tenant.id)
        .is('instructor_user_id', null)
        .gte('end_at', new Date().toISOString())
        .order('start_at', { ascending: true }).limit(50)
    ]);
    dates = (datesRes.data ?? []) as typeof dates;
    overrides = (ovRes.data ?? []) as typeof overrides;
  } catch { /* migration 0017 falta */ }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Disponibilidad</h1>
        <p className="text-white/60 text-sm mt-1">
          Declará tus horarios semanales recurrentes. Los compradores van a poder
          elegir slots dentro de estos bloques cuando un curso esté configurado
          como <strong>mentoría / clase en vivo</strong>.
        </p>
      </div>

      {/* ─── Agregar regla ─── */}
      <form action={addAvailabilityRuleAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <h2 className="font-semibold text-sm">+ Agregar bloque de disponibilidad</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Día</label>
            <select name="weekday" required className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              {WEEKDAY_LABELS.map((label, idx) => (
                <option key={idx} value={idx} className="bg-[#0a0a0a]">{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Desde</label>
            <input name="start_time" type="time" required defaultValue="09:00"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Hasta</label>
            <input name="end_time" type="time" required defaultValue="18:00"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Duración slot</label>
            <select name="slot_duration_min" defaultValue="60" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              <option value="15" className="bg-[#0a0a0a]">15 min</option>
              <option value="30" className="bg-[#0a0a0a]">30 min</option>
              <option value="45" className="bg-[#0a0a0a]">45 min</option>
              <option value="60" className="bg-[#0a0a0a]">1 hora</option>
              <option value="90" className="bg-[#0a0a0a]">1.5 horas</option>
              <option value="120" className="bg-[#0a0a0a]">2 horas</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Zona horaria</label>
            <select name="timezone" defaultValue="America/Argentina/Buenos_Aires"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              {TZ_OPTIONS.map((tz) => (
                <option key={tz} value={tz} className="bg-[#0a0a0a]">{tz}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
          Agregar bloque
        </button>
        <p className="text-[11px] text-white/45">
          Ej: lunes 09:00–18:00 con slots de 60min → 9 slots de 1h por lunes.
        </p>
      </form>

      {/* ─── Reglas configuradas ─── */}
      <div>
        <h2 className="font-semibold mb-3">Bloques configurados</h2>
        {rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-white/40 text-sm">
            Todavía no agregaste disponibilidad.
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => {
              const totalMins = r.end_min - r.start_min;
              const slots = Math.floor(totalMins / r.slot_duration_min);
              return (
                <div key={r.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {WEEKDAY_LABELS[r.weekday]} · {minToHHMM(r.start_min)}–{minToHHMM(r.end_min)}
                    </div>
                    <div className="text-xs text-white/45">
                      {slots} {slots === 1 ? 'slot' : 'slots'} de {r.slot_duration_min}min · {r.timezone}
                    </div>
                  </div>
                  <form action={deleteAvailabilityRuleAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10">
                      Eliminar
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Fechas puntuales (one-off) ─── */}
      <div className="pt-6 border-t border-white/10">
        <h2 className="text-lg font-semibold mb-1">📅 Fechas puntuales</h2>
        <p className="text-xs text-white/55 mb-3">
          Para cursos / eventos que se dan en fechas concretas (no recurrentes).
          Ej: "el sábado 15 de marzo de 10 a 14".
        </p>
        <form action={addOwnerCalendarDateAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Curso</label>
              <select name="course_id" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="">Todos (tenant-wide)</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Fecha</label>
              <input name="date" type="date" required min={new Date().toISOString().slice(0, 10)}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Desde</label>
              <input name="start_time" type="time" required defaultValue="10:00"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Hasta</label>
              <input name="end_time" type="time" required defaultValue="14:00"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Duración slot</label>
              <select name="slot_duration_min" defaultValue="60" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hora</option>
                <option value="90">1.5 horas</option>
                <option value="120">2 horas</option>
                <option value="240">4 horas (evento completo)</option>
              </select>
            </div>
          </div>
          <input name="notes" type="text" maxLength={200} placeholder="Notas (opcional, ej: evento especial)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
            + Agregar fecha puntual
          </button>
        </form>

        {dates.length > 0 && (
          <div className="mt-4 space-y-2">
            {dates.map((d) => {
              const dateLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('es-AR', {
                weekday: 'short', day: '2-digit', month: 'long', year: 'numeric'
              });
              return (
                <div key={d.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm capitalize">
                      {dateLabel} · {minToHHMM(d.start_min)}–{minToHHMM(d.end_min)}
                    </div>
                    <div className="text-xs text-white/45">
                      {courseMap.get(d.course_id ?? '')?.title ?? 'Tenant-wide'} · slots de {d.slot_duration_min}min
                      {d.notes && ` · ${d.notes}`}
                    </div>
                  </div>
                  <form action={deleteOwnerCalendarDateAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10">
                      Eliminar
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Pausas / cancelaciones ─── */}
      <div className="pt-6 border-t border-white/10">
        <h2 className="text-lg font-semibold mb-1">⏸️ Pausas / cancelaciones</h2>
        <p className="text-xs text-white/55 mb-3">
          Cualquier slot que caiga en este rango queda fuera del calendario.
          Usalo para vacaciones, feriados, emergencias o cancelar un curso puntual.
        </p>
        <form action={addOwnerOverrideAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Curso afectado</label>
              <select name="course_id" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="">Todos (tenant-wide)</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Desde</label>
              <input name="start_at" type="datetime-local" required
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Hasta</label>
              <input name="end_at" type="datetime-local" required
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
          </div>
          <input name="reason" type="text" maxLength={200} placeholder="Motivo (opcional, ej: vacaciones)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <button className="rounded bg-amber-500 text-black text-sm font-semibold px-4 py-2 hover:bg-amber-400">
            + Agregar pausa
          </button>
          <p className="text-[11px] text-white/45">
            ⚠️ Esto NO cancela bookings ya tomados. Para reagendar reservas existentes, usá el panel del instructor.
          </p>
        </form>

        {overrides.length > 0 && (
          <div className="mt-4 space-y-2">
            {overrides.map((o) => (
              <div key={o.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {new Date(o.start_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' → '}
                    {new Date(o.end_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-xs text-white/55">
                    {courseMap.get(o.course_id ?? '')?.title ?? 'Toda la academia'}
                    {o.reason && ` · ${o.reason}`}
                  </div>
                </div>
                <form action={deleteOwnerOverrideAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="text-xs px-2 py-1 rounded border border-white/15 hover:bg-white/5">
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Bookings próximos ─── */}
      {bookings.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Próximas reservas</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/50 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Cuando</th>
                  <th className="text-left px-3 py-2">Curso</th>
                  <th className="text-left px-3 py-2">Comprador</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      {new Date(b.slot_start).toLocaleString('es-AR', {
                        weekday: 'short', day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-3 py-2 text-white/70">{courseMap.get(b.course_id)?.title ?? '—'}</td>
                    <td className="px-3 py-2 text-white/70">
                      {b.buyer_name ?? b.buyer_email ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
