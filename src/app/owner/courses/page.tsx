import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { getTenantModules } from "@/lib/modules/queries";
import { PageHeader } from "@/components/owner/PageHeader";
import { AppSectionList } from "@/components/owner/courses/AppSectionList";
import { MisOfertasFilter } from "@/components/owner/courses/MisOfertasFilter";
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
  cover_url: string | null;
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
  cover_url: string | null;
  sku: string | null;
  created_at: string;
};

type BundleRow = {
  id: string; slug: string; title: string; status: string;
  price_cents: number; currency: string; cover_url: string | null; created_at: string;
};

type ArticleRow = {
  id: string; slug: string; title: string;
  status: 'draft' | 'published';
  cover_url: string | null;
  updated_at: string;
};

type ExtraLink = { label: string; href: string; emoji?: string };

/**
 * Sección "Mis publicaciones" reorganizada por app.
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
    bundlesRaw,
    articlesRaw
  ] = await Promise.all([
    svc.from("courses")
      .select("id, slug, title, status, price_cents, currency, product_type, cover_url, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false }),
    // physical_products puede no existir en migraciones viejas
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (svc.from("physical_products") as any)
          .select("id, slug, title, status, price_cents, currency, stock_qty, cover_url, sku, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });
      } catch { return { data: [] }; }
    })(),
    // bundles idem
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (svc.from("bundles") as any)
          .select("id, slug, title, status, price_cents, currency, cover_url, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });
      } catch { return { data: [] }; }
    })(),
    // articles idem — módulo blog opcional
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (svc.from("articles") as any)
          .select("id, slug, title, status, cover_url, updated_at")
          .eq("tenant_id", tenant.id)
          .order("updated_at", { ascending: false });
      } catch { return { data: [] }; }
    })()
  ]);
  const courses = (coursesRaw ?? []) as CourseRow[];
  const physicalProducts = (physicalRaw.data ?? []) as PhysRow[];
  const bundles = (bundlesRaw.data ?? []) as BundleRow[];
  const articles = (articlesRaw.data ?? []) as ArticleRow[];

  const modules = await getTenantModules(tenant.id);

  // Counts defensivos para las apps sin lista completa (planes, promos,
  // dropship): sólo mostramos "N ítems" en el header. Si la tabla no
  // existe (migración vieja) fallback silencioso a 0.
  async function countRows(table: string, extraFilter?: (q: unknown) => unknown): Promise<number> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = (svc.from(table) as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
      if (extraFilter) q = extraFilter(q);
      const { count } = await q;
      return count ?? 0;
    } catch { return 0; }
  }
  const [plansCount, promotionsCount, dropshipCount] = await Promise.all([
    countRows('customer_plans'),
    countRows('promotions'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countRows('reseller_products', (q: any) => q)
  ]);

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
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Mis publicaciones"
        description="Cada app te habilita un tipo de venta distinto. Instalá las que necesites desde Mi sitio → Apps."
      />

      <MisOfertasFilter />

      <div id="mis-ofertas-sections" data-filter="active" className="space-y-8">

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
        extras={[
          { emoji: '🗂️', label: 'Categorías', href: '/categories' }
        ]}
      />

      <AppSection
        moduleActive={modules.blog !== false}
        moduleKey="blog"
        emoji="📝"
        title="Blog / Artículos"
        subtitle="Publicá artículos, noticias y guías. Cada artículo tiene su URL pública en /blog/<slug>."
        newHref="/blog"
        newLabel="Ir al blog"
        articleItems={articles}
      />

      <AppSection
        moduleActive={modules.ecommerce !== false}
        moduleKey="ecommerce"
        emoji="🛒"
        title="Tienda online (productos físicos)"
        subtitle="Productos con envío, variantes, stock. Se ven en /tienda."
        newHref="/products/new"
        physicalItems={physicalProducts}
        extras={[
          { emoji: '📷', label: 'Escanear inventario', href: '/inventory-scan' },
          { emoji: '🚚', label: 'Envíos', href: '/shipping' },
          { emoji: '📦', label: 'Órdenes', href: '/orders' },
          { emoji: '🗂️', label: 'Categorías', href: '/categories' },
          { emoji: '🎟️', label: 'Gift cards', href: '/giftcards' }
        ]}
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
        extras={[
          { emoji: '💬', label: 'Mensajes', href: '/mensajes' }
        ]}
      />

      <AppSection
        moduleActive={modules.events !== false}
        moduleKey="events"
        emoji="🎫"
        title="Eventos con tickets"
        subtitle="Conciertos, conferencias, talleres — entradas con QR"
        newHref="/courses/new?type=event"
        items={events}
        stats={stats}
        extras={[
          { emoji: '📷', label: 'Escanear entradas', href: '/eventos/validar' },
          { emoji: '📋', label: 'Asistencia', href: '/eventos/asistencia' },
          { emoji: '📍', label: 'Sedes', href: '/eventos/calendario#sedes' }
        ]}
      />

      <AppSection
        moduleActive={modules.reservations !== false}
        moduleKey="reservations"
        emoji="📅"
        title="Reservas y turnos"
        subtitle="Mentorías 1-a-1, restaurantes, sedes con turnos"
        newHref="/courses/new?type=mentorship"
        items={reservations}
        stats={stats}
        extras={[
          { emoji: '🗓️', label: 'Calendario', href: '/eventos/calendario' },
          { emoji: '📍', label: 'Sedes', href: '/eventos/calendario#sedes' },
          { emoji: '👤', label: 'Reservas', href: '/reservas' }
        ]}
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
        newHref="/courses/new?type=topup"
        items={topups}
        stats={stats}
        extras={[
          { emoji: '💼', label: 'Saldos de clientes', href: '/wallets' }
        ]}
      />

      <AppSection
        moduleActive={modules.plans !== false}
        moduleKey="plans"
        emoji="💳"
        title="Planes / Suscripciones a clientes"
        subtitle={
          plansCount > 0
            ? `${plansCount} plan${plansCount === 1 ? '' : 'es'} asignado${plansCount === 1 ? '' : 's'} — cobros recurrentes`
            : 'Membresías, cuotas, cobros por servicio con cobro recurrente'
        }
        newHref="/cuentas"
        newLabel="Ir a Planes"
        items={[]}
        stats={stats}
        extras={[
          { emoji: '📊', label: 'Ver suscripciones', href: '/suscripciones' }
        ]}
      />

      <AppSection
        moduleActive={modules.promotions !== false}
        moduleKey="promotions"
        emoji="🎯"
        title="Promociones"
        subtitle={
          promotionsCount > 0
            ? `${promotionsCount} promocion${promotionsCount === 1 ? '' : 'es'} activas`
            : 'Cupones, descuentos y ofertas por tiempo limitado'
        }
        newHref="/promotions/new"
        items={[]}
        stats={stats}
      />

      <AppSection
        moduleActive={modules.dropshipping !== false}
        moduleKey="dropshipping"
        emoji="🚛"
        title="Dropshipping"
        subtitle={
          dropshipCount > 0
            ? `${dropshipCount} producto${dropshipCount === 1 ? '' : 's'} en reventa desde el marketplace mayorista`
            : 'Revendé productos de otros tenants sin manejar stock'
        }
        newHref="/dropship/browse"
        newLabel="Explorar catálogo"
        items={[]}
        stats={stats}
        extras={[
          { emoji: '📦', label: 'Órdenes dropship', href: '/dropship/orders' }
        ]}
      />
      </div>
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
  items, physicalItems, bundleItems, articleItems, stats,
  extras = []
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
  articleItems?: ArticleRow[];
  stats?: Map<string, { clients: number; revenue: number; trend: number[] }>;
  /** Shortcuts extra específicos de la app (envíos, escaneo, categorías, etc). */
  extras?: ExtraLink[];
}) {
  const hasCourses = (items?.length ?? 0) > 0;
  const hasPhys = (physicalItems?.length ?? 0) > 0;
  const hasBundles = (bundleItems?.length ?? 0) > 0;
  const hasArticles = (articleItems?.length ?? 0) > 0;
  const isEmpty = !hasCourses && !hasPhys && !hasBundles && !hasArticles;

  return (
    <section
      data-mod-active={moduleActive ? 'true' : 'false'}
      className={`rounded-xl border overflow-hidden ${moduleActive ? 'border-white/10' : 'border-white/5 opacity-90'}`}
    >
      <header className="flex items-start justify-between gap-3 px-5 py-4 bg-white/[0.02] border-b border-white/10">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2 flex-wrap">
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
          {/* Extras: chips con shortcuts a features relacionadas de la app */}
          {extras.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {extras.map((x) => (
                <Link key={x.href} href={x.href}
                  className="inline-flex items-center gap-1 text-[11px] rounded-full border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] px-2.5 py-1 text-white/75 hover:text-white transition">
                  {x.emoji && <span>{x.emoji}</span>}
                  <span>{x.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {moduleActive ? (
            <Link href={newHref}
              className="rounded-md bg-white text-black text-sm font-semibold px-3 py-1.5 hover:bg-white/90">
              {newLabel}
            </Link>
          ) : (
            <>
              <Link href={`/modulos?open=${moduleKey}`}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm px-3 py-1.5 hover:bg-emerald-500/20">
                ⚡ Activar app
              </Link>
              {!isEmpty && (
                <span className="text-[10px] text-white/40">
                  {(items?.length ?? 0) + (physicalItems?.length ?? 0) + (bundleItems?.length ?? 0) + (articleItems?.length ?? 0)} ítems guardados
                </span>
              )}
            </>
          )}
        </div>
      </header>

      {/* Cuando la app está off: si igual hay productos guardados de antes,
          los mostramos con un banner (evita "perder" data). Si no hay
          nada, mostramos el aviso de activar. */}
      {!moduleActive && isEmpty ? (
        <div className="px-5 py-6 text-sm text-white/50">
          Instalá esta app para empezar a vender {title.toLowerCase()}.
        </div>
      ) : !moduleActive && !isEmpty ? (
        <>
          <div className="px-5 py-2.5 text-xs text-amber-900 bg-amber-100 border-b border-amber-300 dark:text-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30">
            ⚠️ App desactivada — los productos siguen guardados pero se muestran como <strong>inactivos</strong> y ocultos por defecto.
          </div>
          {items && stats && (
            <AppSectionList
              kind="courses"
              dimmed
              rows={items.map((c) => {
                const s = stats.get(c.id);
                return {
                  id: c.id, slug: c.slug, title: c.title, status: c.status,
                  price_cents: c.price_cents, currency: c.currency,
                  cover_url: c.cover_url,
                  clients: s?.clients ?? 0, revenue: s?.revenue ?? 0, trend: s?.trend,
                  editHref: editHrefFor(c)
                };
              })}
            />
          )}
          {physicalItems && (
            <AppSectionList
              kind="physical"
              dimmed
              rows={physicalItems.map((p) => ({
                id: p.id, slug: p.slug, title: p.title, status: p.status,
                price_cents: p.price_cents, currency: p.currency,
                cover_url: p.cover_url, sku: p.sku,
                stock_qty: p.stock_qty,
                editHref: `/products/${p.id}`
              }))}
            />
          )}
          {bundleItems && (
            <AppSectionList
              kind="bundles"
              dimmed
              rows={bundleItems.map((b) => ({
                id: b.id, slug: b.slug, title: b.title, status: b.status,
                price_cents: b.price_cents, currency: b.currency,
                cover_url: b.cover_url,
                editHref: `/bundles/${b.id}`
              }))}
            />
          )}
          {articleItems && (
            <AppSectionList
              kind="articles"
              dimmed
              rows={articleItems.map((a) => ({
                id: a.id, slug: a.slug, title: a.title, status: a.status,
                price_cents: 0, currency: '',
                cover_url: a.cover_url,
                updated_at: a.updated_at,
                editHref: `/blog/${a.id}`
              }))}
            />
          )}
        </>
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
              cover_url: c.cover_url,
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
            cover_url: p.cover_url, sku: p.sku,
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
            cover_url: b.cover_url,
            editHref: `/bundles/${b.id}`
          }))}
        />
      ) : articleItems ? (
        <AppSectionList
          kind="articles"
          rows={articleItems.map((a) => ({
            id: a.id, slug: a.slug, title: a.title, status: a.status,
            price_cents: 0, currency: '',
            cover_url: a.cover_url,
            updated_at: a.updated_at,
            editHref: `/blog/${a.id}`
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
