import Link from "next/link";
import { requireInstructor } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type Row = {
  id: string; course_id: string; slot_start: string; slot_end: string;
  buyer_name: string | null; buyer_email: string | null;
};

export default async function InstructorSchedule() {
  const { userId, tenant } = await requireInstructor();
  const svc = getServiceClient();

  const { data: aRaw } = await svc
    .from('course_instructors')
    .select('course_id, courses ( id, title )')
    .eq('tenant_id', tenant.id).eq('user_id', userId);
  const assigns = (aRaw ?? []) as Array<{ course_id: string; courses: { id: string; title: string } | null }>;
  const courseIds = assigns.map((a) => a.course_id);
  const courseMap = new Map(assigns.filter((a) => a.courses).map((a) => [a.course_id, a.courses!]));

  let rows: Row[] = [];
  if (courseIds.length > 0) {
    try {
      const { data } = await svc
        .from('bookings')
        .select('id, course_id, slot_start, slot_end, buyer_name, buyer_email')
        .in('course_id', courseIds)
        .gte('slot_start', new Date().toISOString())
        .neq('status', 'cancelled')
        .order('slot_start', { ascending: true })
        .limit(200);
      rows = (data ?? []) as Row[];
    } catch { /* migration 0012 falta */ }
  }

  // Agrupado por día
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const day = r.slot_start.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(r);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Agenda</h1>
        <p className="text-white/60 text-sm mt-1">
          Todas tus próximas reservas en todos los publicaciones que tenés asignados, ordenadas por día.
        </p>
      </div>
      {groups.size === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/40 text-sm">
          No tenés reservas próximas.
        </div>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([day, dayRows]) => {
            const date = new Date(day + 'T12:00:00');
            const dayLabel = date.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' });
            return (
              <div key={day}>
                <h3 className="font-semibold capitalize mb-2">{dayLabel}</h3>
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {dayRows.map((r) => (
                        <tr key={r.id} className="border-t border-white/5 first:border-t-0">
                          <td className="px-3 py-2 font-mono w-20 whitespace-nowrap">
                            {new Date(r.slot_start).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-2 text-white/70">{r.buyer_name ?? r.buyer_email ?? '—'}</td>
                          <td className="px-3 py-2 text-white/60 text-xs">
                            <Link href={`/instructor/courses/${r.course_id}`} className="hover:text-white underline-offset-2 hover:underline">
                              {courseMap.get(r.course_id)?.title ?? '—'}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
