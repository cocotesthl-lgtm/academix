import { requireSuperAdmin } from "@/lib/auth/guards";
import { SignoutButton } from "@/components/auth/SignoutButton";
import { SaveStatusBar } from "@/components/owner/SaveStatusBar";
import { GlobalSaveListener } from "@/components/owner/GlobalSaveListener";

export const dynamic = "force-dynamic";

export default async function FounderLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return (
    <div data-ui-theme="dark" className="min-h-screen flex bg-[#0a0a0a] text-white">
      <aside className="w-60 border-r border-white/10 p-4 flex flex-col">
        <h2 className="font-bold text-lg">Founder</h2>
        <div className="mt-3 mb-3 min-h-[2px]">
          <SaveStatusBar />
        </div>
        <GlobalSaveListener />
        <nav className="flex flex-col gap-1 text-sm">
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/dashboard">Dashboard</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/tenants">Sitios</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/users">Usuarios</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/plans">Planes</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5 text-xs text-white/55 ml-3" href="/plans/promos">→ Códigos promo</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5 text-xs text-white/55 ml-3" href="/plans/banner">→ Banner</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5 text-xs text-white/55 ml-3" href="/plans/regalar">→ Regalar plan</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/commissions">Comisiones</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/tickets">Soporte</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/revenue">Revenue</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/wallets">💰 Wallets</a>
        </nav>
        <div className="mt-auto pt-4 border-t border-white/10">
          <SignoutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
