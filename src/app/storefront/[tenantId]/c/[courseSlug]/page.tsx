import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trackClick } from "@/lib/affiliates/tracking";
import { CouponInput } from "@/components/storefront/CouponInput";
import type { LandingConfig, LandingTemplate } from "@/lib/courses/landing";
import { HotmartLanding } from "@/components/storefront/landings/HotmartLanding";
import { FunnelLanding } from "@/components/storefront/landings/FunnelLanding";
import { VslLanding } from "@/components/storefront/landings/VslLanding";
import { resolveCheckoutConfig } from "@/lib/checkout/types";
import { generateSlots, type AvailabilityRule, type BookingSlot, type CalendarMode } from "@/lib/calendar/types";

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
  landing_template: LandingTemplate | null;
  landing_config: LandingConfig | null;
  landing_variants: Record<string, { template: LandingTemplate; config: LandingConfig }> | null;
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
  searchParams: Promise<{ ref?: string; v?: string }>;
}) {
  const { tenantId, courseSlug } = await params;
  const { ref, v: variantParam } = await searchParams;
  const tenant = await getTenantById(tenantId);
  const primary = tenant?.brand?.primary_color ?? '#0a0a0a';

  const svc = getServiceClient();
  // Query base — SIN columnas nuevas (sobrevive a falta de migrations).
  const { data: course } = await svc
    .from("courses")
    .select("id, slug, title, description, cover_url, price_cents, currency, status, landing_template, landing_config, landing_variants")
    .eq("tenant_id", tenantId)
    .eq("slug", courseSlug)
    .maybeSingle<CourseDetail>();

  if (!course || course.status !== 'published') notFound();

  // Query separada para columnas nuevas (checkout + calendar). Si la
  // migration todavía no corrió, falla silencioso y caemos a defaults.
  type CourseExtras = {
    checkout_config: unknown;
    calendar_mode: CalendarMode | null;
    calendar_label: string | null;
    calendar_required: boolean | null;
    calendar_horizon_days: number | null;
  };
  let courseExtras: CourseExtras | null = null;
  try {
    const { data, error } = await svc
      .from("courses")
      .select("checkout_config, calendar_mode, calendar_label, calendar_required, calendar_horizon_days")
      .eq("id", course.id)
      .maybeSingle<CourseExtras>();
    if (!error && data) courseExtras = data;
  } catch { /* migration no corrida — defaults */ }

  let tenantCheckoutCfg: unknown = null;
  try {
    const { data, error } = await svc
      .from('tenants').select('checkout_config').eq('id', tenantId)
      .maybeSingle<{ checkout_config: unknown }>();
    if (!error && data) tenantCheckoutCfg = data.checkout_config;
  } catch { /* idem */ }

  const checkoutConfig = resolveCheckoutConfig({
    tenantConfig: tenantCheckoutCfg,
    courseConfig: courseExtras?.checkout_config ?? null
  });

  // ─── Calendario: si el curso tiene mentorship_slot, calculamos los slots
  // disponibles desde las reglas del tenant menos los ya tomados ───
  const calendarMode = (courseExtras?.calendar_mode ?? 'none') as CalendarMode;
  let calendarSlots: BookingSlot[] = [];
  if (calendarMode === 'mentorship_slot') {
    const horizon = courseExtras?.calendar_horizon_days ?? 30;
    const horizonDate = new Date();
    horizonDate.setDate(horizonDate.getDate() + horizon);
    try {
      const [rulesRes, takenRes] = await Promise.all([
        svc.from('availability_rules')
          .select('id, tenant_id, weekday, start_min, end_min, slot_duration_min, timezone')
          .eq('tenant_id', tenantId),
        svc.from('bookings')
          .select('slot_start')
          .eq('tenant_id', tenantId)
          .neq('status', 'cancelled')
          .gte('slot_start', new Date().toISOString())
          .lte('slot_start', horizonDate.toISOString())
      ]);
      const rules = (rulesRes.data ?? []) as AvailabilityRule[];
      const takenSet = new Set(((takenRes.data ?? []) as Array<{ slot_start: string }>).map((b) => b.slot_start));
      calendarSlots = generateSlots({ rules, takenSlotStarts: takenSet, horizonDays: horizon });
    } catch { /* idem */ }
  }

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

  // ─── A/B/C variants ───
  // El query param ?v=B|C activa una variante alternativa (la que el
  // afiliado eligió en su link). Si no existe la variante o no hay query,
  // usamos el template/config principal (la versión "visible" del owner).
  const variantKey = (variantParam ?? '').toUpperCase();
  const useVariant =
    variantKey &&
    course.landing_variants &&
    typeof course.landing_variants === 'object' &&
    course.landing_variants[variantKey];

  const tpl: LandingTemplate = (useVariant
    ? useVariant.template
    : (course.landing_template ?? 'classic')) as LandingTemplate;
  const tplConfig: LandingConfig = (useVariant
    ? useVariant.config
    : (course.landing_config ?? {})) as LandingConfig;

  // ─── Branching por landing template ───
  if (tpl === 'hotmart') {
    return (
      <HotmartLanding
        course={course}
        modules={modules}
        previewLessonEmbed={previewLesson?.drive_embed_url ?? null}
        previewLessonTitle={previewLesson?.title ?? null}
        totalLessons={totalLessons}
        primary={primary}
        config={tplConfig}
        buyerEmail={currentUser?.email ?? ''}
        checkoutConfig={checkoutConfig}
        calendarMode={calendarMode}
        calendarLabel={courseExtras?.calendar_label ?? null}
        calendarRequired={courseExtras?.calendar_required ?? true}
        calendarSlots={calendarSlots}
      />
    );
  }
  if (tpl === 'funnel') {
    return (
      <FunnelLanding
        course={course}
        modules={modules}
        primary={primary}
        config={tplConfig}
        buyerEmail={currentUser?.email ?? ''}
        checkoutConfig={checkoutConfig}
        calendarMode={calendarMode}
        calendarLabel={courseExtras?.calendar_label ?? null}
        calendarRequired={courseExtras?.calendar_required ?? true}
        calendarSlots={calendarSlots}
      />
    );
  }
  if (tpl === 'vsl') {
    return (
      <VslLanding
        course={{ ...course, tenant_id: tenantId }}
        primary={primary}
        config={tplConfig}
        buyerEmail={currentUser?.email ?? ''}
        checkoutConfig={checkoutConfig}
        calendarMode={calendarMode}
        calendarLabel={courseExtras?.calendar_label ?? null}
        calendarRequired={courseExtras?.calendar_required ?? true}
        calendarSlots={calendarSlots}
      />
    );
  }

  // Default: classic landing (la histórica de Curplat).
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
              checkoutConfig={checkoutConfig}
        calendarMode={calendarMode}
        calendarLabel={courseExtras?.calendar_label ?? null}
        calendarRequired={courseExtras?.calendar_required ?? true}
        calendarSlots={calendarSlots}
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
