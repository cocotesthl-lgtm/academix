import { getServiceClient } from "@/lib/supabase/service";
import { setTenantStatusAction, impersonateTenantAction } from "@/lib/founder/actions";
import { DeleteTenantButton } from "@/components/founder/DeleteTenantButton";
import { SettleDebtButton } from "@/components/founder/SettleDebtButton";
import { ReprocessPaymentButton } from "@/components/founder/ReprocessPaymentButton";

export const dynamic = "force-dynamic";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  commission_rate_override: number | null;
  owner_user_id: string;
};

type OwnerProfile = { id: string; email: string | null; display_name: string | null };

export default async function FounderTenants() {
  const svc = getServiceClient();
  const { data } = await svc
    .from("tenants")
    .select("id, slug, name, status, created_at, commission_rate_override, owner_user_id")
    .order("created_at", { ascending: false });

  const tenants = (data ?? []) as TenantRow[];

  // Fetch owner profiles in batch
  const ownerIds = Array.from(new Set(tenants.map((t) => t.owner_user_id)));
  let ownersById = new Map<string, OwnerProfile>();
  if (ownerIds.length > 0) {
    const { data: profs } = await svc
      .from("profiles")
      .select("id, email, display_name")
      .in("id", ownerIds);
    ownersById = new Map(((profs ?? []) as OwnerProfile[]).map((p) => [p.id, p]));
  }

  // Balance de cada tenant (suma de owner_debt_ledger.amount_cents)
  const balancesByTenant = new Map<string, number>();
  if (tenants.length > 0) {
    const { data: ledgerRows } = await svc
      .from("owner_debt_ledger")
      .select("tenant_id, amount_cents")
      .in("tenant_id", tenants.map((t) => t.id));
    for (const r of ((ledgerRows ?? []) as Array<{ tenant_id: string; amount_cents: number }>)) {
      balancesByTenant.set(r.tenant_id, (balancesByTenant.get(r.tenant_id) ?? 0) + Number(r.amount_cents));
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Academias</h1>
        <p className="text-white/60 text-sm mt-1">
          Gestión de owners — suspender, reactivar, cerrar.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        {tenants.length === 0 ? (
          <div className="p-6 text-sm text-white/50">Ninguna academia todavía.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Academia</th>
                <th className="text-left px-4 py-2.5">Slug</th>
                <th className="text-left px-4 py-2.5">Owner</th>
                <th className="text-left px-4 py-2.5">Comisión</th>
                <th className="text-right px-4 py-2.5">Saldo a cobrar</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-left px-4 py-2.5">Alta</th>
                <th className="text-right px-4 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-medium">
                    <a
                      href={`http://${t.slug}.localhost:3000`}
                      target="_blank"
                      rel="noopener"
                      className="hover:underline"
                    >
                      {t.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-white/60">{t.slug}</td>
                  <td className="px-4 py-3 text-white/70 text-xs">
                    {(() => {
                      const o = ownersById.get(t.owner_user_id);
                      if (!o) return <span className="text-white/30">—</span>;
                      return (
                        <div>
                          <div className="font-medium text-white/90">{o.display_name ?? '—'}</div>
                          <div className="text-white/40">{o.email ?? '—'}</div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-white/80">
                    {t.commission_rate_override !== null
                      ? `${(t.commission_rate_override * 100).toFixed(1)}% (override)`
                      : <span className="text-white/40">global</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {(() => {
                      const b = balancesByTenant.get(t.id) ?? 0;
                      if (b <= 0) return <span className="text-white/30">$0</span>;
                      return (
                        <span className={b >= 200_000_00 ? 'text-red-300' : b >= 50_000_00 ? 'text-amber-300' : 'text-white'}>
                          ${(b / 100).toLocaleString('es-AR')}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {new Date(t.created_at).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <div className="flex justify-end items-center gap-2 flex-wrap">
                      <SettleDebtButton
                        tenantId={t.id}
                        tenantSlug={t.slug}
                        balanceCents={balancesByTenant.get(t.id) ?? 0}
                      />
                      <ReprocessPaymentButton tenantId={t.id} />
                      <form action={impersonateTenantAction}>
                        <input type="hidden" name="slug" value={t.slug} />
                        <button className="text-xs rounded border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 px-2 py-1 hover:bg-fuchsia-500/20">
                          Abrir como owner →
                        </button>
                      </form>
                      <StatusActions tenantId={t.id} status={t.status} />
                      <DeleteTenantButton tenantId={t.id} slug={t.slug} name={t.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusActions({ tenantId, status }: { tenantId: string; status: string }) {
  return (
    <div className="flex justify-end gap-2">
      {status !== 'active' && (
        <form action={setTenantStatusAction}>
          <input type="hidden" name="tenant_id" value={tenantId} />
          <input type="hidden" name="status" value="active" />
          <button className="text-xs rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-1 hover:bg-emerald-500/20">
            Reactivar
          </button>
        </form>
      )}
      {status === 'active' && (
        <form action={setTenantStatusAction}>
          <input type="hidden" name="tenant_id" value={tenantId} />
          <input type="hidden" name="status" value="suspended" />
          <button className="text-xs rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2 py-1 hover:bg-amber-500/20">
            Suspender
          </button>
        </form>
      )}
      {status !== 'closed' && (
        <form action={setTenantStatusAction}>
          <input type="hidden" name="tenant_id" value={tenantId} />
          <input type="hidden" name="status" value="closed" />
          <button className="text-xs rounded border border-red-500/30 bg-red-500/10 text-red-300 px-2 py-1 hover:bg-red-500/20">
            Cerrar
          </button>
        </form>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    suspended: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    closed: 'bg-red-500/10 text-red-300 border-red-500/30'
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${styles[status] ?? 'bg-white/5 border-white/15'}`}>
      {status}
    </span>
  );
}
