import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  ownerAddAvailabilityAction,
  ownerDeleteAvailabilityAction,
  ownerAddCalendarDateAction,
  ownerDeleteCalendarDateAction,
  ownerAddOverrideAction,
  ownerDeleteOverrideAction
} from '@/lib/instructors/availability';
import { WEEKDAY_LABELS, minToHHMM } from '@/lib/calendar/types';

export const dynamic = 'force-dynamic';

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

type RuleRow = {
  id: string;
  weekday: number;
  start_min: number;
  end_min: number;
  slot_duration_min: number;
  timezone: string;
};

type DateRow = {
  id: string;
  date: string;
  start_min: number;
  end_min: number;
  slot_duration_min: number;
  timezone: string;
  notes: string | null;
};

type OverrideRow = {
  id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
};

export default async function OwnerInstructorCalendarPage({
  params
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: instructorUserId } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Verificar que es un instructor activo del tenant + traer datos del perfil
  const { data: mem } = await svc
    .from('memberships')
    .select('user_id, profiles ( email, display_name, full_name )')
    .eq('tenant_id', tenant.id)
    .eq('user_id', instructorUserId)
    .eq('role', 'instructor')
    .eq('status', 'active')
    .maybeSingle<{
      user_id: string;
      profiles: { email: string | null; display_name: string | null; full_name: string | null } | null;
    }>();
  if (!mem) notFound();

  const displayName =
    mem.profiles?.display_name ||
    mem.profiles?.full_name ||
    mem.profiles?.email ||
    'Instructor';
  const email = mem.profiles?.email ?? '—';

  const [{ data: rulesRaw }, { data: datesRaw }, { data: ovrRaw }] = await Promise.all([
    svc.from('availability_rules')
      .select('id, weekday, start_min, end_min, slot_duration_min, timezone')
      .eq('tenant_id', tenant.id).eq('instructor_user_id', instructorUserId)
      .order('weekday', { ascending: true }).order('start_min', { ascending: true }),
    svc.from('calendar_dates')
      .select('id, date, start_min, end_min, slot_duration_min, timezone, notes')
      .eq('tenant_id', tenant.id).eq('instructor_user_id', instructorUserId)
      .order('date', { ascending: true }),
    svc.from('availability_overrides')
      .select('id, start_at, end_at, reason')
      .eq('tenant_id', tenant.id).eq('instructor_user_id', instructorUserId)
      .order('start_at', { ascending: true })
  ]);
  const rules = (rulesRaw ?? []) as RuleRow[];
  const dates = (datesRaw ?? []) as DateRow[];
  const overrides = (ovrRaw ?? []) as OverrideRow[];

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/owner/equipo" className="text-xs text-white/50 hover:text-white/80">
          ← Volver a equipo
        </Link>
        <h1 className="text-2xl font-bold mt-1">📅 Calendario de {displayName}</h1>
        <p className="text-white/60 text-sm mt-1">
          {email} · Editá los horarios de trabajo semanales, agregá fechas puntuales y marcá pausas (francos, vacaciones, feriados) del instructor.
        </p>
      </div>

      {/* ─── Horarios semanales (horas de trabajo) ─── */}
      <section className="space-y-4">
        <h2 className="font-semibold text-lg">Horas de trabajo (semanal)</h2>
        <form action={ownerAddAvailabilityAction}
          className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <input type="hidden" name="instructor_user_id" value={instructorUserId} />
          <h3 className="font-semibold text-sm">+ Agregar bloque semanal</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Día</label>
              <select name="weekday" required className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                {WEEKDAY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
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
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hora</option>
                <option value="90">1.5 horas</option>
                <option value="120">2 horas</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Zona horaria</label>
              <select name="timezone" defaultValue="America/Argentina/Buenos_Aires"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                {TZ_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
          <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
            Agregar bloque
          </button>
        </form>

        {rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-white/40 text-sm">
            Sin horarios semanales cargados.
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => {
              const slots = Math.floor((r.end_min - r.start_min) / r.slot_duration_min);
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
                  <form action={ownerDeleteAvailabilityAction}>
                    <input type="hidden" name="instructor_user_id" value={instructorUserId} />
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
      </section>

      {/* ─── Fechas puntuales (tiempos libres extras) ─── */}
      <section className="space-y-4">
        <h2 className="font-semibold text-lg">Fechas puntuales</h2>
        <p className="text-xs text-white/50 -mt-2">
          Días sueltos con disponibilidad extra que no siguen la agenda semanal (ej. sábado especial, feriado abierto).
        </p>
        <form action={ownerAddCalendarDateAction}
          className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <input type="hidden" name="instructor_user_id" value={instructorUserId} />
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Fecha</label>
              <input name="date" type="date" required
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
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
              <select name="slot_duration_min" defaultValue="60"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hora</option>
                <option value="90">1.5 horas</option>
                <option value="120">2 horas</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Nota</label>
              <input name="notes" type="text" placeholder="opcional"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
          </div>
          <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
            Agregar fecha
          </button>
        </form>

        {dates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-white/40 text-sm">
            Sin fechas puntuales.
          </div>
        ) : (
          <div className="space-y-2">
            {dates.map((d) => (
              <div key={d.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {d.date} · {minToHHMM(d.start_min)}–{minToHHMM(d.end_min)}
                  </div>
                  <div className="text-xs text-white/45">
                    slots de {d.slot_duration_min}min · {d.timezone}
                    {d.notes && ` · ${d.notes}`}
                  </div>
                </div>
                <form action={ownerDeleteCalendarDateAction}>
                  <input type="hidden" name="instructor_user_id" value={instructorUserId} />
                  <input type="hidden" name="id" value={d.id} />
                  <button className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10">
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Pausas / francos / vacaciones ─── */}
      <section className="space-y-4">
        <h2 className="font-semibold text-lg">Francos y pausas</h2>
        <p className="text-xs text-white/50 -mt-2">
          Bloquea un rango de horas o días — el instructor no aparece disponible en ese período (vacaciones, franco médico, feriados).
        </p>
        <form action={ownerAddOverrideAction}
          className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <input type="hidden" name="instructor_user_id" value={instructorUserId} />
          <div className="grid sm:grid-cols-3 gap-3">
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
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Motivo</label>
              <input name="reason" type="text" placeholder="ej. Vacaciones, Franco"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
          </div>
          <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
            Agregar pausa
          </button>
        </form>

        {overrides.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-white/40 text-sm">
            Sin pausas ni francos programados.
          </div>
        ) : (
          <div className="space-y-2">
            {overrides.map((o) => (
              <div key={o.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {new Date(o.start_at).toLocaleString('es-AR')} → {new Date(o.end_at).toLocaleString('es-AR')}
                  </div>
                  {o.reason && <div className="text-xs text-white/45">{o.reason}</div>}
                </div>
                <form action={ownerDeleteOverrideAction}>
                  <input type="hidden" name="instructor_user_id" value={instructorUserId} />
                  <input type="hidden" name="id" value={o.id} />
                  <button className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10">
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
