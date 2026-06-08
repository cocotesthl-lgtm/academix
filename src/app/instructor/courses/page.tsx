import Link from "next/link";
import { requireInstructor } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function InstructorCoursesList() {
  const { userId, tenant } = await requireInstructor();
  const svc = getServiceClient();
  const { data } = await svc
    .from('course_instructors')
    .select('course_id, can_edit_calendar, can_reschedule, can_view_students, courses ( id, title, calendar_mode )')
    .eq('tenant_id', tenant.id).eq('user_id', userId);
  const assigns = (data ?? []) as Array<{
    course_id: string; can_edit_calendar: boolean; can_reschedule: boolean; can_view_students: boolean;
    courses: { id: string; title: string; calendar_mode: string | null } | null;
  }>;
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Mis cursos</h1>
      {assigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/40 text-sm">
          El owner todavía no te asignó cursos.
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
                <div>
                  <div className="font-medium">{a.courses.title}</div>
                  <div className="text-xs text-white/45 mt-0.5">
                    {a.courses.calendar_mode === 'mentorship_slot' && '🗓️ Mentoría con slots'}
                    {a.courses.calendar_mode === 'start_date' && '📅 Con fecha de inicio'}
                    {(!a.courses.calendar_mode || a.courses.calendar_mode === 'none') && '— Sin calendario'}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] flex-wrap shrink-0">
                  {a.can_view_students && <span className="px-1.5 py-0.5 rounded bg-white/5">Alumnos</span>}
                  {a.can_edit_calendar && <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-200">Calendario</span>}
                  {a.can_reschedule && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-200">Reagendar</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
