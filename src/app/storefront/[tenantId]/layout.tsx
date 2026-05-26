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
    return <main className="p-8">Academia no encontrada.</main>;
  }
  if (tenant.status === "suspended") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold">Temporalmente cerrado</h1>
          <p className="opacity-70 mt-2">Esta academia no está disponible en este momento.</p>
        </div>
      </main>
    );
  }

  const brand = tenant.brand ?? {};
  return (
    <div style={{ ['--brand-primary' as string]: brand.primary_color ?? '#0a0a0a' }}>
      <header className="border-b p-4 flex items-center gap-3">
        {brand.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt={tenant.name} className="h-8" />
        ) : (
          <span className="font-bold">{tenant.name}</span>
        )}
        <span className="opacity-50 text-sm">/{slug}</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
