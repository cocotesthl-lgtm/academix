import Link from "next/link";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";
import { mergeConfig, type SectionKey } from "@/lib/site/types";
import { sectionBgStyle, textEffectStyle, buttonStyle, buttonsVisible } from "@/lib/site/style-helpers";
import { AnimatedCounter } from "@/components/storefront/AnimatedCounter";
import { FadeIn } from "@/components/storefront/FadeIn";
import { CatalogFilter } from "@/components/storefront/CatalogFilter";
import { FormRenderer, type FormDef, type FormFieldDef } from "@/components/storefront/FormRenderer";
import { CartWidget } from "@/components/storefront/cart/CartWidget";
import { HeroSlider } from "@/components/storefront/HeroSlider";
import { ProductsStrip } from "@/components/storefront/ProductsStrip";
import { WorkWithUsCTA } from "@/components/storefront/WorkWithUsCTA";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Render de un string que puede ser texto plano (legacy) o HTML del
 * RichTextField (TipTap). Si está vacío, devuelve el fallback como texto.
 * Si es HTML envuelto en un solo <p>...</p>, lo desenvolvemos para que
 * encaje cuando el contenedor es un elemento inline-friendly (h1, p, etc).
 */
function richHtml(input: string | null | undefined, fallback = ''): { __html: string } {
  const raw = (input ?? '').trim() || fallback;
  const stripped = raw.replace(/^<p(\s[^>]*)?>([\s\S]*)<\/p>$/i, '$2');
  return { __html: stripped };
}

export const dynamic = "force-dynamic";

type PublicCourse = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  currency: string;
  is_featured: boolean;
  featured_position: number;
  category_id: string | null;
  ribbon_text?: string | null;
  ribbon_tone?: string | null;
};

type Category = { id: string; name: string; slug: string };

const SOCIAL_LABEL: Record<string, string> = {
  instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn',
  twitter: 'Twitter', tiktok: 'TikTok', facebook: 'Facebook', web: 'Sitio web'
};
void SOCIAL_LABEL;

export default async function StorefrontHome({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ cat?: string; contact?: string }>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const selectedCatSlug = sp.cat;

  const tenant = await getTenantById(tenantId);
  const primary = tenant?.brand?.primary_color ?? '#0a0a0a';
  const accent = tenant?.brand?.accent_color ?? primary;
  void accent;

  const svc = getServiceClient();
  // F6: affiliate mode + terms (defensivo si migration 0047 pendiente)
  let affiliateMode: 'disabled' | '1click' | 'approval' = 'disabled';
  let affiliateTerms: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: aff } = await (svc.from('tenants') as any)
      .select('affiliate_mode, affiliate_terms').eq('id', tenantId).maybeSingle();
    const r = aff as { affiliate_mode?: string; affiliate_terms?: string | null } | null;
    if (r?.affiliate_mode === '1click' || r?.affiliate_mode === 'approval') affiliateMode = r.affiliate_mode;
    affiliateTerms = r?.affiliate_terms ?? null;
  } catch { /* migration pendiente */ }

  // User logueado + su membership actual con este tenant (para decidir
  // qué mostrar en el CTA: "Aplicar" / "Aplicación pendiente" / "Ya sos afiliado")
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user: currentUser } } = await supabaseAuth.auth.getUser();
  let affiliateMembershipStatus: 'active' | 'pending' | null = null;
  if (currentUser) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: m } = await (svc.from('memberships') as any)
        .select('role, status').eq('user_id', currentUser.id).eq('tenant_id', tenantId).maybeSingle();
      const mr = m as { role?: string; status?: string } | null;
      if (mr?.role === 'affiliate' && (mr.status === 'active' || mr.status === 'pending')) {
        affiliateMembershipStatus = mr.status as 'active' | 'pending';
      }
    } catch { /* ignore */ }
  }

  const [{ data: tenantRow }, { data: coursesRaw }, { data: catsRaw }] = await Promise.all([
    // Storefront público: lee site_config_published (snapshot del Publicar).
    // Fallback a site_config si nunca se publicó / si migration 0048 pendiente.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('tenants') as any).select('site_config, site_config_published').eq('id', tenantId).single(),
    // Defensivo: si migration 0029 (ribbon) no corrió, retry sin las columnas
    (async () => {
      try {
        const res = await svc.from('courses')
          .select('id, slug, title, description, cover_url, price_cents, currency, is_featured, featured_position, category_id, ribbon_text, ribbon_tone')
          .eq('tenant_id', tenantId).eq('status', 'published')
          .order('created_at', { ascending: false });
        if (!res.error) return res;
      } catch { /* migration missing */ }
      return await svc.from('courses')
        .select('id, slug, title, description, cover_url, price_cents, currency, is_featured, featured_position, category_id')
        .eq('tenant_id', tenantId).eq('status', 'published')
        .order('created_at', { ascending: false });
    })(),
    svc.from('course_categories')
      .select('id, name, slug')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true })
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tRow = tenantRow as { site_config?: unknown; site_config_published?: unknown } | null;
  const cfg = mergeConfig(tRow?.site_config_published ?? tRow?.site_config);
  const allCourses = (coursesRaw ?? []) as PublicCourse[];

  // Cart mode (defensivo si migration 0034 no corrió)
  let cartEnabled = false;
  if (tenant) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tcart } = await (svc.from('tenants') as any)
        .select('cart_enabled').eq('id', tenant.id).maybeSingle();
      cartEnabled = (tcart as { cart_enabled?: boolean })?.cart_enabled ?? false;
    } catch { /* migration pendiente */ }
  }

  // Cargar el form del hero si media_type='form' y form_id está set.
  // Defensivo: si la migración no corrió, fallback silencioso a undefined.
  let heroForm: FormDef | undefined;
  if (tenant && cfg.sections.hero.media_type === 'form' && cfg.sections.hero.form_id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fRow } = await (svc.from('forms') as any)
        .select('id, title, description, submit_label')
        .eq('id', cfg.sections.hero.form_id)
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      const heroFormRow = fRow as { id: string; title: string; description: string | null; submit_label: string | null } | null;
      if (heroFormRow) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ff } = await (svc.from('form_fields') as any)
          .select('id, position, field_type, name, label, placeholder, required, options, help_text')
          .eq('form_id', heroFormRow.id)
          .order('position');
        heroForm = { ...heroFormRow, fields: (ff ?? []) as FormFieldDef[] };
      }
    } catch { /* migración no corrida — render sin form */ }
  }
  const categories = (catsRaw ?? []) as Category[];

  // Últimos artículos del blog (solo si la sección blog_preview está enabled).
  // Defensivo si migration 0050 no corrió: tabla no existe → catch silencioso.
  type BlogPreviewArticle = {
    id: string; slug: string; title: string;
    excerpt: string | null; cover_url: string | null;
    author_name: string | null; published_at: string;
    category_slug?: string | null;
    category_name?: string | null;
    youtube_video_id?: string | null;
    tags?: string[] | null;
  };
  let blogPreviewArticles: BlogPreviewArticle[] = [];
  // Universo total de artículos que puede necesitar la página (blog_preview
  // + todas las columnas de article_list). Se hace una sola query y cada
  // sección hace slice. Es más eficiente que N queries pequeñas.
  let allArticles: BlogPreviewArticle[] = [];
  const blogPreviewCfg = cfg.sections.blog_preview;
  const articleListCfg = cfg.sections.article_list;
  const categoryShowcaseCfg = cfg.sections.category_showcase;
  const featuredEventCfg = cfg.sections.featured_event;
  const needsArticles = blogPreviewCfg?.enabled || articleListCfg?.enabled || categoryShowcaseCfg?.enabled || featuredEventCfg?.enabled;
  if (needsArticles) {
    // Usa el helper del pool: devuelve union de articles reales del tenant
    // + demos globales visibles (menos hidden + menos ya customizados por
    // este tenant). Cada row viene con category_slug/name normalizados.
    let needed = blogPreviewCfg?.enabled ? Math.max(1, Math.min(12, blogPreviewCfg.count || 3)) : 0;
    if (articleListCfg?.enabled && Array.isArray(articleListCfg.columns)) {
      for (const col of articleListCfg.columns) {
        needed = Math.max(needed, (col.skip ?? 0) + (col.count ?? 5));
      }
    }
    if (categoryShowcaseCfg?.enabled && Array.isArray(categoryShowcaseCfg.blocks)) {
      needed += categoryShowcaseCfg.blocks.length * 5;
    }
    // featured_event necesita que las notas con su tag estén en el universo
    // cargado. Como el filter es por tag y no por posición, sumamos margen
    // para que los ~4 items del evento (que pueden ser viejos) entren en la
    // ventana del fetch.
    if (featuredEventCfg?.enabled) {
      needed += Math.max(4, Math.min(6, featuredEventCfg.count ?? 4)) * 3;
    }
    needed = Math.min(80, Math.max(3, needed));
    const { fetchArticlesForTenant } = await import('@/lib/demo-pool/queries');
    const merged = await fetchArticlesForTenant(tenantId, { limit: needed });
    allArticles = merged.map((r) => ({
      id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt,
      cover_url: r.cover_url, author_name: r.author_name, published_at: r.published_at,
      category_slug: r.category_slug ?? null, category_name: r.category_name ?? null,
      youtube_video_id: r.youtube_video_id ?? null,
      tags: Array.isArray(r.tags) ? r.tags : null
    }));
    if (blogPreviewCfg?.enabled) {
      const count = Math.max(1, Math.min(12, blogPreviewCfg.count || 3));
      blogPreviewArticles = allArticles.slice(0, count);
    }
  }

  // Videos para la sección videos_reel (si está enabled). Trae del pool
  // global + tenant vía helper — si migration 0071 no corrió, devuelve [].
  // Sin hero destacado: el owner pidió que el video destacado vaya
  // adentro del artículo featured del showcase, no como sección aparte.
  type ReelVideo = { slug: string; title: string; youtube_id: string };
  let reelVideos: ReelVideo[] = [];
  const videosReelCfg = cfg.sections.videos_reel;
  if (videosReelCfg?.enabled) {
    try {
      const { fetchVideosForTenant } = await import('@/lib/demo-pool/queries');
      const vids = await fetchVideosForTenant(tenantId, {
        limit: Math.max(3, Math.min(8, videosReelCfg.count || 5))
      });
      reelVideos = vids.map((v) => ({
        slug: v.slug, title: v.title, youtube_id: v.youtube_id
      }));
    } catch { /* migration 0071 pendiente */ }
  }

  // Productos físicos destacados (solo si la sección products está enabled).
  // Defensivo si migration 0051 no corrió: tabla no existe → catch silencioso.
  type ProductPreview = {
    id: string; slug: string; title: string;
    price_cents: number; compare_at_price_cents: number | null;
    currency: string; cover_url: string | null;
    stock_qty: number; track_stock: boolean;
  };
  let previewProducts: ProductPreview[] = [];
  const productsCfg = cfg.sections.products;
  if (productsCfg?.enabled) {
    try {
      const count = Math.max(1, Math.min(12, productsCfg.count || 8));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rowsRaw } = await (svc.from('physical_products') as any)
        .select('id, slug, title, price_cents, compare_at_price_cents, currency, cover_url, stock_qty, track_stock')
        .eq('tenant_id', tenantId).eq('status', 'published')
        .order('updated_at', { ascending: false }).limit(count);
      previewProducts = (rowsRaw ?? []) as ProductPreview[];
    } catch { /* migration 0051 pendiente */ }
  }

  // Productos para products_strip (carrusel horizontal tipo ML "Inspirado en...")
  let stripProducts: ProductPreview[] = [];
  const stripCfg = cfg.sections.products_strip;
  if (stripCfg?.enabled) {
    try {
      const count = Math.max(4, Math.min(24, stripCfg.count || 12));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (svc.from('physical_products') as any)
        .select('id, slug, title, price_cents, compare_at_price_cents, currency, cover_url, stock_qty, track_stock, category_id')
        .eq('tenant_id', tenantId).eq('status', 'published');
      if (stripCfg.source === 'category' && stripCfg.category_slug) {
        const cat = categories.find((c) => c.slug === stripCfg.category_slug);
        if (cat) q = q.eq('category_id', cat.id);
      }
      // 'featured' y 'all' usan orden por updated_at descending
      const { data: rowsRaw } = await q.order('updated_at', { ascending: false }).limit(count);
      stripProducts = (rowsRaw ?? []) as ProductPreview[];
    } catch { /* migration 0051 pendiente */ }
  }

  // Nota: cuando se aplica el template ecommerce, seedEcommerceDemoData crea
  // 6 categorías y 12 productos reales en la DB — aparecen tanto en el
  // storefront como en /owner/products para editar. No hace falta fallback
  // inline en el renderer.
  const catById = new Map(categories.map((c) => [c.id, c]));
  const selectedCat = selectedCatSlug ? categories.find((c) => c.slug === selectedCatSlug) ?? null : null;

  const featured = allCourses
    .filter((c) => c.is_featured)
    .sort((a, b) => a.featured_position - b.featured_position);
  const catalog = selectedCat
    ? allCourses.filter((c) => c.category_id === selectedCat.id)
    : allCourses;

  // CSS emitido para overrides de estilo por sección. El owner edita
  // colores/fuentes/peso en /owner/site → "🎨 Estilos" de cada sección;
  // acá los traducimos a reglas CSS scopeadas por data-sec.
  //
  // Orden de precedencia (lo más específico gana):
  //   text_color (catch-all) < title_color / body_color (específicos)
  //   font-weight default < title_weight
  //   tenant primary < section.accent_color
  const safeHex = (v: string | null | undefined): string =>
    (v ?? '').replace(/[^#0-9a-fA-F]/g, '');
  const safeWord = (v: string | null | undefined): string =>
    (v ?? '').replace(/[^a-zA-Z0-9_-]/g, '');

  const manualTextCss = cfg.order
    .filter((k) => cfg.sections[k].enabled)
    .map((k) => {
      const s = cfg.sections[k];
      const rules: string[] = [];
      const text = safeHex(s.text_color);
      const title = safeHex(s.title_color);
      const body = safeHex(s.body_color);
      const accent = safeHex(s.accent_color);
      const cardBg = safeHex(s.card_bg_color);
      const cardBorder = safeHex(s.card_border_color);
      const weight = safeWord(s.title_weight);
      const sel = `[data-sec="${k}"]`;

      // Catch-all color
      if (text) {
        rules.push(`${sel}{color:${text}}`);
        rules.push(`${sel} .text-black,${sel} [class*="text-black/"]{color:${text} !important}`);
      }
      // Título específico
      if (title) {
        rules.push(`${sel} h1,${sel} h2,${sel} h3{color:${title} !important}`);
      }
      // Body / párrafos / texto chico
      if (body) {
        rules.push(`${sel} p,${sel} li,${sel} span:not([class*="bg-"]):not([class*="text-white"]){color:${body}}`);
      }
      // Peso del título
      if (weight) {
        rules.push(`${sel} h1,${sel} h2,${sel} h3{font-weight:${weight} !important}`);
      }
      // Accent: botones, links destacados, badges con bg=primary
      if (accent) {
        rules.push(`${sel} button[style*="background"],${sel} a[style*="background"]{background:${accent} !important;border-color:${accent} !important}`);
        rules.push(`${sel} [style*="color: var"],${sel} .text-\\[var\\(--brand-primary\\)\\]{color:${accent} !important}`);
      }
      // Tarjetas internas (features, testimonials, pricing usan bg-white)
      if (cardBg) {
        rules.push(`${sel} .bg-white{background-color:${cardBg} !important}`);
      }
      if (cardBorder) {
        rules.push(`${sel} [class*="border-black/"],${sel} .border-black{border-color:${cardBorder} !important}`);
      }

      return rules.join('\n');
    })
    .filter(Boolean)
    .join('\n');

  return (
    <div>
      {manualTextCss && (
        <style dangerouslySetInnerHTML={{ __html: manualTextCss }} />
      )}
      {cfg.order.map((key: SectionKey) => {
        const s = cfg.sections[key];
        if (!s?.enabled) return null;
        const bg = s.bg_color ?? null;
        // data-sec: si CUALQUIER override de estilo está seteado, lo emitimos
        // para que las reglas CSS scopeadas le peguen a esta sección.
        const hasStyleOverride = !!(
          s.text_color || s.title_color || s.body_color || s.accent_color ||
          s.card_bg_color || s.card_border_color || s.title_weight
        );
        const fontFamily = (s.font_family ?? '').replace(/[^a-z]/gi, '');
        const dt: Record<string, string> = {};
        if (hasStyleOverride) dt['data-sec'] = key;
        if (fontFamily && ['sans', 'serif', 'display', 'mono'].includes(fontFamily)) {
          dt['data-font'] = fontFamily;
        }

        switch (key) {
          case 'hero': {
            const h = cfg.sections.hero;
            // Modo slider auto (MercadoLibre-style) — si hay ≥1 slide,
            // ignoramos el hero base y renderemos el carrusel rotativo.
            if (h.slides && h.slides.length > 0) {
              return (
                <div key={key} {...dt} id={key}>
                  <HeroSlider
                    slides={h.slides}
                    intervalSec={h.slide_interval ?? 5}
                    primary={primary}
                  />
                </div>
              );
            }
            const heroTitle = h.title || tenant?.name || 'Sitio';
            const btnHidden = !buttonsVisible(h);
            const heroBtnStyle = buttonStyle(h, primary);
            const cta1 = !btnHidden && h.cta_label && (
              <a href={h.cta_href || '#publicaciones'}
                className="inline-block rounded-md px-6 py-3 font-semibold shadow-md hover:shadow-lg transition"
                style={heroBtnStyle}>
                {h.cta_label}
              </a>
            );
            const cta2 = !btnHidden && h.cta_label_2 && (
              <a href={h.cta_href_2 || '#publicaciones'}
                className="inline-block rounded-md px-6 py-3 font-semibold border-2 hover:bg-black/[0.02] transition"
                style={{ borderColor: h.button_border_color ?? primary, color: h.button_text_color ?? primary }}>
                {h.cta_label_2}
              </a>
            );
            const titleEffectStyle = textEffectStyle(h.text_effect, h.accent_color ?? primary);
            const eyebrowPill = h.eyebrow && (
              <span className="inline-block text-xs font-medium px-3 py-1 rounded-full border" style={{ borderColor: `${primary}55`, color: primary, background: `${primary}10` }}>
                {h.eyebrow}
              </span>
            );

            if (h.layout === 'split') {
              return (
                <section key={key} {...dt} id={key} className="relative overflow-hidden px-6 pt-16 pb-24"
                  style={sectionBgStyle(h, bg ?? `linear-gradient(135deg, ${primary}10 0%, transparent 55%)`)}>
                  {/* Decorative blob */}
                  <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-30 -z-0" style={{ background: `radial-gradient(circle, ${primary} 0%, transparent 70%)` }} />

                  <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                    <FadeIn>
                      <div>
                        {eyebrowPill}
                        <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight leading-tight"
                          style={titleEffectStyle}
                          dangerouslySetInnerHTML={richHtml(h.title, heroTitle)} />
                        {h.subtitle && <div className="mt-5 text-lg text-black/65 leading-relaxed max-w-lg"
                          dangerouslySetInnerHTML={richHtml(h.subtitle)} />}
                        <div className="mt-8 flex flex-wrap gap-3">
                          {cta1}
                          {cta2}
                        </div>
                        {h.caption && <div className="mt-5 text-sm text-black/45"
                          dangerouslySetInnerHTML={richHtml(h.caption)} />}
                      </div>
                    </FadeIn>

                    <FadeIn delay={150}>
                      <HeroMedia h={h} primary={primary} heroForm={heroForm} />
                    </FadeIn>
                  </div>
                </section>
              );
            }

            if (h.layout === 'gallery') {
              /* Amazon-style: imagen full-width grandota arriba que ocupa pantalla,
                 con CTA overlay encima del banner para empujar a la acción. */
              return (
                <section key={key} {...dt} id={key} className="relative" style={sectionBgStyle(h, bg ?? '#0a0a0a')}>
                  {/* Banner principal */}
                  <div className="relative w-full h-[60vh] min-h-[440px] max-h-[680px] overflow-hidden">
                    {h.image_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={h.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        {/* Gradient overlay para legibilidad del texto */}
                        <div
                          className="absolute inset-0"
                          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)' }}
                        />
                      </>
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: `var(--brand-bg, linear-gradient(135deg, ${primary} 0%, ${primary}99 100%))` }}
                      >
                        <div className="text-center text-white/70 px-6">
                          <div className="text-6xl opacity-50">🖼️</div>
                          <p className="mt-3 text-sm">Pegá la URL del banner principal en el builder</p>
                          <p className="mt-1 text-xs opacity-70">Recomendado 2400×1200px (banner ancho)</p>
                        </div>
                      </div>
                    )}

                    {/* Contenido sobreimpreso */}
                    <div className="relative h-full flex items-end">
                      <div className="max-w-6xl mx-auto px-6 pb-12 md:pb-16 w-full">
                        <FadeIn>
                          <div className="max-w-2xl text-white">
                            {h.eyebrow && (
                              <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-white/15 backdrop-blur border border-white/30">
                                {h.eyebrow}
                              </span>
                            )}
                            <h1 className="mt-4 text-4xl md:text-6xl font-bold tracking-tight leading-tight drop-shadow-lg"
                              style={titleEffectStyle}
                              dangerouslySetInnerHTML={richHtml(h.title, heroTitle)} />
                            {h.subtitle && (
                              <div className="mt-4 text-lg md:text-xl text-white/90 leading-relaxed max-w-xl drop-shadow"
                                dangerouslySetInnerHTML={richHtml(h.subtitle)} />
                            )}
                            <div className="mt-7 flex flex-wrap gap-3">
                              {cta1}
                              {h.cta_label_2 && (
                                <a href={h.cta_href_2 || '#publicaciones'}
                                  className="inline-block rounded-md px-6 py-3 font-semibold bg-white/10 backdrop-blur border-2 border-white text-white hover:bg-white hover:text-black transition">
                                  {h.cta_label_2}
                                </a>
                              )}
                            </div>
                            {h.caption && <div className="mt-5 text-sm text-white/75"
                              dangerouslySetInnerHTML={richHtml(h.caption)} />}
                          </div>
                        </FadeIn>
                      </div>
                    </div>
                  </div>
                </section>
              );
            }

            // centered
            return (
              <section key={key} {...dt} id={key} className="relative overflow-hidden px-6 py-24 text-center" style={{ background: bg ?? `linear-gradient(180deg, ${primary}12 0%, transparent 100%)` }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-3xl opacity-20 -z-0" style={{ background: `radial-gradient(circle, ${primary} 0%, transparent 70%)` }} />
                <FadeIn>
                  <div className="relative max-w-3xl mx-auto">
                    {eyebrowPill}
                    <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight leading-tight"
                      dangerouslySetInnerHTML={richHtml(h.title, heroTitle)} />
                    {h.subtitle && <div className="mt-6 text-xl text-black/65 max-w-2xl mx-auto leading-relaxed"
                      dangerouslySetInnerHTML={richHtml(h.subtitle)} />}
                    <div className="mt-10 flex flex-wrap justify-center gap-3">
                      {cta1}
                      {cta2}
                    </div>
                    {h.caption && <div className="mt-6 text-sm text-black/45"
                      dangerouslySetInnerHTML={richHtml(h.caption)} />}
                  </div>
                </FadeIn>
              </section>
            );
          }

          case 'trusted_by': {
            const tb = cfg.sections.trusted_by;
            if (tb.items.length === 0) return null;
            const items = tb.items;
            return (
              <section key={key} {...dt} id={key} className="px-0 py-12 overflow-hidden" style={{ background: bg ?? '#fafafa' }}>
                <div className="max-w-6xl mx-auto px-6">
                  <p className="text-xs text-center text-black/40 uppercase tracking-widest mb-8">{tb.title}</p>
                </div>
                {(() => {
                  const logoH = Math.max(24, Math.min(160, tb.logo_height ?? 40));
                  const gapPx = Math.max(8, Math.min(160, tb.logo_gap ?? 64));
                  const logoStyle: React.CSSProperties = { height: `${logoH}px` };
                  if (tb.marquee) {
                    // Loop seamless: N copias suficientes para llenar viewport.
                    const minCopies = Math.max(2, Math.ceil(16 / Math.max(items.length, 1)));
                    const totalCopies = minCopies % 2 === 0 ? minCopies : minCopies + 1;
                    const copies = Array.from({ length: totalCopies }, (_, i) => i);
                    return (
                      <div className="relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: `linear-gradient(90deg, ${bg ?? '#fafafa'}, transparent)` }} />
                        <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: `linear-gradient(-90deg, ${bg ?? '#fafafa'}, transparent)` }} />
                        <div className="flex w-max animate-marquee items-center" style={{ animationDuration: `${Math.max(5, Math.min(120, tb.marquee_speed ?? 30))}s` }}>
                          {copies.map((copyIdx) => (
                            <div key={copyIdx} className="flex items-center flex-shrink-0"
                              style={{ gap: `${gapPx}px`, paddingRight: `${gapPx}px` }}
                              aria-hidden={copyIdx > 0}>
                              {items.map((l) => {
                                const inner = l.logo_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={l.logo_url} alt={l.name} style={logoStyle} className={`object-contain ${tb.grayscale ? 'grayscale opacity-60' : ''}`} />
                                ) : (
                                  <span className={`font-bold whitespace-nowrap ${tb.grayscale ? 'text-black/50' : 'text-black/70'}`} style={{ fontSize: `${Math.round(logoH * 0.5)}px`, lineHeight: 1 }}>{l.name}</span>
                                );
                                return l.href && copyIdx === 0 ? (
                                  <a key={`${l.id}-${copyIdx}`} href={l.href} target="_blank" rel="noopener" className="flex-shrink-0">{inner}</a>
                                ) : <div key={`${l.id}-${copyIdx}`} className="flex-shrink-0">{inner}</div>;
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="max-w-5xl mx-auto px-6 flex flex-wrap justify-center items-center"
                      style={{ gap: `${gapPx}px` }}>
                      {items.map((l) => {
                        const inner = l.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.logo_url} alt={l.name} style={logoStyle} className={`object-contain ${tb.grayscale ? 'grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition' : ''}`} />
                        ) : (
                          <span className={`font-bold ${tb.grayscale ? 'text-black/50' : 'text-black/70'}`} style={{ fontSize: `${Math.round(logoH * 0.5)}px`, lineHeight: 1 }}>{l.name}</span>
                        );
                        return l.href ? (
                          <a key={l.id} href={l.href} target="_blank" rel="noopener">{inner}</a>
                        ) : <div key={l.id}>{inner}</div>;
                      })}
                    </div>
                  );
                })()}
              </section>
            );
          }

          case 'about': {
            const a = cfg.sections.about;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-20" style={{ background: bg ?? '#fafafa' }}>
                <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                  <FadeIn>
                    {a.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image_url} alt="" className="rounded-2xl w-full max-h-96 shadow-lg"
                        style={{
                          objectFit: a.image_fit ?? 'cover',
                          objectPosition: a.image_position ?? 'center',
                          height: a.image_fit === 'contain' ? 'auto' : undefined
                        }} />
                    ) : (
                      <div className="rounded-2xl w-full h-80 flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${primary}20, ${primary}05)` }}>
                        <span className="text-7xl">👋</span>
                      </div>
                    )}
                  </FadeIn>
                  <FadeIn delay={150}>
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>{a.eyebrow_text ?? 'Sobre nosotros'}</div>
                      <h2 className="text-3xl md:text-4xl font-bold mb-4"
                        dangerouslySetInnerHTML={richHtml(a.title)} />
                      <div className="text-black/70 whitespace-pre-line leading-relaxed text-lg"
                        dangerouslySetInnerHTML={richHtml(a.body)} />
                    </div>
                  </FadeIn>
                </div>
              </section>
            );
          }

          case 'instructor': {
            const ins = cfg.sections.instructor;
            const arr = ins.items?.length > 0 ? ins.items : [{
              id: 'legacy', name: ins.name, credentials: ins.credentials, bio: ins.bio, photo_url: ins.photo_url
            }];
            const mode = ins.display_mode ?? 'single';

            const renderCard = (p: { id: string; name: string; credentials?: string; bio?: string; photo_url: string | null; photo_position?: string; photo_fit?: 'cover' | 'contain' }, opts?: { compact?: boolean }) => {
              const compact = opts?.compact;
              return (
                <div className="text-center">
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_url} alt={p.name}
                      className={`${compact ? 'w-24 h-24' : 'w-36 h-36'} rounded-full mx-auto shadow-xl ring-4 ring-white`}
                      style={{
                        objectFit: p.photo_fit ?? 'cover',
                        objectPosition: p.photo_position ?? 'center'
                      }} />
                  ) : (
                    <div className={`${compact ? 'w-24 h-24 text-3xl' : 'w-36 h-36 text-5xl'} rounded-full mx-auto flex items-center justify-center font-bold text-white shadow-xl ring-4 ring-white`} style={{ background: `var(--brand-bg, linear-gradient(135deg, ${primary}, ${primary}aa))` }}>
                      {p.name.slice(0, 1).toUpperCase() || '👤'}
                    </div>
                  )}
                  <h3 className={`${compact ? 'text-lg mt-3' : 'text-2xl mt-5'} font-bold`}>{p.name || '—'}</h3>
                  {p.credentials && <p className="text-sm text-black/60 mt-1.5">{p.credentials}</p>}
                  {!compact && p.bio && <p className="mt-5 text-black/70 whitespace-pre-line leading-relaxed max-w-xl mx-auto">{p.bio}</p>}
                  {compact && p.bio && <p className="mt-2 text-xs text-black/60 line-clamp-2 max-w-[200px] mx-auto">{p.bio}</p>}
                </div>
              );
            };

            return (
              <section key={key} {...dt} id={key} className="px-6 py-20" style={bg ? { background: bg } : undefined}>
                <FadeIn>
                  <div className="text-center mb-12">
                    <div className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: primary }}>{ins.eyebrow_text ?? 'Quién enseña'}</div>
                    <h2 className="text-2xl md:text-3xl font-bold"
                      dangerouslySetInnerHTML={richHtml(ins.title)} />
                  </div>
                </FadeIn>

                {mode === 'single' && arr[0] && (
                  <FadeIn delay={100}><div className="max-w-3xl mx-auto">{renderCard(arr[0])}</div></FadeIn>
                )}

                {mode === 'grid' && (
                  <div className={`max-w-5xl mx-auto grid gap-8 ${arr.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                    {arr.map((p, idx) => (
                      <FadeIn key={p.id} delay={idx * 120}>
                        <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition border border-black/5">
                          {renderCard(p, { compact: true })}
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                )}

                {mode === 'carousel' && (
                  <div className="relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: `linear-gradient(90deg, ${bg ?? 'white'}, transparent)` }} />
                    <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: `linear-gradient(-90deg, ${bg ?? 'white'}, transparent)` }} />
                    <div className="flex gap-6 animate-marquee-slow items-stretch" style={{ width: 'max-content' }}>
                      {[...arr, ...arr].map((p, idx) => (
                        <div key={`${p.id}-${idx}`} className="flex-shrink-0 w-64 bg-white rounded-2xl p-6 shadow-sm border border-black/5">
                          {renderCard(p, { compact: true })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          }

          case 'stats': {
            const st = cfg.sections.stats;
            if (st.items.length === 0) return null;
            const cols = Math.min(st.items.length, 4);
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16" style={{ background: bg ?? `linear-gradient(180deg, ${primary}08 0%, transparent 100%)` }}>
                <div className="max-w-5xl mx-auto">
                  <FadeIn>
                    <h2 className="text-xl md:text-2xl font-bold text-center mb-10"
                      dangerouslySetInnerHTML={richHtml(st.title)} />
                  </FadeIn>
                  <div className={`grid gap-4 grid-cols-2 md:grid-cols-${cols}`}>
                    {st.items.map((s, idx) => (
                      <FadeIn key={s.id} delay={idx * 80}>
                        <div className="text-center p-6 rounded-2xl border border-black/10 bg-white shadow-sm">
                          <AnimatedCounter value={s.number} color={primary} />
                          <div className="text-sm text-black/60 mt-2">{s.label}</div>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case 'learn_points': {
            const lp = cfg.sections.learn_points;
            if (lp.items.length === 0) return null;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-20" style={bg ? { background: bg } : undefined}>
                <div className="max-w-4xl mx-auto">
                  <FadeIn>
                    <div className="text-center mb-10">
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>{lp.eyebrow_text ?? 'Aprendizaje'}</div>
                      <h2 className="text-3xl md:text-4xl font-bold"
                        dangerouslySetInnerHTML={richHtml(lp.title)} />
                      {lp.subtitle && <p className="text-black/60 mt-3 text-lg">{lp.subtitle}</p>}
                    </div>
                  </FadeIn>
                  <div className="grid md:grid-cols-2 gap-4">
                    {lp.items.map((p, idx) => (
                      <FadeIn key={p.id} delay={idx * 60}>
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-black/5 hover:border-black/15 transition">
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm shrink-0 font-bold" style={{ background: primary }}>✓</span>
                          <span className="text-black/80 pt-0.5">{p.text}</span>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case 'features': {
            const ft = cfg.sections.features;
            if (ft.items.length === 0) return null;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-20" style={{ background: bg ?? '#fafafa' }}>
                <div className="max-w-5xl mx-auto">
                  <FadeIn>
                    <div className="text-center mb-12">
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>{ft.eyebrow_text ?? 'Beneficios'}</div>
                      <h2 className="text-3xl md:text-4xl font-bold"
                        dangerouslySetInnerHTML={richHtml(ft.title)} />
                    </div>
                  </FadeIn>
                  <div className={`grid gap-6 ${ft.items.length === 1 ? 'grid-cols-1' : ft.items.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                    {ft.items.map((f, idx) => (
                      <FadeIn key={f.id} delay={idx * 100}>
                        <div className="text-center p-8 rounded-2xl bg-white border border-black/10 hover:shadow-xl hover:-translate-y-1 transition">
                          <div className="text-5xl mb-4">{f.icon}</div>
                          <h3 className="font-bold text-lg" style={{ color: primary }}>{f.title}</h3>
                          <p className="text-sm text-black/60 mt-2 leading-relaxed">{f.body}</p>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case 'featured':
            if (featured.length === 0) return null;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-6xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold mb-6"
                    dangerouslySetInnerHTML={richHtml(cfg.sections.featured.title)} />
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {featured.map((c) => (
                      <CourseCard key={c.id} c={c} primary={primary} />
                    ))}
                  </div>
                </div>
              </section>
            );

          case 'catalog':
            return (
              <section key={key} {...dt} id="publicaciones" className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <span id="catalog" aria-hidden="true" />
                <CatalogFilter
                  title={cfg.sections.catalog.title}
                  showFilters={cfg.sections.catalog.show_filters}
                  maxVisible={cfg.sections.catalog.max_visible ?? 3}
                  paginationMode={cfg.sections.catalog.pagination_mode ?? 'show_more'}
                  courses={allCourses}
                  categories={categories}
                  primary={primary}
                  initialCatSlug={selectedCatSlug ?? null}
                  ctaMode={cfg.sections.catalog.cta_mode ?? 'course_link'}
                  ctaCustomHref={cfg.sections.catalog.cta_custom_href ?? ''}
                  cardStyle={cfg.sections.catalog.card_style ?? 'classic'}
                  cartEnabled={cartEnabled}
                  tenantId={tenant?.id ?? ''}
                />
              </section>
            );

          case 'cards': {
            const cs = cfg.sections.cards;
            if (!cs.items || cs.items.length === 0) return null;
            const cols = cs.columns ?? 3;
            const colsCls = cols === 2 ? 'md:grid-cols-2' : cols === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3';
            return (
              <section key={key} {...dt} id="bloques" className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <span id="cards" aria-hidden="true" />
                <div className="max-w-6xl mx-auto">
                  {cs.title && <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center"
                    dangerouslySetInnerHTML={richHtml(cs.title)} />}
                  {cs.subtitle && <p className="text-center text-black/60 mb-8 max-w-2xl mx-auto">{cs.subtitle}</p>}
                  <div className={`grid gap-6 ${colsCls}`}>
                    {cs.items.map((card) => <StoreCardItem key={card.id} card={card} primary={primary} />)}
                  </div>
                </div>
              </section>
            );
          }

          case 'testimonials': {
            const ts = cfg.sections.testimonials;
            if (ts.items.length === 0) return null;
            return (
              <section key={key} {...dt} id="testimonios" className="px-6 py-20" style={{ background: bg ?? `linear-gradient(180deg, ${primary}06 0%, ${primary}12 100%)` }}>
                <span id="testimonials" aria-hidden="true" />
                <div className="max-w-5xl mx-auto">
                  <FadeIn>
                    <div className="text-center mb-12">
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>{ts.eyebrow_text ?? 'Testimonios'}</div>
                      <h2 className="text-3xl md:text-4xl font-bold"
                        dangerouslySetInnerHTML={richHtml(ts.title)} />
                    </div>
                  </FadeIn>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ts.items.map((t, idx) => (
                      <FadeIn key={t.id} delay={idx * 100}>
                        <div className="rounded-2xl bg-white border border-black/10 p-6 shadow-sm hover:shadow-md transition h-full">
                          <div className="text-yellow-500 mb-3">{'★'.repeat(t.rating ?? 5)}</div>
                          <p className="text-black/80 italic leading-relaxed">"{t.text}"</p>
                          <div className="mt-5 pt-5 border-t border-black/5 flex items-center gap-3">
                            {t.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.photo_url} alt={t.name} className="w-11 h-11 rounded-full object-cover" />
                            ) : (
                              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: primary }}>
                                {t.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div className="text-sm">
                              <div className="font-semibold">{t.name}</div>
                              {t.role && <div className="text-black/50 text-xs">{t.role}</div>}
                            </div>
                          </div>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case 'before_after': {
            const ba = cfg.sections.before_after;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-5xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold text-center mb-10"
                    dangerouslySetInnerHTML={richHtml(ba.title)} />
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-center font-semibold py-2 rounded-t-lg text-white" style={{ background: `${primary}aa` }}>{ba.before_label}</div>
                      {ba.before_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ba.before_image_url} alt="" className="w-full h-72 object-cover rounded-b-lg" />
                      ) : (
                        <div className="w-full h-72 flex items-center justify-center text-5xl rounded-b-lg bg-black/5">🖼️</div>
                      )}
                      {ba.before_body && <p className="mt-4 text-black/70 whitespace-pre-line">{ba.before_body}</p>}
                    </div>
                    <div>
                      <div className="text-center font-semibold py-2 rounded-t-lg text-white" style={{ background: primary }}>{ba.after_label}</div>
                      {ba.after_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ba.after_image_url} alt="" className="w-full h-72 object-cover rounded-b-lg" />
                      ) : (
                        <div className="w-full h-72 flex items-center justify-center text-5xl rounded-b-lg bg-black/5">🖼️</div>
                      )}
                      {ba.after_body && <p className="mt-4 text-black/70 whitespace-pre-line">{ba.after_body}</p>}
                    </div>
                  </div>
                </div>
              </section>
            );
          }

          case 'faq': {
            const fq = cfg.sections.faq;
            if (fq.items.length === 0) return null;
            return (
              <section key={key} {...dt} id="faq" className="px-6 py-20" style={bg ? { background: bg } : undefined}>
                <div className="max-w-3xl mx-auto">
                  <FadeIn>
                    <div className="text-center mb-10">
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>{fq.eyebrow_text ?? 'FAQ'}</div>
                      <h2 className="text-3xl md:text-4xl font-bold"
                        dangerouslySetInnerHTML={richHtml(fq.title)} />
                    </div>
                  </FadeIn>
                  <div className="space-y-3">
                    {fq.items.map((f, idx) => (
                      <FadeIn key={f.id} delay={idx * 60}>
                        <details className="group rounded-xl border border-black/10 bg-white overflow-hidden hover:shadow-sm transition">
                          <summary className="cursor-pointer px-6 py-4 font-medium hover:bg-black/[0.02] flex items-center justify-between gap-4 list-none">
                            <span>{f.q}</span>
                            <span className="text-2xl text-black/30 group-open:rotate-45 transition-transform" style={{ color: primary }}>+</span>
                          </summary>
                          <div className="px-6 pb-5 text-black/70 whitespace-pre-line leading-relaxed">{f.a}</div>
                        </details>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case 'offer': {
            const o = cfg.sections.offer;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-3xl mx-auto rounded-2xl text-center text-white p-10"
                  style={{ background: `var(--brand-bg, linear-gradient(135deg, ${primary}, ${primary}cc))` }}>
                  <h2 className="text-2xl md:text-3xl font-bold"
                    dangerouslySetInnerHTML={richHtml(o.title)} />
                  {o.subtitle && <p className="mt-2 opacity-90">{o.subtitle}</p>}
                  {o.ends_at && (
                    <CountdownDisplay endsAt={o.ends_at} />
                  )}
                  {o.cta_label && (
                    <a href={o.cta_href || '#publicaciones'}
                      className="mt-2 inline-block rounded-md px-6 py-3 font-semibold bg-white text-black hover:opacity-90">
                      {o.cta_label}
                    </a>
                  )}
                </div>
              </section>
            );
          }

          case 'pricing': {
            const pr = cfg.sections.pricing;
            if (pr.tiers.length === 0) return null;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-5xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold text-center"
                    dangerouslySetInnerHTML={richHtml(pr.title)} />
                  {pr.subtitle && <p className="text-center text-black/60 mt-2">{pr.subtitle}</p>}
                  <div className={`mt-10 grid gap-6 ${pr.tiers.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : pr.tiers.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-3'}`}>
                    {pr.tiers.map((t) => (
                      <div
                        key={t.id}
                        className={`rounded-xl p-6 bg-white ${t.highlighted ? 'border-2 shadow-lg scale-105' : 'border border-black/10'}`}
                        style={t.highlighted ? { borderColor: primary } : undefined}
                      >
                        {t.highlighted && (
                          <div className="text-xs font-bold text-white inline-block px-2 py-0.5 rounded mb-2" style={{ background: primary }}>
                            ★ Recomendado
                          </div>
                        )}
                        <h3 className="text-lg font-bold" style={{ color: primary }}>{t.name}</h3>
                        <div className="text-3xl font-bold mt-2">{t.price}</div>
                        {t.description && <p className="text-sm text-black/60 mt-1">{t.description}</p>}
                        <ul className="mt-4 space-y-2">
                          {t.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-emerald-500 shrink-0">✓</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                        <a
                          href={t.cta_href}
                          className={`mt-6 block text-center rounded-md py-2.5 font-semibold ${t.highlighted ? 'text-white' : 'border-2'}`}
                          style={t.highlighted ? { background: `var(--brand-bg, ${primary})` } : { borderColor: primary, color: primary }}
                        >
                          {t.cta_label}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case 'video': {
            const vd = cfg.sections.video;
            if (!vd.video_id) return null;
            const src = vd.provider === 'youtube'
              ? `https://www.youtube.com/embed/${vd.video_id}`
              : `https://drive.google.com/file/d/${vd.video_id}/preview`;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold text-center"
                    dangerouslySetInnerHTML={richHtml(vd.title)} />
                  {vd.subtitle && <p className="text-center text-black/60 mt-2">{vd.subtitle}</p>}
                  <div className="mt-8 aspect-video rounded-2xl overflow-hidden border border-black/10 bg-black shadow-xl">
                    <iframe
                      src={src}
                      className="w-full h-full"
                      allow="autoplay; encrypted-media; fullscreen"
                      allowFullScreen
                      title={vd.title}
                    />
                  </div>
                </div>
              </section>
            );
          }

          case 'gallery': {
            const g = cfg.sections.gallery;
            if (g.items.length === 0) return null;
            const colsClass = g.columns === 2 ? 'md:grid-cols-2' : g.columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3';
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-6xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold text-center"
                    dangerouslySetInnerHTML={richHtml(g.title)} />
                  {g.subtitle && <p className="text-center text-black/60 mt-2">{g.subtitle}</p>}
                  <div className={`mt-8 grid grid-cols-2 ${colsClass} gap-3`}>
                    {g.items.map((it) => (
                      <figure key={it.id} className="overflow-hidden rounded-xl border border-black/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.image_url} alt={it.caption ?? ''} className="w-full h-48 object-cover hover:scale-105 transition" />
                        {it.caption && <figcaption className="text-xs text-black/60 px-3 py-2">{it.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case 'newsletter': {
            const n = cfg.sections.newsletter;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16" style={{ background: bg ?? `${primary}10` }}>
                <div className="max-w-2xl mx-auto text-center">
                  <h2 className="text-2xl md:text-3xl font-bold"
                    dangerouslySetInnerHTML={richHtml(n.title)} />
                  {n.subtitle && <p className="text-black/60 mt-2">{n.subtitle}</p>}
                  <form className="mt-6 flex gap-2 max-w-md mx-auto" action="#" method="POST">
                    <input type="email" required placeholder="tu@email.com"
                      className="flex-1 rounded-md border border-black/15 px-4 py-2.5 bg-white" />
                    <button type="submit"
                      className="rounded-md px-5 py-2.5 font-semibold text-white whitespace-nowrap"
                      style={{ background: `var(--brand-bg, ${primary})` }}>
                      {n.cta_label || 'Suscribirme'}
                    </button>
                  </form>
                  <p className="text-xs text-black/40 mt-2">Integración con email marketing próximamente.</p>
                </div>
              </section>
            );
          }

          case 'custom': {
            const cb = cfg.sections.custom;
            const pos = cb.image_pos ?? 'none';
            const hasImage = cb.image_url && pos !== 'none';
            return (
              <section key={key} {...dt} id={key} className="px-6 py-20" style={bg ? { background: bg } : undefined}>
                <div className="max-w-5xl mx-auto">
                  {pos === 'top' && hasImage && (
                    <FadeIn>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cb.image_url!} alt="" className="w-full max-h-96 object-cover rounded-2xl shadow-lg mb-10" />
                    </FadeIn>
                  )}
                  <div className={`flex gap-12 items-center ${pos === 'left' ? 'md:flex-row flex-col' : pos === 'right' ? 'md:flex-row-reverse flex-col' : 'flex-col text-center'}`}>
                    {(pos === 'left' || pos === 'right') && hasImage && (
                      <FadeIn delay={100}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cb.image_url!} alt="" className="w-full md:w-1/2 max-h-80 object-cover rounded-2xl shadow-lg" />
                      </FadeIn>
                    )}
                    <FadeIn delay={200}>
                      <div className={(pos === 'left' || pos === 'right') ? 'md:w-1/2' : 'max-w-2xl mx-auto'}>
                        <h2 className="text-3xl md:text-4xl font-bold"
                          dangerouslySetInnerHTML={richHtml(cb.title)} />
                        {cb.subtitle && <p className="mt-2 text-lg text-black/60">{cb.subtitle}</p>}
                        {cb.body && (
                          <div className="mt-5 text-black/70 whitespace-pre-line leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: cb.body }} />
                        )}
                        {cb.cta_label && (
                          <a href={cb.cta_href || '#'}
                            className="mt-6 inline-block rounded-md px-6 py-3 font-semibold text-white shadow-md"
                            style={{ background: `var(--brand-bg, ${primary})` }}>
                            {cb.cta_label}
                          </a>
                        )}
                      </div>
                    </FadeIn>
                  </div>
                </div>
              </section>
            );
          }

          case 'contact': {
            const ct = cfg.sections.contact;
            // POST a /api/contact/{tenantId} — persiste submission en
            // form_submissions (auto-materializa un form '_contact_section')
            // y aparece en /owner/forms + /owner/submissions +
            // /founder/submissions. Antes era mailto: que se perdía.
            const contactStatus = (sp.contact === 'sent' || sp.contact === 'error') ? sp.contact : null;
            return (
              <section key={key} {...dt} id="contacto" className="px-6 py-20" style={{ background: bg ?? '#fafafa' }}>
                <span id="contact" aria-hidden="true" />
                <FadeIn>
                  <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-10">
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>{ct.eyebrow_text ?? 'Contacto'}</div>
                      <h2 className="text-3xl md:text-4xl font-bold"
                        dangerouslySetInnerHTML={richHtml(ct.title)} />
                      {ct.subtitle && <p className="mt-3 text-black/60">{ct.subtitle}</p>}
                    </div>
                    {contactStatus === 'sent' && (
                      <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        ✓ ¡Mensaje enviado! Te vamos a responder a la brevedad.
                      </div>
                    )}
                    {contactStatus === 'error' && (
                      <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        ✗ No pudimos enviar tu mensaje. Revisá los datos e intentá otra vez.
                      </div>
                    )}
                    <form action={`/api/contact/${tenantId}`} method="POST" className="bg-white rounded-2xl p-8 shadow-sm border border-black/5 space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">{ct.name_label}</label>
                        <input name="Nombre" required className="w-full rounded-md border border-black/15 px-4 py-2.5 focus:outline-none focus:border-black/40" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">{ct.email_label}</label>
                        <input name="Email" type="email" required className="w-full rounded-md border border-black/15 px-4 py-2.5 focus:outline-none focus:border-black/40" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">{ct.message_label}</label>
                        <textarea name="Mensaje" rows={4} required className="w-full rounded-md border border-black/15 px-4 py-2.5 focus:outline-none focus:border-black/40" />
                      </div>
                      <button type="submit"
                        className="w-full rounded-md py-3 font-semibold text-white shadow-md hover:shadow-lg transition"
                        style={{ background: `var(--brand-bg, ${primary})` }}>
                        {ct.submit_label}
                      </button>
                      <p className="text-xs text-center text-black/40">
                        Tus envíos aparecen en <strong>Formularios → Contacto</strong> del panel del sitio.
                      </p>
                    </form>
                    {ct.whatsapp && (
                      <div className="text-center mt-5">
                        <a href={`https://wa.me/${ct.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener"
                          className="inline-flex items-center gap-2 text-sm font-medium text-black/70 hover:text-black">
                          📱 También por WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                </FadeIn>
              </section>
            );
          }

          case 'map': {
            const m = cfg.sections.map;
            if (!m.address.trim()) return null;
            const encoded = encodeURIComponent(m.address);
            const zoom = Math.max(1, Math.min(20, m.zoom ?? 15));
            const heightPx = Math.max(200, Math.min(800, m.height_px ?? 400));
            // Embed gratis sin API key
            const embedSrc = `https://www.google.com/maps?q=${encoded}&z=${zoom}&output=embed`;
            // Link a Cómo llegar (abre app de mapas)
            const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-5xl mx-auto">
                  {(m.title || m.subtitle) && (
                    <FadeIn>
                      <div className="text-center mb-8">
                        {m.title && <h2 className="text-3xl md:text-4xl font-bold mb-2"
                          dangerouslySetInnerHTML={richHtml(m.title)} />}
                        {m.subtitle && <p className="text-black/60">{m.subtitle}</p>}
                      </div>
                    </FadeIn>
                  )}
                  <div className="rounded-2xl overflow-hidden border border-black/10 shadow-lg" style={{ height: `${heightPx}px` }}>
                    <iframe
                      src={embedSrc}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title={m.address}
                      allowFullScreen
                    />
                  </div>
                  <div className="mt-5 text-center space-y-2">
                    <p className="text-sm text-black/70">📍 {m.address}</p>
                    {m.show_directions_cta && (
                      <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md transition"
                        style={{ background: `var(--brand-bg, ${primary})` }}>
                        🗺 Cómo llegar
                      </a>
                    )}
                  </div>
                </div>
              </section>
            );
          }

          case 'blog_preview': {
            // Si no hay artículos publicados, no renderea nada aunque la sección esté enabled.
            if (blogPreviewArticles.length === 0) return null;
            const c = cfg.sections.blog_preview;
            const layout = c.layout ?? 'grid';
            const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

            // ─── Layout newspaper: 1 gran + 2 laterales + fila de 3 abajo ───
            // Pensado para sitios de noticias: densidad y jerarquía tipo NYT.
            if (layout === 'newspaper' && blogPreviewArticles.length >= 1) {
              const [featured, ...rest] = blogPreviewArticles;
              const sideArticles = rest.slice(0, 2);
              const rowArticles = rest.slice(2, 5);
              return (
                <section key={key} {...dt} id={key} className="px-6 py-8"
                  style={{ background: bg ?? undefined }}>
                  <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-[2fr_1fr] gap-6 pb-8 border-b border-black/10">
                      {/* Featured — big article */}
                      <Link href={`/blog/${featured.slug}`} className="group block">
                        {featured.cover_url && (
                          <div className="aspect-[16/10] overflow-hidden bg-zinc-100 mb-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={featured.cover_url} alt={featured.title}
                              className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
                          </div>
                        )}
                        <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold mb-2">
                          {fmtDate(featured.published_at)}
                        </div>
                        <h3 className="font-serif text-3xl md:text-4xl font-bold leading-tight mb-3 group-hover:underline decoration-2 underline-offset-4">
                          {featured.title}
                        </h3>
                        {featured.excerpt && (
                          <p className="text-black/70 text-base leading-relaxed line-clamp-3">{featured.excerpt}</p>
                        )}
                        {featured.author_name && (
                          <div className="text-xs text-black/50 mt-3">Por {featured.author_name}</div>
                        )}
                      </Link>

                      {/* Side column */}
                      <div className="border-t md:border-t-0 md:border-l border-black/10 pt-6 md:pt-0 md:pl-6 space-y-6 divide-y divide-black/10">
                        {sideArticles.map((a, i) => (
                          <Link key={a.id} href={`/blog/${a.slug}`}
                            className={`block group ${i > 0 ? 'pt-6' : ''}`}>
                            {a.cover_url && (
                              <div className="aspect-[16/10] overflow-hidden bg-zinc-100 mb-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.cover_url} alt={a.title} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold mb-1.5">
                              {fmtDate(a.published_at)}
                            </div>
                            <h4 className="font-serif text-lg font-bold leading-tight group-hover:underline">
                              {a.title}
                            </h4>
                            {a.excerpt && (
                              <p className="text-sm text-black/60 mt-1.5 line-clamp-2">{a.excerpt}</p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Row below of 3 más */}
                    {rowArticles.length > 0 && (
                      <div className="grid md:grid-cols-3 gap-6 pt-8">
                        {rowArticles.map((a) => (
                          <Link key={a.id} href={`/blog/${a.slug}`} className="group block">
                            {a.cover_url && (
                              <div className="aspect-[16/10] overflow-hidden bg-zinc-100 mb-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.cover_url} alt={a.title} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold mb-1.5">
                              {fmtDate(a.published_at)}
                            </div>
                            <h4 className="font-serif text-lg font-bold leading-tight group-hover:underline">
                              {a.title}
                            </h4>
                            {a.excerpt && (
                              <p className="text-sm text-black/60 mt-1.5 line-clamp-2">{a.excerpt}</p>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              );
            }

            // ─── Layout grid (default, todo lo demás) ───
            const gridCols = blogPreviewArticles.length === 1 ? 'md:grid-cols-1'
              : blogPreviewArticles.length === 2 ? 'md:grid-cols-2'
              : 'md:grid-cols-3';
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16"
                style={{ background: bg ?? undefined }}>
                <div className="max-w-6xl mx-auto">
                  <FadeIn>
                    <div className="text-center mb-10">
                      <h2 className="text-3xl md:text-4xl font-bold mb-2"
                        dangerouslySetInnerHTML={richHtml(c.title)} />
                      {c.subtitle && <p className="text-black/60">{c.subtitle}</p>}
                    </div>
                  </FadeIn>
                  <div className={`grid ${gridCols} gap-6`}>
                    {blogPreviewArticles.map((a) => (
                      <Link key={a.id} href={`/blog/${a.slug}`}
                        className="block rounded-xl border border-black/10 overflow-hidden hover:shadow-lg transition bg-white">
                        {a.cover_url && (
                          <div className="aspect-[16/9] bg-zinc-100 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.cover_url} alt={a.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-5">
                          <div className="text-[10px] uppercase tracking-widest text-black/45 mb-2">
                            {fmtDate(a.published_at)}{a.author_name ? ` · ${a.author_name}` : ''}
                          </div>
                          <h3 className="font-bold text-lg mb-1.5 leading-tight">{a.title}</h3>
                          {a.excerpt && <p className="text-sm text-black/60 line-clamp-2">{a.excerpt}</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                  {c.cta_label && (
                    <div className="text-center mt-10">
                      <Link href="/blog"
                        className="inline-block rounded-md border border-black/15 px-6 py-3 text-sm font-semibold hover:bg-black/[0.03] transition"
                        style={{ borderColor: primary, color: primary }}>
                        {c.cta_label} →
                      </Link>
                    </div>
                  )}
                </div>
              </section>
            );
          }

          case 'videos_reel': {
            const c = cfg.sections.videos_reel;
            if (!c?.enabled || reelVideos.length === 0) return null;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-8"
                style={{ background: bg ?? undefined }}>
                <div className="max-w-6xl mx-auto">
                  <div className="mb-4 pb-2 border-b-2 border-black">
                    <h2 className="font-serif text-xl font-bold" dangerouslySetInnerHTML={richHtml(c.title || 'Videos destacados')} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {reelVideos.map((v) => (
                      <Link key={v.slug} href={`/reels?v=${encodeURIComponent(v.slug)}`}
                        className="group block">
                        <div className="relative aspect-[9/16] overflow-hidden bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                            alt={v.title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition"
                          />
                        </div>
                        <h3 className="mt-3 font-serif text-[15px] font-bold leading-snug group-hover:underline">
                          {v.title}
                        </h3>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case 'featured_event': {
            // Strip destacado para un evento puntual (Mundial, elecciones,
            // gran pelea, cumbre, terremoto). Look "Mundial de fútbol 2026"
            // del NYT: título gigante en serif arriba + fila horizontal de
            // 4 tarjetas (cover 4:3 + kicker de categoría + headline).
            //
            // Filtra por TAG (no por categoría) para permitir agrupar notas
            // de distintas secciones bajo un mismo evento.
            const c = cfg.sections.featured_event;
            if (!c?.tag || allArticles.length === 0) return null;
            const count = Math.max(2, Math.min(6, c.count ?? 4));
            const items = allArticles
              .filter((a) => Array.isArray(a.tags) && a.tags.includes(c.tag))
              .slice(0, count);
            if (items.length === 0) return null;
            const accent = c.accent_color || '#7c3aed';
            return (
              <section key={key} {...dt} id={key} className="px-6 py-10"
                style={{ background: bg ?? undefined }}>
                <div className="max-w-6xl mx-auto">
                  <h2 className="font-serif text-3xl md:text-5xl font-extrabold leading-tight mb-6">
                    {c.title}
                  </h2>
                  {c.subtitle && (
                    <p className="text-sm text-black/60 -mt-4 mb-6">{c.subtitle}</p>
                  )}
                  <div className={`grid gap-x-6 gap-y-8 grid-cols-1 sm:grid-cols-2 ${items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                    {items.map((a) => (
                      <Link key={a.id} href={`/blog/${a.slug}`} className="group block">
                        {a.cover_url && (
                          <div className="aspect-[4/3] overflow-hidden bg-zinc-100 mb-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.cover_url} alt={a.title}
                              className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
                          </div>
                        )}
                        <div className="text-[11px] font-semibold mb-1" style={{ color: accent }}>
                          {a.category_name || 'Nota'}
                        </div>
                        <h3 className="font-serif text-lg md:text-xl font-bold leading-snug group-hover:underline">
                          {a.title}
                        </h3>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case 'category_showcase': {
            // Vitrinas por categoría estilo NYT "Life & Style":
            // header con label en color acento + 1 artículo grande a la
            // izquierda + grid 2×2 de artículos chicos a la derecha.
            const c = cfg.sections.category_showcase;
            const blocks = Array.isArray(c?.blocks) ? c.blocks : [];
            if (allArticles.length === 0 || blocks.length === 0) return null;
            const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
            const defaultAccent = '#0891b2';
            return (
              <section key={key} {...dt} id={key} className="px-6 py-8 space-y-12"
                style={{ background: bg ?? undefined }}>
                <div className="max-w-6xl mx-auto space-y-12">
                  {blocks.map((block) => {
                    // 1 grande + 4 chicos en cuadrícula 2×2 = 5 total. El
                    // block.count histórico podía llegar a 7 o 9; se clampa
                    // a 5 en el render para forzar el layout NYT correcto
                    // (uniforme entre tenants, sin importar la config vieja).
                    const total = 5;
                    const items = allArticles
                      .filter((a) => !block.category_slug || a.category_slug === block.category_slug)
                      .slice(0, total);
                    if (items.length === 0) return null;
                    const featured = items[0];
                    const smalls = items.slice(1);
                    const accent = block.accent_color || defaultAccent;
                    // El link de "ver todos" apunta a /blog?cat=slug — la pagina de blog
                    // filtra por esa categoría y lista todos sus artículos. Es la manera
                    // más directa de que el owner navegue a la vista por categoría.
                    const catHref = block.category_slug
                      ? `/blog?cat=${encodeURIComponent(block.category_slug)}`
                      : '/blog';
                    return (
                      <div key={block.id} className="pt-2">
                        {/* Header: label linkeable con color + arrow chevron */}
                        <div className="flex items-center gap-2 mb-5 pb-2 border-b border-black/15">
                          <a href={catHref} className="text-2xl font-bold hover:underline decoration-2 underline-offset-4"
                            style={{ color: accent }}>
                            {block.title}
                          </a>
                          <a href={catHref}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full border transition hover:bg-current/5"
                            style={{ borderColor: accent, color: accent }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 6 6 6-6 6"/></svg>
                          </a>
                        </div>

                        <div className="grid md:grid-cols-[1.4fr_2fr] gap-x-6 gap-y-6">
                          {/* Columna izquierda: artículo GRANDE.
                              Si tiene youtube_video_id linkeado, autoplay
                              muted del video como preview en vez de la foto
                              cover. Pointer-events-none en iframe para no
                              robar el click al <Link> padre. */}
                          <Link href={`/blog/${featured.slug}`} className="group block">
                            {featured.youtube_video_id ? (
                              <div className="aspect-[4/3] overflow-hidden bg-black mb-3 relative">
                                <iframe
                                  src={`https://www.youtube.com/embed/${featured.youtube_video_id}?autoplay=1&mute=1&loop=1&playlist=${featured.youtube_video_id}&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&fs=0&disablekb=1`}
                                  title={featured.title}
                                  className="absolute inset-0 w-full h-full pointer-events-none"
                                  allow="autoplay; encrypted-media"
                                  allowFullScreen={false}
                                  frameBorder="0"
                                />
                                {/* Tape overlay para tapar el chrome YT
                                    (título flotante top + logo bottom) */}
                                <div className="absolute top-0 left-0 right-0 h-[42px] bg-black pointer-events-none" />
                                <div className="absolute bottom-0 left-0 right-0 h-[36px] bg-black pointer-events-none" />
                              </div>
                            ) : featured.cover_url ? (
                              <div className="aspect-[4/3] overflow-hidden bg-zinc-100 mb-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={featured.cover_url} alt={featured.title}
                                  className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
                              </div>
                            ) : null}
                            <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: accent }}>
                              {featured.category_name || 'Nota'}
                            </div>
                            <h4 className="font-serif text-2xl md:text-3xl font-bold leading-tight mt-1 group-hover:underline">
                              {featured.title}
                            </h4>
                            {featured.excerpt && (
                              <p className="text-sm text-black/60 mt-2 line-clamp-3">{featured.excerpt}</p>
                            )}
                            {featured.author_name && (
                              <div className="text-xs text-black/50 mt-2">{featured.author_name}</div>
                            )}
                          </Link>

                          {/* Columna derecha: cuadrícula 2×2 de chicos (4 items) */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                            {smalls.map((a) => (
                              <Link key={a.id} href={`/blog/${a.slug}`} className="group block">
                                {a.cover_url && (
                                  <div className="aspect-[4/3] overflow-hidden bg-zinc-100 mb-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={a.cover_url} alt={a.title} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: accent }}>
                                  {a.category_name || 'Nota'}
                                </div>
                                <h5 className="font-serif text-[14px] font-bold leading-snug mt-1 group-hover:underline">
                                  {a.title}
                                </h5>
                                {a.author_name && (
                                  <div className="text-[10px] text-black/50 mt-1">{a.author_name}</div>
                                )}
                                <div className="text-[10px] text-black/40 mt-0.5">{fmtDate(a.published_at)}</div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          case 'article_list': {
            // Multi-columnas de headlines (thumb chica + título). Cada
            // columna filtra el universo de artículos por skip + count + order.
            // No renderiza nada si no hay artículos o no hay columnas.
            const c = cfg.sections.article_list;
            const cols = Array.isArray(c?.columns) ? c.columns : [];
            if (allArticles.length === 0 || cols.length === 0) return null;
            const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
            // Helper: aplica order + skip + count al universo de artículos
            function pickFor(col: typeof cols[number]): BlogPreviewArticle[] {
              const skip = Math.max(0, col.skip ?? 0);
              const count = Math.max(1, Math.min(20, col.count ?? 5));
              let pool = [...allArticles];
              if (col.order === 'oldest') pool = pool.slice().reverse();
              if (col.order === 'random') {
                // Shuffle determinístico basado en col.id para no cambiar en cada request
                let seed = 0;
                for (let i = 0; i < col.id.length; i++) seed = ((seed << 5) - seed + col.id.charCodeAt(i)) | 0;
                pool = pool.slice().sort(() => {
                  seed = (seed * 9301 + 49297) % 233280;
                  return seed / 233280 - 0.5;
                });
              }
              return pool.slice(skip, skip + count);
            }
            const gridCols = cols.length === 1 ? 'md:grid-cols-1'
              : cols.length === 2 ? 'md:grid-cols-2'
              : cols.length === 3 ? 'md:grid-cols-3'
              : 'md:grid-cols-4';
            return (
              <section key={key} {...dt} id={key} className="px-6 py-10"
                style={{ background: bg ?? undefined }}>
                <div className={`max-w-6xl mx-auto grid ${gridCols} gap-8`}>
                  {cols.map((col) => {
                    const items = pickFor(col);
                    if (items.length === 0) return null;
                    return (
                      <div key={col.id}>
                        <h3 className="text-lg font-bold pb-2 mb-3 border-b-2 border-black">
                          {col.title}
                        </h3>
                        <ul className="divide-y divide-black/10">
                          {items.map((a) => (
                            <li key={a.id} className="py-3">
                              <Link href={`/blog/${a.slug}`} className="flex items-start gap-3 group">
                                {a.cover_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={a.cover_url} alt="" className="w-20 h-20 object-cover bg-zinc-100 shrink-0" />
                                ) : (
                                  <div className="w-20 h-20 bg-zinc-100 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-serif font-bold text-[15px] leading-tight group-hover:underline">
                                    {a.title}
                                  </h4>
                                  <div className="text-[10px] uppercase tracking-widest text-black/45 mt-1">
                                    {fmtDate(a.published_at)}
                                    {a.author_name && ` · ${a.author_name}`}
                                  </div>
                                </div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          case 'products': {
            if (previewProducts.length === 0) return null;
            const c = cfg.sections.products;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-16"
                style={{ background: bg ?? undefined }}>
                <div className="max-w-6xl mx-auto">
                  <FadeIn>
                    <div className="text-center mb-10">
                      <h2 className="text-3xl md:text-4xl font-bold mb-2"
                        dangerouslySetInnerHTML={richHtml(c.title)} />
                      {c.subtitle && <p className="text-black/60">{c.subtitle}</p>}
                    </div>
                  </FadeIn>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {previewProducts.map((p) => {
                      const discount = p.compare_at_price_cents && p.compare_at_price_cents > p.price_cents
                        ? Math.round((1 - p.price_cents / p.compare_at_price_cents) * 100)
                        : null;
                      const outOfStock = p.track_stock && p.stock_qty <= 0;
                      const price = new Intl.NumberFormat('es-AR', {
                        style: 'currency', currency: p.currency, maximumFractionDigits: 0
                      }).format(p.price_cents / 100);
                      const compareAt = p.compare_at_price_cents
                        ? new Intl.NumberFormat('es-AR', {
                            style: 'currency', currency: p.currency, maximumFractionDigits: 0
                          }).format(p.compare_at_price_cents / 100)
                        : null;
                      return (
                        <Link key={p.id} href={`/p/${p.slug}`}
                          className="group block rounded-xl border border-black/10 overflow-hidden bg-white hover:shadow-lg transition">
                          <div className="aspect-square bg-zinc-100 overflow-hidden relative">
                            {p.cover_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.cover_url} alt={p.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="flex items-center justify-center h-full text-black/25 text-4xl">📦</div>
                            )}
                            {discount !== null && (
                              <div className="absolute top-2 left-2 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                                -{discount}%
                              </div>
                            )}
                            {outOfStock && (
                              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                                <span className="text-xs font-bold uppercase tracking-wider text-black/70">Sin stock</span>
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="font-medium text-sm mb-1 line-clamp-2 leading-tight">{p.title}</h3>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="font-bold text-base">{price}</span>
                              {compareAt && (
                                <span className="text-xs text-black/40 line-through">{compareAt}</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {c.cta_label && (
                    <div className="text-center mt-10">
                      <Link href="/tienda"
                        className="inline-block rounded-md border px-6 py-3 text-sm font-semibold hover:bg-black/[0.03] transition"
                        style={{ borderColor: primary, color: primary }}>
                        {c.cta_label} →
                      </Link>
                    </div>
                  )}
                </div>
              </section>
            );
          }

          case 'benefits_bar': {
            const c = cfg.sections.benefits_bar;
            if (!c.items || c.items.length === 0) return null;
            const dark = c.variant !== 'light';
            return (
              <section key={key} {...dt} id={key}
                className={dark ? "px-6 py-6 bg-neutral-900 text-white" : "px-6 py-6 bg-white border-y border-black/10 text-neutral-900"}
                style={bg ? { background: bg } : undefined}>
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                  {c.items.slice(0, 6).map((it) => (
                    <div key={it.id} className="flex items-start gap-3">
                      <div className={`text-2xl md:text-3xl shrink-0 ${dark ? 'text-white/85' : 'text-neutral-700'}`}>
                        {it.icon || '✓'}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-bold uppercase tracking-wide ${dark ? 'text-white' : 'text-neutral-900'}`}>
                          {it.title}
                        </div>
                        {it.subtitle && (
                          <div className={`text-xs mt-1 leading-relaxed ${dark ? 'text-white/60' : 'text-neutral-500'}`}>
                            {it.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          case 'category_cards': {
            const c = cfg.sections.category_cards;
            if (!c.items || c.items.length === 0) return null;
            // Layout tiene precedencia sobre aspect. Legacy: si aspect='square'
            // y no hay layout, tratamos como 'squares'.
            const layout: 'mixed' | 'squares' | 'banners' =
              c.layout ?? (c.aspect === 'square' ? 'squares' : 'mixed');

            const header = c.title && (
              <div className="text-center mb-8 md:mb-10">
                <h2 className="text-2xl md:text-3xl font-bold" dangerouslySetInnerHTML={richHtml(c.title)} />
                {c.subtitle && <p className="text-black/55 mt-2">{c.subtitle}</p>}
              </div>
            );

            // ── Layout 'squares' — 4 cards cuadradas en fila (tipo Yamamoto)
            if (layout === 'squares') {
              return (
                <section key={key} {...dt} id={key} className="px-6 py-12 md:py-16"
                  style={{ background: bg ?? '#f4f5f7' }}>
                  <div className="max-w-7xl mx-auto">
                    {header}
                    <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
                      {c.items.slice(0, 8).map((it) => {
                        const overlay = it.overlay ?? 0.25;
                        const textColor = it.text_color ?? '#ffffff';
                        return (
                          <Link key={it.id} href={it.cta_href || '#'}
                            className="relative overflow-hidden rounded-lg group aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={it.image_url} alt={it.label}
                              className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" />
                            <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
                            <div className="absolute inset-0 p-4 flex items-end justify-center text-center" style={{ color: textColor }}>
                              <div className="text-sm md:text-lg font-black tracking-wider uppercase drop-shadow-lg">
                                {it.label}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            }

            // ── Layout 'banners' — 2 banners horizontales lado a lado
            //    Card blanco: texto/CTA a la izquierda, imagen a la derecha
            if (layout === 'banners') {
              return (
                <section key={key} {...dt} id={key} className="px-6 py-12 md:py-16"
                  style={{ background: bg ?? '#f4f5f7' }}>
                  <div className="max-w-7xl mx-auto">
                    {header}
                    <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
                      {c.items.slice(0, 4).map((it) => (
                        <Link key={it.id} href={it.cta_href || '#'}
                          className="group rounded-xl bg-white overflow-hidden shadow-sm hover:shadow-lg transition flex flex-row min-h-[180px] md:min-h-[220px]">
                          {/* Texto a la izquierda */}
                          <div className="flex-1 p-5 md:p-7 flex flex-col justify-center">
                            {it.eyebrow && (
                              <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-2">
                                {it.eyebrow}
                              </div>
                            )}
                            <div className="text-lg md:text-2xl font-bold leading-tight tracking-tight text-neutral-900">
                              {it.label}
                            </div>
                            {it.subtitle && (
                              <div className="text-xs md:text-sm mt-1.5 text-neutral-600 leading-snug">
                                {it.subtitle}
                              </div>
                            )}
                            {it.cta_label && (
                              <div className="mt-4">
                                <span className="inline-block rounded-md text-xs md:text-sm font-semibold px-5 py-2.5"
                                  style={{ background: `var(--brand-bg, ${primary})`, color: '#fff' }}>
                                  {it.cta_label}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Imagen a la derecha */}
                          <div className="relative w-[44%] shrink-0 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={it.image_url} alt={it.label}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </section>
              );
            }

            // ── Layout 'mixed' (default) — grid 4-col con span 1/2, imagen full con overlay
            return (
              <section key={key} {...dt} id={key} className="px-6 py-12 md:py-16"
                style={{ background: bg ?? '#f4f5f7' }}>
                <div className="max-w-7xl mx-auto">
                  {header}
                  <div
                    className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-4"
                    style={{ gridAutoRows: 'minmax(240px, 1fr)' }}>
                    {c.items.map((it) => {
                      const overlay = it.overlay ?? 0.25;
                      const textColor = it.text_color ?? '#ffffff';
                      const span = it.span === 2 ? 'md:col-span-2' : '';
                      return (
                        <Link key={it.id} href={it.cta_href || '#'}
                          className={`relative overflow-hidden rounded-xl group aspect-[16/10] md:aspect-auto md:h-full ${span}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={it.image_url} alt={it.label}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                          <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
                          <div className="absolute inset-0 p-5 md:p-7 flex flex-col justify-end" style={{ color: textColor }}>
                            {it.eyebrow && (
                              <div className="text-[10px] md:text-xs uppercase tracking-widest font-bold mb-2 opacity-90">
                                {it.eyebrow}
                              </div>
                            )}
                            <div className="text-lg md:text-2xl font-black leading-tight tracking-tight">
                              {it.label}
                            </div>
                            {it.subtitle && (
                              <div className="text-xs md:text-sm mt-1 opacity-90 leading-snug">
                                {it.subtitle}
                              </div>
                            )}
                            {it.cta_label && (
                              <div className="mt-3">
                                <span className="inline-block rounded-md text-xs md:text-sm font-semibold px-4 py-2"
                                  style={{ background: `var(--brand-bg, ${primary})`, color: '#fff' }}>
                                  {it.cta_label}
                                </span>
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          }

          case 'products_strip': {
            const c = cfg.sections.products_strip;
            if (stripProducts.length === 0) return null;
            // Los dots + los links del título del producto usan el color de
            // acento de la sección (con fallback al primary del tenant).
            // El owner lo cambia desde el editor → sección "Cinta de productos"
            // → picker "Color de acento".
            const accent = c.accent_color || primary;
            return (
              <div key={key} {...dt} id={key} style={bg ? { background: bg } : undefined}>
                <ProductsStrip
                  products={stripProducts}
                  title={c.title || 'Destacados'}
                  subtitle={c.subtitle}
                  ctaLabel={c.cta_label}
                  ctaHref={c.cta_href}
                  accent={accent}
                />
              </div>
            );
          }

          case 'cta_final': {
            const c = cfg.sections.cta_final;
            // Background: preferimos el gradient del brand (var --brand-bg)
            // si el owner lo configuró, sino el fake-gradient de 2 tonos
            // del primary. El bg override del section editor gana sobre
            // ambos (respetamos la decisión manual del owner).
            return (
              <section key={key} {...dt} id={key} className="px-6 py-24 text-center"
                style={{ background: bg ?? `var(--brand-bg, linear-gradient(135deg, ${primary}, ${primary}dd))` }}>
                <FadeIn>
                  <div className="max-w-2xl mx-auto text-white">
                    <h2 className="text-3xl md:text-5xl font-bold mb-5"
                      dangerouslySetInnerHTML={richHtml(c.title)} />
                    {c.body && <p className="text-white/90 text-lg mb-10 leading-relaxed">{c.body}</p>}
                    {c.cta_label && (
                      <a href={c.cta_href || '#publicaciones'}
                        className="inline-block rounded-md px-8 py-4 font-bold bg-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition text-lg"
                        style={{ color: primary }}>
                        {c.cta_label} →
                      </a>
                    )}
                  </div>
                </FadeIn>
              </section>
            );
          }

          case 'workwithus': {
            // Solo aparece si affiliate_mode !== 'disabled' (defensivo:
            // aún estando enabled en site_config, si el owner no activó
            // el programa, no se muestra).
            if ((affiliateMode ?? 'disabled') === 'disabled') return null;
            const c = cfg.sections.workwithus;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-20"
                style={{ background: bg ?? '#0a0a0a', color: '#fff' }}>
                <div className="max-w-5xl mx-auto">
                  <FadeIn>
                    <div className="text-center mb-10">
                      <h2 className="text-3xl md:text-4xl font-bold mb-3"
                        dangerouslySetInnerHTML={richHtml(c.title)} />
                      {c.subtitle && <p className="text-white/70 max-w-2xl mx-auto">{c.subtitle}</p>}
                    </div>
                  </FadeIn>
                  {c.benefits.length > 0 && (
                    <div className="grid md:grid-cols-3 gap-4 mb-10">
                      {c.benefits.map((b) => (
                        <div key={b.id} className="rounded-xl bg-white/5 border border-white/10 p-5">
                          <div className="text-3xl mb-2">{b.icon}</div>
                          <h3 className="font-semibold mb-1">{b.title}</h3>
                          <p className="text-sm text-white/60">{b.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {c.show_terms && affiliateTerms && (
                    <div className="rounded-lg bg-white/5 border border-white/10 p-4 mb-8 text-sm text-white/70 whitespace-pre-wrap max-w-3xl mx-auto">
                      {affiliateTerms}
                    </div>
                  )}
                  <div className="text-center">
                    <WorkWithUsCTA
                      tenantId={tenantId}
                      loggedIn={!!currentUser}
                      alreadyAffiliate={affiliateMembershipStatus}
                      labelLoggedIn={c.cta_label}
                      labelLoggedOut={c.cta_label_logged_out}
                      primary={primary}
                    />
                  </div>
                </div>
              </section>
            );
          }

          default:
            return null;
        }
      })}

      {/* CartWidget movido al header del storefront (layout.tsx) — al lado
          del avatar del user. Se renderiza siempre que cart_enabled=true. */}
    </div>
  );
}

function CourseCard({
  c, primary, category
}: {
  c: PublicCourse; primary: string; category?: Category | null;
}) {
  return (
    <Link href={`/c/${c.slug}`} className="block rounded-xl border border-black/10 overflow-hidden hover:shadow-lg transition bg-white">
      <div className="h-40 relative" style={{ background: `var(--brand-bg, linear-gradient(135deg, ${primary}, ${primary}88))` }}>
        {c.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.cover_url} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {c.is_featured && (
          <span className="absolute top-3 left-3 bg-white text-black text-xs font-semibold px-2 py-1 rounded">
            ⭐ Destacado
          </span>
        )}
      </div>
      <div className="p-5">
        {category && (
          <div className="text-xs font-medium mb-1.5" style={{ color: primary }}>
            {category.name}
          </div>
        )}
        <h3 className="font-semibold mb-1">{c.title}</h3>
        {c.description && <p className="text-sm text-black/60 line-clamp-2 mb-3">{c.description}</p>}
        <div className="flex items-center justify-between">
          <span className="font-bold">
            {c.price_cents === 0 ? 'Gratis' : `$ ${(c.price_cents / 100).toLocaleString('es-AR')} ${c.currency}`}
          </span>
          <span className="text-xs font-medium px-2 py-1 rounded text-white" style={{ background: primary }}>
            Ver publicación →
          </span>
        </div>
      </div>
    </Link>
  );
}

function CountdownDisplay({ endsAt }: { endsAt: string }) {
  // SSR render: snapshot at render time. Browser doesn't auto-tick in this server-rendered version
  // (refresh updates it). Real-time JS countdown can land in a follow-up as a small client component.
  const endsMs = new Date(endsAt).getTime();
  const diff = Math.max(0, endsMs - Date.now());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div className="flex justify-center gap-3 my-6">
      {[{ n: d, l: 'días' }, { n: h, l: 'h' }, { n: m, l: 'min' }, { n: s, l: 'seg' }].map((b, i) => (
        <div key={i} className="bg-white/15 rounded-lg px-4 py-3 min-w-[70px]">
          <div className="text-3xl font-bold leading-none">{String(b.n).padStart(2, '0')}</div>
          <div className="text-xs opacity-70 mt-1">{b.l}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── HeroMedia: lo que aparece al lado del texto en layout='split' ─── */

type HeroData = {
  image_url: string | null;
  media_type?: 'image' | 'video' | 'carousel' | 'form';
  video_url?: string;
  carousel_urls?: string[];
  form_id?: string;
};

function HeroMedia({ h, primary, heroForm }: { h: HeroData; primary: string; heroForm?: FormDef }) {
  const mt = h.media_type ?? 'image';

  if (mt === 'video' && h.video_url) {
    // Extracción simple de id YouTube / Drive
    const yt = h.video_url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{8,})/);
    const drv = h.video_url.match(/\/file\/d\/([\w-]{15,})/);
    const src = yt ? `https://www.youtube.com/embed/${yt[1]}`
      : drv ? `https://drive.google.com/file/d/${drv[1]}/preview`
      : h.video_url;
    return (
      <div className="rounded-2xl overflow-hidden shadow-2xl aspect-video">
        <iframe src={src} className="w-full h-full" allowFullScreen title="Hero video" />
      </div>
    );
  }

  if (mt === 'carousel' && Array.isArray(h.carousel_urls) && h.carousel_urls.length > 0) {
    return (
      <div className="rounded-2xl overflow-hidden shadow-2xl relative aspect-[4/3] bg-gray-100">
        <div className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory scroll-smooth">
          {h.carousel_urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="w-full h-full flex-shrink-0 object-cover snap-center" />
          ))}
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {h.carousel_urls.map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/70" />
          ))}
        </div>
      </div>
    );
  }

  if (mt === 'form' && heroForm) {
    return <FormRenderer form={heroForm} primary={primary} />;
  }

  // Default: image
  if (h.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={h.image_url} alt="" className="rounded-2xl w-full max-h-[480px] object-cover shadow-2xl" />
    );
  }
  return (
    <div className="rounded-2xl w-full aspect-[4/3] flex items-center justify-center border-2 border-dashed border-black/15 bg-black/5">
      <div className="text-center px-6">
        <div className="text-5xl opacity-30">🖼️</div>
        <p className="mt-3 text-sm text-black/40">Pegá la URL de tu imagen hero en el builder</p>
        <p className="mt-1 text-xs text-black/30">Recomendado 1200×900px</p>
      </div>
    </div>
  );
}

/* ─── Tarjetas de la sección 'cards' (info / producto / link / banner) ─── */

const STORE_RIBBON_CLS: Record<string, string> = {
  featured: 'bg-fuchsia-500 text-white',
  sale:     'bg-rose-500 text-white',
  urgent:   'bg-amber-500 text-amber-950',
  new:      'bg-emerald-500 text-white',
  info:     'bg-sky-500 text-white'
};

type StoreCard = {
  id: string;
  layout?: 'standard' | 'banner_h' | 'banner_v';
  title: string;
  subtitle?: string;
  body?: string;
  image_url?: string | null;
  price?: string;
  old_price?: string;
  stock_label?: string;
  ribbon_text?: string;
  ribbon_tone?: 'featured' | 'sale' | 'urgent' | 'new' | 'info';
  cta_text?: string;
  cta_href?: string;
  text_color?: string;
  overlay_opacity?: number;
};

function StoreCardItem({ card, primary }: { card: StoreCard; primary: string }) {
  const layout = card.layout ?? 'standard';
  if (layout === 'banner_h') return <BannerHCard card={card} primary={primary} />;
  if (layout === 'banner_v') return <BannerVCard card={card} primary={primary} />;
  return <StandardCard card={card} primary={primary} />;
}

function CardLinkWrap({ href, children, className }: { href: string | null; children: React.ReactNode; className: string }) {
  if (!href) return <div className={className}>{children}</div>;
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

function StandardCard({ card, primary }: { card: StoreCard; primary: string }) {
  const ribbonCls = card.ribbon_text ? (STORE_RIBBON_CLS[card.ribbon_tone ?? 'featured'] ?? STORE_RIBBON_CLS.featured) : '';
  const hasButton = !!card.cta_text?.trim();
  const href = hasButton ? (card.cta_href?.trim() || '#') : null;

  return (
    <CardLinkWrap href={href} className="block rounded-xl border border-black/10 overflow-hidden hover:shadow-lg transition bg-white">
      <div className="h-40 relative" style={{ background: `var(--brand-bg, linear-gradient(135deg, ${primary}, ${primary}88))` }}>
        {card.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image_url} alt={card.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {card.ribbon_text && (
          <span className={`absolute top-3 left-3 text-[10px] font-bold tracking-wider px-2 py-1 rounded uppercase ${ribbonCls}`}>
            {card.ribbon_text}
          </span>
        )}
        {card.stock_label && (
          <span className="absolute top-3 right-3 bg-black/70 text-white text-[10px] font-semibold px-2 py-1 rounded uppercase tracking-wide">
            {card.stock_label}
          </span>
        )}
      </div>
      <div className="p-5">
        {card.subtitle && <div className="text-xs font-medium mb-1.5" style={{ color: primary }}>{card.subtitle}</div>}
        <h3 className="font-semibold mb-1">{card.title}</h3>
        {card.body && <p className="text-sm text-black/60 line-clamp-2 mb-3">{card.body}</p>}
        <div className="flex items-center justify-between">
          {card.price ? (
            <div className="flex items-baseline gap-2">
              <span className="font-bold">{card.price}</span>
              {card.old_price && <span className="text-xs text-black/40 line-through">{card.old_price}</span>}
            </div>
          ) : <span />}
          {hasButton && (
            <span className="text-xs font-medium px-2 py-1 rounded text-white" style={{ background: primary }}>
              {card.cta_text} →
            </span>
          )}
        </div>
      </div>
    </CardLinkWrap>
  );
}

function BannerHCard({ card, primary }: { card: StoreCard; primary: string }) {
  const ribbonCls = card.ribbon_text ? (STORE_RIBBON_CLS[card.ribbon_tone ?? 'featured'] ?? STORE_RIBBON_CLS.featured) : '';
  const hasButton = !!card.cta_text?.trim();
  const href = hasButton ? (card.cta_href?.trim() || '#') : null;
  const ov = card.overlay_opacity ?? 0.4;
  const textColor = card.text_color ?? '#ffffff';

  return (
    <CardLinkWrap href={href} className="col-span-full block rounded-xl overflow-hidden hover:shadow-xl transition relative aspect-[16/5] bg-gray-200">
      {card.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image_url} alt={card.title} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${ov})` }} />
      {card.ribbon_text && (
        <span className={`absolute top-4 left-4 text-[11px] font-bold tracking-wider px-2.5 py-1 rounded uppercase ${ribbonCls}`}>
          {card.ribbon_text}
        </span>
      )}
      <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-12" style={{ color: textColor }}>
        {card.subtitle && <div className="text-xs md:text-sm font-medium mb-2 opacity-90">{card.subtitle}</div>}
        <h3 className="text-xl md:text-3xl font-bold leading-tight max-w-xl">{card.title}</h3>
        {card.body && <p className="text-sm md:text-base mt-2 opacity-90 max-w-xl line-clamp-2">{card.body}</p>}
        {hasButton && (
          <span className="mt-4 inline-block w-fit text-sm font-semibold px-5 py-2.5 rounded-md text-white" style={{ background: `var(--brand-bg, ${primary})` }}>
            {card.cta_text} →
          </span>
        )}
      </div>
    </CardLinkWrap>
  );
}

function BannerVCard({ card, primary }: { card: StoreCard; primary: string }) {
  const ribbonCls = card.ribbon_text ? (STORE_RIBBON_CLS[card.ribbon_tone ?? 'featured'] ?? STORE_RIBBON_CLS.featured) : '';
  const hasButton = !!card.cta_text?.trim();
  const href = hasButton ? (card.cta_href?.trim() || '#') : null;
  const ov = card.overlay_opacity ?? 0.45;
  const textColor = card.text_color ?? '#ffffff';

  return (
    <CardLinkWrap href={href} className="block rounded-xl overflow-hidden hover:shadow-xl transition relative aspect-[3/4] bg-gray-200">
      {card.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image_url} alt={card.title} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, rgba(0,0,0,${Math.min(1, ov + 0.3)}) 0%, rgba(0,0,0,${Math.max(0, ov - 0.2)}) 60%, rgba(0,0,0,0) 100%)` }} />
      {card.ribbon_text && (
        <span className={`absolute top-3 left-3 text-[10px] font-bold tracking-wider px-2 py-1 rounded uppercase ${ribbonCls}`}>
          {card.ribbon_text}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-5" style={{ color: textColor }}>
        {card.subtitle && <div className="text-[11px] font-medium mb-1 opacity-90">{card.subtitle}</div>}
        <h3 className="text-lg font-bold leading-tight">{card.title}</h3>
        {card.body && <p className="text-xs mt-1.5 opacity-90 line-clamp-2">{card.body}</p>}
        {hasButton && (
          <span className="mt-3 inline-block text-xs font-semibold px-3 py-1.5 rounded text-white" style={{ background: `var(--brand-bg, ${primary})` }}>
            {card.cta_text} →
          </span>
        )}
      </div>
    </CardLinkWrap>
  );
}
