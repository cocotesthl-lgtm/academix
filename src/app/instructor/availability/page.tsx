import { requireInstructor } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import {
  addInstructorAvailabilityAction,
  deleteInstructorAvailabilityAction
} from "@/lib/instructors/availability";
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

export default async function InstructorAvailability() {
  const { userId, tenant } = await requireInstructor();
  const svc = getServiceClient();

  let rules: AvailabilityRule[] = [];
  let migrationMissing = false;
  try {
    const { data, error } = await svc
      .from('availability_rules')
      .select('id, tenant_id, weekday, start_min, end_min, slot_duration_min, timezone')
      .eq('tenant_id', tenant.id)
      .eq('instructor_user_id', userId)
      .order('weekday', { ascending: true }).order('start_min', { ascending: true });
    if (error) migrationMissing = true;
    else rules = (data ?? []) as AvailabilityRule[];
  } catch { migrationMissing = true; }

  if (migrationMissing) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold">Mi disponibilidad</h1>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
          <p className="font-semibold mb-2">⚠️ Migración pendiente</p>
          <p className="text-sm">El owner tiene que correr la migración 0015 en Supabase. Avisale.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Mi disponibilidad</h1>
        <p className="text-white/60 text-sm mt-1">
          Tus horarios semanales recurrentes. Los compradores ven la <strong>unión</strong> de
          los horarios de todos los instructores asignados al publicación. Si sos el único asignado,
          solo se ven los tuyos.
        </p>
      </div>

      <form action={addInstructorAvailabilityAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <h2 className="font-semibold text-sm">+ Agregar bloque</h2>
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

      <div>
        <h2 className="font-semibold mb-3">Tus bloques</h2>
        {rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-white/40 text-sm">
            Todavía no agregaste horarios. Los compradores no van a ver slots tuyos hasta que sumes alguno.
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
                  <form action={deleteInstructorAvailabilityAction}>
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
    </div>
  );
}
