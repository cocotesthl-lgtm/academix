import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import {
  addInstructorAction,
  removeInstructorAction,
  assignCourseToInstructorAction,
  unassignCourseFromInstructorAction
} from "@/lib/instructors/actions";
import { InstructorPermToggle } from "@/components/owner/instructors/InstructorPermToggle";
import { EmptyState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";

export const dynamic = "force-dynamic";

type MembershipRow = {
  user_id: string;
  profiles: { id: string; email: string | null; display_name: string | null } | null;
};
type CourseRow = { id: string; title: string; slug: string };
type AssignmentRow = {
  user_id: string; course_id: string;
  can_edit_calendar: boolean; can_reschedule: boolean; can_view_students: boolean;
};

export default async function OwnerInstructorsPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const [{ data: memRaw }, { data: courseRaw }, { data: affMemRaw }] = await Promise.all([
    svc.from('memberships')
      .select('user_id, profiles ( id, email, display_name )')
      .eq('tenant_id', tenant.id).eq('role', 'instructor').eq('status', 'active')
      .order('created_at', { ascending: false }),
    svc.from('courses')
      .select('id, title, slug')
      .eq('tenant_id', tenant.id)
      .order('title', { ascending: true }),
    // Afiliados de la sitio (que YA tienen membership de afiliado acá)
    // — candidatos directos para ascender a instructor sin pedir email.
    svc.from('memberships')
      .select('user_id, profiles ( id, email, display_name )')
      .eq('tenant_id', tenant.id).eq('role', 'affiliate').eq('status', 'active')
      .order('created_at', { ascending: false })
  ]);

  const memberships = (memRaw ?? []) as MembershipRow[];
  const courses = (courseRaw ?? []) as CourseRow[];
  const instructors = memberships
    .filter((m) => m.profiles)
    .map((m) => ({
      user_id: m.user_id,
      email: m.profiles!.email ?? '—',
      name: m.profiles!.display_name ?? m.profiles!.email ?? '—'
    }));
  const instructorIds = new Set(instructors.map((i) => i.user_id));
  // Afiliados que NO son ya instructores (candidatos)
  const affiliateCandidates = ((affMemRaw ?? []) as MembershipRow[])
    .filter((m) => m.profiles && !instructorIds.has(m.user_id))
    .map((m) => ({
      user_id: m.user_id,
      email: m.profiles!.email ?? '—',
      name: m.profiles!.display_name ?? m.profiles!.email ?? '—'
    }));

  // Asignaciones existentes
  let assignments: AssignmentRow[] = [];
  if (instructors.length > 0) {
    const { data } = await svc
      .from('course_instructors')
      .select('user_id, course_id, can_edit_calendar, can_reschedule, can_view_students')
      .eq('tenant_id', tenant.id)
      .in('user_id', instructors.map((i) => i.user_id));
    assignments = (data ?? []) as AssignmentRow[];
  }
  const assignMap = new Map<string, AssignmentRow>();
  for (const a of assignments) assignMap.set(`${a.user_id}|${a.course_id}`, a);

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        title="Instructores"
        description="Asigná publicaciones a cada instructor y decidí qué pueden hacer. Acceden desde /instructor con su misma cuenta."
      />

      {/* ─── Ascender afiliados ─── */}
      {affiliateCandidates.length > 0 && (
        <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
          <h2 className="font-semibold text-sm mb-1">💼 → 👨‍🏫 Ascender afiliados a instructor</h2>
          <p className="text-xs text-white/55 mb-3">
            Estos afiliados ya generan links de tus publicaciones. Sin fricción: 1 click y son
            también instructores. Mantienen su rol de afiliado en paralelo. Si trabajan
            para varias sitios, pueden ser instructores de todas a la vez.
          </p>
          <div className="space-y-2">
            {affiliateCandidates.map((c) => (
              <div key={c.user_id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{c.name}</div>
                  <div className="text-xs text-white/45 font-mono truncate">{c.email}</div>
                </div>
                <form action={addInstructorAction}>
                  <input type="hidden" name="user_id" value={c.user_id} />
                  <button className="text-xs px-3 py-1.5 rounded border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20 whitespace-nowrap">
                    ⬆ Ascender a instructor
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Alta manual por email ─── */}
      <form action={addInstructorAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-white/60 mb-1">O agregalo por email</label>
          <input
            name="email" type="email" required
            placeholder="instructor@email.com"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
        </div>
        <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90">
          + Sumar
        </button>
        <p className="text-[11px] text-white/45 basis-full">
          ⚠️ El user tiene que estar registrado en Curplat (signup público o como afiliado).
          Si no existe, no hace nada.
        </p>
      </form>

      {/* ─── Lista de instructores con asignaciones ─── */}
      {instructors.length === 0 ? (
        <EmptyState
          icon="👨‍🏫"
          title="Aún no sumaste instructores"
          description="Los instructores pueden ver alumnos, editar su calendario y reagendar clases. Sumá uno por email arriba, o ascendé un afiliado existente."
        />
      ) : (
        <div className="space-y-6">
          {instructors.map((i) => (
            <div key={i.user_id} className="rounded-xl border border-white/15 bg-white/[0.02] p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-semibold">{i.name}</div>
                  <div className="text-xs text-white/45 font-mono">{i.email}</div>
                </div>
                <form action={removeInstructorAction}>
                  <input type="hidden" name="user_id" value={i.user_id} />
                  <button className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10">
                    Quitar
                  </button>
                </form>
              </div>

              {/* Lista de publicaciones del tenant con toggle de asignación + permisos */}
              <div className="space-y-2">
                {courses.length === 0 ? (
                  <p className="text-xs text-white/40">Sin publicaciones creados en la sitio todavía.</p>
                ) : (
                  courses.map((c) => {
                    const a = assignMap.get(`${i.user_id}|${c.id}`);
                    const isAssigned = !!a;
                    return (
                      <div key={c.id} className="rounded border border-white/10 bg-white/[0.02] p-3 flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[160px]">
                          <div className="text-sm font-medium">{c.title}</div>
                        </div>
                        {isAssigned && a && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <InstructorPermToggle userId={i.user_id} courseId={c.id} field="can_view_students" initial={a.can_view_students} label="Ver alumnos" />
                            <InstructorPermToggle userId={i.user_id} courseId={c.id} field="can_edit_calendar" initial={a.can_edit_calendar} label="Editar calendario" />
                            <InstructorPermToggle userId={i.user_id} courseId={c.id} field="can_reschedule" initial={a.can_reschedule} label="Reagendar" />
                          </div>
                        )}
                        <form action={isAssigned ? unassignCourseFromInstructorAction : assignCourseToInstructorAction}>
                          <input type="hidden" name="user_id" value={i.user_id} />
                          <input type="hidden" name="course_id" value={c.id} />
                          <button className={`text-xs px-3 py-1 rounded border whitespace-nowrap ${
                            isAssigned
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-white/15 hover:bg-white/5'
                          }`}>
                            {isAssigned ? '✓ Asignado' : '+ Asignar'}
                          </button>
                        </form>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
