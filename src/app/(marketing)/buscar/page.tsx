import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { AcademiaSearch, type AcademiaCard } from "@/components/marketing/AcademiaSearch";
import { MarketingAuthNav } from "@/components/marketing/MarketingAuthNav";

export const dynamic = "force-dynamic";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  brand: { primary_color?: string; logo_url?: string } | null;
  owner_user_id?: string;
};

export default async function BuscarAcademiasPage() {
  const svc = getServiceClient();
  // Defensivo: si migration 0026 no corrió, public_listing no existe →
  // hacemos query sin el filtro y muestra todos (comportamiento previo).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] | null = null;
  try {
    const res = await svc
      .from("tenants")
      .select("id, slug, name, brand, owner_user_id")
      .eq("status", "active")
      .eq("public_listing", true)
      .order("created_at", { ascending: false });
    if (!res.error) data = res.data;
  } catch { /* migration missing */ }
  if (!data) {
    const fallback = await svc.from("tenants")
      .select("id, slug, name, brand, owner_user_id").eq("status", "active")
      .order("created_at", { ascending: false });
    data = fallback.data;
  }

  // Filtrar sitios cuyo owner esté 'suspended'. Defensivo: si migration 0086
  // no corrió (schema cache stale), no filtramos nada y el flujo sigue igual.
  const rawTenants = (data ?? []) as TenantRow[];
  const ownerIds = Array.from(new Set(rawTenants.map((t) => t.owner_user_id).filter((x): x is string => !!x)));
  const suspendedOwners = new Set<string>();
  if (ownerIds.length > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profs, error } = await (svc.from('profiles') as any)
        .select('id, moderation_status')
        .in('id', ownerIds);
      if (!error) {
        for (const p of ((profs ?? []) as Array<{ id: string; moderation_status?: string }>)) {
          if (p.moderation_status === 'suspended') suspendedOwners.add(p.id);
        }
      }
    } catch { /* silent */ }
  }
  const filtered = rawTenants.filter((t) => !t.owner_user_id || !suspendedOwners.has(t.owner_user_id));

  const sitios: AcademiaCard[] = filtered.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    primary_color: t.brand?.primary_color ?? null,
    logo_url: t.brand?.logo_url ?? null
  }));

  const u = new URL(env.appUrl);
  const isLocal = u.hostname === "localhost" || u.hostname.endsWith(".localhost");

  return (
    <div data-ui-theme="dark" className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">OfferNow</Link>
          <div className="flex items-center gap-3">
            <MarketingAuthNav variant="dark" />
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {/* ─── Buscar sitio (alumnos) ─── */}
        <div>
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Encontrá tu sitio
            </h1>
            <p className="mt-3 text-white/60">
              ¿Sos alumno? Buscá el sitio donde te inscribiste y entrá desde ahí.
            </p>
          </div>

          <AcademiaSearch
            sitios={sitios}
            rootDomain={env.rootDomain}
            isLocal={isLocal}
          />
        </div>

      </main>
    </div>
  );
}
