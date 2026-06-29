import { requireOwner, getCurrentUser } from "@/lib/auth/guards";
import { SignoutButton } from "@/components/auth/SignoutButton";
import { stopImpersonatingAction } from "@/lib/founder/actions";
import { tenantOrigin } from "@/lib/env";
import { OwnerSidebar } from "@/components/owner/OwnerSidebar";
import { OwnerShell } from "@/components/owner/OwnerShell";
import { CommandPaletteTrigger } from "@/components/owner/CommandPalette";
import { SaveStatusBar } from "@/components/owner/SaveStatusBar";
import { GlobalSaveListener } from "@/components/owner/GlobalSaveListener";
import { AnnouncementBanner } from "@/components/owner/plan/AnnouncementBanner";
import { getActiveAnnouncements, getTenantPlan } from "@/lib/plans/queries";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { tenant, impersonating } = await requireOwner();
  const user = await getCurrentUser();
  const email = user?.email ?? '';
  // Post-logout redirect → storefront del tenant (sensación white-label).
  // El login del storefront ya auto-redirige al owner a /dashboard via
  // postAuthRedirect, así que vuelven a su panel sin perderse.
  const tenantLoginUrl = `${tenantOrigin(tenant.slug)}/login`;
  const storefrontUrl = `https://${tenant.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com'}`;

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
        <h2 className="font-bold text-lg truncate">{tenant.name}</h2>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-xs text-white/40 truncate flex-1" title={email}>{email}</p>
          <SignoutButton icon redirectTo={tenantLoginUrl} />
        </div>
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
        <OwnerSidebar />
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
        <p className="text-[10px] text-white/35 text-center truncate cp-collapse-hide" title={`${tenant.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com'}`}>
          {tenant.slug}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com'}
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
