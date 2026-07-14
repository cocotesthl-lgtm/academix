import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { getTenantModules } from "@/lib/modules/queries";
import { PageHeader } from "@/components/owner/PageHeader";
import { AppSectionList } from "@/components/owner/courses/AppSectionList";
import type { ModuleKey } from "@/lib/modules/types";

export const dynamic = "force-dynamic";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  price_cents: number;
  currency: string;
  product_type: string | null;
  created_at: string;
};

type PhysRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  price_cents: number;
  currency: string;
  stock_qty: number;
  created_at: string;
};

type BundleRow = {
  id: string; slug: string; title: string; status: string;
  price_cents: number; currency: string; created_at: string;
};

/**
 * Sección "Mis ofertas" reorganizada por app.
 *
 * Cada app instalable tiene su bloque con:
 *   - Header con emoji + nombre + chip de estado (activa / desactivada)
 *   - Si activa: lista de sus productos + botón "+ Nuevo" que va directo
 *     al create flow con el tipo pre-seleccionado (skip wizard step 1)
 *   - Si desactivada: mensaje corto + link "Activar app" a /modulos
 *
 * Reemplaza el botón global "+ Crear oferta" que forzaba pasar por el
 * wizard genérico.
 */
export default async function CoursesIndex() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // ── Data loads ───────────────────────────────────────────────────
  const [
    { data: coursesRaw },
    physicalRaw,
    bundlesRaw
  ] = await Promise.all([
    svc.from("courses")
      .select("id, slug, title, status, price_cents, currency, product_type, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false }),
    // physical_products puede no existir en migraciones viejas
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (svc.from("physical_products") as any)
          .select("id, slug, title, status, price_cents, currency, stock_qty, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });
      } catch { return { data: [] }; }
    })(),
    // bundles idem
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (svc.from("bundles") as any)
          .select("id, slug, title, status, price_cents, currency, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });
      } catch { return { data: [] }; }
    })()
  ]);
  const courses = (coursesRaw ?? []) as CourseRow[];
  const physicalProducts = (physicalRaw.data ?? []) as PhysRow[];
  const bundles = (bundlesRaw.data ?? []) as BundleRow[];

  const modules = await getTenantModules(tenant.id);

  // Stats por publicación (clientes + revenue + trend 30d) — solo para courses
  type Stats = { clients: number; revenue: number; trend: number[] };
  const stats = new Map<string, Stats>();
  const courseIds = courses.map((c) => c.id);
  const now = Date.now();
  const since30 = new Date(now - 30 * 86400_000).toISOString();
  if (courseIds.length > 0) {
    const [{ data: enrollAgg }, { data: salesAgg }, { data: salesWithDate }] = await Promise.all([
      svc.from('enrollments').select('course_id, user_id')
        .eq('tenant_id', tenant.id).in('course_id', courseIds),
      svc.from('sales').select('course_id, amount_gross_cents')
        .eq('tenant_id', tenant.id).eq('status', 'paid').in('course_id', courseIds),
      svc.from('sales').select('course_id, amount_gross_cents, occurred_at')
        .eq('tenant_id', tenant.id).eq('status', 'paid').in('course_id', courseIds).gte('occurred_at', since30)
    ]);
    const uniqueByCourse = new Map<string, Set<string>>();
    for (const e of ((enrollAgg ?? []) as Array<{ course_id: string; user_id: string }>)) {
      if (!uniqueByCourse.has(e.course_id)) uniqueByCourse.set(e.course_id, new Set());
      uniqueByCourse.get(e.course_id)!.add(e.user_id);
    }
    const revByCourse = new Map<string, number>();
    for (const s of ((salesAgg ?? []) as Array<{ course_id: string; amount_gross_cents: number }>)) {
      revByCourse.set(s.course_id, (revByCourse.get(s.course_id) ?? 0) + Number(s.amount_gross_cents));
    }
    const trendByCourse = new Map<string, number[]>();
    for (const c of courses) trendByCourse.set(c.id, Array.from({ length: 30 }, () => 0));
    for (const s of ((salesWithDate ?? []) as Array<{ course_id: string; amount_gross_cents: number; occurred_at: string }>)) {
      const arr = trendByCourse.get(s.course_id);
      if (!arr) continue;
      const daysAgo = Math.floor((now - new Date(s.occurred_at).getTime()) / 86400_000);
      const idx = 29 - daysAgo;
      if (idx >= 0 && idx < 30) arr[idx] += Number(s.amount_gross_cents);
    }
    for (const c of courses) {
      stats.set(c.id, {
        clients: uniqueByCourse.get(c.id)?.size ?? 0,
        revenue: revByCourse.get(c.id) ?? 0,
        trend: trendByCourse.get(c.id) ?? Array.from({ length: 30 }, () => 0)
      });
    }
  }

  // ── Grupos por app ───────────────────────────────────────────────
  // "Publicaciones" (courses genérico) atrapa product_type que no
  // esté explícitamente ruteado a otra app.
  const publicaciones = courses.filter((c) =>
    !c.product_type ||
    c.product_type === 'course' ||
    c.product_type === 'digital' ||
    c.product_type === 'service'
  );
  const vipPacks       = courses.filter((c) => c.product_type === 'vip_pack');
  const events         = courses.filter((c) => c.product_type === 'event');
  const reservations   = courses.filter((c) => c.product_type === 'mentorship' || c.product_type === 'multi_venue' || c.product_type === 'restaurant');
  const topups         = courses.filter((c) => c.product_type === 'topup');

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        title="Mis ofertas"
        description="Cada app te habilita un tipo de venta distinto. Instalá las que necesites desde Mi sitio → Apps."
      />

      {/* Publicaciones — siempre visible (courses macro está prendido default) */}
      <AppSection
        moduleActive={modules.courses !== false}
        moduleKey="courses"
        emoji="🎓"
        title="Cursos, publicaciones y servicios"
        subtitle="Cursos online, productos digitales, servicios profesionales — todo lo genérico"
        newHref="/courses/new"
        items={publicaciones}
        stats={stats}
      />

      <AppSection
        moduleActive={modules.ecommerce !== false}
        moduleKey="ecommerce"
        emoji="🛒"
        title="Tienda online (productos físicos)"
        subtitle="Productos con envío, variantes, stock. Se ven en /tienda."
        newHref="/products/new"
        physicalItems={physicalProducts}
      />

      <AppSection
        moduleActive={modules.vip !== false}
        moduleKey="vip"
        emoji="💎"
        title="Contenido VIP"
        subtitle="Packs de contenido premium bloqueado (galería estilo OnlyFans)"
        newHref="/vip"
        newLabel="Ir a Contenido VIP"
        items={vipPacks}
        stats={stats}
      />

      <AppSection
        moduleActive={modules.events !== false}
        moduleKey="events"
        emoji="🎫"
        title="Eventos con tickets"
        subtitle="Conciertos, conferencias, talleres — entradas con QR"
        newHref="/crear-oferta?type=event"
        items={events}
        stats={stats}
      />

      <AppSection
        moduleActive={modules.reservations !== false}
        moduleKey="reservations"
        emoji="📅"
        title="Reservas y turnos"
        subtitle="Mentorías 1-a-1, restaurantes, sedes con turnos"
        newHref="/crear-oferta?type=mentorship"
        items={reservations}
        stats={stats}
      />

      <AppSection
        moduleActive={modules.bundles !== false}
        moduleKey="bundles"
        emoji="🎁"
        title="Bundles / Kits"
        subtitle="Combos de productos con descuento"
        newHref="/bundles"
        newLabel="Ir a Bundles"
        bundleItems={bundles}
      />

      <AppSection
        moduleActive={modules.wallets !== false}
        moduleKey="wallets"
        emoji="💰"
        title="Cargas de saldo"
        subtitle="Productos que acreditan saldo interno al buyer"
        newHref="/crear-oferta?type=topup"
        items={topups}
        stats={stats}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Render de cada sección de app — states: activa (con lista +
   botón nuevo) / desactivada (con activar link).
   ───────────────────────────────────────────────────────────── */
function AppSection({
  moduleActive, moduleKey, emoji, title, subtitle,
  newHref, newLabel = '+ Nuevo',
  items, physicalItems, bundleItems, stats
}: {
  moduleActive: boolean;
  moduleKey: ModuleKey;
  emoji: string;
  title: string;
  subtitle: string;
  newHref: string;
  newLabel?: string;
  items?: CourseRow[];
  physicalItems?: PhysRow[];
  bundleItems?: BundleRow[];
  stats?: Map<string, { clients: number; revenue: number; trend: number[] }>;
}) {
  void moduleKey;
  const hasCourses = (items?.length ?? 0) > 0;
  const hasPhys = (physicalItems?.length ?? 0) > 0;
  const hasBundles = (bundleItems?.length ?? 0) > 0;
  const isEmpty = !hasCourses && !hasPhys && !hasBundles;

  return (
    <section className="rounded-xl border border-white/10 overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-5 py-4 bg-white/[0.02] border-b border-white/10">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>{emoji}</span>
            <span>{title}</span>
            <span className={`text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${
              moduleActive
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-white/10 text-white/50'
            }`}>
              {moduleActive ? 'Activa' : 'Off'}
            </span>
          </h2>
          <p className="text-xs text-white/55 mt-0.5">{subtitle}</p>
        </div>
        {moduleActive ? (
          <Link href={newHref}
            className="shrink-0 rounded-md bg-white text-black text-sm font-semibold px-3 py-1.5 hover:bg-white/90">
            {newLabel}
          </Link>
        ) : (
          <Link href="/modulos"
            className="shrink-0 rounded-md border border-white/15 text-white/70 text-sm px-3 py-1.5 hover:bg-white/5">
            Activar app →
          </Link>
        )}
      </header>

      {!moduleActive ? (
        <div className="px-5 py-6 text-sm text-white/50">
          Instalá esta app para empezar a vender {title.toLowerCase()}.
        </div>
      ) : isEmpty ? (
        <div className="px-5 py-6 text-sm text-white/45">
          Todavía no tenés {title.toLowerCase()}. Tocá <strong className="text-white/70">{newLabel}</strong> para crear la primera.
        </div>
      ) : items && stats ? (
        <AppSectionList
          kind="courses"
          rows={items.map((c) => {
            const s = stats.get(c.id);
            return {
              id: c.id, slug: c.slug, title: c.title, status: c.status,
              price_cents: c.price_cents, currency: c.currency,
              clients: s?.clients ?? 0,
              revenue: s?.revenue ?? 0,
              trend: s?.trend,
              editHref: editHrefFor(c)
            };
          })}
        />
      ) : physicalItems ? (
        <AppSectionList
          kind="physical"
          rows={physicalItems.map((p) => ({
            id: p.id, slug: p.slug, title: p.title, status: p.status,
            price_cents: p.price_cents, currency: p.currency,
            stock_qty: p.stock_qty,
            editHref: `/products/${p.id}`
          }))}
        />
      ) : bundleItems ? (
        <AppSectionList
          kind="bundles"
          rows={bundleItems.map((b) => ({
            id: b.id, slug: b.slug, title: b.title, status: b.status,
            price_cents: b.price_cents, currency: b.currency,
            editHref: `/bundles/${b.id}`
          }))}
        />
      ) : null}
    </section>
  );
}

/** VIP packs se editan en /owner/vip/[id]; el resto en /owner/courses/[id]. */
function editHrefFor(c: CourseRow): string {
  if (c.product_type === 'vip_pack') return `/vip/${c.id}`;
  return `/courses/${c.id}`;
}
