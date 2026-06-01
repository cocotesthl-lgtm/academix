import { CouponInput } from '@/components/storefront/CouponInput';
import type { LandingConfig } from '@/lib/courses/landing';

type CourseInfo = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  currency: string;
};

type ModuleWithLessons = {
  id: string;
  title: string;
  position: number;
  lessons: Array<{
    id: string;
    title: string;
    drive_embed_url: string | null;
    is_preview: boolean;
    position: number;
  }>;
};

/**
 * Hotmart-style product page landing.
 *
 * Layout:
 *  - Banner full-width con imagen + overlay del título + eyebrow promo
 *  - Sidebar sticky derecha con precio + CTA + garantía + trust badges
 *  - Bullets de "qué vas a aprender"
 *  - Sobre este curso (description / about_body)
 *  - Curriculum (módulos colapsables)
 *  - Productor (instructor)
 *  - Testimonios (si el config tiene)
 *  - FAQ
 *
 * Todo el contenido se override desde landing_config; lo que no esté en config
 * cae al course.title / course.description.
 */
export function HotmartLanding({
  course,
  modules,
  previewLessonEmbed,
  previewLessonTitle,
  totalLessons,
  primary,
  config,
  buyerEmail
}: {
  course: CourseInfo;
  modules: ModuleWithLessons[];
  previewLessonEmbed: string | null;
  previewLessonTitle: string | null;
  totalLessons: number;
  primary: string;
  config: LandingConfig;
  buyerEmail: string;
}) {
  const headline = config.headline?.trim() || course.title;
  const subtitle = config.subtitle?.trim();
  const eyebrow = config.eyebrow?.trim();
  const heroImg = config.hero_image_url ?? course.cover_url;
  const learnPoints = (config.learn_points ?? []).filter((p) => p.trim());
  const ctaCaption = config.cta_caption?.trim();
  const garantiaDias = config.garantia_dias ?? 7;
  const garantiaText = config.garantia_text?.trim();
  const trustBadges = config.trust_badges ?? ['Acceso de por vida', 'Certificado al finalizar', 'Soporte directo'];
  const aboutBody = config.about_body?.trim() || course.description || '';
  const instructorName = config.instructor_name?.trim();
  const instructorRole = config.instructor_role?.trim();
  const instructorBio = config.instructor_bio?.trim();
  const instructorPhoto = config.instructor_photo_url;
  const testimonials = config.testimonials ?? [];
  const faq = config.faq ?? [];
  const bonuses = config.bonuses ?? [];
  const offerText = config.offer_text?.trim();

  return (
    <article>
      {/* ─── Banner ─── */}
      <section className="relative">
        <div className="relative h-[55vh] min-h-[400px] max-h-[600px] overflow-hidden">
          {heroImg ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.7) 100%)' }} />
            </>
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}99 100%)` }} />
          )}
          <div className="relative h-full max-w-6xl mx-auto px-6 flex items-end pb-12">
            <div className="text-white max-w-2xl">
              {eyebrow && (
                <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-white/15 backdrop-blur border border-white/30">
                  {eyebrow}
                </span>
              )}
              <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight leading-tight drop-shadow-lg">
                {headline}
              </h1>
              {subtitle && (
                <p className="mt-4 text-lg md:text-xl text-white/90 leading-relaxed drop-shadow max-w-xl">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
        {/* ─── Left content ─── */}
        <div className="md:col-span-2 space-y-10">
          {/* Preview lesson */}
          {previewLessonEmbed && (
            <section>
              <h2 className="text-lg font-bold mb-3">Vista previa</h2>
              <div className="rounded-xl overflow-hidden border border-black/10 bg-black aspect-video">
                <iframe src={previewLessonEmbed} allow="autoplay; encrypted-media" allowFullScreen className="w-full h-full" title={previewLessonTitle ?? ''} />
              </div>
            </section>
          )}

          {/* Learn points */}
          {learnPoints.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Lo que vas a llevarte</h2>
              <ul className="grid sm:grid-cols-2 gap-3">
                {learnPoints.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: primary }}>✓</span>
                    <span className="text-black/80">{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* About / description */}
          {aboutBody && (
            <section>
              <h2 className="text-2xl font-bold mb-3">Sobre este producto</h2>
              <p className="text-black/75 whitespace-pre-line leading-relaxed">{aboutBody}</p>
            </section>
          )}

          {/* Curriculum */}
          {modules.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-1">Contenido del curso</h2>
              <p className="text-sm text-black/50 mb-4">
                {modules.length} módulos · {totalLessons} lecciones
              </p>
              <div className="space-y-2.5">
                {modules.map((m) => (
                  <details key={m.id} className="rounded-lg border border-black/10 overflow-hidden">
                    <summary className="cursor-pointer px-4 py-3 bg-black/[0.02] font-medium flex justify-between hover:bg-black/[0.04]">
                      <span>{m.title}</span>
                      <span className="text-xs text-black/50">{m.lessons.length} lecciones</span>
                    </summary>
                    <ul className="divide-y divide-black/5">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="px-4 py-2.5 text-sm flex items-center gap-2">
                          <span className="flex-1">{l.title}</span>
                          {l.is_preview && (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${primary}15`, color: primary }}>
                              preview
                            </span>
                          )}
                        </li>
                      ))}
                      {m.lessons.length === 0 && (
                        <li className="px-4 py-2.5 text-sm text-black/40">Sin lecciones todavía.</li>
                      )}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Instructor */}
          {(instructorName || instructorBio || instructorPhoto) && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Sobre el productor</h2>
              <div className="rounded-xl border border-black/10 p-5 flex gap-5 items-start">
                {instructorPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={instructorPhoto} alt={instructorName ?? ''} className="w-24 h-24 rounded-full object-cover shadow" />
                )}
                <div className="flex-1">
                  {instructorName && <div className="font-bold text-lg">{instructorName}</div>}
                  {instructorRole && <div className="text-sm text-black/55 mt-0.5">{instructorRole}</div>}
                  {instructorBio && <p className="mt-3 text-sm text-black/70 leading-relaxed whitespace-pre-line">{instructorBio}</p>}
                </div>
              </div>
            </section>
          )}

          {/* Testimonials */}
          {testimonials.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Lo que dicen los alumnos</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {testimonials.map((t, i) => (
                  <div key={i} className="rounded-xl border border-black/10 p-4">
                    <div className="text-yellow-500 mb-2">{'★'.repeat(t.rating ?? 5)}</div>
                    <p className="text-sm text-black/75 italic">"{t.text}"</p>
                    <div className="mt-3 flex items-center gap-2.5 pt-3 border-t border-black/5">
                      {t.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.photo_url} alt={t.name} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: primary }}>
                          {t.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="text-xs">
                        <div className="font-semibold">{t.name}</div>
                        {t.role && <div className="text-black/50">{t.role}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bonuses */}
          {bonuses.length > 0 && (
            <section className="rounded-2xl p-6 border-2 border-dashed" style={{ borderColor: `${primary}40`, background: `${primary}05` }}>
              <h2 className="text-2xl font-bold mb-1">🎁 Bonus que te llevás</h2>
              <p className="text-sm text-black/60 mb-4">Por comprar hoy, además del curso recibís:</p>
              <div className="space-y-3">
                {bonuses.map((b, i) => (
                  <div key={i} className="rounded-lg bg-white border border-black/10 p-4 flex gap-4 items-start">
                    <div className="flex-1">
                      <div className="font-bold">{b.title}</div>
                      <p className="text-sm text-black/65 mt-1">{b.description}</p>
                    </div>
                    {b.value && (
                      <div className="shrink-0 text-xs font-bold px-2.5 py-1.5 rounded text-white" style={{ background: primary }}>
                        {b.value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Offer / urgencia */}
          {offerText && (
            <section className="rounded-xl bg-amber-50 border-2 border-amber-300 p-4 text-center">
              <p className="text-amber-900 font-semibold">{offerText}</p>
            </section>
          )}

          {/* FAQ */}
          {faq.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Preguntas frecuentes</h2>
              <div className="space-y-2">
                {faq.map((q, i) => (
                  <details key={i} className="rounded-lg border border-black/10 px-4 py-3">
                    <summary className="cursor-pointer font-medium">{q.q}</summary>
                    <p className="mt-2 text-sm text-black/70 whitespace-pre-line">{q.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ─── Sticky sidebar precio ─── */}
        <aside className="md:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-black/10 bg-white p-5 shadow-lg space-y-4">
            {course.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.cover_url} alt="" className="w-full aspect-video rounded-lg object-cover" />
            )}
            <div>
              <div className="text-3xl font-bold">
                {course.price_cents === 0
                  ? 'Gratis'
                  : `${(course.price_cents / 100).toLocaleString('es-AR')} ${course.currency}`}
              </div>
              <p className="text-xs text-black/50 mt-1">Pago único · Acceso de por vida</p>
            </div>
            <CouponInput
              courseId={course.id}
              priceCents={course.price_cents}
              currency={course.currency}
              primary={primary}
              defaultEmail={buyerEmail}
              buyLabel={config.cta_label || 'Continuar al pago'}
            />
            {ctaCaption && (
              <p className="text-xs text-center text-black/60">{ctaCaption}</p>
            )}
            <div className="rounded-lg bg-black/[0.03] p-3 text-xs space-y-1.5">
              <div className="font-semibold text-sm flex items-center gap-1.5">
                🛡️ {garantiaDias} días de garantía
              </div>
              {garantiaText && <p className="text-black/65 leading-snug">{garantiaText}</p>}
            </div>
            <ul className="space-y-1.5 text-xs">
              {trustBadges.map((b, i) => (
                <li key={i} className="flex items-center gap-1.5 text-black/70">
                  <span style={{ color: primary }}>✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-center text-black/40 pt-1">Pago seguro vía MercadoPago</p>
          </div>
        </aside>
      </div>
    </article>
  );
}
