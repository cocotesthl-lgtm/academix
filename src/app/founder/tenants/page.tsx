import { getServiceClient } from "@/lib/supabase/service";
import { FounderTenantsTable } from "@/components/founder/FounderTenantsTable";

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

  // Excluir preview tenants (slug '_tpl-*') que son sandboxes del founder
  // para editar templates — no son sitios reales que deban aparecer acá.
  const tenants = ((data ?? []) as TenantRow[]).filter((t) => !t.slug.startsWith('_tpl-'));

  const ownerIds = Array.from(new Set(tenants.map((t) => t.owner_user_id)));
  let ownersById = new Map<string, OwnerProfile>();
  if (ownerIds.length > 0) {
    const { data: profs } = await svc
      .from("profiles")
      .select("id, email, display_name")
      .in("id", ownerIds);
    ownersById = new Map(((profs ?? []) as OwnerProfile[]).map((p) => [p.id, p]));
  }

  // Balance de cada tenant (owner_debt_ledger)
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

  // Enriquecer para el client component
  const rows = tenants.map((t) => {
    const o = ownersById.get(t.owner_user_id);
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      created_at: t.created_at,
      commission_rate_override: t.commission_rate_override,
      ownerName: o?.display_name ?? null,
      ownerEmail: o?.email ?? null,
      balance: balancesByTenant.get(t.id) ?? 0
    };
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Sitios</h1>
        <p className="text-white/60 text-sm mt-1">
          Todos los sitios de la plataforma. Buscá, seleccioná varios para acciones bulk (reactivar, bajo revisión, suspender, eliminar), o usá acciones por-row (impersonar, saldar deuda, reprocesar pagos).
        </p>
      </div>

      <FounderTenantsTable rows={rows} />
    </div>
  );
}
