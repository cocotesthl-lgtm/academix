import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { AcademiaSearch, type AcademiaCard } from "@/components/marketing/AcademiaSearch";

export const dynamic = "force-dynamic";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  brand: { primary_color?: string; logo_url?: string } | null;
};

export default async function BuscarAcademiasPage() {
  const svc = getServiceClient();
  const { data } = await svc
    .from("tenants")
    .select("id, slug, name, brand")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const academias: AcademiaCard[] = ((data ?? []) as TenantRow[]).map((t) => ({
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
          <Link href="/" className="text-xl font-bold tracking-tight">Curplat</Link>
          <div className="flex items-center gap-3">
            <Link href="/signup" className="text-sm rounded-md bg-white text-black px-4 py-2 font-medium hover:bg-white/90">
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Encontrá tu academia
          </h1>
          <p className="mt-3 text-white/60">
            Buscá la academia donde te inscribiste. Entrás a su sitio y desde ahí iniciás sesión.
          </p>
        </div>

        <AcademiaSearch
          academias={academias}
          rootDomain={env.rootDomain}
          isLocal={isLocal}
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
            <p className="text-sm text-white/60">
              ¿Sos creador y querés tener tu propia academia?
            </p>
            <Link
              href="/signup"
              className="inline-block mt-3 rounded-md bg-white text-black px-5 py-2 font-medium hover:bg-white/90"
            >
              Crear mi academia gratis →
            </Link>
          </div>

          {/* CTA afiliados — registro platform-level (Curplat) */}
          <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 p-6 text-center">
            <p className="text-sm text-white/70">
              💼 ¿Querés promocionar cursos y ganar comisión?
            </p>
            <Link
              href="/affiliate"
              className="inline-block mt-3 rounded-md bg-fuchsia-500 text-white px-5 py-2 font-semibold hover:bg-fuchsia-400"
            >
              Ser afiliado de Curplat →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
