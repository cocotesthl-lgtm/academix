import { requireOwner, getCurrentUser } from "@/lib/auth/guards";
import { stopImpersonatingAction } from "@/lib/founder/actions";
import { tenantOrigin, env } from "@/lib/env";
import { getServiceClient } from "@/lib/supabase/service";
import { OwnerSidebar } from "@/components/owner/OwnerSidebar";
import { getTenantModules } from "@/lib/modules/queries";
import { getUserPermissionsInTenant } from "@/lib/permissions/queries";
import { OwnerShell } from "@/components/owner/OwnerShell";
import { WorkspaceSwitcher } from "@/components/owner/WorkspaceSwitcher";
import { SignoutButton } from "@/components/auth/SignoutButton";
import { CommandPaletteTrigger } from "@/components/owner/CommandPalette";
import { SaveStatusBar } from "@/components/owner/SaveStatusBar";
import { GlobalSaveListener } from "@/components/owner/GlobalSaveListener";
import { AnnouncementBanner } from "@/components/owner/plan/AnnouncementBanner";
import { getActiveAnnouncements, getTenantPlan } from "@/lib/plans/queries";

function subdomainUrl(sub: 'app' | 'admin', path: string): string {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === "localhost" || appUrl.hostname.endsWith(".localhost");
  const host = isLocal
    ? `${sub}.localhost${appUrl.port ? ":" + appUrl.port : ""}`
    : `${sub}.${env.rootDomain}`;
  return `${appUrl.protocol}//${host}${path}`;
}

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { tenant, impersonating } = await requireOwner();
  const user = await getCurrentUser();
  const email = user?.email ?? '';
  const modules = await getTenantModules(tenant.id);
  // Si el user llegó a /owner via requireOwner(), es owner del tenant →
  // permissions serán las de owner (full). Se pasa igual para que el
  // sidebar aplique el mismo pipeline que aplicará para instructor/staff/
  // affiliate cuando F3.b/c fusionen los otros portales.
  const permissions = user ? await getUserPermissionsInTenant(user.id, tenant.id) : null;
  // Post-logout redirect → storefront del tenant (sensación white-label).
  // El login del storefront ya auto-redirige al owner a /dashboard via
  // postAuthRedirect, así que vuelven a su panel sin perderse.
  const tenantLoginUrl = `${tenantOrigin(tenant.slug)}/login`;
  const storefrontUrl = `https://${tenant.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'bzseguridad.store'}`;

  // Brand del tenant actual (para el avatar del switcher)
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantBrandRow } = await (svc.from('tenants') as any)
    .select('brand').eq('id', tenant.id).maybeSingle();
  const currentBrand: { primary_color?: string; logo_url?: string } | null =
    tenantBrandRow?.brand ?? null;

  // Workspaces del user (memberships activas en todos los tenants).
  // Lo cargamos siempre para alimentar el WorkspaceSwitcher.
  type WS = {
    tenant_id: string; tenant_name: string; tenant_slug: string;
    role: 'owner' | 'instructor' | 'student';
    brand_primary: string | null; logo_url: string | null;
    href: string;
  };
  let workspaces: WS[] = [];
  if (user?.id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (svc.from('memberships') as any)
        .select('tenant_id, role, tenants ( name, slug, brand )')
        .eq('user_id', user.id)
        .eq('status', 'active')
        // Workspaces = sólo roles que dan acceso a un panel.
        // 'affiliate' NO es workspace — es relación comercial y aparece
        // automáticamente al visitar /affiliate de cualquier tenant.
        .in('role', ['owner', 'instructor', 'student']);
      const raw = ((data ?? []) as Array<{
        tenant_id: string; role: WS['role'];
        tenants: { name: string; slug: string; brand: { primary_color?: string; logo_url?: string } | null } | null;
      }>).filter((m) => m.tenants);
      // Dedup por tenant — gana el rol más alto
      const priority = { owner: 3, instructor: 2, student: 1 } as const;
      const byTenant = new Map<string, WS>();
      for (const m of raw) {
        const ws: WS = {
          tenant_id: m.tenant_id,
          tenant_name: m.tenants!.name,
          tenant_slug: m.tenants!.slug,
          role: m.role,
          brand_primary: m.tenants!.brand?.primary_color ?? null,
          logo_url: m.tenants!.brand?.logo_url ?? null,
          href: m.role === 'student'
            ? `https://${m.tenants!.slug}.${env.rootDomain}/learn`
            : m.role === 'instructor'
              ? subdomainUrl('app', '/instructor')
              : subdomainUrl('app', '/dashboard')
        };
        const existing = byTenant.get(m.tenant_id);
        if (!existing || priority[m.role] > priority[existing.role]) byTenant.set(m.tenant_id, ws);
      }
      workspaces = Array.from(byTenant.values()).sort((a, b) =>
        priority[b.role] - priority[a.role] || a.tenant_name.localeCompare(b.tenant_name)
      );
    } catch { /* ignore */ }
  }

  // Banner promo: el más reciente activo que matchee el plan del tenant
  const [announcements, tenantPlan] = await Promise.all([
    getActiveAnnouncements(),
    getTenantPlan(tenant.id)
  ]);
  const matchingBanner = announcements.find((a) =>
    a.plan_ids.length === 0 ||
    (tenantPlan.plan && a.plan_ids.includes(tenantPlan.plan.id))
  );

  const sidebar = (
    <>
      <div className="mb-3 cp-collapse-hide">
        <WorkspaceSwitcher
          currentName={tenant.name}
          currentLogo={currentBrand?.logo_url ?? null}
          currentBrand={currentBrand?.primary_color ?? '#f97316'}
          email={email}
          workspaces={workspaces}
          currentTenantId={tenant.id}
          onboardingUrl={subdomainUrl('app', '/onboarding')}
        />
      </div>
      <div className="mb-3 cp-collapse-hide">
        <CommandPaletteTrigger />
      </div>
      {/* Barra de estado de guardado — entre Buscar y el menú. Sólo
          aparece cuando hay actividad (saving / saved / error). */}
      <div className="mb-3 min-h-[2px] cp-collapse-hide">
        <SaveStatusBar />
      </div>
      <GlobalSaveListener />
      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        <OwnerSidebar modules={modules} permissions={permissions} />
      </div>
      <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
        {/* CTA destacado: ver el sitio público — abre en pestaña nueva.
            Cuando collapsed: solo el ícono. */}
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/40 text-white text-sm font-medium py-2.5 transition"
          title="Ver mi sitio público"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span className="cp-collapse-hide">Ver mi sitio</span>
        </a>
        {/* Logout ahora vive acá abajo, no dentro del WorkspaceSwitcher */}
        <SignoutButton
          redirectTo={tenantLoginUrl}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.06] text-xs font-medium py-2 transition"
        />
        <p className="text-[10px] text-white/35 text-center truncate cp-collapse-hide" title={`${tenant.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'bzseguridad.store'}`}>
          {tenant.slug}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'bzseguridad.store'}
        </p>
      </div>
    </>
  );

  return (
    <OwnerShell brandName={tenant.name} storefrontUrl={storefrontUrl} sidebar={sidebar}>
      {impersonating && (
        <div className="mb-4 rounded-lg bg-amber-500 text-amber-950 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
          <span>
            ⚠️ Estás viendo <strong>{tenant.name}</strong> como admin. Tus acciones quedan en el audit log.
          </span>
          <form action={stopImpersonatingAction}>
            <button className="rounded bg-amber-950 text-amber-100 px-3 py-1 text-xs font-semibold hover:bg-black">
              Salir del modo admin
            </button>
          </form>
        </div>
      )}
      {matchingBanner && (
        <div className="mb-4">
          <AnnouncementBanner banner={{
            id: matchingBanner.id,
            title: matchingBanner.title,
            message: matchingBanner.message,
            cta_label: matchingBanner.cta_label,
            cta_href: matchingBanner.cta_href,
            promo_code: matchingBanner.promo_code,
            bg_color: matchingBanner.bg_color,
            text_color: matchingBanner.text_color
          }} />
        </div>
      )}
      {children}
    </OwnerShell>
  );
}
