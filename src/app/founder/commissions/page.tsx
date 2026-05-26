import { getServiceClient } from "@/lib/supabase/service";
import { GlobalRateForm, TenantOverridesTable } from "@/components/founder/CommissionsAdmin";

export const dynamic = "force-dynamic";

type Rule = { rate: number; effective_from: string; reason: string | null };
type Tenant = { id: string; slug: string; name: string; commission_rate_override: number | null };
type AuditEntry = {
  id: string;
  action: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
  tenant_id: string | null;
};

export default async function FounderCommissions() {
  const svc = getServiceClient();

  const [{ data: globalRule }, { data: tenants }, { data: audit }] = await Promise.all([
    svc.from("commission_rules")
      .select("rate, effective_from, reason")
      .eq("scope", "global")
      .is("effective_to", null)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle<Rule>(),
    svc.from("tenants")
      .select("id, slug, name, commission_rate_override")
      .order("created_at", { ascending: false }),
    svc.from("audit_log")
      .select("id, action, reason, before, after, created_at, tenant_id")
      .like("action", "commission_rate%")
      .order("created_at", { ascending: false })
      .limit(15)
  ]);

  const globalRate = Number(globalRule?.rate ?? 0.05);
  const tenantRows = (tenants ?? []) as Tenant[];
  const auditRows = (audit ?? []) as AuditEntry[];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Comisiones</h1>
        <p className="text-white/60 text-sm mt-1">
          Controlá la tasa global y los overrides por academia.
        </p>
      </div>

      <GlobalRateForm currentRate={globalRate} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Overrides por academia</h2>
        <TenantOverridesTable tenants={tenantRows} globalRate={globalRate} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Cambios recientes</h2>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {auditRows.length === 0 ? (
            <div className="p-6 text-sm text-white/50">Sin cambios todavía.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Cuándo</th>
                  <th className="text-left px-4 py-2.5">Acción</th>
                  <th className="text-left px-4 py-2.5">Cambio</th>
                  <th className="text-left px-4 py-2.5">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((a) => {
                  const beforeRate = (a.before as { commission_rate_override?: number; rate?: number } | null);
                  const afterRate = (a.after as { commission_rate_override?: number; rate?: number } | null);
                  const fmt = (v: number | null | undefined) =>
                    v === null || v === undefined ? 'global' : `${(v * 100).toFixed(2)}%`;
                  const beforeStr = a.action.includes('global')
                    ? '—'
                    : fmt(beforeRate?.commission_rate_override);
                  const afterStr = a.action.includes('global')
                    ? fmt(afterRate?.rate)
                    : fmt(afterRate?.commission_rate_override);
                  return (
                    <tr key={a.id} className="border-t border-white/5">
                      <td className="px-4 py-2.5 text-white/60">
                        {new Date(a.created_at).toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-2.5">
                        {a.action.replace('commission_rate.', '')}
                      </td>
                      <td className="px-4 py-2.5 font-mono">
                        {beforeStr} → <span className="text-white">{afterStr}</span>
                      </td>
                      <td className="px-4 py-2.5 text-white/70">{a.reason ?? '—'}</td>
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
