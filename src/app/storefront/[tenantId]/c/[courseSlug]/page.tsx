import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trackClick } from "@/lib/affiliates/tracking";
import { CouponInput } from "@/components/storefront/CouponInput";

export const dynamic = "force-dynamic";

type CourseDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  currency: string;
  status: string;
};

type ModuleWithLessons = {
  id: string;
  title: string;
  position: number;
  lessons: Array<{
    id: string;
    title: string;
    drive_embed_url: string | null;
    is_preview: boolean;
    position: number;
  }>;
};

export default async function CourseDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string; courseSlug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { tenantId, courseSlug } = await params;
  const { ref } = await searchParams;
  const tenant = await getTenantById(tenantId);
  const primary = tenant?.brand?.primary_color ?? '#0a0a0a';

  const svc = getServiceClient();
  const { data: course } = await svc
    .from("courses")
    .select("id, slug, title, description, cover_url, price_cents, currency, status")
    .eq("tenant_id", tenantId)
    .eq("slug", courseSlug)
    .maybeSingle<CourseDetail>();

  if (!course || course.status !== 'published') notFound();

  // Resolvemos el user logueado una sola vez (lo usamos para tracking de
  // afiliados y como default del email en el form de checkout).
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user: currentUser } } = await supabaseAuth.auth.getUser();

  // Affiliate click tracking + cookie set on first ?ref= visit
  if (ref) {
    const h = await headers();
    const ip =
      (h.get('x-forwarded-for')?.split(',')[0].trim()) ||
      h.get('x-real-ip') ||
      '0.0.0.0';
    const ua = h.get('user-agent') ?? '';
    const referer = h.get('referer') ?? '';
    await trackClick({
      code: ref,
      tenantId,
      ip,
      userAgent: ua,
      referer,
      currentUserId: currentUser?.id ?? null
    });
  }

  const { data: modulesRaw } = await svc
    .from("modules")
    .select("id, title, position")
    .eq("course_id", course.id)
    .order("position", { ascending: true });
  const moduleRows = (modulesRaw ?? []) as Array<{ id: string; title: string; position: number }>;

  let lessonRows: Array<{
    id: string;
    title: string;
    drive_embed_url: string | null;
    is_preview: boolean;
    position: number;
    module_id: string;
  }> = [];
  if (moduleRows.length > 0) {
    const { data: ls } = await svc
      .from("lessons")
      .select("id, title, drive_embed_url, is_preview, position, module_id")
      .in("module_id", moduleRows.map((m) => m.id))
      .order("position", { ascending: true });
    lessonRows = (ls ?? []) as typeof lessonRows;
  }

  const modules: ModuleWithLessons[] = moduleRows.map((m) => ({
    ...m,
    lessons: lessonRows.filter((l) => l.module_id === m.id)
  }));

  const totalLessons = lessonRows.length;
  const previewLesson = lessonRows.find((l) => l.is_preview && l.drive_embed_url);

  return (
    <article className="max-w-5xl mx-auto px-6 py-10">
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{course.title}</h1>
          {course.description && (
            <p className="text-lg text-black/70 whitespace-pre-line">{course.description}</p>
          )}

          {previewLesson?.drive_embed_url && (
            <div className="rounded-xl overflow-hidden border border-black/10 bg-black aspect-video">
              <iframe
                src={previewLesson.drive_embed_url}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full h-full"
                title={previewLesson.title}
              />
            </div>
          )}

          <section>
            <h2 className="text-xl font-bold mb-3">Contenido del curso</h2>
            <p className="text-sm text-black/50 mb-4">
              {modules.length} módulos · {totalLessons} lecciones
            </p>
            <div className="space-y-3">
              {modules.map((m) => (
                <details key={m.id} className="rounded-lg border border-black/10 overflow-hidden">
                  <summary className="cursor-pointer px-4 py-3 bg-black/[0.02] font-medium flex justify-between">
                    <span>{m.title}</span>
                    <span className="text-xs text-black/50">{m.lessons.length} lecciones</span>
                  </summary>
                  <ul className="divide-y divide-black/5">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="px-4 py-2.5 text-sm flex items-center gap-2">
                        <span className="flex-1">{l.title}</span>
                        {l.is_preview && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ background: `${primary}15`, color: primary }}
                          >
                            preview
                          </span>
                        )}
                      </li>
                    ))}
                    {m.lessons.length === 0 && (
                      <li className="px-4 py-2.5 text-sm text-black/40">Sin lecciones todavía.</li>
                    )}
                  </ul>
                </details>
              ))}
              {modules.length === 0 && (
                <div className="rounded-lg border border-black/10 p-6 text-center text-black/50 text-sm">
                  El instructor todavía no cargó el contenido.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="md:col-span-1">
          <div className="sticky top-24 rounded-xl border border-black/10 p-6 space-y-4">
            <div>
              <div className="text-3xl font-bold">
                {course.price_cents === 0
                  ? 'Gratis'
                  : `${(course.price_cents / 100).toLocaleString('es-AR')} ${course.currency}`}
              </div>
              <p className="text-xs text-black/50 mt-1">Pago único · Acceso permanente</p>
            </div>
            <CouponInput
              courseId={course.id}
              priceCents={course.price_cents}
              currency={course.currency}
              primary={primary}
              defaultEmail={currentUser?.email ?? ''}
            />
            <p className="text-xs text-center text-black/40">
              Pago seguro vía MercadoPago
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}
