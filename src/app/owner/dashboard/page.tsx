import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerBalance } from "@/lib/debt/accrue";
import { tenantOrigin } from "@/lib/env";
import { OnboardingChecklist, type OnboardingStep } from "@/components/owner/OnboardingChecklist";

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
 * - Acciones rápidas según estado (sin cursos → "creá tu primer curso";
 *   con cursos → "crear nuevo evento" + "ver storefront")
 * - Actividad reciente (últimas 5 ventas)
 */
export default async function OwnerDashboard() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const storefrontUrl = tenantOrigin(tenant.slug);

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
          .limit(1);
        return data?.[0] as { id: string; date: string; course_id: string | null; start_min: number; capacity: number; seat_mode: string } | undefined;
      } catch { return undefined; }
    })()
  ]);

  const sales30 = (sales30Res.data ?? []) as Array<{ amount_gross_cents: number }>;
  const salesPrev30 = (salesPrev30Res.data ?? []) as Array<{ amount_gross_cents: number }>;
  const gmv30 = sales30.reduce((s, r) => s + Number(r.amount_gross_cents), 0);
  const gmvPrev30 = salesPrev30.reduce((s, r) => s + Number(r.amount_gross_cents), 0);
  const gmvDelta = gmvPrev30 > 0 ? Math.round(((gmv30 - gmvPrev30) / gmvPrev30) * 100) : null;

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

  // Next event ticket sales count
  let nextEventTickets = 0;
  let nextEventCourseTitle = '';
  if (nextEventRes) {
    try {
      const [{ count }, { data: course }] = await Promise.all([
        svc.from('event_tickets').select('id', { count: 'exact', head: true })
          .eq('calendar_date_id', nextEventRes.id).eq('status', 'confirmed'),
        nextEventRes.course_id
          ? svc.from('courses').select('title').eq('id', nextEventRes.course_id).maybeSingle<{ title: string }>()
          : Promise.resolve({ data: null })
      ]);
      nextEventTickets = count ?? 0;
      nextEventCourseTitle = course?.title ?? 'Evento';
    } catch { /* ignore */ }
  }

  const isNewAccount = totalCourses === 0;

  // Onboarding: detectar qué pasos faltan
  const { data: tenantBrand } = await svc
    .from('tenants').select('brand').eq('id', tenant.id).maybeSingle<{ brand: { logo_url?: string; primary_color?: string } | null }>();
  const hasBranding = !!(tenantBrand?.brand?.logo_url || (tenantBrand?.brand?.primary_color && tenantBrand.brand.primary_color !== '#a855f7'));
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
      title: 'Creá tu primer curso',
      description: 'Curso online, evento con tickets o mentoría.',
      href: '/courses/new',
      done: totalCourses > 0
    },
    {
      id: 'publish',
      title: 'Publicá al menos un curso',
      description: 'Los borradores no aparecen en tu storefront público.',
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
            Resumen de tu academia.
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

      {/* ─── Alertas críticas (no redundantes con el checklist) ─── */}
      {balance > 0 && (
        <Alert tone="amber" title={`Tenés $ ${ars(balance)} de comisión a pagar`}
          desc="Pagar a tiempo evita la suspensión de tu academia."
          cta={{ label: 'Ver finanzas', href: '/finance' }} />
      )}

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Ventas 30 días"
          value={`$ ${ars(gmv30)}`}
          sub={`${sales30.length} transacciones`}
          delta={gmvDelta}
        />
        <Kpi
          label="Clientes activos"
          value={String(totalClients)}
          sub={totalClients === 0 ? 'Compartí tu sitio' : `${nextEventTickets > 0 ? nextEventTickets + ' tickets vendidos del evento próximo' : ''}`}
        />
        <Kpi
          label="Cursos publicados"
          value={String(totalPublished)}
          sub={totalCourses > totalPublished ? `${totalCourses - totalPublished} en borrador` : 'Todos publicados'}
        />
        <Kpi
          label="Comisión a pagar"
          value={`$ ${ars(balance)}`}
          accent={balance > 0 ? 'amber' : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ─── Próximo evento ─── */}
        {nextEventRes && (
          <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-fuchsia-300 font-semibold mb-1">🎟️ Próximo evento</div>
                <h3 className="text-lg font-bold">{nextEventCourseTitle}</h3>
                <p className="text-sm text-white/65 mt-1">
                  {new Date(nextEventRes.date + 'T12:00:00').toLocaleDateString('es-AR', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                  {' · '}
                  {String(Math.floor(nextEventRes.start_min / 60)).padStart(2, '0')}:
                  {String(nextEventRes.start_min % 60).padStart(2, '0')} hs
                </p>
              </div>
            </div>
            <div className="text-sm">
              <strong className="text-fuchsia-200">{nextEventTickets}</strong>
              {nextEventRes.capacity > 0 && (
                <span className="text-white/55"> / {nextEventRes.capacity}</span>
              )}
              <span className="text-white/55"> entradas vendidas</span>
            </div>
            <div className="flex gap-2 mt-4">
              <Link href="/eventos/validar"
                className="rounded-md bg-fuchsia-500 text-white px-3 py-1.5 text-xs font-semibold hover:bg-fuchsia-400">
                Validar entradas
              </Link>
              <Link href="/eventos/asistencia"
                className="rounded-md border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5">
                Ver asistencia
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

      {/* ─── Actividad reciente ─── */}
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
                    <div className="text-xs text-white/45">
                      {new Date(s.occurred_at).toLocaleString('es-AR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
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

      {openSupport > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm flex items-center justify-between gap-4">
          <span>📨 Tenés <strong>{openSupport}</strong> ticket{openSupport === 1 ? '' : 's'} de soporte abierto{openSupport === 1 ? '' : 's'}.</span>
          <Link href="/soporte" className="text-amber-200 hover:text-amber-100 font-medium">Ver →</Link>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, delta, accent }: {
  label: string; value: string; sub?: string; delta?: number | null; accent?: 'amber';
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
    fuchsia: { bg: 'border-fuchsia-500/30 bg-fuchsia-500/10', text: 'text-fuchsia-200', btn: 'bg-fuchsia-500 text-white hover:bg-fuchsia-400' }
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
        { label: '📚 Creá tu primer curso', href: '/courses/new', sub: 'Empezá a vender' },
        { label: hasMp ? '✓ MP conectado' : '💳 Conectá MercadoPago', href: '/integrations', sub: hasMp ? 'Listo para cobrar' : 'Para recibir pagos' },
        { label: '🎨 Editá tu landing', href: '/site', sub: 'Diseñá tu home' }
      ]
    : [
        { label: '📚 Crear nuevo curso', href: '/courses/new', sub: 'Curso o evento' },
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
