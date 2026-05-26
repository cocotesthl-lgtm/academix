import { requireSuperAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function FounderLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r p-4 space-y-2">
        <h2 className="font-bold mb-4">Founder</h2>
        <a className="block" href="/dashboard">Dashboard</a>
        <a className="block" href="/tenants">Academias</a>
        <a className="block" href="/commissions">Comisiones</a>
        <a className="block" href="/tickets">Soporte</a>
        <a className="block" href="/revenue">Revenue</a>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
