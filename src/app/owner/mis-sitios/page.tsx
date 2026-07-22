import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { tenantOrigin } from '@/lib/env';
import { ManageSiteRow } from '@/components/owner/ManageSiteRow';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  slug: string;
  name: string;
  brand: { logo_url?: string | null; primary_color?: string | null } | null;
  status: string;
  created_at: string;
};

/**
 * "Mis sitios": lista todos los tenants donde el user es owner activo.
 * Cada row permite renombrar o eliminar el sitio. Se llega desde el
 * WorkspaceSwitcher (link "⚙️ Gestionar mis sitios").
 */
export default async function MisSitiosPage() {
  const { tenant: currentTenant, userId } = await requireOwner();
  const svc = getServiceClient();

  // Todos los tenants donde el user es owner activo
  const { data: memsRaw } = await svc
    .from('memberships')
    .select('tenant_id, tenants ( id, slug, name, brand, status, created_at )')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active');

  const rows = ((memsRaw ?? []) as Array<{ tenant_id: string; tenants: Row | null }>)
    .filter((m) => m.tenants)
    .map((m) => m.tenants!);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Mis sitios"
        description="Todos los sitios donde sos propietario. Podés renombrarlos o eliminarlos desde acá."
        actions={
          <Link href="/onboarding" className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
            + Crear nuevo sitio
          </Link>
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">🏗️</div>
          <div className="text-white/70 font-medium">No tenés ningún sitio propio todavía</div>
          <Link href="/onboarding" className="inline-block mt-4 rounded bg-white text-black text-sm font-semibold px-4 py-2">
            Crear mi primer sitio
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <ManageSiteRow
              key={r.id}
              tenantId={r.id}
              slug={r.slug}
              name={r.name}
              logoUrl={r.brand?.logo_url ?? null}
              brandColor={r.brand?.primary_color ?? '#f97316'}
              status={r.status}
              publicUrl={tenantOrigin(r.slug)}
              isCurrent={r.id === currentTenant.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
