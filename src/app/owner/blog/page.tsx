import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createArticleAction } from '@/lib/articles/actions';
import { PageHeader } from '@/components/owner/PageHeader';
import { fetchArticlesForTenant } from '@/lib/demo-pool/queries';
import { AppSectionList } from '@/components/owner/courses/AppSectionList';
import { tenantOrigin } from '@/lib/env';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  published_at: string | null;
  updated_at: string;
  cover_url: string | null;
  is_demo?: boolean;
};

export default async function BlogListPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const origin = tenantOrigin(tenant.slug);

  // Reales del tenant + demos visibles del pool. Los demos tienen id
  // sintético "demo:{slug}" y aparecen con badge "Demo".
  const reals = await (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('articles') as any)
      .select('id, slug, title, status, published_at, updated_at, cover_url')
      .eq('tenant_id', tenant.id)
      .order('updated_at', { ascending: false });
    return (data ?? []) as Row[];
  })();
  const demos = await fetchArticlesForTenant(tenant.id, { limit: 100 });
  // Solo demos puros (is_demo=true) — los reales ya vienen arriba.
  const demoRows: Row[] = demos.filter((d) => d.is_demo).map((d) => ({
    id: d.id, slug: d.slug, title: d.title,
    status: 'published' as const,
    published_at: d.published_at, updated_at: d.published_at,
    cover_url: d.cover_url,
    is_demo: true
  }));
  const rows: Row[] = [...reals, ...demoRows];
  const publishedCount = rows.filter((r) => r.status === 'published').length;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Blog"
        description="Publicá artículos, noticias y guías. Cada artículo tiene su URL pública en /blog/<slug>."
        actions={
          <form action={createArticleAction}>
            <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
              + Nuevo artículo
            </button>
          </form>
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">📝</div>
          <div className="text-white/70 font-medium">Aún no publicaste artículos</div>
          <p className="text-xs text-white/45 mt-1 mb-4">
            Escribí tu primer artículo y compartilo con tu audiencia.
          </p>
          <form action={createArticleAction}>
            <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
              + Crear el primero
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="text-xs text-white/50">
            {rows.length} artículo{rows.length === 1 ? '' : 's'} · {publishedCount} publicado{publishedCount === 1 ? '' : 's'}
          </div>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <AppSectionList
              kind="articles"
              rows={rows.map((r) => ({
                id: r.id,
                slug: r.slug,
                title: r.title || 'Sin título',
                status: r.status,
                price_cents: 0,
                currency: '',
                cover_url: r.cover_url,
                updated_at: r.updated_at,
                editHref: `/blog/${r.id}`,
                publicHref: `${origin}/blog/${r.slug}`
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
