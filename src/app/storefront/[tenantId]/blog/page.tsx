import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { storefrontOrigin } from '@/lib/seo/meta';
import { fetchArticlesForTenant, fetchCategoriesForTenant } from '@/lib/demo-pool/queries';

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

async function lookupCategoryName(tenantId: string, slug: string): Promise<string | null> {
  // Busca en el conjunto efectivo (real + demos visibles).
  const cats = await fetchCategoriesForTenant(tenantId);
  return cats.find((c) => c.slug === slug)?.name ?? null;
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
type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
};

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

  // Categorías efectivas (real + demos visibles) — helper del pool.
  const allCategories = await fetchCategoriesForTenant(tenantId);

  // Separar top-level de subs.
  const mainCategories = allCategories.filter((c) => !c.parent_id);
  const activeCategory = catSlug ? allCategories.find((c) => c.slug === catSlug) ?? null : null;
  const isSub = !!activeCategory?.parent_id;
  const parentCategory = isSub
    ? allCategories.find((c) => c.id === activeCategory?.parent_id) ?? null
    : activeCategory;
  const subsOfParent = parentCategory
    ? allCategories.filter((c) => c.parent_id === parentCategory.id)
    : [];

  // Artículos efectivos (real + demos visibles) con filtro por categoría.
  const mergedArticles = await fetchArticlesForTenant(tenantId, {
    limit: 50,
    categorySlug: activeCategory?.slug ?? null
  });
  const rows: ArticleCard[] = mergedArticles.map((a) => ({
    id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt,
    cover_url: a.cover_url, author_name: a.author_name,
    published_at: a.published_at, category_id: a.category_id ?? null
  }));

  // El título grande es siempre el nombre de la categoría activa (main o sub);
  // si no hay categoría activa, "Blog".
  const pageTitle = activeCategory?.name ?? 'Blog';

  return (
    <article className="max-w-6xl mx-auto px-6 py-10">
      <header className="text-center mb-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-black">
          {pageTitle}
        </h1>
      </header>

      {/* Sub-nav estilo The Times: underline en la activa, sin chips.
          Muestra "Top stories" como link a la vista de la main sin filtro
          de subcategoría, más las subcategorías del parent actual.
          Si la página está en /blog sin categoría, muestra las mains. */}
      {(subsOfParent.length > 0 || (!activeCategory && mainCategories.length > 0)) && (
        <nav className="flex flex-wrap gap-x-6 gap-y-2 justify-center border-b border-black/15 pb-3 mb-8 text-[13px]">
          {parentCategory ? (
            <>
              <SubNavLink
                href={`/blog?cat=${encodeURIComponent(parentCategory.slug)}`}
                label="Top stories"
                active={activeCategory?.id === parentCategory.id}
              />
              {subsOfParent.map((s) => (
                <SubNavLink
                  key={s.id}
                  href={`/blog?cat=${encodeURIComponent(s.slug)}`}
                  label={s.name}
                  active={activeCategory?.id === s.id}
                />
              ))}
            </>
          ) : (
            <>
              <SubNavLink href="/blog" label="Todas" active={!activeCategory} />
              {mainCategories.map((c) => (
                <SubNavLink key={c.id} href={`/blog?cat=${encodeURIComponent(c.slug)}`}
                  label={c.name} active={false} />
              ))}
            </>
          )}
        </nav>
      )}

      {/* Grid de artículos */}
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

/** Link de subnav estilo The Times: sin bordes, underline en la activa. */
function SubNavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative pb-2 font-semibold transition ${
        active
          ? 'text-black'
          : 'text-black/65 hover:text-black'
      }`}
      style={active ? { boxShadow: 'inset 0 -3px 0 0 currentColor' } : undefined}
    >
      {label}
    </Link>
  );
}
