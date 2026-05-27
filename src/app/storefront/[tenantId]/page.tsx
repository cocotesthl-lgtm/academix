import Link from "next/link";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";
import { DEFAULT_SITE_CONFIG, type SiteConfig, type SectionKey } from "@/lib/site/types";

export const dynamic = "force-dynamic";

type PublicCourse = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  currency: string;
  is_featured: boolean;
  featured_position: number;
  category_id: string | null;
};

type Category = { id: string; name: string; slug: string };

export default async function StorefrontHome({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const { tenantId } = await params;
  const { cat: selectedCatSlug } = await searchParams;

  const tenant = await getTenantById(tenantId);
  const primary = tenant?.brand?.primary_color ?? '#0a0a0a';
  const accent = tenant?.brand?.accent_color ?? primary;

  const svc = getServiceClient();
  const [{ data: tenantRow }, { data: coursesRaw }, { data: catsRaw }] = await Promise.all([
    svc.from('tenants').select('site_config').eq('id', tenantId).single<{ site_config: SiteConfig | null }>(),
    svc.from('courses')
      .select('id, slug, title, description, cover_url, price_cents, currency, is_featured, featured_position, category_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
    svc.from('course_categories')
      .select('id, name, slug')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true })
  ]);

  const cfg: SiteConfig = tenantRow?.site_config ?? DEFAULT_SITE_CONFIG;
  const allCourses = (coursesRaw ?? []) as PublicCourse[];
  const categories = (catsRaw ?? []) as Category[];
  const catById = new Map(categories.map((c) => [c.id, c]));
  const selectedCat = selectedCatSlug ? categories.find((c) => c.slug === selectedCatSlug) ?? null : null;

  const featured = allCourses
    .filter((c) => c.is_featured)
    .sort((a, b) => a.featured_position - b.featured_position);
  const catalog = selectedCat
    ? allCourses.filter((c) => c.category_id === selectedCat.id)
    : allCourses;

  return (
    <div>
      {cfg.order.map((key: SectionKey) => {
        const s = cfg.sections[key];
        if (!s?.enabled) return null;

        switch (key) {
          case 'hero':
            return (
              <section
                key={key}
                className="px-6 py-20 text-center"
                style={{ background: `linear-gradient(180deg, ${primary}15 0%, transparent 100%)` }}
              >
                <div className="max-w-3xl mx-auto">
                  <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                    {cfg.sections.hero.title || tenant?.name || 'Academia'}
                  </h1>
                  {cfg.sections.hero.subtitle && (
                    <p className="mt-4 text-lg text-black/60">{cfg.sections.hero.subtitle}</p>
                  )}
                  {cfg.sections.hero.cta_label && (
                    <a
                      href={cfg.sections.hero.cta_href || '#cursos'}
                      className="mt-8 inline-block rounded-md px-6 py-3 font-semibold text-white"
                      style={{ background: primary }}
                    >
                      {cfg.sections.hero.cta_label}
                    </a>
                  )}
                </div>
              </section>
            );

          case 'about':
            return (
              <section key={key} className="px-6 py-16 bg-black/[0.02]">
                <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
                  {cfg.sections.about.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cfg.sections.about.image_url} alt="" className="rounded-xl w-full object-cover max-h-96" />
                  ) : (
                    <div className="rounded-xl w-full h-72 flex items-center justify-center" style={{ background: `${primary}15` }}>
                      <span className="text-6xl">👋</span>
                    </div>
                  )}
                  <div>
                    <h2 className="text-3xl font-bold mb-4">{cfg.sections.about.title}</h2>
                    <p className="text-black/70 whitespace-pre-line leading-relaxed">{cfg.sections.about.body}</p>
                  </div>
                </div>
              </section>
            );

          case 'featured':
            if (featured.length === 0) return null;
            return (
              <section key={key} className="px-6 py-16 max-w-6xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">{cfg.sections.featured.title}</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                  {featured.map((c) => (
                    <CourseCard key={c.id} c={c} primary={primary} accent={accent} />
                  ))}
                </div>
              </section>
            );

          case 'catalog':
            return (
              <section key={key} id="cursos" className="px-6 py-16 max-w-6xl mx-auto">
                <div className="flex items-end justify-between gap-4 mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold">{cfg.sections.catalog.title}</h2>
                </div>
                {cfg.sections.catalog.show_filters && categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    <Link
                      href="/"
                      className={`text-sm px-3 py-1.5 rounded-full border ${!selectedCat ? 'bg-black text-white border-black' : 'border-black/15 text-black/70 hover:bg-black/[0.03]'}`}
                    >
                      Todos
                    </Link>
                    {categories.map((c) => (
                      <Link
                        key={c.id}
                        href={`/?cat=${c.slug}`}
                        className={`text-sm px-3 py-1.5 rounded-full border ${selectedCat?.id === c.id ? 'bg-black text-white border-black' : 'border-black/15 text-black/70 hover:bg-black/[0.03]'}`}
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
                {catalog.length === 0 ? (
                  <div className="rounded-xl border border-black/10 p-12 text-center text-black/50">
                    {selectedCat ? `No hay cursos en "${selectedCat.name}" todavía.` : 'Todavía no hay cursos publicados.'}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {catalog.map((c) => (
                      <CourseCard key={c.id} c={c} primary={primary} accent={accent} category={c.category_id ? catById.get(c.category_id) : null} />
                    ))}
                  </div>
                )}
              </section>
            );

          case 'testimonials':
            if (cfg.sections.testimonials.items.length === 0) return null;
            return (
              <section key={key} className="px-6 py-16 bg-black/[0.02]">
                <div className="max-w-5xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{cfg.sections.testimonials.title}</h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {cfg.sections.testimonials.items.map((t) => (
                      <div key={t.id} className="rounded-xl bg-white border border-black/10 p-5">
                        <p className="text-black/80 italic">"{t.text}"</p>
                        <div className="mt-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: primary }}>
                            {t.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="text-sm">
                            <div className="font-medium">{t.name}</div>
                            {t.role && <div className="text-black/50 text-xs">{t.role}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case 'faq':
            if (cfg.sections.faq.items.length === 0) return null;
            return (
              <section key={key} className="px-6 py-16 max-w-3xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{cfg.sections.faq.title}</h2>
                <div className="space-y-3">
                  {cfg.sections.faq.items.map((f) => (
                    <details key={f.id} className="rounded-lg border border-black/10 overflow-hidden">
                      <summary className="cursor-pointer px-5 py-3 font-medium hover:bg-black/[0.02]">{f.q}</summary>
                      <div className="px-5 pb-4 text-black/70 whitespace-pre-line">{f.a}</div>
                    </details>
                  ))}
                </div>
              </section>
            );

          case 'cta_final':
            return (
              <section
                key={key}
                className="px-6 py-20 text-center"
                style={{ background: `linear-gradient(0deg, ${primary}15 0%, transparent 100%)` }}
              >
                <div className="max-w-2xl mx-auto">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">{cfg.sections.cta_final.title}</h2>
                  {cfg.sections.cta_final.body && (
                    <p className="text-black/70 mb-8">{cfg.sections.cta_final.body}</p>
                  )}
                  {cfg.sections.cta_final.cta_label && (
                    <a
                      href={cfg.sections.cta_final.cta_href || '#cursos'}
                      className="inline-block rounded-md px-6 py-3 font-semibold text-white"
                      style={{ background: primary }}
                    >
                      {cfg.sections.cta_final.cta_label}
                    </a>
                  )}
                </div>
              </section>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

function CourseCard({
  c, primary, category
}: {
  c: PublicCourse; primary: string; accent?: string; category?: Category | null;
}) {
  return (
    <Link
      href={`/c/${c.slug}`}
      className="block rounded-xl border border-black/10 overflow-hidden hover:shadow-lg transition bg-white"
    >
      <div className="h-40 relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
        {c.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.cover_url} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {c.is_featured && (
          <span className="absolute top-3 left-3 bg-white text-black text-xs font-semibold px-2 py-1 rounded">
            ⭐ Destacado
          </span>
        )}
      </div>
      <div className="p-5">
        {category && (
          <div className="text-xs font-medium mb-1.5" style={{ color: primary }}>
            {category.name}
          </div>
        )}
        <h3 className="font-semibold mb-1">{c.title}</h3>
        {c.description && <p className="text-sm text-black/60 line-clamp-2 mb-3">{c.description}</p>}
        <div className="flex items-center justify-between">
          <span className="font-bold">
            {c.price_cents === 0 ? 'Gratis' : `$ ${(c.price_cents / 100).toLocaleString('es-AR')} ${c.currency}`}
          </span>
          <span
            className="text-xs font-medium px-2 py-1 rounded text-white"
            style={{ background: primary }}
          >
            Ver curso →
          </span>
        </div>
      </div>
    </Link>
  );
}
