import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type SaleAgg = { tenant_id: string; amount_gross_cents: number; currency: string; occurred_at: string };
type LedgerAgg = { tenant_id: string; amount_cents: number };
type Tenant = { id: string; name: string; slug: string };

function ars(cents: number) {
  return `$ ${(cents / 100).toLocaleString('es-AR')}`;
}

export default async function FounderRevenue() {
  const svc = getServiceClient();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: salesAll }, { data: sales30 }, { data: ledger }, { data: tenants }] = await Promise.all([
    svc.from('sales').select('tenant_id, amount_gross_cents, currency, occurred_at').eq('status', 'paid'),
    svc.from('sales').select('tenant_id, amount_gross_cents, currency, occurred_at').eq('status', 'paid').gte('occurred_at', since),
    svc.from('owner_debt_ledger').select('tenant_id, amount_cents'),
    svc.from('tenants').select('id, name, slug')
  ]);

  const salesAllRows = (salesAll ?? []) as SaleAgg[];
  const sales30Rows = (sales30 ?? []) as SaleAgg[];
  const ledgerRows = (ledger ?? []) as LedgerAgg[];
  const tenantList = (tenants ?? []) as Tenant[];
  const tenantById = new Map(tenantList.map((t) => [t.id, t]));

  const gmvAll = salesAllRows.reduce((s, r) => s + Number(r.amount_gross_cents), 0);
  const gmv30 = sales30Rows.reduce((s, r) => s + Number(r.amount_gross_cents), 0);

  const accrued = ledgerRows
    .filter((r) => Number(r.amount_cents) > 0)
    .reduce((s, r) => s + Number(r.amount_cents), 0);
  const paid = -ledgerRows
    .filter((r) => Number(r.amount_cents) < 0)
    .reduce((s, r) => s + Number(r.amount_cents), 0);
  const outstanding = accrued - paid;

  // Per-tenant GMV ranking
  const gmvByTenant = new Map<string, number>();
  for (const s of salesAllRows) {
    gmvByTenant.set(s.tenant_id, (gmvByTenant.get(s.tenant_id) ?? 0) + Number(s.amount_gross_cents));
  }
  const top = Array.from(gmvByTenant.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Revenue</h1>
        <p className="text-white/60 text-sm mt-1">Métricas globales de la plataforma.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="GMV total" value={ars(gmvAll)} />
        <Stat label="GMV últimos 30d" value={ars(gmv30)} />
        <Stat label="Comisión devengada" value={ars(accrued)} />
        <Stat label="Comisión cobrada" value={ars(paid)} sub={`Pendiente: ${ars(outstanding)}`} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Top 5 academias por GMV</h2>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {top.length === 0 ? (
            <div className="p-6 text-sm text-white/50">Sin ventas todavía.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">#</th>
                  <th className="text-left px-4 py-2.5">Academia</th>
                  <th className="text-right px-4 py-2.5">GMV total</th>
                </tr>
              </thead>
              <tbody>
                {top.map(([id, amount], i) => {
                  const t = tenantById.get(id);
                  return (
                    <tr key={id} className="border-t border-white/5">
                      <td className="px-4 py-3 text-white/40 font-mono">{i + 1}</td>
                      <td className="px-4 py-3">
                        {t?.name ?? id.slice(0, 8)}
                        {t?.slug && <span className="text-white/40 ml-2 text-xs">/{t.slug}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{ars(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-2 font-mono">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  );
}
