import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createArticleAction } from '@/lib/articles/actions';
import { PageHeader } from '@/components/owner/PageHeader';
import { relativeTime } from '@/lib/time';
import { fetchArticlesForTenant } from '@/lib/demo-pool/queries';

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
          <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
            {rows.map((r) => (
              <Link key={r.id} href={`/blog/${r.id}`} className="flex items-center gap-4 p-4 hover:bg-white/[0.03] transition">
                <div className="w-14 h-14 rounded bg-white/5 shrink-0 overflow-hidden">
                  {r.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    <span className="truncate">{r.title || 'Sin título'}</span>
                    {r.is_demo && (
                      <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 shrink-0">
                        Demo
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/45 mt-0.5 truncate">
                    /blog/{r.slug}
                    {r.is_demo
                      ? ' · del pool global (editá para personalizarlo)'
                      : ` · última edición ${relativeTime(r.updated_at)}`
                    }
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                  r.status === 'published'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-amber-500/15 text-amber-300'
                }`}>
                  {r.status === 'published' ? 'publicado' : 'borrador'}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
