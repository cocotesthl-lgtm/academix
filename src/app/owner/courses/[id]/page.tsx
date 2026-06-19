import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { CourseEditor, type Course, type Module, type Lesson, type Category } from "@/components/owner/courses/CourseEditor";
import { GrantEnrollmentForm } from "@/components/owner/courses/GrantEnrollmentForm";
import { deleteCourseAction, setCourseContentLabelsAction } from "@/lib/courses/actions";
import { CourseCheckoutOverride } from "@/components/owner/checkout/CourseCheckoutOverride";
import { CourseCalendarConfig } from "@/components/owner/courses/CourseCalendarConfig";
import { CourseSubscriptionConfig } from "@/components/owner/courses/CourseSubscriptionConfig";
import { CourseRibbonEditor } from "@/components/owner/courses/CourseRibbonEditor";
import { VenueLinker, type VenueOpt } from "@/components/owner/courses/VenueLinker";
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

  // Query base — sin las columnas nuevas (sobrevive a migrations pendientes)
  const { data: course } = await svc
    .from("courses")
    .select("id, slug, title, description, cover_url, price_cents, currency, status, affiliate_enabled, is_featured, category_id, landing_template, landing_config, landing_variants")
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle<Course>();

  // Calendar source extra (puede no existir si 0017 falta — defaults a 'instructor')
  let calendarSource: 'instructor' | 'owner' = 'instructor';
  try {
    const { data, error } = await svc.from('courses')
      .select('calendar_source').eq('id', id).maybeSingle<{ calendar_source: string | null }>();
    if (!error && data?.calendar_source === 'owner') calendarSource = 'owner';
  } catch { /* migration 0017 falta */ }

  // Ribbon (migration 0029) — defensivo
  let ribbonText: string | null = null;
  let ribbonTone: string | null = null;
  try {
    const { data } = await svc.from('courses')
      .select('ribbon_text, ribbon_tone').eq('id', id).maybeSingle<{ ribbon_text: string | null; ribbon_tone: string | null }>();
    if (data) {
      ribbonText = data.ribbon_text;
      ribbonTone = data.ribbon_tone;
    }
  } catch { /* migration 0029 falta */ }

  if (!course) notFound();

  // Query separada para nuevos campos (checkout/calendar/subscription) —
  // si la migration no corrió, cae a defaults sin romper.
  type CourseExtras = {
    checkout_config: unknown;
    calendar_mode: CalendarMode | null;
    calendar_label: string | null;
    calendar_required: boolean | null;
    calendar_horizon_days: number | null;
    pricing_mode: 'one_time' | 'subscription' | null;
    subscription_frequency: 'monthly' | 'yearly' | null;
    subscription_trial_days: number | null;
    content_title?: string | null;
    module_label?: string | null;
    lesson_label?: string | null;
    show_content_section?: boolean | null;
  };
  let courseExtras: CourseExtras | null = null;
  try {
    const { data, error } = await svc
      .from("courses")
      .select("checkout_config, calendar_mode, calendar_label, calendar_required, calendar_horizon_days, pricing_mode, subscription_frequency, subscription_trial_days, content_title, module_label, lesson_label, show_content_section")
      .eq("id", course.id)
      .maybeSingle<CourseExtras>();
    if (!error && data) courseExtras = data;
  } catch { /* migration no corrida */ }

  // Branding color del tenant + checkout default del tenant (para fallback)
  let tenantBrand: { primary_color?: string } | null = null;
  let tenantCheckoutRaw: unknown = null;
  try {
    const { data, error } = await svc
      .from("tenants").select("brand, checkout_config").eq("id", tenant.id)
      .maybeSingle<{ brand: { primary_color?: string } | null; checkout_config: unknown }>();
    if (!error && data) {
      tenantBrand = data.brand;
      tenantCheckoutRaw = data.checkout_config;
    } else if (error) {
      // checkout_config no existe → traemos solo brand
      const { data: justBrand } = await svc.from("tenants").select("brand").eq("id", tenant.id)
        .maybeSingle<{ brand: { primary_color?: string } | null }>();
      tenantBrand = justBrand?.brand ?? null;
    }
  } catch {
    const { data: justBrand } = await svc.from("tenants").select("brand").eq("id", tenant.id)
      .maybeSingle<{ brand: { primary_color?: string } | null }>();
    tenantBrand = justBrand?.brand ?? null;
  }
  const primaryColor = tenantBrand?.primary_color ?? '#0a0a0a';
  const tenantCheckoutCfg = mergeCheckoutConfig(tenantCheckoutRaw);
  const courseHasOverride = !!courseExtras?.checkout_config &&
    typeof courseExtras.checkout_config === 'object' &&
    Object.keys(courseExtras.checkout_config as object).length > 0;
  const courseCheckoutCfg = courseHasOverride
    ? mergeCheckoutConfig(courseExtras!.checkout_config)
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

      <CourseRibbonEditor
        courseId={course.id}
        initialText={ribbonText}
        initialTone={ribbonTone}
      />

      <section className="max-w-3xl pt-8 border-t border-white/10">
        <h2 className="text-lg font-semibold mb-1">Modelo de cobro</h2>
        <p className="text-sm text-white/60 mb-4">
          Cobrá una vez o seteá una suscripción recurrente (mensual o anual)
          via MercadoPago. El monto sale del precio del curso.
        </p>
        <CourseSubscriptionConfig
          courseId={course.id}
          initialMode={(courseExtras?.pricing_mode ?? 'one_time') as 'one_time' | 'subscription'}
          initialFrequency={courseExtras?.subscription_frequency ?? null}
          initialTrialDays={courseExtras?.subscription_trial_days ?? 0}
          priceCents={course.price_cents}
          currency={course.currency}
        />
      </section>

      <VenueLinkerBlock courseId={course.id} tenantId={tenant.id} />

      <section className="max-w-3xl pt-8 border-t border-white/10">
        <h2 className="text-lg font-semibold mb-1">Página pública — sección &quot;Contenido&quot;</h2>
        <p className="text-sm text-white/60 mb-4">
          Personalizá los textos de la sección que muestra los módulos/lecciones en la
          página de venta del producto. Útil si no vendés un curso (ej. ecommerce → &quot;Detalles&quot; / &quot;variantes&quot; / &quot;opciones&quot;).
        </p>
        <form action={setCourseContentLabelsAction} className="grid sm:grid-cols-2 gap-3">
          <input type="hidden" name="id" value={course.id} />
          <label className="block sm:col-span-2">
            <span className="text-xs text-white/55">Título de la sección</span>
            <input name="content_title" defaultValue={courseExtras?.content_title ?? ''}
              placeholder="Contenido del curso"
              maxLength={80}
              className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-white/55">Etiqueta &quot;módulos&quot; (plural)</span>
            <input name="module_label" defaultValue={courseExtras?.module_label ?? ''}
              placeholder="módulos"
              maxLength={40}
              className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-white/55">Etiqueta &quot;lecciones&quot; (plural)</span>
            <input name="lesson_label" defaultValue={courseExtras?.lesson_label ?? ''}
              placeholder="lecciones"
              maxLength={40}
              className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="show_content_section"
              defaultChecked={courseExtras?.show_content_section !== false} />
            Mostrar la sección de contenido en la página pública
          </label>
          <div className="sm:col-span-2">
            <button type="submit"
              className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
              Guardar
            </button>
          </div>
        </form>
      </section>

      <section className="max-w-3xl pt-8 border-t border-white/10">
        <h2 className="text-lg font-semibold mb-1">Checkout — calendario / fecha</h2>
        <p className="text-sm text-white/60 mb-4">
          Pedile al comprador una fecha de inicio o un slot puntual de mentoría / clase en vivo.
        </p>
        <CourseCalendarConfig
          courseId={course.id}
          initialMode={(courseExtras?.calendar_mode ?? 'none') as CalendarMode}
          initialLabel={courseExtras?.calendar_label ?? null}
          initialRequired={courseExtras?.calendar_required ?? true}
          initialHorizon={courseExtras?.calendar_horizon_days ?? 30}
          initialSource={calendarSource}
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

/** Server component que carga sedes del tenant + las vinculadas a este producto */
async function VenueLinkerBlock({ courseId, tenantId }: { courseId: string; tenantId: string }) {
  const svc = getServiceClient();
  let venues: VenueOpt[] = [];
  let linkedIds: string[] = [];
  let migrationMissing = false;
  try {
    const { data: vs, error } = await svc.from('venues')
      .select('id, name, address, active').eq('tenant_id', tenantId)
      .order('position').order('created_at');
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    venues = (vs ?? []) as VenueOpt[];
    const { data: linked } = await svc.from('course_venues').select('venue_id').eq('course_id', courseId);
    linkedIds = ((linked ?? []) as Array<{ venue_id: string }>).map((r) => r.venue_id);
  } catch { migrationMissing = true; }
  if (migrationMissing) return null;
  return (
    <section className="max-w-3xl pt-8 border-t border-white/10">
      <h2 className="text-lg font-semibold mb-1">📍 Sedes que ofrecen este producto</h2>
      <p className="text-sm text-white/60 mb-4">
        Si tu producto se ofrece en varias sucursales, tildá acá cuáles. En el storefront
        el cliente va a elegir sede antes de reservar.
      </p>
      <VenueLinker courseId={courseId} allVenues={venues} linkedIds={linkedIds} />
    </section>
  );
}
