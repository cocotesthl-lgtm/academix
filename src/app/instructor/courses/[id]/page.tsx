import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInstructor } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { generateSlots, type AvailabilityRule, type BookingSlot } from "@/lib/calendar/types";
import { BookingRow } from "@/components/instructor/BookingRow";

export const dynamic = "force-dynamic";

export default async function InstructorCourseDetail({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseId } = await params;
  const { userId, tenant } = await requireInstructor();
  const svc = getServiceClient();

  // Verificar que el instructor tiene esta asignación + traer permisos
  const { data: assign } = await svc
    .from('course_instructors')
    .select('can_edit_calendar, can_reschedule, can_view_students')
    .eq('tenant_id', tenant.id)
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle<{ can_edit_calendar: boolean; can_reschedule: boolean; can_view_students: boolean }>();
  if (!assign) notFound();

  const { data: course } = await svc
    .from('courses')
    .select('id, slug, title, calendar_mode, calendar_horizon_days')
    .eq('id', courseId).eq('tenant_id', tenant.id)
    .maybeSingle<{ id: string; slug: string; title: string; calendar_mode: string | null; calendar_horizon_days: number | null }>();
  if (!course) notFound();

  // Bookings de este curso (próximos + recientes)
  let upcoming: Array<{
    id: string; slot_start: string; slot_end: string; status: string;
    buyer_name: string | null; buyer_email: string | null;
  }> = [];
  let past: typeof upcoming = [];
  try {
    const { data: upRaw } = await svc
      .from('bookings')
      .select('id, slot_start, slot_end, status, buyer_name, buyer_email')
      .eq('course_id', courseId).eq('tenant_id', tenant.id)
      .gte('slot_start', new Date().toISOString())
      .neq('status', 'cancelled')
      .order('slot_start', { ascending: true })
      .limit(50);
    upcoming = (upRaw ?? []) as typeof upcoming;
    const { data: pastRaw } = await svc
      .from('bookings')
      .select('id, slot_start, slot_end, status, buyer_name, buyer_email')
      .eq('course_id', courseId).eq('tenant_id', tenant.id)
      .lt('slot_start', new Date().toISOString())
      .order('slot_start', { ascending: false })
      .limit(10);
    past = (pastRaw ?? []) as typeof past;
  } catch { /* migration 0012 pending */ }

  // Alumnos inscriptos (si tiene permiso)
  let students: Array<{
    id: string; created_at: string; status: string;
    buyer_name: string | null; buyer_email: string | null; buyer_phone: string | null;
  }> = [];
  if (assign.can_view_students) {
    const { data } = await svc
      .from('enrollments')
      .select('id, created_at, status, buyer_name, buyer_email, buyer_phone')
      .eq('course_id', courseId).eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(200);
    students = (data ?? []) as typeof students;
  }

  // Slots disponibles para reschedule (si permite + curso es mentorship)
  let availableSlots: BookingSlot[] = [];
  if (assign.can_reschedule && course.calendar_mode === 'mentorship_slot') {
    try {
      const horizon = course.calendar_horizon_days ?? 30;
      const horizonDate = new Date();
      horizonDate.setDate(horizonDate.getDate() + horizon);
      const [rulesRes, takenRes] = await Promise.all([
        svc.from('availability_rules')
          .select('id, tenant_id, weekday, start_min, end_min, slot_duration_min, timezone')
          .eq('tenant_id', tenant.id),
        svc.from('bookings')
          .select('slot_start')
          .eq('tenant_id', tenant.id)
          .neq('status', 'cancelled')
          .gte('slot_start', new Date().toISOString())
          .lte('slot_start', horizonDate.toISOString())
      ]);
      const rules = (rulesRes.data ?? []) as AvailabilityRule[];
      const takenSet = new Set(((takenRes.data ?? []) as Array<{ slot_start: string }>).map((b) => b.slot_start));
      availableSlots = generateSlots({ rules, takenSlotStarts: takenSet, horizonDays: horizon });
    } catch { /* idem */ }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-3 text-sm text-white/50">
        <Link href="/instructor/courses" className="hover:text-white">← Mis cursos</Link>
        <span>/</span>
        <span className="text-white">{course.title}</span>
      </div>

      <div className="flex items-center gap-2 text-[10px] flex-wrap">
        {assign.can_view_students && <span className="px-2 py-1 rounded bg-white/5 border border-white/15">Ver alumnos</span>}
        {assign.can_edit_calendar && <span className="px-2 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-200">Editar calendario</span>}
        {assign.can_reschedule && <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-200">Reagendar</span>}
        {!assign.can_view_students && !assign.can_edit_calendar && !assign.can_reschedule && (
          <span className="text-white/40">Solo lectura — el owner no te dio permisos extra.</span>
        )}
      </div>

      {/* ─── Reservas próximas ─── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">📅 Próximas reservas ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-white/40 rounded-xl border border-dashed border-white/15 p-6 text-center">
            No hay reservas próximas.
          </p>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/50 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Cuándo</th>
                  <th className="text-left px-3 py-2">Alumno</th>
                  <th className="text-right px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    canReschedule={assign.can_reschedule}
                    availableSlots={availableSlots}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Alumnos inscriptos ─── */}
      {assign.can_view_students && (
        <section>
          <h2 className="text-lg font-semibold mb-3">👥 Alumnos inscriptos ({students.length})</h2>
          {students.length === 0 ? (
            <p className="text-sm text-white/40 rounded-xl border border-dashed border-white/15 p-6 text-center">
              Sin alumnos inscriptos todavía.
            </p>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-white/50 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Nombre</th>
                    <th className="text-left px-3 py-2">Email</th>
                    <th className="text-left px-3 py-2">Teléfono</th>
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-t border-white/5">
                      <td className="px-3 py-2 font-medium">{s.buyer_name ?? '—'}</td>
                      <td className="px-3 py-2 text-white/70">
                        {s.buyer_email
                          ? <a href={`mailto:${s.buyer_email}`} className="hover:text-white underline-offset-2 hover:underline">{s.buyer_email}</a>
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-white/70">
                        {s.buyer_phone
                          ? <a href={`https://wa.me/${s.buyer_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="hover:text-white underline-offset-2 hover:underline">{s.buyer_phone}</a>
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-white/50 text-xs whitespace-nowrap">
                        {new Date(s.created_at).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-3 py-2 text-xs">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ─── Past reservas (resumen) ─── */}
      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-white/55 hover:text-white">
            Ver últimas {past.length} reservas pasadas →
          </summary>
          <div className="mt-3 rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {past.map((b) => (
                  <tr key={b.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-white/60">
                      {new Date(b.slot_start).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-3 py-2 text-white/60">{b.buyer_name ?? b.buyer_email ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {assign.can_edit_calendar && (
        <p className="text-xs text-white/45">
          💡 Tenés permiso para editar el calendario. Por ahora se hace desde{' '}
          <Link href="/owner/availability" className="text-fuchsia-300 hover:underline">la página de Disponibilidad del owner</Link>
          {' '}(misma cuenta tenant-wide). Vista propia próximamente.
        </p>
      )}
    </div>
  );
}
