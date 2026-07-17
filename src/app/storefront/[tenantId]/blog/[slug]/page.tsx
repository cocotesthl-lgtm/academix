import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { storefrontOrigin, truncate } from '@/lib/seo/meta';

export const dynamic = 'force-dynamic';

type ArticleFull = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  body_html: string;
  author_name: string | null;
  published_at: string;
};

/**
 * Busca un artículo por slug: primero en articles (real del tenant),
 * después en demo_articles (pool global) si no está oculto ni customizado.
 *
 * Prioridad:
 *   1. articles del tenant con ese slug
 *   2. articles del tenant con demo_ref = slug (versión customizada del demo)
 *   3. demo_articles con ese slug, SI no está en tenant_demo_hidden
 *      Y no hay una row real con demo_ref apuntando a él
 */
async function findArticleBySlug(tenantId: string, slug: string): Promise<ArticleFull | null> {
  const svc = getServiceClient();

  // 1. Real del tenant por slug directo
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('articles') as any)
      .select('id, slug, title, excerpt, cover_url, body_html, author_name, published_at')
      .eq('tenant_id', tenantId).eq('slug', slug).eq('status', 'published')
      .maybeSingle();
    if (data) return data as ArticleFull;
  } catch { /* ignore */ }

  // 2. Real del tenant que sea customización de un demo con este slug
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('articles') as any)
      .select('id, slug, title, excerpt, cover_url, body_html, author_name, published_at')
      .eq('tenant_id', tenantId).eq('demo_ref', slug).eq('status', 'published')
      .maybeSingle();
    if (data) return data as ArticleFull;
  } catch { /* ignore */ }

  // 3. Demo del pool global, si no está hidden y no está customizado
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: hidden } = await (svc.from('tenant_demo_hidden') as any)
      .select('id').eq('tenant_id', tenantId).eq('resource_type', 'article').eq('demo_slug', slug)
      .maybeSingle();
    if (hidden) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: demo } = await (svc.from('demo_articles') as any)
      .select('slug, title, excerpt, cover_url, body_html, author_name, published_at')
      .eq('slug', slug).eq('status', 'published')
      .maybeSingle();
    if (!demo) return null;
    const d = demo as {
      slug: string; title: string; excerpt: string | null; cover_url: string | null;
      body_html: string; author_name: string | null; published_at: string;
    };
    return {
      id: `demo:${d.slug}`,
      slug: d.slug,
      title: d.title,
      excerpt: d.excerpt,
      cover_url: d.cover_url,
      body_html: d.body_html,
      author_name: d.author_name,
      published_at: d.published_at
    };
  } catch { /* ignore */ }

  return null;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ tenantId: string; slug: string }>;
}): Promise<Metadata> {
  const { tenantId, slug } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return {};
  const a = await findArticleBySlug(tenantId, slug);
  if (!a) return {};
  const origin = storefrontOrigin(tenant.slug);
  const description = truncate(a.excerpt || a.body_html, 160);
  const url = `${origin}/blog/${slug}`;
  return {
    title: a.title,
    description,
    openGraph: {
      type: 'article',
      title: a.title,
      description,
      url,
      siteName: tenant.name,
      publishedTime: a.published_at,
      authors: a.author_name ? [a.author_name] : undefined,
      images: a.cover_url ? [{ url: a.cover_url }] : undefined
    },
    twitter: {
      card: a.cover_url ? 'summary_large_image' : 'summary',
      title: a.title,
      description,
      images: a.cover_url ? [a.cover_url] : undefined
    },
    alternates: { canonical: url }
  };
}

export default async function ArticlePublicPage({
  params
}: {
  params: Promise<{ tenantId: string; slug: string }>;
}) {
  const { tenantId, slug } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const article = await findArticleBySlug(tenantId, slug);
  if (!article) notFound();

  const dateLabel = new Date(article.published_at).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <article className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/blog" className="text-sm text-black/55 hover:text-black">← Volver al blog</Link>

      <header className="mt-4 mb-8">
        <div className="text-xs uppercase tracking-wider text-black/45 mb-2">
          {dateLabel}{article.author_name ? ` · Por ${article.author_name}` : ''}
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-3">{article.title}</h1>
        {article.excerpt && (
          <p className="text-lg text-black/65 leading-relaxed">{article.excerpt}</p>
        )}
      </header>

      {article.cover_url && (
        <div className="rounded-xl overflow-hidden mb-10 border border-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.cover_url} alt={article.title}
            className="w-full h-auto object-cover" />
        </div>
      )}

      <div
        className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600 prose-a:underline"
        dangerouslySetInnerHTML={{ __html: article.body_html }}
      />
    </article>
  );
}
