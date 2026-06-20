import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader, HeaderSecondary } from '@/components/owner/PageHeader';
import { BarChart } from '@/components/owner/BarChart';

export const dynamic = 'force-dynamic';

/**
 * Panel de Ventas — tabla de transacciones de la tabla `sales`.
 * Una row por compra (cada webhook MP aprobado crea una sale).
 *
 * Diferencia con Clientes:
 *  - Clientes = enrollments (un alumno puede tener 1 sola activa por curso).
 *  - Ventas = sales (cada pago, incluso re-compras, refunds, etc).
 */

type SaleRow = {
  id: string;
  course_id: string | null;
  buyer_user_id: string | null;
  external_provider: string;
  external_id: string;
  amount_gross_cents: number;
  amount_net_cents: number;
  currency: string;
  status: string;
  occurred_at: string;
  payment_kind?: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_dni: string | null;
};

export default async function OwnerVentasPage({
  searchParams
}: {
  searchParams: Promise<{ course?: string; status?: string; q?: string }>;
}) {
  const { tenant } = await requireOwner();
  const sp = await searchParams;
  const filterCourse = sp.course ?? '';
  const filterStatus = sp.status ?? '';
  const search = (sp.q ?? '').trim().toLowerCase();

  const svc = getServiceClient();

  let query = svc
    .from('sales')
    .select('id, course_id, buyer_user_id, external_provider, external_id, amount_gross_cents, amount_net_cents, currency, status, occurred_at, payment_kind, buyer_name, buyer_email, buyer_phone, buyer_dni')
    .eq('tenant_id', tenant.id)
    .order('occurred_at', { ascending: false });

  if (filterCourse) query = query.eq('course_id', filterCourse);
  if (filterStatus) query = query.eq('status', filterStatus);

  const { data: salesRaw } = await query.limit(500);
  const sales = (salesRaw ?? []) as SaleRow[];

  const { data: coursesRaw } = await svc
    .from('courses').select('id, title')
    .eq('tenant_id', tenant.id).order('title');
  const courses = (coursesRaw ?? []) as Array<{ id: string; title: string }>;
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  // Si buscás por N° de orden, resolvemos el sale via event_tickets.order_number
  let orderHits = new Set<string>(); // sale_ids que matchean por order_number
  if (search) {
    try {
      const { data: orderRaw } = await svc
        .from('event_tickets')
        .select('order_number, enrollment_id')
        .eq('tenant_id', tenant.id)
        .ilike('order_number', `%${search.toUpperCase()}%`)
        .limit(50);
      const enrollIdsFromOrders = ((orderRaw ?? []) as Array<{ enrollment_id: string | null }>)
        .map((t) => t.enrollment_id).filter((x): x is string => !!x);
      if (enrollIdsFromOrders.length > 0) {
        const { data: salesFromOrders } = await svc
          .from('enrollments').select('sale_id').in('id', enrollIdsFromOrders);
        orderHits = new Set(((salesFromOrders ?? []) as Array<{ sale_id: string | null }>)
          .map((e) => e.sale_id).filter((x): x is string => !!x));
      }
    } catch { /* tabla event_tickets no existe */ }
  }
  const filtered = search
    ? sales.filter((s) => {
        const hay = [s.buyer_name, s.buyer_email, s.buyer_phone, s.buyer_dni, s.external_id]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(search) || orderHits.has(s.id);
      })
    : sales;

  // Stats
  const totalGross = filtered
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + s.amount_gross_cents, 0);
  const totalSales = filtered.filter((s) => s.status === 'paid').length;
  const refunded = filtered.filter((s) => s.status === 'refunded').length;
  const pending = filtered.filter((s) => s.status === 'pending').length;
  const currency = filtered[0]?.currency ?? 'ARS';

  // Daily chart: ventas por día últimos 30 días (sobre filtered)
  const now = Date.now();
  const chartData: Array<{ label: string; value: number; subLabel?: string }> = Array.from(
    { length: 30 },
    (_, i) => {
      const d = new Date(now - (29 - i) * 86400_000);
      return {
        label: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        value: 0
      };
    }
  );
  for (const s of filtered.filter((s) => s.status === 'paid')) {
    const daysAgo = Math.floor((now - new Date(s.occurred_at).getTime()) / 86400_000);
    const idx = 29 - daysAgo;
    if (idx >= 0 && idx < 30) chartData[idx].value += Number(s.amount_gross_cents);
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Ventas"
        description="Cada compra confirmada genera una venta. Filtrá por curso, estado o buscá por nombre, email o N° de orden."
        actions={
          <>
            <HeaderSecondary href="/api/export/ventas">⬇ Exportar CSV</HeaderSecondary>
            <HeaderSecondary href="/clientes">Ver clientes</HeaderSecondary>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Ingresos brutos" value={`${currency} ${(totalGross / 100).toLocaleString('es-AR')}`} accent="emerald" />
        <Stat label="Ventas confirmadas" value={String(totalSales)} />
        <Stat label="Reembolsos" value={String(refunded)} accent={refunded > 0 ? 'rose' : undefined} />
        <Stat label="Pendientes" value={String(pending)} accent={pending > 0 ? 'amber' : undefined} />
      </div>

      {/* Daily chart: últimos 30 días */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-[10px] uppercase tracking-wider text-white/55 font-semibold">
            Ingresos por día · últimos 30 días
          </h2>
          {filterCourse && (
            <span className="text-[10px] text-white/40">(filtrado por curso)</span>
          )}
        </div>
        <BarChart
          data={chartData}
          height={140}
          formatValue={(v) => `${currency} ${(v / 100).toLocaleString('es-AR')}`}
          emptyText="Sin ventas en los últimos 30 días"
        />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-white/50 mb-1">Buscar</label>
          <input
            type="text" name="q" defaultValue={sp.q ?? ''}
            placeholder="Nombre, email, DNI, ID externo o N° de orden"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs text-white/50 mb-1">Curso</label>
          <select name="course" defaultValue={filterCourse}
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-white/50 mb-1">Estado</label>
          <select name="status" defaultValue={filterStatus}
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
            <option value="">Todos</option>
            <option value="paid">Pagada</option>
            <option value="pending">Pendiente</option>
            <option value="refunded">Reembolsada</option>
          </select>
        </div>
        <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold">Filtrar</button>
        {(filterCourse || filterStatus || search) && (
          <a href="/ventas" className="text-xs text-white/50 hover:text-white/80 underline">Limpiar</a>
        )}
      </form>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-white/50 text-sm">
            {sales.length === 0
              ? 'Todavía no hay ventas. Cuando alguien complete una compra, va a aparecer acá.'
              : 'Sin resultados con esos filtros.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#0f0f0f] text-white/50 text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2.5">Fecha</th>
                <th className="text-left px-3 py-2.5">Cliente</th>
                <th className="text-left px-3 py-2.5">Curso</th>
                <th className="text-right px-3 py-2.5">Monto</th>
                <th className="text-left px-3 py-2.5">Estado</th>
                <th className="text-left px-3 py-2.5">Proveedor</th>
                <th className="text-left px-3 py-2.5">ID externo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const course = s.course_id ? courseMap.get(s.course_id) : null;
                return (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="px-3 py-2.5 text-white/70 text-xs whitespace-nowrap">
                      {new Date(s.occurred_at).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{s.buyer_name || '—'}</div>
                      {s.buyer_email && (
                        <a href={`mailto:${s.buyer_email}`} className="text-xs text-white/55 hover:text-white">
                          {s.buyer_email}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-white/70">{course?.title ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <div>{s.currency} {(s.amount_gross_cents / 100).toLocaleString('es-AR')}</div>
                      {s.payment_kind === 'deposit' && (
                        <span className="inline-block mt-0.5 text-[9px] uppercase font-bold tracking-wider bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded">
                          🪙 Pago parcial
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-3 py-2.5 text-white/55 text-xs uppercase">{s.external_provider}</td>
                    <td className="px-3 py-2.5 text-white/40 text-xs font-mono">{s.external_id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-white/40">
        Mostrando hasta 500 ventas más recientes. Filtros reducen el set.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'rose' | 'amber' }) {
  const color = accent === 'emerald' ? 'text-emerald-300'
    : accent === 'rose' ? 'text-rose-300'
    : accent === 'amber' ? 'text-amber-300'
    : 'text-white';
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[10px] text-white/50 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold mt-2 ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: 'Pagada', cls: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' },
    pending: { label: 'Pendiente', cls: 'bg-amber-500/10 text-amber-300 border border-amber-500/30' },
    refunded: { label: 'Reembolsada', cls: 'bg-rose-500/10 text-rose-300 border border-rose-500/30' }
  };
  const info = map[status] ?? { label: status, cls: 'bg-white/5 text-white/55 border border-white/15' };
  return <span className={`text-[11px] px-2 py-0.5 rounded ${info.cls}`}>{info.label}</span>;
}
