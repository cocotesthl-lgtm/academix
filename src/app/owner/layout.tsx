import { requireOwner } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r p-4 space-y-2">
        <h2 className="font-bold mb-4">Tu academia</h2>
        <a className="block" href="/dashboard">Dashboard</a>
        <a className="block" href="/branding">Branding</a>
        <a className="block" href="/integrations">Integraciones</a>
        <a className="block" href="/courses">Cursos</a>
        <a className="block" href="/finance">Finanzas</a>
        <a className="block" href="/affiliates">Afiliados</a>
        <a className="block" href="/tickets">Soporte</a>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
