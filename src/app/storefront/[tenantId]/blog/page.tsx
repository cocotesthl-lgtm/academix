import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { storefrontOrigin } from '@/lib/seo/meta';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return {};
  const origin = storefrontOrigin(tenant.slug);
  const description = `Últimas notas, artículos y novedades de ${tenant.name}.`;
  const ogImage = tenant.brand?.og_image_url ?? null;
  return {
    title: 'Blog',
    description,
    openGraph: {
      type: 'website',
      title: `Blog · ${tenant.name}`,
      description,
      url: `${origin}/blog`,
      siteName: tenant.name,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: `Blog · ${tenant.name}`,
      description,
      images: ogImage ? [ogImage] : undefined
    },
    alternates: { canonical: `${origin}/blog`, types: { 'application/rss+xml': `${origin}/rss.xml` } }
  };
}

type ArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  author_name: string | null;
  published_at: string;
};

export default async function BlogIndexPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('articles') as any)
    .select('id, slug, title, excerpt, cover_url, author_name, published_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);
  const rows = (data ?? []) as ArticleCard[];

  return (
    <article className="max-w-4xl mx-auto px-6 py-12">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-2">Blog</h1>
        <p className="text-black/55">Últimas notas, artículos y novedades.</p>
      </header>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-black/45">
          <div className="text-4xl mb-3">📝</div>
          <div className="text-lg">Todavía no hay artículos publicados.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
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
                  <div className="text-xs uppercase tracking-wider text-black/45 mb-2">
                    {dateLabel}{a.author_name ? ` · ${a.author_name}` : ''}
                  </div>
                  <h2 className="text-xl font-bold mb-2 leading-tight">{a.title}</h2>
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
