import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createArticleAction } from '@/lib/articles/actions';
import { BlogAdsPanel } from '@/components/owner/blog/BlogAdsPanel';
import { PageHeader } from '@/components/owner/PageHeader';
import { fetchArticlesForTenant } from '@/lib/demo-pool/queries';
import { AppSectionList } from '@/components/owner/courses/AppSectionList';
import { tenantOrigin } from '@/lib/env';
import { getTenantModules } from '@/lib/modules/queries';
import { mergeConfig } from '@/lib/site/types';

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

  // Módulos activos + config del paywall + ads — para mostrar cards
  // de "Configurar paywall" y "Publicidad" con el estado actual.
  const modules = await getTenantModules(tenant.id);
  const plansEnabled = modules.plans !== false;
  let paywallMode: 'off' | 'soft' | 'hard' = 'off';
  let adsEnabled = true;
  let adSlots: Record<'banner' | 'rectangle' | 'square_1' | 'square_2', import('@/lib/site/types').BlogAdSlot | undefined> = {
    banner: undefined, rectangle: undefined, square_1: undefined, square_2: undefined
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tCfg } = await (svc.from('tenants') as any)
      .select('site_config_published, site_config').eq('id', tenant.id).maybeSingle();
    const cfg = mergeConfig(tCfg?.site_config_published ?? tCfg?.site_config);
    if (plansEnabled) {
      const raw = cfg.paywall?.mode ?? 'off';
      if (raw === 'soft' || raw === 'hard') paywallMode = raw;
    }
    adsEnabled = cfg.blog_ads_enabled !== false;
    const ads = cfg.blog_ads ?? {};
    adSlots = {
      banner: ads.banner,
      rectangle: ads.rectangle,
      square_1: ads.square_1,
      square_2: ads.square_2
    };
  } catch { /* respetamos defaults */ }

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

      {/* Card de paywall — sólo si la app Suscripciones (plans) está activa. */}
      {plansEnabled && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 flex-wrap ${
          paywallMode === 'off'
            ? 'border-white/15 bg-white/[0.02]'
            : paywallMode === 'soft'
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-emerald-500/40 bg-emerald-500/10'
        }`}>
          <div className="text-2xl leading-none">
            {paywallMode === 'off' ? '🔓' : paywallMode === 'soft' ? '💡' : '🔒'}
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="font-semibold text-sm">
              Paywall del blog · {paywallMode === 'off' ? 'sin paywall' : paywallMode === 'soft' ? 'opcional' : 'obligatorio'}
            </div>
            <p className="text-xs text-white/60 mt-0.5">
              {paywallMode === 'off'
                ? 'Todas las notas se leen completas. Prendé el paywall para monetizar contenido exclusivo.'
                : paywallMode === 'soft'
                  ? 'Los visitantes ven los primeros párrafos + banner recomendando suscribirse (pueden cerrarlo y seguir leyendo).'
                  : 'Los visitantes ven los primeros párrafos y después un gate bloqueante — necesitan suscripción para leer el resto.'}
            </p>
          </div>
          <Link
            href="/site#paywall-editor"
            className="text-xs px-3 py-1.5 rounded border border-white/20 bg-white/[0.05] hover:bg-white/10 whitespace-nowrap self-center"
          >
            ⚙️ Configurar paywall →
          </Link>
        </div>
      )}

      {/* Panel de publicidad — toggle on/off + editor expandible con 4 slots
          (banner, rectangle, 2 squares) editables: URL imagen, URL click,
          alt, fecha de expiración opcional (default indefinida). */}
      <BlogAdsPanel enabled={adsEnabled} slots={adSlots} />

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
