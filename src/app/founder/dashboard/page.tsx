import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type RecentTenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
};

export default async function FounderDashboard() {
  const svc = getServiceClient();

  const [{ count: tenantCount }, { count: activeCount }, { count: openTickets }, recent] = await Promise.all([
    svc.from('tenants').select('id', { count: 'exact', head: true }),
    svc.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    svc.from('tenants').select('id, slug, name, status, created_at').order('created_at', { ascending: false }).limit(5)
  ]);

  const recentTenants = (recent.data ?? []) as RecentTenant[];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Panel del fundador</h1>
        <p className="text-white/60 text-sm mt-1">Resumen global de la plataforma.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Academias totales" value={tenantCount ?? 0} />
        <Stat label="Activas" value={activeCount ?? 0} />
        <Stat label="Tickets abiertos" value={openTickets ?? 0} />
        <Stat label="Ventas (próximamente)" value="—" />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Últimas academias</h2>
          <Link href="/tenants" className="text-sm text-white/60 hover:text-white">Ver todas →</Link>
        </div>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {recentTenants.length === 0 ? (
            <div className="p-6 text-sm text-white/50">Todavía no hay academias creadas.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Academia</th>
                  <th className="text-left px-4 py-2.5">Slug</th>
                  <th className="text-left px-4 py-2.5">Estado</th>
                  <th className="text-left px-4 py-2.5">Alta</th>
                </tr>
              </thead>
              <tbody>
                {recentTenants.map((t) => (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-white/60">{t.slug}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-white/50">
                      {new Date(t.created_at).toLocaleDateString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
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
