import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { AcademiaSearch, type AcademiaCard } from "@/components/marketing/AcademiaSearch";
import { MarketingAuthNav } from "@/components/marketing/MarketingAuthNav";
import { Reveal } from "@/components/marketing/Reveal";

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
  const filtered = rawTenants
    // Ocultar preview tenants del founder (slug prefix `_tpl-`) — sandboxes
    // internos, no son sitios reales que quieran aparecer en el marketplace.
    .filter((t) => !t.slug.startsWith('_tpl-'))
    .filter((t) => !t.owner_user_id || !suspendedOwners.has(t.owner_user_id));

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

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {/* ─── Buscar sitio (alumnos) ─── */}
        <Reveal>
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Encontrá tu sitio
              </h1>
              <p className="mt-3 text-white/60">
                ¿Sos alumno o cliente? Buscá el sitio donde te registraste y entrá desde ahí.
              </p>
            </div>

            <AcademiaSearch
              sitios={sitios}
              rootDomain={env.rootDomain}
              isLocal={isLocal}
            />
          </div>
        </Reveal>

        {/* ─── Divisor "o" ─── */}
        <Reveal delay={100}>
          <div className="flex items-center gap-4 max-w-md mx-auto">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">o</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </Reveal>

        {/* ─── Dos rutas: Afiliarse / Crear sitio ─── */}
        <div className="grid md:grid-cols-2 gap-5">
          <Reveal delay={150} className="h-full">
            <Link
              href="/affiliate"
              className="block h-full rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-white/[0.02] to-transparent hover:from-blue-500/20 hover:border-blue-500/40 p-7 transition-all group"
            >
              <div className="text-4xl mb-4">💼</div>
              <h2 className="text-xl font-bold mb-2">Volvete afiliado</h2>
              <p className="text-sm text-white/60 leading-relaxed mb-5">
                Promocioná publicaciones de los sitios en la plataforma con un link único y ganás
                comisión por cada venta. Aprobación inmediata, sin costo.
              </p>
              <div className="text-sm font-semibold text-blue-300 group-hover:text-blue-200 transition inline-flex items-center gap-1">
                Ver cómo funciona
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          </Reveal>

          <Reveal delay={250} className="h-full">
            <Link
              href="/onboarding"
              className="block h-full rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/15 via-amber-500/[0.06] to-transparent hover:from-orange-500/25 hover:border-orange-400 p-7 transition-all group shadow-lg shadow-orange-500/10"
            >
              <div className="text-4xl mb-4">🏗️</div>
              <h2 className="text-xl font-bold mb-2">Creá tu propio sitio</h2>
              <p className="text-sm text-white/70 leading-relaxed mb-5">
                Empezá con tu subdominio gratis en <strong>tunombre.bzseguridad.store</strong>.
                Todos los módulos incluidos: cursos, ecommerce, entradas, blog y más.
                Solo pagás cuando vendés.
              </p>
              <div className="text-sm font-semibold text-orange-300 group-hover:text-orange-200 transition inline-flex items-center gap-1">
                Empezar ahora
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          </Reveal>
        </div>
      </main>
    </div>
  );
}
