import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerBalance } from "@/lib/debt/accrue";
import { tenantOrigin } from "@/lib/env";
import { OnboardingChecklist, type OnboardingStep } from "@/components/owner/OnboardingChecklist";
import { Sparkline } from "@/components/owner/Sparkline";
import { relativeTime, absoluteTime } from "@/lib/time";
import { getTenantModules } from "@/lib/modules/queries";

export const dynamic = "force-dynamic";

function ars(cents: number) {
  return `${(cents / 100).toLocaleString('es-AR')}`;
}

/**
 * Inicio del owner. Pensado como home accionable, no como pantalla de KPIs.
 *
 * - Alertas arriba (MP no conectado, próximo evento, deuda alta)
 * - 4 KPIs con comparativa 30d
 * - Próximo evento destacado (si hay)
 * - Acciones rápidas según estado (sin publicaciones → "creá tu primera publicación";
 *   con publicaciones → "crear nuevo evento" + "ver storefront")
 * - Actividad reciente (últimas 5 ventas)
 */
export default async function OwnerDashboard() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const storefrontUrl = tenantOrigin(tenant.slug);
  // F4: qué módulos están activos → cada card se muestra solo si su
  // módulo lo está. El "widget Hoy" resume por módulo.
  const modules = await getTenantModules(tenant.id);

  const now = Date.now();
  const since30 = new Date(now - 30 * 86400_000).toISOString();
  const since60to30 = new Date(now - 60 * 86400_000).toISOString();

  const [
    coursesCount,
    publishedCount,
    sales30Res,
    salesPrev30Res,
    clientsCount,
    recentSalesRes,
    balance,
    openSupportRes,
    integrationsRes,
    nextEventRes
  ] = await Promise.all([
    svc.from('courses').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
    svc.from('courses').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('status', 'published'),
    svc.from('sales').select('amount_gross_cents')
      .eq('tenant_id', tenant.id).eq('status', 'paid').gte('occurred_at', since30),
    svc.from('sales').select('amount_gross_cents')
      .eq('tenant_id', tenant.id).eq('status', 'paid')
      .gte('occurred_at', since60to30).lt('occurred_at', since30),
    svc.from('enrollments').select('user_id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('status', 'active'),
    svc.from('sales')
      .select('id, amount_gross_cents, currency, occurred_at, buyer_name, buyer_email, course_id, status')
      .eq('tenant_id', tenant.id).order('occurred_at', { ascending: false }).limit(5),
    getOwnerBalance(tenant.id),
    svc.from('support_tickets').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('status', 'open'),
    svc.from('integrations').select('provider, status').eq('tenant_id', tenant.id),
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await svc
          .from('calendar_dates')
          .select('id, date, course_id, start_min, capacity, seat_mode')
          .eq('tenant_id', tenant.id)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(3);
        return (data ?? []) as Array<{ id: string; date: string; course_id: string | null; start_min: number; capacity: number; seat_mode: string }>;
      } catch { return []; }
    })()
  ]);

  const sales30 = (sales30Res.data ?? []) as Array<{ amount_gross_cents: number }>;
  const salesPrev30 = (salesPrev30Res.data ?? []) as Array<{ amount_gross_cents: number }>;
  const gmv30 = sales30.reduce((s, r) => s + Number(r.amount_gross_cents), 0);
  const gmvPrev30 = salesPrev30.reduce((s, r) => s + Number(r.amount_gross_cents), 0);
  const gmvDelta = gmvPrev30 > 0 ? Math.round(((gmv30 - gmvPrev30) / gmvPrev30) * 100) : null;

  // Sparkline data: ventas por día últimos 30 días + top publicaciones
  const { data: salesWithDateRes } = await svc.from('sales')
    .select('amount_gross_cents, occurred_at, course_id')
    .eq('tenant_id', tenant.id).eq('status', 'paid').gte('occurred_at', since30);
  const salesByDay: number[] = Array.from({ length: 30 }, () => 0);
  const revenueByCourse = new Map<string, { revenue: number; count: number }>();
  for (const s of ((salesWithDateRes ?? []) as Array<{ amount_gross_cents: number; occurred_at: string; course_id: string | null }>)) {
    const daysAgo = Math.floor((now - new Date(s.occurred_at).getTime()) / 86400_000);
    const idx = 29 - daysAgo;
    if (idx >= 0 && idx < 30) salesByDay[idx] += Number(s.amount_gross_cents);
    if (s.course_id) {
      const cur = revenueByCourse.get(s.course_id) ?? { revenue: 0, count: 0 };
      cur.revenue += Number(s.amount_gross_cents);
      cur.count += 1;
      revenueByCourse.set(s.course_id, cur);
    }
  }

  // Top 5 publicaciones por revenue 30d
  const topCourseIds = Array.from(revenueByCourse.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5).map((e) => e[0]);
  let topCourses: Array<{ id: string; title: string; revenue: number; count: number }> = [];
  if (topCourseIds.length > 0) {
    const { data: titles } = await svc.from('courses').select('id, title').in('id', topCourseIds);
    const titleMap = new Map(((titles ?? []) as Array<{ id: string; title: string }>).map((c) => [c.id, c.title]));
    topCourses = topCourseIds.map((id) => ({
      id, title: titleMap.get(id) ?? 'Publicación eliminado',
      revenue: revenueByCourse.get(id)!.revenue,
      count: revenueByCourse.get(id)!.count
    }));
  }
  const maxRevenue = topCourses.length > 0 ? topCourses[0].revenue : 0;

  const recentSales = (recentSalesRes.data ?? []) as Array<{
    id: string; amount_gross_cents: number; currency: string; occurred_at: string;
    buyer_name: string | null; buyer_email: string | null; course_id: string | null;
    status: string;
  }>;
  const integrations = (integrationsRes.data ?? []) as Array<{ provider: string; status: string }>;
  const mpConnected = integrations.some((i) => i.provider === 'mercadopago' && i.status === 'connected');
  const totalCourses = coursesCount.count ?? 0;
  const totalPublished = publishedCount.count ?? 0;
  const totalClients = clientsCount.count ?? 0;
  const openSupport = openSupportRes.count ?? 0;

  // Next events: fetch ticket counts + course titles in batch
  type EventCard = {
    id: string; date: string; start_min: number; capacity: number;
    course_id: string | null; courseTitle: string; ticketsSold: number;
  };
  const upcomingEvents: EventCard[] = [];
  if (nextEventRes.length > 0) {
    try {
      const eventIds = nextEventRes.map((e) => e.id);
      const courseIdsFromEvents = Array.from(new Set(nextEventRes.map((e) => e.course_id).filter((c): c is string => !!c)));
      const [tCountRes, coursesRes] = await Promise.all([
        svc.from('event_tickets').select('calendar_date_id').in('calendar_date_id', eventIds).eq('status', 'confirmed'),
        courseIdsFromEvents.length > 0
          ? svc.from('courses').select('id, title').in('id', courseIdsFromEvents)
          : Promise.resolve({ data: [] })
      ]);
      const ticketsByDate = new Map<string, number>();
      for (const t of ((tCountRes.data ?? []) as Array<{ calendar_date_id: string }>)) {
        ticketsByDate.set(t.calendar_date_id, (ticketsByDate.get(t.calendar_date_id) ?? 0) + 1);
      }
      const titleMap = new Map(((coursesRes.data ?? []) as Array<{ id: string; title: string }>).map((c) => [c.id, c.title]));
      for (const e of nextEventRes) {
        upcomingEvents.push({
          id: e.id, date: e.date, start_min: e.start_min, capacity: e.capacity,
          course_id: e.course_id,
          courseTitle: e.course_id ? (titleMap.get(e.course_id) ?? 'Evento') : 'Evento',
          ticketsSold: ticketsByDate.get(e.id) ?? 0
        });
      }
    } catch { /* ignore */ }
  }

  const isNewAccount = totalCourses === 0;

  // Onboarding: detectar qué pasos faltan
  const { data: tenantBrand } = await svc
    .from('tenants').select('brand').eq('id', tenant.id).maybeSingle<{ brand: { logo_url?: string; primary_color?: string } | null }>();
  const hasBranding = !!(tenantBrand?.brand?.logo_url || (tenantBrand?.brand?.primary_color && tenantBrand.brand.primary_color !== '#f97316'));
  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'brand',
      title: 'Personalizá tu marca',
      description: 'Subí tu logo y elegí un color principal.',
      href: '/branding',
      done: hasBranding
    },
    {
      id: 'mp',
      title: 'Conectá MercadoPago',
      description: 'Necesario para cobrar las ventas.',
      href: '/integrations',
      done: mpConnected
    },
    {
      id: 'course',
      title: 'Creá tu primera oferta',
      description: 'Publicación, evento, mentoría, servicio, producto físico o digital, reserva.',
      href: '/courses/new',
      done: totalCourses > 0
    },
    {
      id: 'publish',
      title: 'Publicá al menos una oferta',
      description: 'Los borradores no aparecen en tu sitio público.',
      href: '/courses',
      done: totalPublished > 0
    }
  ];

  return (
    <div className="space-y-7 max-w-6xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hola, {tenant.name}</h1>
          <p className="text-white/55 text-sm mt-1">
            Resumen de tu sitio.
          </p>
        </div>
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5 hover:border-white/30 transition"
        >
          ↗ Ver mi sitio público
        </a>
      </div>

      {/* ─── Onboarding checklist (se auto-oculta cuando 4/4 completados) ─── */}
      <OnboardingChecklist steps={onboardingSteps} />

      {/* ─── Widget "Hoy": stats accionables del día por módulo activo ─── */}
      <TodayWidget
        tenantId={tenant.id}
        showSales={modules.sales !== false}
        showCalendar={modules.calendar !== false}
        showCrm={modules.crm !== false}
      />

      {/* ─── Alertas críticas (no redundantes con el checklist) ─── */}
      {balance > 0 && (
        <Alert tone="amber" title={`Tenés $ ${ars(balance)} de comisión a pagar`}
          desc="Pagar a tiempo evita la suspensión de tu sitio."
          cta={{ label: 'Ver finanzas', href: '/finance' }} />
      )}

      {/* ─── KPIs (cada uno visible solo si su módulo lo está) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {modules.sales !== false && (
          <Kpi
            label="Ventas 30 días"
            value={`$ ${ars(gmv30)}`}
            sub={`${sales30.length} transacciones`}
            delta={gmvDelta}
            chart={<Sparkline values={salesByDay} color="#f97316" width={140} height={36} className="mt-2" />}
          />
        )}
        {modules.crm !== false && (
          <Kpi
            label="Clientes activos"
            value={String(totalClients)}
            sub={totalClients === 0 ? 'Compartí tu sitio' : `${upcomingEvents.length > 0 ? upcomingEvents[0].ticketsSold + ' tickets en próximo evento' : ''}`}
          />
        )}
        {modules.catalog !== false && (
          <Kpi
            label="Publicaciones publicados"
            value={String(totalPublished)}
            sub={totalCourses > totalPublished ? `${totalCourses - totalPublished} en borrador` : 'Todos publicados'}
          />
        )}
        {modules.sales !== false && (
          <Kpi
            label="Comisión a pagar"
            value={`$ ${ars(balance)}`}
            accent={balance > 0 ? 'amber' : undefined}
          />
        )}
      </div>

      {/* ─── Métricas VIP / Creator (parte del catálogo) ─── */}
      {modules.catalog !== false && <VipMetrics tenantId={tenant.id} />}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ─── Próximos eventos (hasta 3) ─── */}
        {modules.calendar !== false && upcomingEvents.length > 0 && (
          <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-5">
            <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-3">🎟️ Próximos eventos</div>
            <ul className="space-y-3">
              {upcomingEvents.map((ev) => {
                const dateLabel = new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR', {
                  weekday: 'short', day: 'numeric', month: 'short'
                });
                const timeLabel = `${String(Math.floor(ev.start_min / 60)).padStart(2, '0')}:${String(ev.start_min % 60).padStart(2, '0')}`;
                const pct = ev.capacity > 0 ? Math.min(100, Math.round((ev.ticketsSold / ev.capacity) * 100)) : 0;
                return (
                  <li key={ev.id}>
                    <Link href={`/eventos/${ev.id}`} className="block group">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-sm font-bold truncate group-hover:text-amber-300">{ev.courseTitle}</h3>
                        <span className="text-xs text-white/55 capitalize whitespace-nowrap">{dateLabel} · {timeLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-xs text-amber-300 font-medium">
                          {ev.ticketsSold}{ev.capacity > 0 ? `/${ev.capacity}` : ''} entradas
                        </div>
                        {ev.capacity > 0 && (
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2 mt-4">
              <Link href="/eventos/validar"
                className="rounded-md bg-orange-500 text-white px-3 py-1.5 text-xs font-semibold hover:bg-orange-400">
                Validar entradas
              </Link>
              <Link href="/eventos/asistencia"
                className="rounded-md border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5">
                Ver todos →
              </Link>
            </div>
          </div>
        )}

        {/* ─── Acciones rápidas ─── */}
        <QuickActions
          isNew={isNewAccount}
          hasMp={mpConnected}
          storefrontUrl={storefrontUrl}
        />
      </div>

      {/* ─── Top publicaciones ─── */}
      {modules.catalog !== false && modules.sales !== false && topCourses.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">Top publicaciones · últimos 30 días</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <ul className="divide-y divide-white/5">
              {topCourses.map((c, i) => {
                const pct = maxRevenue > 0 ? (c.revenue / maxRevenue) * 100 : 0;
                return (
                  <li key={c.id} className="px-4 py-3 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-orange-500/[0.07]"
                      style={{ width: `${pct}%` }}
                      aria-hidden="true"
                    />
                    <div className="relative flex items-center gap-3 text-sm">
                      <span className="text-white/40 text-xs font-mono w-4">{i + 1}</span>
                      <Link href={`/courses/${c.id}`} className="flex-1 font-medium truncate hover:underline">
                        {c.title}
                      </Link>
                      <span className="text-xs text-white/50">{c.count} {c.count === 1 ? 'venta' : 'ventas'}</span>
                      <span className="font-mono font-semibold text-emerald-300 whitespace-nowrap">
                        ${ars(c.revenue)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ─── Actividad reciente (solo si sales activo) ─── */}
      {modules.sales !== false && (
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">Últimas ventas</h2>
        {recentSales.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/45">
            <div className="text-2xl mb-2">🌱</div>
            <p className="text-sm">Todavía no tenés ventas.</p>
            <p className="text-xs mt-1">Cuando alguien compre, aparece acá.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <ul className="divide-y divide-white/5">
              {recentSales.map((s) => (
                <li key={s.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.buyer_name ?? s.buyer_email ?? '—'}</div>
                    <div className="text-xs text-white/45" title={absoluteTime(s.occurred_at)}>
                      {relativeTime(s.occurred_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">{s.currency} {ars(s.amount_gross_cents)}</div>
                    <div className={`text-[10px] uppercase tracking-wider ${
                      s.status === 'paid' ? 'text-emerald-300'
                      : s.status === 'refunded' ? 'text-rose-300'
                      : 'text-amber-300'
                    }`}>
                      {s.status === 'paid' ? 'pagada' : s.status === 'refunded' ? 'reembolsada' : 'pendiente'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-white/5 px-4 py-2 text-center">
              <Link href="/ventas" className="text-xs text-white/55 hover:text-white">
                Ver todas →
              </Link>
            </div>
          </div>
        )}
      </div>
      )}

      {openSupport > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm flex items-center justify-between gap-4">
          <span>📨 Tenés <strong>{openSupport}</strong> ticket{openSupport === 1 ? '' : 's'} de soporte abierto{openSupport === 1 ? '' : 's'}.</span>
          <Link href="/soporte" className="text-amber-200 hover:text-amber-100 font-medium">Ver →</Link>
        </div>
      )}
    </div>
  );
}

async function VipMetrics({ tenantId }: { tenantId: string }) {
  const svc = getServiceClient();
  type PackRow = { id: string; title: string; price_cents: number; pricing_mode: string | null };
  let packs: PackRow[] = [];
  let activeSubs = 0;
  let totalEnrollments = 0;
  let mrrCents = 0;
  let tips30Cents = 0;
  let tipsCount = 0;
  let migrationMissing = false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('courses') as any)
      .select('id, title, price_cents, pricing_mode')
      .eq('tenant_id', tenantId)
      .eq('product_type', 'vip_pack');
    if (error?.message?.includes('does not exist') || error?.message?.includes('column')) migrationMissing = true;
    packs = (data ?? []) as PackRow[];
  } catch { migrationMissing = true; }

  if (!migrationMissing && packs.length > 0) {
    const packIds = packs.map((p) => p.id);
    // Total enrollments en cualquier pack VIP
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: enrCount } = await (svc.from('enrollments') as any)
      .select('id', { count: 'exact', head: true })
      .in('course_id', packIds);
    totalEnrollments = enrCount ?? 0;

    // Suscripciones activas (mp_subscriptions con status='active')
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: subs } = await (svc.from('mp_subscriptions') as any)
        .select('course_id, amount_cents, status, frequency_type')
        .in('course_id', packIds).eq('status', 'authorized');
      const subRows = (subs ?? []) as Array<{ course_id: string; amount_cents: number; frequency_type: string | null }>;
      activeSubs = subRows.length;
      for (const s of subRows) {
        // Normalizamos a mensual para el MRR
        if (s.frequency_type === 'yearly') mrrCents += Math.round(s.amount_cents / 12);
        else mrrCents += s.amount_cents;
      }
    } catch { /* tabla mp_subscriptions no existe — skip */ }

    // Tips últimos 30 días
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tipsRaw } = await (svc.from('tips') as any)
        .select('amount_cents').eq('tenant_id', tenantId).eq('status', 'paid')
        .gte('created_at', since);
      const tipsList = (tipsRaw ?? []) as Array<{ amount_cents: number }>;
      tipsCount = tipsList.length;
      tips30Cents = tipsList.reduce((s, t) => s + (t.amount_cents || 0), 0);
    } catch { /* migration 0033 falta — skip */ }
  }

  if (migrationMissing || packs.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span className="text-base">🔒</span> Métricas de Contenido VIP
        </h2>
        <Link href="/vip" className="text-xs text-amber-400 hover:text-amber-300">Gestionar packs →</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCell label="Packs activos" value={String(packs.length)} />
        <MetricCell label="Compras totales" value={String(totalEnrollments)} />
        <MetricCell label="Suscripciones activas" value={String(activeSubs)} sub={activeSubs > 0 ? `MRR $ ${ars(mrrCents)}` : undefined} />
        <MetricCell label="Tips (30d)" value={`$ ${ars(tips30Cents)}`} sub={`${tipsCount} propinas`} />
      </div>
    </div>
  );
}

function MetricCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-black/30 border border-white/10 p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">{label}</div>
      <div className="text-xl font-bold mt-1 text-white">{value}</div>
      {sub && <div className="text-[10px] text-white/55 mt-0.5">{sub}</div>}
    </div>
  );
}

function Kpi({ label, value, sub, delta, accent, chart }: {
  label: string; value: string; sub?: string; delta?: number | null; accent?: 'amber';
  chart?: React.ReactNode;
}) {
  const border = accent === 'amber' ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/[0.02]';
  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <div className="text-[10px] text-white/45 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold mt-1.5 font-mono">{value}</div>
      <div className="text-[11px] text-white/40 mt-1 flex items-center gap-1.5 min-h-[1rem]">
        {delta !== null && delta !== undefined && (
          <span className={delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        )}
        {sub && <span className="truncate">{sub}</span>}
      </div>
      {chart}
    </div>
  );
}

function Alert({ tone, title, desc, cta }: {
  tone: 'amber' | 'emerald' | 'fuchsia';
  title: string; desc: string;
  cta: { label: string; href: string };
}) {
  const m = {
    amber: { bg: 'border-amber-500/30 bg-amber-500/10', text: 'text-amber-200', btn: 'bg-amber-200 text-amber-900 hover:bg-amber-100' },
    emerald: { bg: 'border-emerald-500/30 bg-emerald-500/10', text: 'text-emerald-200', btn: 'bg-emerald-200 text-emerald-900 hover:bg-emerald-100' },
    fuchsia: { bg: 'border-orange-500/30 bg-orange-500/10', text: 'text-amber-300', btn: 'bg-orange-500 text-white hover:bg-orange-400' }
  }[tone];
  return (
    <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${m.bg}`}>
      <div>
        <strong className={m.text}>{title}</strong>
        <p className={`text-sm ${m.text}/80 mt-0.5`}>{desc}</p>
      </div>
      <Link href={cta.href}
        className={`rounded-md ${m.btn} px-4 py-2 text-sm font-semibold whitespace-nowrap`}>
        {cta.label}
      </Link>
    </div>
  );
}

function QuickActions({ isNew, hasMp, storefrontUrl }: {
  isNew: boolean; hasMp: boolean; storefrontUrl: string;
}) {
  const actions = isNew
    ? [
        { label: '✨ Personalizá tu marca', href: '/branding', sub: 'Logo y colores' },
        { label: '🛍️ Creá tu primera oferta', href: '/courses/new', sub: 'Empezá a vender' },
        { label: hasMp ? '✓ MP conectado' : '💳 Conectá MercadoPago', href: '/integrations', sub: hasMp ? 'Listo para cobrar' : 'Para recibir pagos' },
        { label: '🎨 Editá tu landing', href: '/site', sub: 'Diseñá tu home' }
      ]
    : [
        { label: '📚 Crear nueva publicación', href: '/courses/new', sub: 'Publicación o evento' },
        { label: '🎟️ Programar evento', href: '/eventos/calendario', sub: 'Fecha + capacidad' },
        { label: '🎨 Editar landing', href: '/site', sub: 'Mi sitio público' },
        { label: '↗ Ver mi storefront', href: storefrontUrl, sub: 'Como lo ve el cliente', external: true }
      ];
  return (
    <div className="rounded-xl border border-white/10 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">Acciones rápidas</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            target={'external' in a && a.external ? '_blank' : undefined}
            className="rounded-lg border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.05] hover:border-white/20 transition"
          >
            <div className="text-sm font-medium">{a.label}</div>
            <div className="text-[11px] text-white/45 mt-0.5">{a.sub}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * TodayWidget — resumen accionable del día.
 * Muestra una fila con 1-4 cards según qué módulos estén activos.
 * Cada card es un contador + link directo al lugar donde actuar.
 * Defensivo: si alguna query falla, esa card no aparece (no rompe el dashboard).
 */
async function TodayWidget({
  tenantId,
  showSales,
  showCalendar,
  showCrm
}: {
  tenantId: string;
  showSales: boolean;
  showCalendar: boolean;
  showCrm: boolean;
}) {
  const svc = getServiceClient();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayStart = new Date(todayStr + 'T00:00:00').toISOString();
  const todayEnd = new Date(todayStr + 'T23:59:59').toISOString();

  const [salesTodayRes, eventsTodayRes, leadsTodayRes, dmsUnreadRes] = await Promise.all([
    showSales
      ? svc.from('sales').select('amount_gross_cents')
          .eq('tenant_id', tenantId).eq('status', 'paid')
          .gte('occurred_at', todayStart).lte('occurred_at', todayEnd)
      : Promise.resolve({ data: [] }),
    showCalendar
      ? svc.from('calendar_dates').select('id, start_min, course_id')
          .eq('tenant_id', tenantId).eq('date', todayStr).order('start_min')
      : Promise.resolve({ data: [] }),
    showCrm
      ? svc.from('leads').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).gte('created_at', todayStart)
      : Promise.resolve({ count: 0 }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    showCrm
      ? (svc.from('dm_threads') as any).select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).gt('unread_count_owner', 0)
      : Promise.resolve({ count: 0 })
  ]);

  const salesToday = (salesTodayRes.data ?? []) as Array<{ amount_gross_cents: number }>;
  const gmvToday = salesToday.reduce((s, r) => s + Number(r.amount_gross_cents), 0);
  const eventsToday = ((eventsTodayRes.data ?? []) as Array<{ id: string; start_min: number }>);
  const leadsCount = (leadsTodayRes as { count?: number | null }).count ?? 0;
  const unreadDms = (dmsUnreadRes as { count?: number | null }).count ?? 0;

  const cards: Array<{ icon: string; label: string; value: string; sub: string; href: string; tone: string }> = [];
  if (showSales) {
    cards.push({
      icon: '💰', label: 'Ventas hoy',
      value: `$ ${(gmvToday / 100).toLocaleString('es-AR')}`,
      sub: `${salesToday.length} ${salesToday.length === 1 ? 'venta' : 'ventas'}`,
      href: '/ventas', tone: 'emerald'
    });
  }
  if (showCalendar) {
    const nextTime = eventsToday.length > 0
      ? `próximo ${String(Math.floor(eventsToday[0].start_min / 60)).padStart(2, '0')}:${String(eventsToday[0].start_min % 60).padStart(2, '0')}`
      : 'sin agenda';
    cards.push({
      icon: '📅', label: 'Hoy en agenda',
      value: String(eventsToday.length),
      sub: nextTime,
      href: '/eventos/calendario', tone: 'sky'
    });
  }
  if (showCrm) {
    cards.push({
      icon: '🎯', label: 'Leads hoy',
      value: String(leadsCount),
      sub: leadsCount === 0 ? 'sin nuevos' : 'requieren atención',
      href: '/crm', tone: 'amber'
    });
    cards.push({
      icon: '💬', label: 'Mensajes sin leer',
      value: String(unreadDms),
      sub: unreadDms === 0 ? 'al día' : 'nuevos',
      href: '/mensajes', tone: 'violet'
    });
  }
  if (cards.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
        Hoy · {now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}
            className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 p-4 transition group">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50 font-semibold">
              <span className="text-base">{c.icon}</span>
              <span>{c.label}</span>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums">{c.value}</div>
            <div className="text-[11px] text-white/45 mt-0.5">{c.sub}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
