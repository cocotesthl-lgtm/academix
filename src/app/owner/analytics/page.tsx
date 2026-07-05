import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { PageHeader } from '@/components/owner/PageHeader';
import { getFunnelCounts, getTopProductFunnels, getDailyCounts } from '@/lib/analytics/queries';

export const dynamic = 'force-dynamic';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(cents / 100);
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

export default async function AnalyticsPage({
  searchParams
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { tenant } = await requireOwner();
  const sp = await searchParams;
  const days = Math.max(1, Math.min(365, parseInt(sp.days ?? '30', 10) || 30));

  let counts: Awaited<ReturnType<typeof getFunnelCounts>> = {
    page_view: 0, product_view: 0, add_to_cart: 0, checkout_start: 0, purchase: 0
  };
  let products: Awaited<ReturnType<typeof getTopProductFunnels>> = [];
  let daily: Awaited<ReturnType<typeof getDailyCounts>> = [];
  try {
    counts = await getFunnelCounts(tenant.id, days);
    products = await getTopProductFunnels(tenant.id, days, 10);
    daily = await getDailyCounts(tenant.id, 'purchase', days);
  } catch { /* migration 0052 pendiente — todo queda en 0 */ }

  const totalRevenue = products.reduce((s, p) => s + p.revenue_cents, 0);
  const overallConversion = counts.product_view > 0 ? counts.purchase / counts.product_view : 0;

  // Máximo diario para escalar el sparkline
  const maxDay = Math.max(1, ...daily.map((d) => d.count));

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Analytics"
        description="Funnel de conversión y performance por producto. Solo productos físicos."
        actions={
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <Link key={d}
                href={`/analytics?days=${d}`}
                className={`text-sm px-3 py-1.5 rounded border transition ${
                  days === d
                    ? 'bg-white text-black border-white font-semibold'
                    : 'border-white/15 text-white/70 hover:bg-white/5'
                }`}>
                Últimos {d} días
              </Link>
            ))}
          </div>
        }
      />

      {/* Funnel principal */}
      <section className="rounded-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold mb-4">Funnel de {days} días</h2>
        <div className="space-y-2">
          <FunnelStage label="Vistas de producto"       count={counts.product_view}   max={Math.max(counts.product_view, 1)} />
          <FunnelStage label="Agregaron al carrito"     count={counts.add_to_cart}    max={Math.max(counts.product_view, 1)}
            deltaFrom={counts.product_view} />
          <FunnelStage label="Iniciaron checkout"       count={counts.checkout_start} max={Math.max(counts.product_view, 1)}
            deltaFrom={counts.add_to_cart} />
          <FunnelStage label="Compras confirmadas"      count={counts.purchase}       max={Math.max(counts.product_view, 1)}
            deltaFrom={counts.checkout_start} highlight />
        </div>

        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4">
          <Metric label="Tasa de conversión total" value={pct(overallConversion)} />
          <Metric label="Ingresos" value={formatMoney(totalRevenue)} />
          <Metric label="Ticket promedio" value={counts.purchase > 0 ? formatMoney(totalRevenue / counts.purchase) : '—'} />
        </div>
      </section>

      {/* Ventas por día (sparkline) */}
      <section className="rounded-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold mb-3">Compras por día</h2>
        {daily.every((d) => d.count === 0) ? (
          <p className="text-xs text-white/40 italic">Sin datos en este rango.</p>
        ) : (
          <div className="flex items-end gap-0.5 h-24">
            {daily.map((d) => (
              <div key={d.date}
                title={`${d.date}: ${d.count} compra${d.count === 1 ? '' : 's'}`}
                className="flex-1 rounded-t bg-emerald-500/40 hover:bg-emerald-500/70 transition-colors"
                style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }} />
            ))}
          </div>
        )}
        <div className="flex justify-between text-[10px] text-white/40 mt-1">
          <span>{daily[0]?.date}</span>
          <span>{daily[daily.length - 1]?.date}</span>
        </div>
      </section>

      {/* Top productos */}
      <section className="rounded-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold mb-3">Top productos (por vistas)</h2>
        {products.length === 0 ? (
          <p className="text-xs text-white/40 italic">Aún no hay tráfico registrado.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {products.map((p) => (
              <div key={p.product_id} className="py-3 flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-white/5 shrink-0 overflow-hidden">
                  {p.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.product_title}</div>
                  <div className="text-[11px] text-white/45 flex gap-3 mt-0.5">
                    <span>{p.views} vista{p.views === 1 ? '' : 's'}</span>
                    <span>{p.add_to_carts} al carrito ({pct(p.add_to_cart_rate)})</span>
                    <span>{p.purchases} compra{p.purchases === 1 ? '' : 's'} ({pct(p.purchase_rate)})</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono">{formatMoney(p.revenue_cents)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] text-white/40 text-center">
        Los eventos se cuentan por sesión única (mismo visitante = 1 vista) — salvo las compras, que se cuentan brutas.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function FunnelStage({
  label, count, max, deltaFrom, highlight
}: {
  label: string; count: number; max: number;
  deltaFrom?: number; highlight?: boolean;
}) {
  const pctBar = (count / max) * 100;
  const dropRate = deltaFrom && deltaFrom > 0 ? (count / deltaFrom) : null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-white/85">{label}</div>
        <div className="text-xs font-mono flex items-center gap-2">
          <span className={highlight ? 'text-emerald-300 font-bold' : ''}>{count}</span>
          {dropRate !== null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              dropRate >= 0.5 ? 'bg-emerald-500/15 text-emerald-300'
              : dropRate >= 0.2 ? 'bg-amber-500/15 text-amber-300'
              : 'bg-rose-500/15 text-rose-300'
            }`}>{pct(dropRate)}</span>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded bg-white/5 overflow-hidden">
        <div className={`h-full transition-all ${highlight ? 'bg-emerald-500/60' : 'bg-blue-500/40'}`}
          style={{ width: `${pctBar}%` }} />
      </div>
    </div>
  );
}
