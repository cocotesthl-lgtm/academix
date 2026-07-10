import { getServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';

/**
 * Fetch de workspaces del user para alimentar el WorkspaceSwitcher.
 * Compartido entre el owner sidebar y el panel del afiliado (F6.1).
 *
 * Cada workspace = un tenant donde el user tiene membership activo,
 * incluyendo affiliate (integrado en F6).
 *
 * Devuelve la lista ya deduplicada por tenant (gana el rol más alto)
 * y ordenada por prioridad, con el `href` correcto a dónde llevar
 * al user al switchear.
 */

export type Workspace = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: 'owner' | 'instructor' | 'student' | 'affiliate';
  brand_primary: string | null;
  logo_url: string | null;
  href: string;
};

const PRIORITY = { owner: 4, instructor: 3, affiliate: 2, student: 1 } as const;

function subdomainUrl(sub: 'app' | 'admin', path: string): string {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === 'localhost' || appUrl.hostname.endsWith('.localhost');
  const host = isLocal
    ? `${sub}.localhost${appUrl.port ? ':' + appUrl.port : ''}`
    : `${sub}.${env.rootDomain}`;
  return `${appUrl.protocol}//${host}${path}`;
}

function tenantSubdomainUrl(slug: string, path: string): string {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === 'localhost' || appUrl.hostname.endsWith('.localhost');
  const host = isLocal
    ? `${slug}.localhost${appUrl.port ? ':' + appUrl.port : ''}`
    : `${slug}.${env.rootDomain}`;
  return `${appUrl.protocol}//${host}${path}`;
}

export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  if (!userId) return [];
  const svc = getServiceClient();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('memberships') as any)
      .select('tenant_id, role, tenants ( name, slug, brand )')
      .eq('user_id', userId).eq('status', 'active')
      .in('role', ['owner', 'instructor', 'student', 'affiliate']);

    const raw = ((data ?? []) as Array<{
      tenant_id: string;
      role: Workspace['role'];
      tenants: { name: string; slug: string; brand: { primary_color?: string; logo_url?: string } | null } | null;
    }>).filter((m) => m.tenants);

    const byTenant = new Map<string, Workspace>();
    for (const m of raw) {
      const ws: Workspace = {
        tenant_id: m.tenant_id,
        tenant_name: m.tenants!.name,
        tenant_slug: m.tenants!.slug,
        role: m.role,
        brand_primary: m.tenants!.brand?.primary_color ?? null,
        logo_url: m.tenants!.brand?.logo_url ?? null,
        // Para owner: pasar por /api/workspace/switch que setea la cookie
        // 'owner_tenant_id' antes de redirigir. Sin esto el switch entre
        // tenants no funcionaba — requireOwner() siempre agarraba el mismo.
        href: m.role === 'student'
          ? tenantSubdomainUrl(m.tenants!.slug, '/learn')
          : m.role === 'affiliate'
            ? tenantSubdomainUrl(m.tenants!.slug, '/affiliate')
            : m.role === 'instructor'
              ? subdomainUrl('app', '/instructor')
              : subdomainUrl('app', `/api/workspace/switch?tenant=${m.tenant_id}&to=/dashboard`)
      };
      const existing = byTenant.get(m.tenant_id);
      if (!existing || PRIORITY[m.role] > PRIORITY[existing.role]) byTenant.set(m.tenant_id, ws);
    }

    return Array.from(byTenant.values()).sort((a, b) =>
      PRIORITY[b.role] - PRIORITY[a.role] || a.tenant_name.localeCompare(b.tenant_name)
    );
  } catch {
    return [];
  }
}
