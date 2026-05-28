import Link from "next/link";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";
import { mergeConfig, type SectionKey } from "@/lib/site/types";
import { AnimatedCounter } from "@/components/storefront/AnimatedCounter";
import { FadeIn } from "@/components/storefront/FadeIn";

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

  return (
    <div>
      {cfg.order.map((key: SectionKey) => {
        const s = cfg.sections[key];
        if (!s?.enabled) return null;
        const bg = s.bg_color ?? null;

        switch (key) {
          case 'hero': {
            const h = cfg.sections.hero;
            const heroBg = bg ?? `linear-gradient(180deg, ${primary}15 0%, transparent 100%)`;

            if (h.layout === 'split') {
              return (
                <section key={key} className="px-6 py-20" style={{ background: heroBg }}>
                  <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
                    <div>
                      <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                        {h.title || tenant?.name || 'Academia'}
                      </h1>
                      {h.subtitle && <p className="mt-4 text-lg text-black/60">{h.subtitle}</p>}
                      {h.cta_label && (
                        <a href={h.cta_href || '#cursos'}
                          className="mt-8 inline-block rounded-md px-6 py-3 font-semibold text-white"
                          style={{ background: primary }}>
                          {h.cta_label}
                        </a>
                      )}
                    </div>
                    {h.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.image_url} alt="" className="rounded-2xl w-full max-h-96 object-cover" />
                    ) : (
                      <div className="rounded-2xl w-full h-80 flex items-center justify-center" style={{ background: `${primary}20` }}>
                        <span className="text-6xl">🖼️</span>
                      </div>
                    )}
                  </div>
                </section>
              );
            }
            if (h.layout === 'gallery') {
              return (
                <section key={key} className="px-6 py-20" style={{ background: heroBg }}>
                  <div className="max-w-5xl mx-auto">
                    {h.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.image_url} alt="" className="rounded-2xl w-full max-h-[420px] object-cover mb-10" />
                    ) : (
                      <div className="rounded-2xl w-full h-72 flex items-center justify-center mb-10" style={{ background: `${primary}20` }}>
                        <span className="text-6xl">🖼️</span>
                      </div>
                    )}
                    <div className="text-center">
                      <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{h.title || tenant?.name || 'Academia'}</h1>
                      {h.subtitle && <p className="mt-4 text-lg text-black/60">{h.subtitle}</p>}
                      {h.cta_label && (
                        <a href={h.cta_href || '#cursos'}
                          className="mt-8 inline-block rounded-md px-6 py-3 font-semibold text-white"
                          style={{ background: primary }}>
                          {h.cta_label}
                        </a>
                      )}
                    </div>
                  </div>
                </section>
              );
            }
            // centered
            return (
              <section key={key} className="px-6 py-20 text-center" style={{ background: heroBg }}>
                <div className="max-w-3xl mx-auto">
                  <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                    {h.title || tenant?.name || 'Academia'}
                  </h1>
                  {h.subtitle && <p className="mt-4 text-lg text-black/60">{h.subtitle}</p>}
                  {h.cta_label && (
                    <a href={h.cta_href || '#cursos'}
                      className="mt-8 inline-block rounded-md px-6 py-3 font-semibold text-white"
                      style={{ background: primary }}>
                      {h.cta_label}
                    </a>
                  )}
                </div>
              </section>
            );
          }

          case 'trusted_by': {
            const tb = cfg.sections.trusted_by;
            if (tb.items.length === 0) return null;
            return (
              <section key={key} className="px-6 py-10" style={{ background: bg ?? 'rgba(0,0,0,0.02)' }}>
                <div className="max-w-5xl mx-auto">
                  <p className="text-xs text-center text-black/40 uppercase tracking-widest mb-6">{tb.title}</p>
                  <div className="flex flex-wrap justify-center items-center gap-8">
                    {tb.items.map((l) => {
                      const inner = l.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.logo_url} alt={l.name} className={`h-10 object-contain ${tb.grayscale ? 'grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition' : ''}`} />
                      ) : (
                        <span className="text-sm font-semibold text-black/60">{l.name}</span>
                      );
                      return l.href ? (
                        <a key={l.id} href={l.href} target="_blank" rel="noopener">{inner}</a>
                      ) : <div key={l.id}>{inner}</div>;
                    })}
                  </div>
                </div>
              </section>
            );
          }

          case 'about': {
            const a = cfg.sections.about;
            return (
              <section key={key} className="px-6 py-20" style={{ background: bg ?? '#fafafa' }}>
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
                      <h2 className="text-3xl md:text-4xl font-bold mb-4">{a.title}</h2>
                      <p className="text-black/70 whitespace-pre-line leading-relaxed text-lg">{a.body}</p>
                    </div>
                  </FadeIn>
                </div>
              </section>
            );
          }

          case 'instructor': {
            const i = cfg.sections.instructor;
            return (
              <section key={key} className="px-6 py-20" style={bg ? { background: bg } : undefined}>
                <FadeIn>
                  <div className="max-w-3xl mx-auto text-center">
                    <div className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: primary }}>Quién enseña</div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-10">{i.title}</h2>
                    {i.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.photo_url} alt={i.name} className="w-36 h-36 rounded-full mx-auto object-cover mb-5 shadow-xl ring-4 ring-white" />
                    ) : (
                      <div className="w-36 h-36 rounded-full mx-auto flex items-center justify-center text-5xl font-bold text-white mb-5 shadow-xl ring-4 ring-white" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}aa)` }}>
                        {i.name.slice(0, 1).toUpperCase() || '👤'}
                      </div>
                    )}
                    <h3 className="text-2xl font-bold">{i.name || '—'}</h3>
                    {i.credentials && <p className="text-sm text-black/60 mt-1.5">{i.credentials}</p>}
                    {i.bio && <p className="mt-5 text-black/70 whitespace-pre-line leading-relaxed max-w-xl mx-auto">{i.bio}</p>}
                  </div>
                </FadeIn>
              </section>
            );
          }

          case 'stats': {
            const st = cfg.sections.stats;
            if (st.items.length === 0) return null;
            const cols = Math.min(st.items.length, 4);
            return (
              <section key={key} className="px-6 py-16" style={{ background: bg ?? `linear-gradient(180deg, ${primary}08 0%, transparent 100%)` }}>
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
              <section key={key} className="px-6 py-20" style={bg ? { background: bg } : undefined}>
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
              <section key={key} className="px-6 py-20" style={{ background: bg ?? '#fafafa' }}>
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
              <section key={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
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
              <section key={key} id="cursos" className="px-6 py-16" style={bg ? { background: bg } : undefined}>
                <div className="max-w-6xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-bold mb-6">{cfg.sections.catalog.title}</h2>
                  {cfg.sections.catalog.show_filters && categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      <Link href="/"
                        className={`text-sm px-3 py-1.5 rounded-full border ${!selectedCat ? 'bg-black text-white border-black' : 'border-black/15 text-black/70 hover:bg-black/[0.03]'}`}>
                        Todos
                      </Link>
                      {categories.map((c) => (
                        <Link key={c.id} href={`/?cat=${c.slug}`}
                          className={`text-sm px-3 py-1.5 rounded-full border ${selectedCat?.id === c.id ? 'bg-black text-white border-black' : 'border-black/15 text-black/70 hover:bg-black/[0.03]'}`}>
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  {catalog.length === 0 ? (
                    <div className="rounded-xl border border-black/10 p-12 text-center text-black/50">
                      {selectedCat ? `No hay cursos en "${selectedCat.name}" todavía.` : 'Todavía no hay cursos publicados.'}
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {catalog.map((c) => (
                        <CourseCard key={c.id} c={c} primary={primary} category={c.category_id ? catById.get(c.category_id) : null} />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );

          case 'testimonials': {
            const ts = cfg.sections.testimonials;
            if (ts.items.length === 0) return null;
            return (
              <section key={key} id="testimonios" className="px-6 py-20" style={{ background: bg ?? `linear-gradient(180deg, ${primary}06 0%, ${primary}12 100%)` }}>
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
              <section key={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
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
              <section key={key} id="faq" className="px-6 py-20" style={bg ? { background: bg } : undefined}>
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
              <section key={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
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
              <section key={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
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
              <section key={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
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
              <section key={key} className="px-6 py-16" style={bg ? { background: bg } : undefined}>
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
              <section key={key} className="px-6 py-16" style={{ background: bg ?? `${primary}10` }}>
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

          case 'cta_final': {
            const c = cfg.sections.cta_final;
            return (
              <section key={key} className="px-6 py-24 text-center"
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
