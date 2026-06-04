import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { addAvailabilityRuleAction, deleteAvailabilityRuleAction } from "@/lib/calendar/actions";
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
  const { data: rulesRaw } = await svc
    .from('availability_rules')
    .select('id, tenant_id, weekday, start_min, end_min, slot_duration_min, timezone')
    .eq('tenant_id', tenant.id)
    .order('weekday', { ascending: true }).order('start_min', { ascending: true });
  const rules = (rulesRaw ?? []) as AvailabilityRule[];

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

  // Cursos para mostrar nombre en la lista de bookings
  const { data: coursesRaw } = await svc
    .from('courses').select('id, title').eq('tenant_id', tenant.id);
  const courseMap = new Map(((coursesRaw ?? []) as Array<{ id: string; title: string }>)
    .map((c) => [c.id, c]));

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
