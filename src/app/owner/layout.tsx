import { requireOwner, getCurrentUser } from "@/lib/auth/guards";
import { SignoutButton } from "@/components/auth/SignoutButton";
import { stopImpersonatingAction } from "@/lib/founder/actions";
import { tenantOrigin } from "@/lib/env";
import { OwnerSidebar } from "@/components/owner/OwnerSidebar";

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
  return (
    <div data-ui-theme="dark" className="min-h-screen flex bg-[#0a0a0a] text-white">
      <aside className="w-64 border-r border-white/10 p-4 flex flex-col">
        <div className="mb-5">
          <h2 className="font-bold text-lg truncate">{tenant.name}</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xs text-white/40 truncate flex-1" title={email}>{email}</p>
            <SignoutButton icon redirectTo={tenantLoginUrl} />
          </div>
        </div>
        <OwnerSidebar />
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
      </aside>
      <main className="flex-1">
        {impersonating && (
          <div className="bg-amber-500 text-amber-950 px-6 py-2.5 flex items-center justify-between text-sm font-medium">
            <span>
              ⚠️ Estás viendo <strong>{tenant.name}</strong> como administrador de la plataforma. Tus acciones quedan registradas en el audit log.
            </span>
            <form action={stopImpersonatingAction}>
              <button className="rounded bg-amber-950 text-amber-100 px-3 py-1 text-xs font-semibold hover:bg-black">
                Salir del modo admin
              </button>
            </form>
          </div>
        )}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
