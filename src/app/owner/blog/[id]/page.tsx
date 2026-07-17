import { notFound, redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import { ArticleToolbar } from '@/components/owner/blog/ArticleToolbar';
import { ArticleEditorForm } from '@/components/owner/blog/ArticleEditorForm';
import type { Article } from '@/lib/articles/actions';
import { isDemoId, demoSlugFromId } from '@/lib/demo-pool/queries';
import { materializeDemoArticle } from '@/lib/demo-pool/mutations';

export const dynamic = 'force-dynamic';

export default async function ArticleEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Copy-on-open: si es un demo, materializarlo antes de abrir el editor
  // y redirigir al id real. Owner ve el editor con la data del demo pre-cargada
  // desde el primer momento y puede editar/publicar sin issues.
  if (isDemoId(id)) {
    const slug = demoSlugFromId(id);
    if (!slug) notFound();
    const realId = await materializeDemoArticle(tenant.id, slug);
    if (!realId) notFound();
    redirect(`/blog/${realId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('articles') as any)
    .select('*').eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  const article = data as Article | null;
  if (!article) notFound();

  const { data: catsRaw } = await svc.from('course_categories')
    .select('id, name').eq('tenant_id', tenant.id).order('position', { ascending: true });
  const categories = (catsRaw ?? []) as Array<{ id: string; name: string }>;

  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const host = isLocal
    ? `${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
    : `${tenant.slug}.${env.rootDomain}`;
  const publicUrl = `${u.protocol}//${host}/blog/${article.slug}`;

  return (
    <div className="space-y-6">
      <ArticleToolbar
        articleId={article.id}
        articleTitle={article.title}
        articleStatus={article.status}
        publicUrl={publicUrl}
      />

      {article.status !== 'published' && (
        <div className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          📝 En borrador — el artículo no aparece en tu blog público. Tocá <strong>Publicar</strong> arriba cuando esté listo.
        </div>
      )}

      <div className="max-w-3xl">
        <ArticleEditorForm article={article} categories={categories} />
      </div>
    </div>
  );
}
