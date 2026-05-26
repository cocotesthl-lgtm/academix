import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isEnrolled } from "@/lib/enrollments/actions";

export const dynamic = "force-dynamic";

export default async function CoursePlayer({
  params
}: {
  params: Promise<{ tenantId: string; courseId: string }>;
}) {
  const { tenantId, courseId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/learn/${courseId}`);

  const { enrolled, enrollmentId } = await isEnrolled(user.id, courseId);
  if (!enrolled) redirect(`/`);

  const svc = getServiceClient();
  const { data: course } = await svc
    .from("courses")
    .select("id, title, slug, description")
    .eq("id", courseId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string; title: string; slug: string; description: string | null }>();
  if (!course) notFound();

  const { data: modules } = await svc
    .from("modules")
    .select("id, title, position")
    .eq("course_id", courseId)
    .order("position", { ascending: true });
  const moduleRows = (modules ?? []) as Array<{ id: string; title: string; position: number }>;

  let lessonRows: Array<{ id: string; title: string; position: number; module_id: string; is_preview: boolean }> = [];
  let progressRows: Array<{ lesson_id: string; completed_at: string | null }> = [];
  if (moduleRows.length > 0) {
    const ids = moduleRows.map((m) => m.id);
    const [{ data: ls }, { data: pr }] = await Promise.all([
      svc.from("lessons")
        .select("id, title, position, module_id, is_preview")
        .in("module_id", ids)
        .order("position", { ascending: true }),
      svc.from("lesson_progress")
        .select("lesson_id, completed_at")
        .eq("enrollment_id", enrollmentId!)
    ]);
    lessonRows = (ls ?? []) as typeof lessonRows;
    progressRows = (pr ?? []) as typeof progressRows;
  }

  const completedSet = new Set(
    progressRows.filter((p) => p.completed_at !== null).map((p) => p.lesson_id)
  );
  const totalLessons = lessonRows.length;
  const completedCount = completedSet.size;
  const pct = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 text-sm text-black/50 mb-6">
        <Link href="/learn" className="hover:text-black">← Mis cursos</Link>
        <span>/</span>
        <span className="text-black">{course.title}</span>
      </div>

      <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
      {course.description && (
        <p className="text-black/60 mb-6">{course.description}</p>
      )}

      <div className="mb-8">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-black/60">Tu progreso</span>
          <span className="font-medium">{completedCount}/{totalLessons} · {pct}%</span>
        </div>
        <div className="h-2 bg-black/10 rounded-full overflow-hidden">
          <div className="h-full bg-black" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-4">
        {moduleRows.map((m) => {
          const lessons = lessonRows.filter((l) => l.module_id === m.id);
          return (
            <div key={m.id} className="rounded-xl border border-black/10 overflow-hidden">
              <div className="px-5 py-3 bg-black/[0.02] font-medium">{m.title}</div>
              <ul className="divide-y divide-black/5">
                {lessons.length === 0 && (
                  <li className="px-5 py-3 text-sm text-black/40">Sin lecciones todavía.</li>
                )}
                {lessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/learn/${courseId}/${l.id}`}
                      className="block px-5 py-3 text-sm flex items-center gap-3 hover:bg-black/[0.02]"
                    >
                      <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                        completedSet.has(l.id) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-black/20'
                      }`}>
                        {completedSet.has(l.id) ? '✓' : ''}
                      </span>
                      <span className="flex-1">{l.title}</span>
                      <span className="text-xs text-black/40">Ver →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
