import Link from "next/link";
import { requireInstructor } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type AssignedCourse = {
  course_id: string;
  can_edit_calendar: boolean;
  can_reschedule: boolean;
  can_view_students: boolean;
  courses: { id: string; title: string; slug: string; calendar_mode: string | null } | null;
};

type BookingRow = {
  id: string;
  course_id: string;
  slot_start: string;
  buyer_name: string | null;
  buyer_email: string | null;
};

export default async function InstructorDashboard() {
  const { userId, tenant } = await requireInstructor();
  const svc = getServiceClient();

  // Publicaciones asignados (intento con calendar_mode; fallback sin si migration 0012 falta)
  let assigns: AssignedCourse[] = [];
  try {
    const { data, error } = await svc
      .from('course_instructors')
      .select('course_id, can_edit_calendar, can_reschedule, can_view_students, courses ( id, title, slug, calendar_mode )')
      .eq('tenant_id', tenant.id).eq('user_id', userId);
    if (!error) assigns = (data ?? []) as AssignedCourse[];
  } catch { /* migration pending */ }

  const courseIds = assigns.map((a) => a.course_id);

  // Próximas reservas en esas publicaciones
  let upcoming: BookingRow[] = [];
  if (courseIds.length > 0) {
    try {
      const { data } = await svc
        .from('bookings')
        .select('id, course_id, slot_start, buyer_name, buyer_email')
        .in('course_id', courseIds)
        .gte('slot_start', new Date().toISOString())
        .neq('status', 'cancelled')
        .order('slot_start', { ascending: true })
        .limit(10);
      upcoming = (data ?? []) as BookingRow[];
    } catch { /* tabla bookings no existe (migration 0012) */ }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Hola, esto es lo que tenés</h1>
        <p className="text-white/60 text-sm mt-1">
          Publicaciones asignados por el owner de <strong>{tenant.name}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Publicaciones asignados" value={assigns.length.toString()} />
        <Stat label="Próximas reservas" value={upcoming.length.toString()} />
        <Stat label="Con permiso reagendar" value={assigns.filter((a) => a.can_reschedule).length.toString()} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Tus publicaciones</h2>
        {assigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/40 text-sm">
            El owner todavía no te asignó publicaciones.
          </div>
        ) : (
          <div className="space-y-2">
            {assigns.map((a) => a.courses && (
              <Link
                key={a.course_id}
                href={`/instructor/courses/${a.course_id}`}
                className="block rounded-lg border border-white/10 bg-white/[0.02] p-4 hover:border-white/30 hover:bg-white/[0.04] transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{a.courses.title}</div>
                    <div className="text-xs text-white/45 mt-0.5">
                      {a.courses.calendar_mode === 'mentorship_slot' && '🗓️ Mentoría con slots'}
                      {a.courses.calendar_mode === 'start_date' && '📅 Con fecha de inicio'}
                      {(!a.courses.calendar_mode || a.courses.calendar_mode === 'none') && '— Sin calendario'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] flex-wrap shrink-0">
                    {a.can_view_students && <span className="px-1.5 py-0.5 rounded bg-white/5">Ver alumnos</span>}
                    {a.can_edit_calendar && <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-amber-300">Editar cal.</span>}
                    {a.can_reschedule && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-200">Reagendar</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Próximas reservas</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/50 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Cuándo</th>
                  <th className="text-left px-3 py-2">Alumno</th>
                  <th className="text-left px-3 py-2">Publicación</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((b) => {
                  const course = assigns.find((a) => a.course_id === b.course_id)?.courses;
                  return (
                    <tr key={b.id} className="border-t border-white/5">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(b.slot_start).toLocaleString('es-AR', {
                          weekday: 'short', day: '2-digit', month: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-3 py-2 text-white/70">{b.buyer_name ?? b.buyer_email ?? '—'}</td>
                      <td className="px-3 py-2 text-white/70">
                        {course
                          ? <Link href={`/instructor/courses/${b.course_id}`} className="hover:text-white underline-offset-2 hover:underline">{course.title}</Link>
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl md:text-3xl font-bold mt-1 font-mono">{value}</div>
    </div>
  );
}
