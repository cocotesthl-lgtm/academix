import { headers } from "next/headers";
import { getTenantById } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";

export default async function StorefrontLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  const h = await headers();
  const slug = h.get("x-tenant-slug") ?? tenant?.slug ?? "";

  if (!tenant) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white text-black p-8">
        Academia no encontrada.
      </main>
    );
  }
  if (tenant.status === "suspended" || tenant.status === "closed") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white text-black p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold">Temporalmente cerrado</h1>
          <p className="text-black/60 mt-2">Esta academia no está disponible en este momento.</p>
        </div>
      </main>
    );
  }

  const brand = tenant.brand ?? {};
  const primary = brand.primary_color ?? '#0a0a0a';
  const accent = brand.accent_color ?? '#0a0a0a';

  return (
    <div
      className="min-h-screen bg-white text-black"
      style={{
        ['--brand-primary' as string]: primary,
        ['--brand-accent' as string]: accent
      }}
    >
      <header className="border-b border-black/10 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            {brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={tenant.name} className="h-9 w-9 object-contain rounded" />
            ) : (
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ background: primary }}
              >
                {tenant.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-bold leading-tight">{tenant.name}</div>
              <div className="text-xs text-black/40">{slug}.curplat.com</div>
            </div>
          </a>
          <nav className="hidden md:flex gap-6 text-sm text-black/70">
            <a href="/" className="hover:text-black">Cursos</a>
            <a href="/login" className="hover:text-black">Mi cuenta</a>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-black/10 mt-16 py-8 text-center text-sm text-black/40">
        © {new Date().getFullYear()} {tenant.name} · Powered by Curplat
      </footer>
    </div>
  );
}
