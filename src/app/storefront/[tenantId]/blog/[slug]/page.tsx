import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';

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

export default async function ArticlePublicPage({
  params
}: {
  params: Promise<{ tenantId: string; slug: string }>;
}) {
  const { tenantId, slug } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('articles') as any)
    .select('id, slug, title, excerpt, cover_url, body_html, author_name, published_at')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  const article = data as ArticleFull | null;
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
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-3">{article.title}</h1>
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

      {/* Cuerpo del artículo. El HTML viene del RichTextField (TipTap) del owner.
          Es seguro porque TipTap solo produce tags estándares (p, strong, em, h1-3, ul, ol, li, a). */}
      <div
        className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600 prose-a:underline"
        dangerouslySetInnerHTML={{ __html: article.body_html }}
      />
    </article>
  );
}
