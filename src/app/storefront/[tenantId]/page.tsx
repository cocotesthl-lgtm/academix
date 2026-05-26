import { getTenantById } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";

export default async function StorefrontHome({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  const primary = tenant?.brand?.primary_color ?? '#0a0a0a';

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
          <p className="mt-4 text-lg text-black/60">
            Aprendé con nosotros. Cursos próximamente.
          </p>
        </div>
      </section>

      <section className="px-6 py-12 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Cursos disponibles</h2>
        <div className="rounded-xl border border-black/10 p-12 text-center text-black/50">
          Todavía no hay cursos publicados.
        </div>
      </section>
    </div>
  );
}
