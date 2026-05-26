import { requireOwner } from "@/lib/auth/guards";
import { SignoutButton } from "@/components/auth/SignoutButton";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = await requireOwner();
  return (
    <div className="min-h-screen flex bg-[#0a0a0a] text-white">
      <aside className="w-64 border-r border-white/10 p-4 flex flex-col">
        <div className="mb-6">
          <h2 className="font-bold text-lg">{tenant.name}</h2>
          <p className="text-xs text-white/40">{tenant.slug}.curplat.com</p>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/dashboard">Dashboard</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/branding">Branding</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/integrations">Integraciones</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/courses">Cursos</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/finance">Finanzas</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/affiliates">Afiliados</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/tickets">Soporte</a>
        </nav>
        <div className="mt-auto pt-4 border-t border-white/10">
          <SignoutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
