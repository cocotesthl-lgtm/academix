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
  searchParams: Promise<{ cat?: string }>;
}) {
  const { tenantId } = await params;
  const { cat: selectedCatSlug } = await searchParams;

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
  };
  let blogPreviewArticles: BlogPreviewArticle[] = [];
  const blogPreviewCfg = cfg.sections.blog_preview;
  if (blogPreviewCfg?.enabled) {
    try {
      const count = Math.max(1, Math.min(6, blogPreviewCfg.count || 3));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: articlesRaw } = await (svc.from('articles') as any)
        .select('id, slug, title, excerpt, cover_url, author_name, published_at')
        .eq('tenant_id', tenantId).eq('status', 'published')
        .order('published_at', { ascending: false }).limit(count);
      blogPreviewArticles = (articlesRaw ?? []) as BlogPreviewArticle[];
    } catch { /* migration 0050 pendiente */ }
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
                        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}99 100%)` }}
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
                    <div className={`${compact ? 'w-24 h-24 text-3xl' : 'w-36 h-36 text-5xl'} rounded-full mx-auto flex items-center justify-center font-bold text-white shadow-xl ring-4 ring-white`} style={{ background: `linear-gradient(135deg, ${primary}, ${primary}aa)` }}>
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
                  style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
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
                          style={t.highlighted ? { background: primary } : { borderColor: primary, color: primary }}
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
                      style={{ background: primary }}>
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
                            style={{ background: primary }}>
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
            const formAction = ct.email ? `mailto:${ct.email}` : undefined;
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
                    <form action={formAction} method="POST" encType="text/plain" className="bg-white rounded-2xl p-8 shadow-sm border border-black/5 space-y-4">
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
                        style={{ background: primary }}>
                        {ct.submit_label}
                      </button>
                      {!ct.email && <p className="text-xs text-center text-black/40">⚠ Configurá el email destino en el editor.</p>}
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
                        style={{ background: primary }}>
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
                    {blogPreviewArticles.map((a) => {
                      const dateLabel = new Date(a.published_at).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'short', year: 'numeric'
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
                            <div className="text-[10px] uppercase tracking-widest text-black/45 mb-2">
                              {dateLabel}{a.author_name ? ` · ${a.author_name}` : ''}
                            </div>
                            <h3 className="font-bold text-lg mb-1.5 leading-tight">{a.title}</h3>
                            {a.excerpt && <p className="text-sm text-black/60 line-clamp-2">{a.excerpt}</p>}
                          </div>
                        </Link>
                      );
                    })}
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

          case 'cta_final': {
            const c = cfg.sections.cta_final;
            return (
              <section key={key} {...dt} id={key} className="px-6 py-24 text-center"
                style={{ background: bg ?? `linear-gradient(135deg, ${primary}, ${primary}dd)` }}>
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
      <div className="h-40 relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
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
      <div className="h-40 relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
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
          <span className="mt-4 inline-block w-fit text-sm font-semibold px-5 py-2.5 rounded-md text-white" style={{ background: primary }}>
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
          <span className="mt-3 inline-block text-xs font-semibold px-3 py-1.5 rounded text-white" style={{ background: primary }}>
            {card.cta_text} →
          </span>
        )}
      </div>
    </CardLinkWrap>
  );
}
