import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { CourseEditor, type Course, type Module, type Lesson, type Category } from "@/components/owner/courses/CourseEditor";
import { GrantEnrollmentForm } from "@/components/owner/courses/GrantEnrollmentForm";
import { deleteCourseAction } from "@/lib/courses/actions";
import { CourseCheckoutOverride } from "@/components/owner/checkout/CourseCheckoutOverride";
import { CourseCalendarConfig } from "@/components/owner/courses/CourseCalendarConfig";
import { CourseSubscriptionConfig } from "@/components/owner/courses/CourseSubscriptionConfig";
import { mergeCheckoutConfig } from "@/lib/checkout/types";
import type { CalendarMode } from "@/lib/calendar/types";

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
    .select("id, slug, title, description, cover_url, price_cents, currency, status, affiliate_enabled, is_featured, category_id, landing_template, landing_config, landing_variants, checkout_config, calendar_mode, calendar_label, calendar_required, calendar_horizon_days, pricing_mode, subscription_frequency, subscription_trial_days")
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle<Course & {
      checkout_config: unknown;
      calendar_mode: CalendarMode | null;
      calendar_label: string | null;
      calendar_required: boolean | null;
      calendar_horizon_days: number | null;
      pricing_mode: 'one_time' | 'subscription' | null;
      subscription_frequency: 'monthly' | 'yearly' | null;
      subscription_trial_days: number | null;
    }>();

  if (!course) notFound();

  // Branding color del tenant + checkout default del tenant (para fallback
  // del editor de override por curso)
  const { data: tenantRow } = await svc
    .from("tenants")
    .select("brand, checkout_config")
    .eq("id", tenant.id)
    .maybeSingle<{ brand: { primary_color?: string } | null; checkout_config: unknown }>();
  const primaryColor = tenantRow?.brand?.primary_color ?? '#0a0a0a';
  const tenantCheckoutCfg = mergeCheckoutConfig(tenantRow?.checkout_config);
  const courseHasOverride = !!course.checkout_config &&
    typeof course.checkout_config === 'object' &&
    Object.keys(course.checkout_config as object).length > 0;
  const courseCheckoutCfg = courseHasOverride
    ? mergeCheckoutConfig(course.checkout_config)
    : tenantCheckoutCfg;

  const { data: cats } = await svc
    .from("course_categories")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .order("position", { ascending: true });
  const categories = (cats ?? []) as Category[];

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
          href={(() => {
            const u = new URL(env.appUrl);
            const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
            const host = isLocal
              ? `${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
              : `${tenant.slug}.${env.rootDomain}`;
            return `${u.protocol}//${host}/c/${course.slug}`;
          })()}
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

      <CourseEditor
        course={course}
        modules={modules}
        categories={categories}
        primaryColor={primaryColor}
        storefrontOrigin={(() => {
          const u = new URL(env.appUrl);
          const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
          const host = isLocal
            ? `${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
            : `${tenant.slug}.${env.rootDomain}`;
          return `${u.protocol}//${host}`;
        })()}
      />

      <section className="max-w-3xl pt-8 border-t border-white/10">
        <h2 className="text-lg font-semibold mb-1">Modelo de cobro</h2>
        <p className="text-sm text-white/60 mb-4">
          Cobrá una vez o seteá una suscripción recurrente (mensual o anual)
          via MercadoPago. El monto sale del precio del curso.
        </p>
        <CourseSubscriptionConfig
          courseId={course.id}
          initialMode={(course.pricing_mode ?? 'one_time') as 'one_time' | 'subscription'}
          initialFrequency={course.subscription_frequency}
          initialTrialDays={course.subscription_trial_days ?? 0}
          priceCents={course.price_cents}
          currency={course.currency}
        />
      </section>

      <section className="max-w-3xl pt-8 border-t border-white/10">
        <h2 className="text-lg font-semibold mb-1">Checkout — calendario / fecha</h2>
        <p className="text-sm text-white/60 mb-4">
          Pedile al comprador una fecha de inicio o un slot puntual de mentoría / clase en vivo.
        </p>
        <CourseCalendarConfig
          courseId={course.id}
          initialMode={(course.calendar_mode ?? 'none') as CalendarMode}
          initialLabel={course.calendar_label ?? null}
          initialRequired={course.calendar_required ?? true}
          initialHorizon={course.calendar_horizon_days ?? 30}
        />
      </section>

      <section className="max-w-3xl pt-8 border-t border-white/10">
        <h2 className="text-lg font-semibold mb-1">Checkout — campos que se piden al comprar</h2>
        <p className="text-sm text-white/60 mb-4">
          Por default usa la config global de tu academia. Activá el override
          si este curso necesita campos diferentes.
        </p>
        <CourseCheckoutOverride
          courseId={course.id}
          hasOverride={courseHasOverride}
          config={courseCheckoutCfg}
        />
      </section>

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
