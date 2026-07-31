import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { storefrontOrigin, truncate } from '@/lib/seo/meta';
import { fetchArticlesForTenant } from '@/lib/demo-pool/queries';
import { ArticleSidebar } from '@/components/storefront/blog/ArticleSidebar';
import { AdSquaresPair } from '@/components/storefront/blog/AdSlot';
import { inlineAdHtml } from '@/components/storefront/blog/AdSlot';
import { PaywallSoft } from '@/components/storefront/paywall/PaywallSoft';
import { PaywallHard } from '@/components/storefront/paywall/PaywallHard';
import { splitBodyAtParagraph } from '@/lib/paywall/split-body';
import { isUserSubscribedToTenant } from '@/lib/paywall/check';
import { mergeConfig } from '@/lib/site/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TrackPageView } from '@/components/storefront/TrackPageView';

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
  tags?: string[] | null;
};

/**
 * Query defensiva: intenta con tags; si la columna no existe (migration
 * 0069 pendiente), reintenta sin tags. Similar para articles y demo_articles
 * respecto a columnas del pool (0067) y campo demo_ref (0067).
 */
async function selectArticleSafe(
  tableFrom: unknown,
  filters: (q: unknown) => unknown
): Promise<ArticleFull | null> {
  const baseCols = 'id, slug, title, excerpt, cover_url, body_html, author_name, published_at';
  // Intento con tags
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q1 = filters((tableFrom as any).select(`${baseCols}, tags`)) as any;
    const r1 = await q1.maybeSingle();
    if (r1?.data) return r1.data as ArticleFull;
    if (!r1?.error) return null;
    // Si hubo error (columna missing) caemos al retry sin tags
  } catch { /* ignore */ }
  // Retry sin tags
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q2 = filters((tableFrom as any).select(baseCols)) as any;
    const r2 = await q2.maybeSingle();
    if (r2?.data) return r2.data as ArticleFull;
  } catch { /* ignore */ }
  return null;
}

async function findArticleBySlug(tenantId: string, slug: string): Promise<ArticleFull | null> {
  const svc = getServiceClient();

  // 1. Real del tenant por slug directo
  const bySlug = await selectArticleSafe(
    svc.from('articles'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q: any) => q.eq('tenant_id', tenantId).eq('slug', slug).eq('status', 'published')
  );
  if (bySlug) return bySlug;

  // 2. Real del tenant customización de demo (columna demo_ref requiere 0067)
  try {
    const byDemoRef = await selectArticleSafe(
      svc.from('articles'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q: any) => q.eq('tenant_id', tenantId).eq('demo_ref', slug).eq('status', 'published')
    );
    if (byDemoRef) return byDemoRef;
  } catch { /* demo_ref no existe todavía */ }

  // 3. Demo del pool global (todo requiere 0067; falla silencioso si no)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: hidden } = await (svc.from('tenant_demo_hidden') as any)
      .select('id').eq('tenant_id', tenantId).eq('resource_type', 'article').eq('demo_slug', slug)
      .maybeSingle();
    if (hidden) return null;

    const fromPool = await selectArticleSafe(
      svc.from('demo_articles'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q: any) => q.eq('slug', slug).eq('status', 'published')
    );
    if (fromPool) return { ...fromPool, id: `demo:${fromPool.slug}` };
  } catch { /* pool no existe todavía */ }

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
      type: 'article', title: a.title, description, url, siteName: tenant.name,
      publishedTime: a.published_at,
      authors: a.author_name ? [a.author_name] : undefined,
      images: a.cover_url ? [{ url: a.cover_url }] : undefined
    },
    twitter: {
      card: a.cover_url ? 'summary_large_image' : 'summary',
      title: a.title, description,
      images: a.cover_url ? [a.cover_url] : undefined
    },
    alternates: { canonical: url }
  };
}

/**
 * Inserta un HTML snippet en medio del body_html después del N-ésimo </p>.
 * Si hay menos párrafos, lo pone al final.
 */
function insertAfterNthParagraph(bodyHtml: string, snippet: string, n: number): string {
  const closeTag = '</p>';
  let count = 0;
  let idx = -1;
  while (count < n) {
    idx = bodyHtml.indexOf(closeTag, idx + 1);
    if (idx === -1) break;
    count++;
  }
  if (idx === -1) return bodyHtml + snippet;
  const cut = idx + closeTag.length;
  return bodyHtml.slice(0, cut) + snippet + bodyHtml.slice(cut);
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

  const primary = tenant.brand?.primary_color ?? '#0a0a0a';
  const dateLabel = new Date(article.published_at).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const tags = Array.isArray(article.tags) ? article.tags.filter(Boolean) : [];

  // Traer un pool de artículos para: sidebar (últimos/más leídos/recomendados),
  // "te puede interesar" inline, "seguir leyendo" al final, y "últimas
  // noticias" antes del footer. Una sola query para todo.
  const others = (await fetchArticlesForTenant(tenantId, { limit: 30 }))
    .filter((a) => a.slug !== slug);

  // Selección determinística de "te puede interesar" — hash del slug del
  // artículo actual + módulo. Así no cambia en cada refresh.
  const interestIdx = others.length > 0
    ? Math.abs(hashCode(slug)) % others.length
    : -1;
  const interestArticle = interestIdx >= 0 ? others[interestIdx] : null;

  // Sub-set "seguir leyendo" (3 tras el artículo) — evita el "te puede interesar"
  const seguirLeyendo = others
    .filter((a) => !interestArticle || a.slug !== interestArticle.slug)
    .slice(0, 3);

  // Últimas noticias para la sección antes del footer (6)
  const ultimasNoticias = others.slice(0, 6);

  // ── HTML del "te puede interesar" inline ──
  const interestCardHtml = interestArticle
    ? `<aside class="tpi-card" style="display:flex;align-items:center;gap:16px;border-top:2px solid rgba(0,0,0,0.15);border-bottom:2px solid rgba(0,0,0,0.15);background:#fafaf9;padding:16px;margin:24px 0;">
        ${interestArticle.cover_url
          ? `<img src="${escapeAttr(interestArticle.cover_url)}" alt="" style="width:120px;height:80px;object-fit:cover;flex-shrink:0" />`
          : ''}
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(0,0,0,0.55);font-weight:600;margin-bottom:4px">
            Te puede interesar
          </div>
          <a href="/blog/${escapeAttr(interestArticle.slug)}" style="font-family:Georgia,serif;font-size:17px;font-weight:700;color:#000;line-height:1.3;text-decoration:none">
            ${escapeHtml(interestArticle.title)}
          </a>
        </div>
        <span style="color:${primary};font-size:20px;font-weight:bold">›</span>
      </aside>`
    : '';

  // Inyectamos varias cosas dentro del body_html en orden:
  //   1er banner de ad → después del 2do párrafo
  //   te puede interesar → después del 3er párrafo
  //   rectangle ad     → después del 5to párrafo
  //
  // Se insertan en orden inverso (últimos primero) para que las
  // posiciones de los primeros no se corran al agregar los siguientes.
  let bodyWithExtras = article.body_html;
  const inlineRectAd = inlineAdHtml('rectangle');
  const inlineBannerAd = inlineAdHtml('banner');
  bodyWithExtras = insertAfterNthParagraph(bodyWithExtras, inlineRectAd, 5);
  if (interestCardHtml) {
    bodyWithExtras = insertAfterNthParagraph(bodyWithExtras, interestCardHtml, 3);
  }
  bodyWithExtras = insertAfterNthParagraph(bodyWithExtras, inlineBannerAd, 2);

  // ── Paywall ──────────────────────────────────────────────────────
  // Cargamos site_config para leer el modo. Owner del tenant y
  // buyers con suscripción activa BYPASSEAN el paywall siempre.
  const svcCfg = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tRow } = await (svcCfg.from('tenants') as any)
    .select('site_config_published, site_config').eq('id', tenantId).single();
  const cfg = mergeConfig(tRow?.site_config_published ?? tRow?.site_config);
  const paywallCfg = cfg.paywall || { mode: 'off' };

  let userId: string | null = null;
  if (paywallCfg.mode !== 'off') {
    try {
      const sb = await createSupabaseServerClient();
      const { data: { user } } = await sb.auth.getUser();
      userId = user?.id ?? null;
    } catch { /* anon visitor */ }
  }
  const bypass = paywallCfg.mode === 'off'
    ? true
    : await isUserSubscribedToTenant(userId, tenantId);

  // Split body al párrafo N si vamos a aplicar paywall
  const freeParas = Math.max(1, Math.min(10, paywallCfg.free_paragraphs ?? 3));
  const { free: bodyFree, rest: bodyRest } = (!bypass && paywallCfg.mode !== 'off')
    ? splitBodyAtParagraph(bodyWithExtras, freeParas)
    : { free: bodyWithExtras, rest: '' };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <TrackPageView tenantId={tenantId} eventType="article_view" productId={article.id} contentKind="article" />
      {/* Layout 2 columnas: contenido (article + últimas noticias) a la
          izquierda, sidebar a la derecha. Al meter Últimas Noticias
          DENTRO del grid, la aside crece más y el sticky de
          "Te Recomendamos" acompaña el scroll hasta abajo de Últimas. */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-10">
        {/* ── COLUMNA PRINCIPAL ── */}
        <article className="min-w-0">
          <Link href="/blog" className="text-sm text-black/55 hover:text-black">← Volver</Link>

          <header className="mt-4 mb-8">
            <div className="text-xs uppercase tracking-wider text-black/45 mb-2">
              {dateLabel}{article.author_name ? ` · Por ${article.author_name}` : ''}
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-3">{article.title}</h1>
            {article.excerpt && (
              <p className="text-lg text-black/70 leading-relaxed">{article.excerpt}</p>
            )}
          </header>

          {article.cover_url && (
            <div className="overflow-hidden mb-8 border border-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.cover_url} alt={article.title}
                className="w-full h-auto object-cover" />
            </div>
          )}

          {/* Cuerpo del artículo con paywall opcional. Bypass si owner
              o suscriptor activo. Modo 'off' == bypass. */}
          <div
            className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600 prose-a:underline"
            dangerouslySetInnerHTML={{ __html: bodyFree }}
          />
          {!bypass && paywallCfg.mode === 'soft' && bodyRest && (
            <PaywallSoft
              restHtml={bodyRest}
              title={paywallCfg.title || 'Seguí leyendo esta nota'}
              message={paywallCfg.message || 'Suscribite y accedé sin límites.'}
              ctaLabel={paywallCfg.cta_label || 'Suscribirme'}
              ctaHref={paywallCfg.cta_href || '#pricing'}
              dismissLabel={paywallCfg.dismiss_label || 'Seguir leyendo igual'}
              primaryColor={primary}
            />
          )}
          {!bypass && paywallCfg.mode === 'hard' && bodyRest && (
            <PaywallHard
              title={paywallCfg.title || 'Contenido para suscriptores'}
              message={paywallCfg.message || 'Suscribite para leer la nota completa.'}
              ctaLabel={paywallCfg.cta_label || 'Suscribirme'}
              ctaHref={paywallCfg.cta_href || '#pricing'}
              primaryColor={primary}
            />
          )}

          {/* Compartir + separator */}
          <div className="mt-10 pt-6 border-t border-black/10 flex items-center justify-center gap-3 text-sm text-black/60">
            <span className="mr-2">Compartir nota:</span>
            <ShareLink kind="facebook" href={`https://facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${storefrontOrigin(tenant.slug)}/blog/${slug}`)}`} />
            <ShareLink kind="whatsapp" href={`https://wa.me/?text=${encodeURIComponent(article.title + ' — ' + storefrontOrigin(tenant.slug) + '/blog/' + slug)}`} />
            <ShareLink kind="twitter" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${storefrontOrigin(tenant.slug)}/blog/${slug}`)}&text=${encodeURIComponent(article.title)}`} />
          </div>

          {/* Par de squares de ads — típico ubicación post-share */}
          <AdSquaresPair />

          {/* Seguir leyendo */}
          {seguirLeyendo.length > 0 && (
            <section className="mt-10 border border-black/10 rounded">
              <div className="px-4 py-3 border-b border-black/10 flex items-center gap-2">
                <span className="text-lg">👁</span>
                <strong className="text-sm">Seguir leyendo</strong>
              </div>
              <ul className="divide-y divide-black/5">
                {seguirLeyendo.map((a) => (
                  <li key={a.slug} className="p-4">
                    <Link href={`/blog/${a.slug}`} className="flex items-start gap-3 group">
                      <span className="w-1 h-full min-h-[40px] shrink-0" style={{ background: primary }} />
                      <span className="font-serif font-bold text-[15px] leading-tight flex-1 group-hover:underline">
                        {a.title}
                      </span>
                      <span className="text-lg shrink-0" style={{ color: primary }}>›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Temas relacionados */}
          {tags.length > 0 && (
            <section className="mt-8">
              <div className="text-sm font-bold mb-2">+ Temas Relacionados</div>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Link key={t} href={`/blog?q=${encodeURIComponent(t)}`}
                    className="inline-block text-xs bg-black/5 hover:bg-black/10 border border-black/10 px-3 py-1.5 rounded-full text-black/80">
                    {t}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── ÚLTIMAS NOTICIAS antes del footer ── */}
          {/* Vive dentro del <article> (columna izq) para que el sticky
              del sidebar acompañe hasta abajo y se despegue recién cuando
              termina esta sección. */}
          {ultimasNoticias.length > 0 && (
            <section className="mt-16 pt-8 border-t-2 border-black">
              <h2 className="font-serif text-2xl font-bold mb-6">Últimas Noticias</h2>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
                {ultimasNoticias.map((a) => (
                  <Link key={a.slug} href={`/blog/${a.slug}`}
                    className="flex gap-4 group items-start border-b border-black/5 pb-4">
                    <div className="flex-1 min-w-0">
                      {a.category_name && (
                        <div className="text-[10px] uppercase tracking-widest text-black/45 mb-1">
                          {a.category_name}
                        </div>
                      )}
                      <h3 className="font-serif font-bold text-[15px] leading-snug group-hover:underline">
                        {a.title}
                      </h3>
                      {a.excerpt && (
                        <p className="text-xs text-black/55 mt-1 line-clamp-2">{a.excerpt}</p>
                      )}
                    </div>
                    {a.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.cover_url} alt="" className="w-24 h-20 object-cover shrink-0" />
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>

        {/* ── SIDEBAR (sticky con "Te recomendamos") ── */}
        <aside className="min-w-0">
          <ArticleSidebar
            articles={others.slice(0, 15).map((a) => ({
              slug: a.slug, title: a.title, cover_url: a.cover_url,
              category_name: a.category_name ?? null
            }))}
            primary={primary}
          />
        </aside>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function ShareLink({ kind, href }: { kind: 'facebook' | 'whatsapp' | 'twitter'; href: string }) {
  const icons = {
    facebook: 'f',
    whatsapp: '💬',
    twitter: '𝕏'
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="w-9 h-9 rounded-full border border-black/15 hover:bg-black/5 flex items-center justify-center text-sm font-bold">
      {icons[kind]}
    </a>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]!);
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}
