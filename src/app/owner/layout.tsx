import { requireOwner, getCurrentUser } from "@/lib/auth/guards";
import { SignoutButton } from "@/components/auth/SignoutButton";
import { stopImpersonatingAction } from "@/lib/founder/actions";
import { tenantOrigin } from "@/lib/env";
import { OwnerSidebar } from "@/components/owner/OwnerSidebar";
import { OwnerShell } from "@/components/owner/OwnerShell";

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

  const sidebar = (
    <>
      <div className="mb-5">
        <h2 className="font-bold text-lg truncate">{tenant.name}</h2>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-xs text-white/40 truncate flex-1" title={email}>{email}</p>
          <SignoutButton icon redirectTo={tenantLoginUrl} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        <OwnerSidebar />
      </div>
      <div className="mt-auto pt-4 border-t border-white/10">
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-white/40 hover:text-white truncate"
          title="Ver mi storefront"
        >
          ↗ {tenant.slug}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com'}
        </a>
      </div>
    </>
  );

  return (
    <OwnerShell brandName={tenant.name} sidebar={sidebar}>
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
      {children}
    </OwnerShell>
  );
}
