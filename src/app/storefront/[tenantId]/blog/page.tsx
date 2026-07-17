import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { storefrontOrigin } from '@/lib/seo/meta';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ cat?: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  const { cat } = await searchParams;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return {};
  const origin = storefrontOrigin(tenant.slug);
  // Título/descripción dinámicos según categoría activa (mejor SEO por página).
  const catLabel = cat ? await lookupCategoryName(tenantId, cat) : null;
  const title = catLabel ? `${catLabel} · Blog` : 'Blog';
  const description = catLabel
    ? `Notas de ${catLabel} en ${tenant.name}.`
    : `Últimas notas, artículos y novedades de ${tenant.name}.`;
  const ogImage = tenant.brand?.og_image_url ?? null;
  const canonicalPath = cat ? `/blog?cat=${encodeURIComponent(cat)}` : '/blog';
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title: `${title} · ${tenant.name}`,
      description,
      url: `${origin}${canonicalPath}`,
      siteName: tenant.name,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: `${title} · ${tenant.name}`,
      description,
      images: ogImage ? [ogImage] : undefined
    },
    alternates: { canonical: `${origin}${canonicalPath}`, types: { 'application/rss+xml': `${origin}/rss.xml` } }
  };
}

// Helper: mirar el nombre de una categoría por slug (para header + meta).
// Defensivo — si no existe la tabla o el slug, devuelve null.
async function lookupCategoryName(tenantId: string, slug: string): Promise<string | null> {
  try {
    const svc = getServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('course_categories') as any)
      .select('name').eq('tenant_id', tenantId).eq('slug', slug).maybeSingle();
    return (data as { name?: string } | null)?.name ?? null;
  } catch { return null; }
}

type ArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  author_name: string | null;
  published_at: string;
  category_id: string | null;
};
type CategoryRow = { id: string; slug: string; name: string };

export default async function BlogIndexPage({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const { tenantId } = await params;
  const { cat: catSlug = null } = await searchParams;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();
  const primary = tenant.brand?.primary_color ?? '#0a0a0a';

  const svc = getServiceClient();

  // Cargar TODAS las categorías del tenant para el nav horizontal arriba
  // (siempre visible, permite saltar entre categorías).
  let allCategories: CategoryRow[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('course_categories') as any)
      .select('id, slug, name').eq('tenant_id', tenantId).order('position', { ascending: true });
    allCategories = (data ?? []) as CategoryRow[];
  } catch { /* ignore */ }

  // Resolver la categoría activa (si el owner pasó ?cat=slug).
  const activeCategory = catSlug
    ? allCategories.find((c) => c.slug === catSlug) ?? null
    : null;
  // Si el slug NO matchea ninguna categoría real, tratamos como "todas"
  // (evitamos 404 duro por si el owner borró la categoría después).
  const filterCatId = activeCategory?.id ?? null;

  // Cargar artículos, filtrando por category_id si hay categoría activa.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (svc.from('articles') as any)
    .select('id, slug, title, excerpt, cover_url, author_name, published_at, category_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);
  if (filterCatId) q = q.eq('category_id', filterCatId);
  const { data } = await q;
  const rows = (data ?? []) as ArticleCard[];

  const pageTitle = activeCategory?.name ?? 'Blog';

  return (
    <article className="max-w-5xl mx-auto px-6 py-10">
      <header className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold" style={activeCategory ? { color: primary } : undefined}>
          {pageTitle}
        </h1>
      </header>

      {/* Nav de categorías — siempre visible; resalta la activa */}
      {allCategories.length > 0 && (
        <nav className="flex flex-wrap gap-2 justify-center mb-8 pb-4 border-b border-black/10">
          <CatChip href="/blog" label="Todas" active={!activeCategory} />
          {allCategories.map((c) => (
            <CatChip key={c.id} href={`/blog?cat=${encodeURIComponent(c.slug)}`}
              label={c.name} active={activeCategory?.id === c.id} />
          ))}
        </nav>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-16 text-black/45">
          <div className="text-4xl mb-3">📝</div>
          <div className="text-lg">
            {activeCategory
              ? `No hay artículos publicados en ${activeCategory.name} todavía.`
              : 'Todavía no hay artículos publicados.'}
          </div>
          {activeCategory && (
            <Link href="/blog" className="inline-block mt-4 text-sm underline">
              Ver todas las notas →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rows.map((a) => {
            const dateLabel = new Date(a.published_at).toLocaleDateString('es-AR', {
              day: 'numeric', month: 'long', year: 'numeric'
            });
            return (
              <Link key={a.id} href={`/blog/${a.slug}`}
                className="block rounded-xl border border-black/10 overflow-hidden hover:shadow-lg transition bg-white">
                {a.cover_url && (
                  <div className="aspect-[16/9] bg-zinc-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.cover_url} alt={a.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="text-[11px] uppercase tracking-widest text-black/45 mb-2">
                    {dateLabel}{a.author_name ? ` · ${a.author_name}` : ''}
                  </div>
                  <h2 className="font-serif text-lg font-bold mb-2 leading-tight">{a.title}</h2>
                  {a.excerpt && <p className="text-sm text-black/60 line-clamp-3">{a.excerpt}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </article>
  );
}

function CatChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href}
      className={`text-xs px-3 py-1.5 rounded-full transition uppercase tracking-wide ${
        active
          ? 'bg-black text-white font-semibold'
          : 'border border-black/15 text-black/70 hover:border-black/40 hover:text-black'
      }`}>
      {label}
    </Link>
  );
}
