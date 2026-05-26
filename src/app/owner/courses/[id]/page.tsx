import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { CourseEditor, type Course, type Module, type Lesson } from "@/components/owner/courses/CourseEditor";
import { GrantEnrollmentForm } from "@/components/owner/courses/GrantEnrollmentForm";
import { deleteCourseAction } from "@/lib/courses/actions";

export const dynamic = "force-dynamic";

export default async function CourseEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const { data: course } = await svc
    .from("courses")
    .select("id, slug, title, description, price_cents, currency, status, affiliate_enabled")
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle<Course>();

  if (!course) notFound();

  const [{ data: rawModules }, { data: rawLessons }] = await Promise.all([
    svc.from("modules")
      .select("id, title, position")
      .eq("course_id", course.id)
      .order("position", { ascending: true }),
    svc.from("lessons")
      .select("id, title, drive_file_id, drive_embed_url, is_preview, position, module_id")
      .in("module_id", []) // placeholder; we filter below in JS to avoid empty .in() error
  ]);

  const moduleRows = (rawModules ?? []) as Array<{ id: string; title: string; position: number }>;
  const moduleIds = moduleRows.map((m) => m.id);

  let lessonRows: Array<Lesson & { module_id: string }> = [];
  if (moduleIds.length > 0) {
    const { data: ls } = await svc
      .from("lessons")
      .select("id, title, drive_file_id, drive_embed_url, is_preview, position, module_id")
      .in("module_id", moduleIds)
      .order("position", { ascending: true });
    lessonRows = (ls ?? []) as Array<Lesson & { module_id: string }>;
  }
  void rawLessons;

  const modules: Module[] = moduleRows.map((m) => ({
    id: m.id,
    title: m.title,
    position: m.position,
    lessons: lessonRows.filter((l) => l.module_id === m.id)
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-white/50">
        <Link href="/courses" className="hover:text-white">← Cursos</Link>
        <span>/</span>
        <span className="text-white">{course.title}</span>
        <a
          href={`http://${tenant.slug}.localhost:3000/c/${course.slug}`}
          target="_blank"
          rel="noopener"
          className="ml-auto rounded-md border border-white/15 px-3 py-1 text-xs hover:bg-white/5"
        >
          Ver público →
        </a>
        <form action={deleteCourseAction}>
          <input type="hidden" name="id" value={course.id} />
          <button className="rounded-md border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-1 text-xs hover:bg-red-500/20">
            Eliminar
          </button>
        </form>
      </div>

      <CourseEditor course={course} modules={modules} />

      <section className="max-w-3xl pt-8 border-t border-white/10">
        <h2 className="text-lg font-semibold mb-1">Conceder acceso manual</h2>
        <p className="text-sm text-white/60 mb-4">
          Usalo para regalar el curso, dar acceso a beta testers o procesar ventas hechas
          por fuera de la plataforma.
        </p>
        <GrantEnrollmentForm courseId={course.id} />
      </section>
    </div>
  );
}
