import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { signoutAction } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

function subdomainUrl(sub: 'admin' | 'app', path: string): string {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === "localhost" || appUrl.hostname.endsWith(".localhost");
  const host = isLocal
    ? `${sub}.localhost${appUrl.port ? ":" + appUrl.port : ""}`
    : `${sub}.${env.rootDomain}`;
  return `${appUrl.protocol}//${host}${path}`;
}

function tenantUrl(slug: string, path = ''): string {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === "localhost" || appUrl.hostname.endsWith(".localhost");
  const host = isLocal
    ? `${slug}.localhost${appUrl.port ? ":" + appUrl.port : ""}`
    : `${slug}.${env.rootDomain}`;
  return `${appUrl.protocol}//${host}${path}`;
}

type Workspace = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: 'owner' | 'instructor' | 'student';
  brand_primary?: string | null;
  logo_url?: string | null;
};

const ROLE_LABEL: Record<Workspace['role'], string> = {
  owner: 'Propietario',
  instructor: 'Instructor',
  student: 'Alumno'
};
const ROLE_BADGE: Record<Workspace['role'], string> = {
  owner: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  instructor: 'bg-sky-100 text-sky-700 border-sky-300',
  student: 'bg-neutral-100 text-neutral-700 border-neutral-300'
};

export default async function WorkspacesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/workspaces");

  const svc = getServiceClient();

  // Super admin → atajo al admin panel
  const { data: profile } = await svc
    .from('profiles')
    .select('is_super_admin, display_name')
    .eq('id', user.id)
    .maybeSingle<{ is_super_admin: boolean; display_name: string | null }>();

  // Todas las memberships activas, con info del tenant
  let workspaces: Workspace[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('memberships') as any)
      .select('tenant_id, role, tenants ( name, slug, brand )')
      .eq('user_id', user.id)
      .eq('status', 'active')
      // Excluimos 'affiliate' — esa membership se autocrea al visitar
      // /affiliate de cualquier tenant y no es un workspace.
      .in('role', ['owner', 'instructor', 'student']);
    workspaces = ((data ?? []) as Array<{
      tenant_id: string; role: Workspace['role'];
      tenants: { name: string; slug: string; brand: { primary_color?: string; logo_url?: string } | null } | null;
    }>)
      .filter((m) => m.tenants)
      .map((m) => ({
        tenant_id: m.tenant_id,
        tenant_name: m.tenants!.name,
        tenant_slug: m.tenants!.slug,
        role: m.role,
        brand_primary: m.tenants!.brand?.primary_color ?? null,
        logo_url: m.tenants!.brand?.logo_url ?? null
      }));
  } catch { /* tabla puede no existir si migration 0001 pendiente */ }

  // Quitar duplicados por tenant + priorizar el rol más alto
  // (si sos owner Y student del mismo tenant, mostramos como owner)
  const dedup = new Map<string, Workspace>();
  const priority: Record<Workspace['role'], number> = { owner: 3, instructor: 2, student: 1 };
  for (const w of workspaces) {
    const existing = dedup.get(w.tenant_id);
    if (!existing || priority[w.role] > priority[existing.role]) {
      dedup.set(w.tenant_id, w);
    }
  }
  const sorted = Array.from(dedup.values()).sort((a, b) => {
    // owners primero, alfabético
    if (a.role !== b.role) return priority[b.role] - priority[a.role];
    return a.tenant_name.localeCompare(b.tenant_name);
  });

  const userName = profile?.display_name ?? user.email?.split('@')[0] ?? 'vos';

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            <span className="text-neutral-900">Offer</span><span className="text-orange-500">Now</span>
          </Link>
          <form action={async () => { 'use server'; await signoutAction(); }}>
            <button className="text-xs text-neutral-500 hover:text-neutral-900">Cerrar sesión</button>
          </form>
        </div>

        <div className="space-y-2 pt-4">
          <h1 className="text-3xl font-bold">Hola, {userName} 👋</h1>
          <p className="text-neutral-600">Elegí un espacio de trabajo para entrar.</p>
          <p className="text-xs text-neutral-500">Sesión: {user.email}</p>
        </div>

        {profile?.is_super_admin && (
          <Link
            href={subdomainUrl('admin', '/dashboard')}
            className="block rounded-xl border border-amber-300 bg-amber-50 p-4 hover:bg-amber-100 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-700 font-semibold">Founder</div>
                <div className="font-bold text-lg">Panel de administración</div>
              </div>
              <span className="text-amber-700">→</span>
            </div>
          </Link>
        )}

        {/* Workspaces existentes */}
        <div className="space-y-2.5">
          {sorted.length === 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-neutral-500">
              Todavía no formás parte de ningún sitio.
            </div>
          )}
          {sorted.map((w) => {
            const href = w.role === 'student'
              ? tenantUrl(w.tenant_slug, '/learn')
              : w.role === 'instructor'
                ? subdomainUrl('app', '/instructor')
                : subdomainUrl('app', '/dashboard');
            const primary = w.brand_primary ?? '#f97316';
            return (
              <a
                key={w.tenant_id}
                href={href}
                className="block rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-900 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-3">
                  {w.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.logo_url} alt="" className="w-11 h-11 rounded-lg object-cover border border-neutral-200" />
                  ) : (
                    <div
                      className="w-11 h-11 rounded-lg grid place-items-center font-bold text-white border border-neutral-200"
                      style={{ background: primary }}
                    >
                      {w.tenant_name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{w.tenant_name}</div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${ROLE_BADGE[w.role]}`}>
                        {ROLE_LABEL[w.role]}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 truncate">{w.tenant_slug}.{env.rootDomain}</div>
                  </div>
                  <span className="text-neutral-400">→</span>
                </div>
              </a>
            );
          })}
        </div>

        {/* CTA crear nuevo — flag ?new=1 evita el auto-redirect al dashboard
             cuando el user ya tiene tenants. */}
        <Link
          href="/onboarding?new=1"
          className="block rounded-xl border border-dashed border-neutral-300 hover:border-neutral-900 bg-white p-4 text-center text-neutral-600 hover:text-neutral-900 transition"
        >
          + Crear un nuevo sitio
        </Link>

        <p className="text-[11px] text-center text-neutral-400 pt-2">
          Tip: con una sola cuenta podés ser parte de varios sitios — propio,
          alumno en algunos, instructor en otros. Cambiá entre ellos cuando quieras.
        </p>
      </div>
    </main>
  );
}
