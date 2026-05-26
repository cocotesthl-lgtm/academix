import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerBalance } from "@/lib/debt/accrue";

export const dynamic = "force-dynamic";

function ars(cents: number) {
  return `${(cents / 100).toLocaleString('es-AR')}`;
}

export default async function OwnerDashboard() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: publishedCourses },
    { count: draftCourses },
    { count: activeStudents },
    { data: salesRows },
    balance,
    { count: openTickets },
    { data: integrations }
  ] = await Promise.all([
    svc.from('courses').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('status', 'published'),
    svc.from('courses').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('status', 'draft'),
    svc.from('enrollments').select('user_id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('status', 'active'),
    svc.from('sales').select('amount_gross_cents')
      .eq('tenant_id', tenant.id).eq('status', 'paid').gte('occurred_at', since),
    getOwnerBalance(tenant.id),
    svc.from('support_tickets').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('status', 'open'),
    svc.from('integrations').select('provider, status').eq('tenant_id', tenant.id)
  ]);

  const sales = (salesRows ?? []) as Array<{ amount_gross_cents: number }>;
  const gmv30 = sales.reduce((s, r) => s + Number(r.amount_gross_cents), 0);
  const integrationsList = (integrations ?? []) as Array<{ provider: string; status: string }>;
  const mpConnected = integrationsList.some((i) => i.provider === 'mercadopago' && i.status === 'connected');

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">{tenant.name}</h1>
        <p className="text-white/60 text-sm mt-1">
          Resumen de tu academia los últimos 30 días.
        </p>
      </div>

      {!mpConnected && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-4">
          <div>
            <strong className="text-amber-200">No conectaste MercadoPago todavía.</strong>
            <p className="text-sm text-amber-200/80 mt-0.5">
              Sin pasarela los alumnos no pueden pagar tus cursos.
            </p>
          </div>
          <Link
            href="/integrations"
            className="rounded-md bg-amber-200 text-amber-900 px-4 py-2 text-sm font-semibold whitespace-nowrap"
          >
            Conectar
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Cursos publicados" value={(publishedCourses ?? 0).toString()} sub={`${draftCourses ?? 0} en borrador`} />
        <Stat label="Alumnos activos" value={(activeStudents ?? 0).toString()} />
        <Stat label="Ventas 30d" value={`$ ${ars(gmv30)}`} sub={`${sales.length} transacciones`} />
        <Stat label="Comisión a pagar" value={`$ ${ars(balance)}`} highlight={balance > 0} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ActionCard
          title="Próximos pasos"
          items={[
            { label: 'Personalizá tu marca', href: '/branding' },
            { label: 'Crear un curso nuevo', href: '/courses/new' },
            { label: 'Ver storefront público', href: `http://${tenant.slug}.localhost:3000`, external: true },
            { label: 'Invitar afiliados', href: '/affiliates' }
          ]}
        />
        <div className="rounded-xl border border-white/10 p-5">
          <h3 className="font-semibold mb-2">Soporte</h3>
          <p className="text-sm text-white/60 mb-3">
            {openTickets && openTickets > 0
              ? `Tenés ${openTickets} ticket(s) abiertos.`
              : 'No tenés tickets abiertos.'}
          </p>
          <Link href="/tickets" className="text-sm text-white hover:underline">Ver bandeja →</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/[0.02]'}`}>
      <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-2 font-mono">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  );
}

function ActionCard({ title, items }: { title: string; items: Array<{ label: string; href: string; external?: boolean }> }) {
  return (
    <div className="rounded-xl border border-white/10 p-5">
      <h3 className="font-semibold mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              target={i.external ? '_blank' : undefined}
              className="text-sm text-white/80 hover:text-white inline-flex items-center gap-1"
            >
              {i.label} <span className="text-white/40">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
