import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isEnrolled, markLessonCompleteAction } from "@/lib/enrollments/actions";

export const dynamic = "force-dynamic";

export default async function LessonPlayer({
  params
}: {
  params: Promise<{ tenantId: string; courseId: string; lessonId: string }>;
}) {
  const { tenantId, courseId, lessonId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/learn/${courseId}/${lessonId}`);

  const { enrolled, enrollmentId } = await isEnrolled(user.id, courseId);

  const svc = getServiceClient();
  const { data: lesson } = await svc
    .from("lessons")
    .select("id, title, drive_embed_url, is_preview, module_id, tenant_id")
    .eq("id", lessonId)
    .maybeSingle<{
      id: string;
      title: string;
      drive_embed_url: string | null;
      is_preview: boolean;
      module_id: string;
      tenant_id: string;
    }>();
  if (!lesson || lesson.tenant_id !== tenantId) notFound();

  // Access rule: preview lessons open to anyone; full lessons need enrollment
  if (!lesson.is_preview && !enrolled) redirect(`/`);

  const { data: progress } = await svc
    .from("lesson_progress")
    .select("completed_at")
    .eq("enrollment_id", enrollmentId ?? '00000000-0000-0000-0000-000000000000')
    .eq("lesson_id", lessonId)
    .maybeSingle<{ completed_at: string | null }>();
  const isCompleted = !!progress?.completed_at;

  // Sibling lessons for prev/next nav
  const { data: siblings } = await svc
    .from("lessons")
    .select("id, position")
    .eq("module_id", lesson.module_id)
    .order("position", { ascending: true });
  const siblingRows = (siblings ?? []) as Array<{ id: string; position: number }>;
  const idx = siblingRows.findIndex((s) => s.id === lessonId);
  const prev = idx > 0 ? siblingRows[idx - 1] : null;
  const next = idx >= 0 && idx < siblingRows.length - 1 ? siblingRows[idx + 1] : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center gap-3 text-sm text-black/50">
        <Link href={`/learn/${courseId}`} className="hover:text-black">← Volver al publicación</Link>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold">{lesson.title}</h1>

      {lesson.drive_embed_url ? (
        <div className="rounded-xl overflow-hidden border border-black/10 bg-black aspect-video">
          <iframe
            src={lesson.drive_embed_url}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            className="w-full h-full"
            title={lesson.title}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-black/10 p-12 text-center text-black/50">
          Esta lección todavía no tiene contenido cargado.
        </div>
      )}

      {enrolled && enrollmentId && (
        <form action={markLessonCompleteAction} className="flex items-center justify-between gap-4 rounded-xl border border-black/10 p-4">
          <input type="hidden" name="enrollment_id" value={enrollmentId} />
          <input type="hidden" name="lesson_id" value={lessonId} />
          <input type="hidden" name="tenant_id" value={tenantId} />
          <input type="hidden" name="completed" value={String(isCompleted)} />
          <div className="text-sm">
            <span className={isCompleted ? 'text-emerald-600 font-medium' : 'text-black/70'}>
              {isCompleted ? '✓ Marcaste esta lección como completada' : 'Marcá cuando termines'}
            </span>
          </div>
          <button className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-black/90">
            {isCompleted ? 'Desmarcar' : 'Marcar completada'}
          </button>
        </form>
      )}

      <div className="flex items-center justify-between">
        {prev ? (
          <Link href={`/learn/${courseId}/${prev.id}`} className="text-sm font-medium hover:underline">
            ← Lección anterior
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/learn/${courseId}/${next.id}`} className="text-sm font-medium hover:underline">
            Siguiente lección →
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}
