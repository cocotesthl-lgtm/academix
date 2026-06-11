import { requireOwner, getCurrentUser } from "@/lib/auth/guards";
import { SignoutButton } from "@/components/auth/SignoutButton";
import { stopImpersonatingAction } from "@/lib/founder/actions";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { tenant, impersonating } = await requireOwner();
  const user = await getCurrentUser();
  const email = user?.email ?? '';
  return (
    <div data-ui-theme="dark" className="min-h-screen flex bg-[#0a0a0a] text-white">
      <aside className="w-64 border-r border-white/10 p-4 flex flex-col">
        <div className="mb-6">
          <h2 className="font-bold text-lg">{tenant.name}</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xs text-white/40 truncate flex-1" title={email}>{email}</p>
            <SignoutButton className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white border border-white/15 hover:border-white/40 rounded px-1.5 py-0.5 disabled:opacity-50 shrink-0" />
          </div>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/dashboard">Dashboard</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/site">Editor de sitio</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/branding">Branding</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/courses">Cursos</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/students">Alumnos</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/instructors">Instructores</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/categories">Categorías</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/coupons">Cupones</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/checkout">Checkout</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/availability">Disponibilidad</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/integrations">Integraciones</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/finance">Finanzas</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/affiliates">Afiliados</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/tickets">Soporte</a>
        </nav>
        <div className="mt-auto pt-4 border-t border-white/10">
          <a
            href={`https://${tenant.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com'}`}
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
