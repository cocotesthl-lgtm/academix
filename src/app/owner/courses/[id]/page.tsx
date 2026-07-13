import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { CourseEditor, type Course, type Module, type Lesson, type Category } from "@/components/owner/courses/CourseEditor";
import { getTenantModules } from "@/lib/modules/queries";
import { CourseBuilderToolbar } from "@/components/owner/courses/CourseBuilderToolbar";
import { GrantEnrollmentForm } from "@/components/owner/courses/GrantEnrollmentForm";
import { ContentLabelsForm } from "@/components/owner/courses/ContentLabelsForm";
import { CourseCheckoutOverride } from "@/components/owner/checkout/CourseCheckoutOverride";
import { CourseCalendarConfig } from "@/components/owner/courses/CourseCalendarConfig";
import { CourseSubscriptionConfig } from "@/components/owner/courses/CourseSubscriptionConfig";
import { CourseRibbonEditor } from "@/components/owner/courses/CourseRibbonEditor";
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

  // Wallet bonus (migration 0061) + info de moneda default del tenant
  // para preview en el input. Todo defensivo — si la app Saldos no está
  // instalada o las migrations faltan, el input no se renderiza.
  let walletBonusCents = 0;
  try {
    const { data } = await svc.from('courses')
      .select('wallet_bonus_cents').eq('id', id).maybeSingle<{ wallet_bonus_cents: number | null }>();
    if (data?.wallet_bonus_cents != null) walletBonusCents = data.wallet_bonus_cents;
  } catch { /* migration 0061 falta */ }
  const tenantModules = await getTenantModules(tenant.id);
  const walletsEnabled = tenantModules.wallets !== false;
  let walletCurrency: { label: string; symbol: string } | null = null;
  if (walletsEnabled) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (svc.from('wallet_currencies') as any)
        .select('label, symbol').eq('tenant_id', tenant.id).eq('is_default', true).maybeSingle();
      if (data) walletCurrency = { label: data.label, symbol: data.symbol };
    } catch { /* migration 0063 falta */ }
  }

  // PayPal integration → moneda + precio actual del curso para el input
  // Hotmart-style. Si el tenant no conectó PayPal, no mostramos el input.
  let paypalCurrency: string | null = null;
  let paypalPriceCents: number | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pp } = await (svc.from('integrations') as any)
      .select('metadata').eq('tenant_id', tenant.id)
      .eq('provider', 'paypal').eq('status', 'connected').maybeSingle();
    const c = (pp?.metadata as { currency?: string } | null)?.currency;
    if (c) paypalCurrency = c.toUpperCase();
  } catch { /* migration 0064 falta */ }
  if (paypalCurrency) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cp } = await (svc.from('courses') as any)
        .select('paypal_price_cents').eq('id', id).maybeSingle();
      if (typeof (cp as { paypal_price_cents?: number | null } | null)?.paypal_price_cents === 'number') {
        paypalPriceCents = (cp as { paypal_price_cents: number }).paypal_price_cents;
      }
    } catch { /* migration 0065 falta */ }
  }

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

  const publicUrl = (() => {
    const u = new URL(env.appUrl);
    const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
    const host = isLocal
      ? `${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
      : `${tenant.slug}.${env.rootDomain}`;
    return `${u.protocol}//${host}/c/${course.slug}`;
  })();

  return (
    <div className="space-y-6">
      <CourseBuilderToolbar
        courseId={course.id}
        courseTitle={course.title}
        courseStatus={course.status}
        publicUrl={publicUrl}
      />

      {/* Banner draft compacto — recordatorio de que el producto no es visible */}
      {course.status !== 'published' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/80">
          📝 En borrador — invisible para tus visitantes. La URL pública (/c/{course.slug}) devuelve 404 hasta que toques <strong>Publicar</strong> arriba.
        </div>
      )}

      <CourseEditor
        course={{ ...course, wallet_bonus_cents: walletBonusCents }}
        modules={modules}
        categories={categories}
        primaryColor={primaryColor}
        walletsEnabled={walletsEnabled}
        walletCurrency={walletCurrency}
        paypalCurrency={paypalCurrency}
        paypalPriceCents={paypalPriceCents}
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
          via MercadoPago. El monto sale del precio de la publicación.
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

      <section className="max-w-3xl pt-8 border-t border-white/10">
        <h2 className="text-lg font-semibold mb-1">Página pública — sección &quot;Contenido&quot;</h2>
        <p className="text-sm text-white/60 mb-4">
          Personalizá los textos de la sección que muestra los módulos/lecciones en la
          página de venta del producto. Útil si no vendés una publicación (ej. ecommerce → &quot;Detalles&quot; / &quot;variantes&quot; / &quot;opciones&quot;).
        </p>
        <ContentLabelsForm
          courseId={course.id}
          contentTitle={courseExtras?.content_title}
          moduleLabel={courseExtras?.module_label}
          lessonLabel={courseExtras?.lesson_label}
          showContentSection={courseExtras?.show_content_section !== false}
        />
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
          Por default usa la config global de tu sitio. Activá el override
          si esta publicación necesita campos diferentes.
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
          Usalo para regalar la publicación, dar acceso a beta testers o procesar ventas hechas
          por fuera de la plataforma.
        </p>
        <GrantEnrollmentForm courseId={course.id} />
      </section>
    </div>
  );
}

