import { getServiceClient } from "@/lib/supabase/service";
import { setTenantStatusAction } from "@/lib/founder/actions";
import { DeleteTenantButton } from "@/components/founder/DeleteTenantButton";

export const dynamic = "force-dynamic";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  commission_rate_override: number | null;
};

export default async function FounderTenants() {
  const svc = getServiceClient();
  const { data } = await svc
    .from("tenants")
    .select("id, slug, name, status, created_at, commission_rate_override")
    .order("created_at", { ascending: false });

  const tenants = (data ?? []) as TenantRow[];

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
                <th className="text-left px-4 py-2.5">Comisión</th>
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
                  <td className="px-4 py-3 text-white/80">
                    {t.commission_rate_override !== null
                      ? `${(t.commission_rate_override * 100).toFixed(1)}% (override)`
                      : <span className="text-white/40">global</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {new Date(t.created_at).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-2">
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
