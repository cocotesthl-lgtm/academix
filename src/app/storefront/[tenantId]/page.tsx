import Link from "next/link";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";
import { mergeConfig, type SectionKey } from "@/lib/site/types";
import { AnimatedCounter } from "@/components/storefront/AnimatedCounter";
import { FadeIn } from "@/components/storefront/FadeIn";
import { CatalogFilter } from "@/components/storefront/CatalogFilter";

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
  const [{ data: tenantRow }, { data: coursesRaw }, { data: catsRaw }] = await Promise.all([
    svc.from('tenants').select('site_config').eq('id', tenantId).single<{ site_config: unknown }>(),
    svc.from('courses')
      .select('id, slug, title, description, cover_url, price_cents, currency, is_featured, featured_position, category_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
    svc.from('course_categories')
      .select('id, name, slug')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true })
  ]);

  const cfg = mergeConfig(tenantRow?.site_config);
  const allCourses = (coursesRaw ?? []) as PublicCourse[];
  const categories = (catsRaw ?? []) as Category[];
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
            const heroTitle = h.title || tenant?.name || 'Academia';
            const cta1 = h.cta_label && (
              <a href={h.cta_href || '#cursos'}
                className="inline-block rounded-md px-6 py-3 font-semibold text-white shadow-md hover:shadow-lg transition"
                style={{ background: primary }}>
                {h.cta_label}
              </a>
            );
            const cta2 = h.cta_label_2 && (
              <a href={h.cta_href_2 || '#cursos'}
                className="inline-block rounded-md px-6 py-3 font-semibold border-2 hover:bg-black/[0.02] transition"
                style={{ borderColor: primary, color: primary }}>
                {h.cta_label_2}
              </a>
            );
            const eyebrowPill = h.eyebrow && (
              <span className="inline-block text-xs font-medium px-3 py-1 rounded-full border" style={{ borderColor: `${primary}55`, color: primary, background: `${primary}10` }}>
                {h.eyebrow}
              </span>
            );

            if (h.layout === 'split') {
              return (
                <section key={key} {...dt} className="relative overflow-hidden px-6 pt-16 pb-24" style={{ background: bg ?? `linear-gradient(135deg, ${primary}10 0%, transparent 55%)` }}>
                  {/* Decorative blob */}
                  <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-30 -z-0" style={{ background: `radial-gradient(circle, ${primary} 0%, transparent 70%)` }} />

                  <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                    <FadeIn>
                      <div>
                        {eyebrowPill}
                        <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight leading-tight"
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
                      {h.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.image_url} alt="" className="rounded-2xl w-full max-h-[480px] object-cover shadow-2xl" />
                      ) : (
                        /* Sin URL: placeholder discreto. El owner debe pegar una URL en el builder. */
                        <div className="rounded-2xl w-full aspect-[4/3] flex items-center justify-center border-2 border-dashed border-black/15 bg-black/5">
                          <div className="text-center px-6">
                            <div className="text-5xl opacity-30">🖼️</div>
                            <p className="mt-3 text-sm text-black/40">Pegá la URL de tu imagen hero en el builder</p>
                            <p className="mt-1 text-xs text-black/30">Recomendado 1200×900px</p>
                          </div>
                        </div>
                      )}
                    </FadeIn>
                  </div>
                </section>
              );
            }

            if (h.layout === 'gallery') {
              /* Amazon-style: imagen full-width grandota arriba que ocupa pantalla,
                 con CTA overlay encima del banner para empujar a la acción. */
              return (
                <section key={key} {...dt} className="relative" style={{ background: bg ?? '#0a0a0a' }}>
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
                              dangerouslySetInnerHTML={richHtml(h.title, heroTitle)} />
                            {h.subtitle && (
                              <div className="mt-4 text-lg md:text-xl text-white/90 leading-relaxed max-w-xl drop-shadow"
                                dangerouslySetInnerHTML={richHtml(h.subtitle)} />
                            )}
                            <div className="mt-7 flex flex-wrap gap-3">
                              {cta1}
                              {h.cta_label_2 && (
                                <a href={h.cta_href_2 || '#cursos'}
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
              <section key={key} {...dt} className="relative overflow-hidden px-6 py-24 text-center" style={{ background: bg ?? `linear-gradient(180deg, ${primary}12 0%, transparent 100%)` }}>
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
              <section key={key} {...dt} className="px-0 py-12 overflow-hidden" style={{ background: bg ?? '#fafafa' }}>
                <div className="max-w-6xl mx-auto px-6">
                  <p className="text-xs text-center text-black/40 uppercase tracking-widest mb-8">{tb.title}</p>
                </div>
                {tb.marquee ? (
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: `linear-gradient(90deg, ${bg ?? '#fafafa'}, transparent)` }} />
                    <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: `linear-gradient(-90deg, ${bg ?? '#fafafa'}, transparent)` }} />
                    <div className="flex gap-16 animate-marquee items-center" style={{ width: 'max-content' }}>
                      {[...items, ...items].map((l, idx) => {
                        const inner = l.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.logo_url} alt={l.name} className={`h-10 object-contain ${tb.grayscale ? 'grayscale opacity-60' : ''}`} />
                        ) : (
                          <span className={`text-xl font-bold whitespace-nowrap ${tb.grayscale ? 'text-black/50' : 'text-black/70'}`}>{l.name}</span>
                        );
                        return l.href ? (
                          <a key={`${l.id}-${idx}`} href={l.href} target="_blank" rel="noopener" className="flex-shrink-0">{inner}</a>
                        ) : <div key={`${l.id}-${idx}`} className="flex-shrink-0">{inner}</div>;
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-5xl mx-auto px-6 flex flex-wrap justify-center items-center gap-10">
                    {items.map((l) => {
                      const inner = l.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.logo_url} alt={l.name} className={`h-10 object-contain ${tb.grayscale ? 'grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition' : ''}`} />
                      ) : (
                        <span className={`text-lg font-bold ${tb.grayscale ? 'text-black/50' : 'text-black/70'}`}>{l.name}</span>
                      );
                      return l.href ? (
                        <a key={l.id} href={l.href} target="_blank" rel="noopener">{inner}</a>
                      ) : <div key={l.id}>{inner}</div>;
                    })}
                  </div>
                )}
              </section>
            );
          }

          case 'about': {
            const a = cfg.sections.about;
            return (
              <section key={key} {...dt} className="px-6 py-20" style={{ background: bg ?? '#fafafa' }}>
                <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                  <FadeIn>
                    {a.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image_url} alt="" className="rounded-2xl w-full object-cover max-h-96 shadow-lg" />
                    ) : (
                      <div className="rounded-2xl w-full h-80 flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${primary}20, ${primary}05)` }}>
                        <span className="text-7xl">👋</span>
                      </div>
                    )}
                  </FadeIn>
                  <FadeIn delay={150}>
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>Sobre nosotros</div>
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

            const renderCard = (p: { id: string; name: string; credentials?: string; bio?: string; photo_url: string | null }, opts?: { compact?: boolean }) => {
              const compact = opts?.compact;
              return (
                <div className="text-center">
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_url} alt={p.name} className={`${compact ? 'w-24 h-24' : 'w-36 h-36'} rounded-full mx-auto object-cover shadow-xl ring-4 ring-white`} />
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
              <section key={key} {...dt} className="px-6 py-20" style={bg ? { background: bg } : undefined}>
                <FadeIn>
                  <div className="text-center mb-12">
                    <div className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: primary }}>Quién enseña</div>
                    <h2 className="text-2xl md:text-3xl font-bold">{ins.title}</h2>
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
              <section key={key} {...dt} className="px-6 py-16" style={{ background: bg ?? `linear-gradient(180deg, ${primary}08 0%, transparent 100%)` }}>
                <div className="max-w-5xl mx-auto">
                  <FadeIn>
                    <h2 className="text-xl md:text-2xl font-bold text-center mb-10">{st.title}</h2>
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
              <section key={key} {...dt} className="px-6 py-20" style={bg ? { background: bg } : undefined}>
                <div className="max-w-4xl mx-auto">
                  <FadeIn>
                    <div className="text-center mb-10">
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>Aprendizaje</div>
                      <h2 className="text-3xl md:text-4xl font-bold">{lp.title}</h2>
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
              <section key={key} {...dt} className="px-6 py-20" style={{ background: bg ?? '#fafafa' }}>
                <div className="max-w-5xl mx-auto">
                  <FadeIn>
                    <div className="text-center mb-12">
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>Beneficios</div>
                      <h2 className="text-3xl md:text-4xl font-bold">{ft.title}</h2>
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
              <section key={key} {...dt} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-6xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold mb-6">{cfg.sections.featured.title}</h2>
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
              <section key={key} {...dt} id="cursos" className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <CatalogFilter
                  title={cfg.sections.catalog.title}
                  showFilters={cfg.sections.catalog.show_filters}
                  maxVisible={cfg.sections.catalog.max_visible ?? 3}
                  paginationMode={cfg.sections.catalog.pagination_mode ?? 'show_more'}
                  courses={allCourses}
                  categories={categories}
                  primary={primary}
                  initialCatSlug={selectedCatSlug ?? null}
                />
              </section>
            );

          case 'testimonials': {
            const ts = cfg.sections.testimonials;
            if (ts.items.length === 0) return null;
            return (
              <section key={key} {...dt} id="testimonios" className="px-6 py-20" style={{ background: bg ?? `linear-gradient(180deg, ${primary}06 0%, ${primary}12 100%)` }}>
                <div className="max-w-5xl mx-auto">
                  <FadeIn>
                    <div className="text-center mb-12">
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>Testimonios</div>
                      <h2 className="text-3xl md:text-4xl font-bold">{ts.title}</h2>
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
              <section key={key} {...dt} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-5xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{ba.title}</h2>
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
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>FAQ</div>
                      <h2 className="text-3xl md:text-4xl font-bold">{fq.title}</h2>
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
              <section key={key} {...dt} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-3xl mx-auto rounded-2xl text-center text-white p-10"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
                  <h2 className="text-2xl md:text-3xl font-bold">{o.title}</h2>
                  {o.subtitle && <p className="mt-2 opacity-90">{o.subtitle}</p>}
                  {o.ends_at && (
                    <CountdownDisplay endsAt={o.ends_at} />
                  )}
                  {o.cta_label && (
                    <a href={o.cta_href || '#cursos'}
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
              <section key={key} {...dt} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-5xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold text-center">{pr.title}</h2>
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
              <section key={key} {...dt} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold text-center">{vd.title}</h2>
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
              <section key={key} {...dt} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-6xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold text-center">{g.title}</h2>
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
              <section key={key} {...dt} className="px-6 py-16" style={{ background: bg ?? `${primary}10` }}>
                <div className="max-w-2xl mx-auto text-center">
                  <h2 className="text-2xl md:text-3xl font-bold">{n.title}</h2>
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
              <section key={key} {...dt} className="px-6 py-20" style={bg ? { background: bg } : undefined}>
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
                        <h2 className="text-3xl md:text-4xl font-bold">{cb.title}</h2>
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
                <FadeIn>
                  <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-10">
                      <div className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primary }}>Contacto</div>
                      <h2 className="text-3xl md:text-4xl font-bold">{ct.title}</h2>
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

          case 'cta_final': {
            const c = cfg.sections.cta_final;
            return (
              <section key={key} {...dt} className="px-6 py-24 text-center"
                style={{ background: bg ?? `linear-gradient(135deg, ${primary}, ${primary}dd)` }}>
                <FadeIn>
                  <div className="max-w-2xl mx-auto text-white">
                    <h2 className="text-3xl md:text-5xl font-bold mb-5">{c.title}</h2>
                    {c.body && <p className="text-white/90 text-lg mb-10 leading-relaxed">{c.body}</p>}
                    {c.cta_label && (
                      <a href={c.cta_href || '#cursos'}
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

          default:
            return null;
        }
      })}
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
            Ver curso →
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
