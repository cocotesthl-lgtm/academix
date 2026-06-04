import { CouponInput } from '@/components/storefront/CouponInput';
import type { LandingConfig } from '@/lib/courses/landing';
import { LandingChrome } from '@/components/storefront/landings/LandingChrome';

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
 * Funnel ClickFunnels-style landing — long-form direct-response.
 *
 * Estructura:
 *  1. Sticky URGENCIA bar arriba
 *  2. Hero centered con eyebrow "ATENCIÓN", headline grande, subtitle, UN solo CTA
 *  3. Video / VSL placeholder
 *  4. Stats bar (números fuertes)
 *  5. Sección "Sabés que estás listo cuando…" (learn_points como prueba social)
 *  6. CTA inline #1
 *  7. Sobre el método (about_body)
 *  8. Testimonios full-width
 *  9. CTA inline #2
 *  10. Instructor / quién soy
 *  11. Pricing card + bonus stack
 *  12. Garantía destacada
 *  13. FAQ
 *  14. CTA final "Última oportunidad"
 */
export function FunnelLanding({
  course,
  modules,
  primary,
  config,
  buyerEmail,
  checkoutConfig,
  calendarMode,
  calendarLabel,
  calendarRequired,
  calendarSlots
}: {
  course: CourseInfo;
  modules: ModuleWithLessons[];
  previewLessonEmbed?: string | null;
  previewLessonTitle?: string | null;
  totalLessons?: number;
  primary: string;
  checkoutConfig?: import('@/lib/checkout/types').CheckoutConfig;
  calendarMode?: import('@/lib/calendar/types').CalendarMode;
  calendarLabel?: string | null;
  calendarRequired?: boolean;
  calendarSlots?: import('@/lib/calendar/types').BookingSlot[];
  config: LandingConfig;
  buyerEmail: string;
}) {
  const headline = config.headline?.trim() || course.title;
  const subtitle = config.subtitle?.trim();
  const eyebrow = config.eyebrow?.trim();
  const heroImg = config.hero_image_url ?? course.cover_url;
  const learnPoints = (config.learn_points ?? []).filter((p) => p.trim());
  const ctaLabel = config.cta_label?.trim() || 'Quiero entrar AHORA';
  const ctaCaption = config.cta_caption?.trim();
  const garantiaDias = config.garantia_dias ?? 7;
  const garantiaText = config.garantia_text?.trim();
  const aboutBody = config.about_body?.trim() || course.description || '';
  const instructorName = config.instructor_name?.trim();
  const instructorRole = config.instructor_role?.trim();
  const instructorBio = config.instructor_bio?.trim();
  const instructorPhoto = config.instructor_photo_url;
  const testimonials = config.testimonials ?? [];
  const faq = config.faq ?? [];
  const bonuses = config.bonuses ?? [];
  const offerText = config.offer_text?.trim();

  const InlineCTA = ({ label }: { label?: string }) => (
    <div className="my-12 text-center">
      <CouponInput
        courseId={course.id}
        priceCents={course.price_cents}
        currency={course.currency}
        primary={primary}
        defaultEmail={buyerEmail}
        checkoutConfig={checkoutConfig}
        calendarMode={calendarMode}
        calendarLabel={calendarLabel}
        calendarRequired={calendarRequired}
        calendarSlots={calendarSlots}
        buyLabel={label ?? ctaLabel}
      />
      {ctaCaption && <p className="text-xs text-black/55 mt-2 max-w-md mx-auto">{ctaCaption}</p>}
    </div>
  );

  return (
    <article className="bg-white">
      <LandingChrome hideNav={config.hide_nav} hideFooter={config.hide_footer} />
      {/* URGENCIA BAR */}
      {offerText && (
        <div className="sticky top-0 z-40 text-center text-sm font-semibold py-2 px-4 text-white" style={{ background: primary }}>
          {offerText}
        </div>
      )}

      {/* HERO */}
      <section className="relative px-6 pt-16 pb-12 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: `radial-gradient(circle at top, ${primary}15 0%, transparent 70%)` }} />
        <div className="max-w-3xl mx-auto">
          {eyebrow && (
            <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border-2" style={{ borderColor: primary, color: primary, background: `${primary}10` }}>
              {eyebrow}
            </span>
          )}
          <h1 className="mt-6 text-4xl md:text-6xl font-black tracking-tight leading-[1.1] text-black">
            {headline}
          </h1>
          {subtitle && (
            <p className="mt-6 text-lg md:text-xl text-black/75 leading-relaxed max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}
          <div className="mt-8 max-w-md mx-auto">
            <CouponInput
              courseId={course.id}
              priceCents={course.price_cents}
              currency={course.currency}
              primary={primary}
              defaultEmail={buyerEmail}
        checkoutConfig={checkoutConfig}
        calendarMode={calendarMode}
        calendarLabel={calendarLabel}
        calendarRequired={calendarRequired}
        calendarSlots={calendarSlots}
              buyLabel={ctaLabel}
            />
            {ctaCaption && <p className="text-xs text-black/55 mt-2.5">{ctaCaption}</p>}
          </div>
        </div>
      </section>

      {/* HERO IMAGE / VSL PLACEHOLDER */}
      {heroImg && (
        <section className="px-6 -mt-6 mb-12">
          <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-2xl aspect-video relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImg} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-20 h-20 rounded-full bg-white/95 flex items-center justify-center shadow-2xl">
                <div className="text-3xl ml-1" style={{ color: primary }}>▶</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-center text-black/50 mt-2">🎥 Mirá esto antes de tomar tu decisión</p>
        </section>
      )}

      {/* STATS BAR */}
      <section className="px-6 py-10 border-y border-black/10 bg-black/[0.02]">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl md:text-4xl font-black" style={{ color: primary }}>+2.400</div>
            <div className="text-xs uppercase tracking-wider text-black/55 mt-1">alumnos</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-black" style={{ color: primary }}>4.9★</div>
            <div className="text-xs uppercase tracking-wider text-black/55 mt-1">puntaje</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-black" style={{ color: primary }}>{garantiaDias}d</div>
            <div className="text-xs uppercase tracking-wider text-black/55 mt-1">garantía</div>
          </div>
        </div>
      </section>

      {/* LEARN POINTS — long */}
      {learnPoints.length > 0 && (
        <section className="px-6 py-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-2">Sabés que estás listo cuando…</h2>
            <p className="text-center text-black/60 mb-10">Esto es lo que vas a tener acceso a partir de hoy:</p>
            <ul className="space-y-3">
              {learnPoints.map((p, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl border border-black/10 p-4 hover:border-black/30 transition">
                  <span className="shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold" style={{ background: primary }}>✓</span>
                  <span className="text-black/80 leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <InlineCTA />

      {/* ABOUT */}
      {aboutBody && (
        <section className="px-6 py-16 bg-black/[0.02]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-6">¿Por qué este método funciona?</h2>
            <p className="text-lg text-black/75 whitespace-pre-line leading-relaxed">{aboutBody}</p>
          </div>
        </section>
      )}

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section className="px-6 py-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-2">Mirá lo que dicen los que ya lo hicieron</h2>
            <p className="text-center text-black/60 mb-10">+2.400 personas ya tomaron este curso</p>
            <div className="grid md:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-2xl border-2 border-black/10 p-5 bg-white hover:shadow-lg transition">
                  <div className="text-yellow-500 mb-2 text-lg">{'★'.repeat(t.rating ?? 5)}</div>
                  <p className="text-black/80 italic leading-relaxed">"{t.text}"</p>
                  <div className="mt-4 flex items-center gap-3 pt-4 border-t border-black/5">
                    {t.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.photo_url} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ background: primary }}>
                        {t.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-bold">{t.name}</div>
                      {t.role && <div className="text-xs text-black/55">{t.role}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <InlineCTA />

      {/* INSTRUCTOR */}
      {(instructorName || instructorBio || instructorPhoto) && (
        <section className="px-6 py-16 bg-black/[0.02]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">Sobre mí</h2>
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {instructorPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={instructorPhoto} alt={instructorName ?? ''} className="w-40 h-40 rounded-full object-cover shadow-xl shrink-0" />
              )}
              <div>
                {instructorName && <div className="font-bold text-2xl">{instructorName}</div>}
                {instructorRole && <div className="text-sm font-semibold mt-1" style={{ color: primary }}>{instructorRole}</div>}
                {instructorBio && <p className="mt-4 text-black/75 leading-relaxed whitespace-pre-line">{instructorBio}</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PRICING + BONUS */}
      {bonuses.length > 0 && (
        <section className="px-6 py-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-2">🎁 Pero esperá, también te llevás:</h2>
            <p className="text-center text-black/60 mb-8">Bonus por tiempo limitado</p>
            <div className="space-y-3">
              {bonuses.map((b, i) => (
                <div key={i} className="rounded-xl border-2 border-dashed p-5 flex items-start justify-between gap-4" style={{ borderColor: `${primary}50`, background: `${primary}05` }}>
                  <div>
                    <div className="font-bold text-lg">{b.title}</div>
                    <p className="text-sm text-black/65 mt-1">{b.description}</p>
                  </div>
                  {b.value && (
                    <div className="shrink-0 text-xs font-bold px-3 py-2 rounded text-white whitespace-nowrap" style={{ background: primary }}>
                      {b.value}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-black/60 mt-6">
              Todo esto incluido en el precio del curso, sin costo extra.
            </p>
          </div>
        </section>
      )}

      <InlineCTA />

      {/* GARANTIA destacada */}
      <section className="px-6 py-12">
        <div className="max-w-2xl mx-auto rounded-2xl p-8 text-center" style={{ background: `${primary}10`, border: `2px solid ${primary}` }}>
          <div className="text-5xl mb-3">🛡️</div>
          <h3 className="text-2xl font-bold mb-2">Garantía de {garantiaDias} días — sin letra chica</h3>
          {garantiaText && <p className="text-black/75 leading-relaxed">{garantiaText}</p>}
        </div>
      </section>

      {/* CONTENIDO DEL CURSO (compacto) */}
      {modules.length > 0 && (
        <section className="px-6 py-12 bg-black/[0.02]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-6">¿Qué hay adentro del curso?</h2>
            <div className="space-y-2">
              {modules.map((m) => (
                <details key={m.id} className="rounded-lg border border-black/10 overflow-hidden bg-white">
                  <summary className="cursor-pointer px-4 py-3 font-medium flex justify-between">
                    <span>{m.title}</span>
                    <span className="text-xs text-black/50">{m.lessons.length} lecciones</span>
                  </summary>
                  <ul className="divide-y divide-black/5">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="px-4 py-2 text-sm text-black/70">{l.title}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
        <section className="px-6 py-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">¿Tenés dudas? Mirá esto antes de irte</h2>
            <div className="space-y-2">
              {faq.map((q, i) => (
                <details key={i} className="rounded-xl border-2 border-black/10 px-5 py-3 hover:border-black/30 transition">
                  <summary className="cursor-pointer font-bold text-lg">{q.q}</summary>
                  <p className="mt-3 text-black/75 leading-relaxed whitespace-pre-line">{q.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA FINAL */}
      <section className="px-6 py-20 text-white" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 100%)` }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            🚀 Última oportunidad
          </h2>
          <p className="text-lg text-white/90 leading-relaxed mb-8">
            Esta es tu decisión. Hacés click ahora y entrás, o seguís en el mismo lugar dentro de 6 meses. Vos elegís.
          </p>
          <div className="max-w-md mx-auto bg-white text-black rounded-2xl p-5 shadow-2xl">
            <div className="text-3xl font-black mb-3">
              {course.price_cents === 0 ? 'Gratis' : `$${(course.price_cents / 100).toLocaleString('es-AR')} ${course.currency}`}
            </div>
            <CouponInput
              courseId={course.id}
              priceCents={course.price_cents}
              currency={course.currency}
              primary={primary}
              defaultEmail={buyerEmail}
        checkoutConfig={checkoutConfig}
        calendarMode={calendarMode}
        calendarLabel={calendarLabel}
        calendarRequired={calendarRequired}
        calendarSlots={calendarSlots}
              buyLabel={ctaLabel}
            />
            <p className="text-xs text-black/55 mt-2">{ctaCaption ?? 'Pago seguro vía MercadoPago'}</p>
          </div>
        </div>
      </section>
    </article>
  );
}
