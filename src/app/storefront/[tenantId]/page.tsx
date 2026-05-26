import Link from "next/link";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type PublicCourse = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  currency: string;
};

export default async function StorefrontHome({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  const primary = tenant?.brand?.primary_color ?? '#0a0a0a';

  const svc = getServiceClient();
  const { data } = await svc
    .from("courses")
    .select("id, slug, title, description, cover_url, price_cents, currency")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  const courses = (data ?? []) as PublicCourse[];

  return (
    <div>
      <section
        className="px-6 py-20 text-center"
        style={{
          background: `linear-gradient(180deg, ${primary}15 0%, transparent 100%)`
        }}
      >
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            {tenant?.name ?? 'Academia'}
          </h1>
          <p className="mt-4 text-lg text-black/60">Aprendé con nosotros.</p>
        </div>
      </section>

      <section className="px-6 py-12 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Cursos disponibles</h2>

        {courses.length === 0 ? (
          <div className="rounded-xl border border-black/10 p-12 text-center text-black/50">
            Todavía no hay cursos publicados.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                className="block rounded-xl border border-black/10 overflow-hidden hover:shadow-lg transition"
              >
                <div
                  className="h-40 relative"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}
                >
                  {c.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.cover_url} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold mb-1">{c.title}</h3>
                  {c.description && (
                    <p className="text-sm text-black/60 line-clamp-2 mb-3">{c.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {c.price_cents === 0 ? 'Gratis' : `${(c.price_cents / 100).toLocaleString('es-AR')} ${c.currency}`}
                    </span>
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ background: primary, color: 'white' }}
                    >
                      Ver curso →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
