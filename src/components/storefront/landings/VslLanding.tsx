'use client';

import { useState, useEffect, useMemo } from 'react';
import { CouponInput } from '@/components/storefront/CouponInput';
import { parseVideoUrl, type LandingConfig } from '@/lib/courses/landing';
import { LandingChrome } from '@/components/storefront/landings/LandingChrome';

type CourseInfo = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  currency: string;
  tenant_id: string;
};

/**
 * VSL (Video Sales Letter) landing.
 *
 * Flow:
 *  1. Hero pequeño con eyebrow + headline + subtitle.
 *  2. Video embebido (YouTube/Vimeo) — el visitante DEBE verlo.
 *  3. Contador "Desbloqueando en X segundos…" basado en vsl_unlock_seconds.
 *  4. Después del unlock:
 *     - Si vsl_form_after_watch=true → form multi-paso configurable
 *     - Después del form → CTA de compra
 *  5. Garantía + testimonios + FAQ debajo.
 *
 * El lead se persiste vía POST /api/leads/<tenantId>/<courseId> cuando
 * el visitante completa el form (independiente de si compra después).
 */
export function VslLanding({
  course,
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
  primary: string;
  config: LandingConfig;
  buyerEmail: string;
  checkoutConfig?: import('@/lib/checkout/types').CheckoutConfig;
  calendarMode?: import('@/lib/calendar/types').CalendarMode;
  calendarLabel?: string | null;
  calendarRequired?: boolean;
  calendarSlots?: import('@/lib/calendar/types').BookingSlot[];
}) {
  const headline = config.headline?.trim() || course.title;
  const subtitle = config.subtitle?.trim();
  const eyebrow = config.eyebrow?.trim();

  // Colores override (defaults VSL: negro+dorado+blanco). Si el config no
  // los define, caemos al brand del tenant (primary) y al blanco/negro
  // estándar del storefront.
  const bg = config.bg_color || '#ffffff';
  const text = config.text_color || '#0a0a0a';
  const accent = config.accent_color || primary;
  const unlockSeconds = Math.max(5, config.vsl_unlock_seconds ?? 60);
  const formAfterWatch = config.vsl_form_after_watch ?? true;
  // Parseamos lo que haya en vsl_video_id (puede ser una URL completa o ID raw)
  // — el editor ahora pide la URL pero datos viejos pueden tener ID raw.
  const parsedVideo = useMemo(
    () => parseVideoUrl(config.vsl_video_id ?? ''),
    [config.vsl_video_id]
  );
  const videoId = parsedVideo?.id;
  const videoProvider = parsedVideo?.provider ?? config.vsl_video_provider ?? 'youtube';
  const garantiaDias = config.garantia_dias ?? 7;
  const garantiaText = config.garantia_text?.trim();
  const testimonials = config.testimonials ?? [];
  const faq = config.faq ?? [];
  const ctaLabel = config.cta_label?.trim() || 'Reservar mi lugar';
  const ctaCaption = config.cta_caption?.trim();

  // Si no hay video configurado no tiene sentido el gating — desbloqueamos
  // todo desde el inicio para que el form y el CTA se vean igual.
  const hasVideo = Boolean(videoId);

  // Contador global "elapsed" desde que arrancó el video. Lo usamos para:
  //  - desbloquear el form (cuando elapsed >= vsl_unlock_seconds)
  //  - desbloquear cada sección configurada en section_unlocks
  // Si no hay video, elapsed se considera muy grande (todo unlocked).
  const [elapsed, setElapsed] = useState(0);
  const [videoStarted, setVideoStarted] = useState(!hasVideo);

  // Form state
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!videoStarted) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [videoStarted]);

  // Helpers de gating
  const formUnlockAt = config.section_unlocks?.form ?? unlockSeconds;
  const formUnlocked = !hasVideo || elapsed >= formUnlockAt;
  const secondsLeftForm = Math.max(0, formUnlockAt - elapsed);

  function sectionReady(key: 'testimonials' | 'bonuses' | 'faq' | 'cta'): boolean {
    const unlockAt = config.section_unlocks?.[key];
    if (unlockAt === undefined || unlockAt === null) return true; // no gating → visible
    if (!hasVideo) return true;                                    // sin video → visible
    return elapsed >= unlockAt;
  }
  function secondsLeftFor(key: 'testimonials' | 'bonuses' | 'faq' | 'cta'): number {
    const unlockAt = config.section_unlocks?.[key];
    if (unlockAt === undefined) return 0;
    return Math.max(0, unlockAt - elapsed);
  }

  // Auto-unlock si el owner no configuró formAfterWatch + no hay form
  const showForm = formUnlocked && formAfterWatch && !formSubmitted && (config.multistep_form ?? []).length > 0;
  const showBuyCTAByForm = formUnlocked && (!formAfterWatch || formSubmitted || (config.multistep_form ?? []).length === 0);
  const showBuyCTA = showBuyCTAByForm && sectionReady('cta');

  // Modo VSL "locked": oculta controles + bloquea pause via overlay.
  // Por default activado (el caso de uso de VSL es "tienen que ver el
  // video sin distracciones"). Owner puede desactivar con vsl_block_pause=false.
  const blockPause = config.vsl_block_pause ?? true;

  // Estado de "play iniciado por user" (autoplay browsers requiere gesture)
  const [playClicked, setPlayClicked] = useState(false);

  // URL del embed. Params para ocultar UI tanto como se pueda.
  // YouTube: controls=0 oculta barra; disablekb=1 desactiva teclas EXCEPTO
  //   spacebar (limitación pública del embed); rel=0 minimiza related;
  //   modestbranding=1 reduce logo (deprecado pero por las dudas);
  //   iv_load_policy=3 oculta annotations; fs=0 desactiva fullscreen;
  //   playsinline=1 evita fullscreen en mobile iOS.
  // Vimeo: controls=0 + keyboard=0 + pip=0 oculta todo + desactiva teclas.
  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    const ap = playClicked ? '1' : '0';
    if (videoProvider === 'vimeo') {
      const params = blockPause
        ? `autoplay=${ap}&controls=0&keyboard=0&pip=0&title=0&byline=0&portrait=0`
        : `autoplay=${ap}`;
      return `https://player.vimeo.com/video/${videoId}?${params}`;
    }
    const params = blockPause
      ? `autoplay=${ap}&controls=0&disablekb=1&modestbranding=1&rel=0&iv_load_policy=3&fs=0&playsinline=1`
      : `autoplay=${ap}&rel=0&modestbranding=1`;
    return `https://www.youtube.com/embed/${videoId}?${params}`;
  }, [videoId, videoProvider, blockPause, playClicked]);

  return (
    <article className="min-h-screen" style={{ background: bg, color: text }}>
      <LandingChrome hideNav={config.hide_nav} hideFooter={config.hide_footer} />
      {/* Hero compacto */}
      <section className="px-6 pt-12 pb-6 text-center">
        <div className="max-w-3xl mx-auto">
          {eyebrow && (
            <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full" style={{ background: `${accent}15`, color: accent }}>
              {eyebrow}
            </span>
          )}
          <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight leading-tight">
            {headline}
          </h1>
          {subtitle && <p className="mt-4 text-lg text-black/70 max-w-2xl mx-auto">{subtitle}</p>}
        </div>
      </section>

      {/* Video gated — sólo si el owner configuró un video */}
      {hasVideo && (
        <section className="px-6 mb-8">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-black aspect-video relative">
              {/* Estado inicial: fake poster + botón ▶ que dispara autoplay
                  (los browsers permiten autoplay solo si el user gestureó) */}
              {!playClicked ? (
                <button
                  type="button"
                  onClick={() => {
                    setPlayClicked(true);
                    setVideoStarted(true);
                  }}
                  className="absolute inset-0 w-full h-full flex items-center justify-center group bg-black"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${accent}30 0%, ${accent}05 100%)`
                  }}
                >
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/95 flex items-center justify-center shadow-2xl group-hover:scale-110 transition">
                    <div className="text-3xl md:text-4xl ml-1" style={{ color: accent }}>▶</div>
                  </div>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm font-semibold drop-shadow">
                    Click para reproducir
                  </div>
                </button>
              ) : (
                <>
                  <iframe
                    src={embedUrl ?? undefined}
                    allow="autoplay; encrypted-media"
                    allowFullScreen={!blockPause}
                    /* pointer-events-none cuando blockPause: el iframe no recibe
                       clicks (no se puede pausar). El overlay de abajo capta los
                       clicks. Limitación: spacebar sigue funcionando si el iframe
                       tiene foco — los browsers no permiten al parent bloquear
                       teclado de un iframe cross-origin. */
                    className={`w-full h-full ${blockPause ? 'pointer-events-none' : ''}`}
                    title="VSL"
                  />
                  {blockPause && (
                    <div
                      className="absolute inset-0"
                      aria-hidden="true"
                      title="Mirá el video completo para continuar"
                      onClick={(e) => e.preventDefault()}
                    />
                  )}
                </>
              )}
            </div>

            {!formUnlocked && (
              <div className="mt-4 rounded-xl border-2 p-4 text-center" style={{ borderColor: `${accent}50`, background: `${accent}08` }}>
                <div className="text-sm font-semibold" style={{ color: accent }}>
                  🔒 {videoStarted
                    ? `Desbloqueando en ${secondsLeftForm}s — mirá el video completo`
                    : 'Mirá el video para desbloquear el contenido'}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full transition-all duration-1000"
                    style={{
                      width: `${((formUnlockAt - secondsLeftForm) / formUnlockAt) * 100}%`,
                      background: accent
                    }}
                  />
                </div>
              </div>
            )}

            {formUnlocked && (
              <div className="mt-4 rounded-xl border-2 border-emerald-400 bg-emerald-50 p-3 text-center">
                <div className="text-sm font-semibold text-emerald-800">
                  ✓ ¡Acceso desbloqueado!
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Empty state cuando NO hay video — solo visible para el owner viendo
          su propia landing antes de configurarla. El visitante normal
          probablemente nunca lo va a ver porque el owner lo configura
          antes de publicar. */}
      {!hasVideo && (
        <section className="px-6 mb-8">
          <div className="max-w-3xl mx-auto rounded-2xl bg-amber-50 border-2 border-dashed border-amber-300 p-8 text-center">
            <div className="text-4xl mb-3">🎥</div>
            <div className="font-bold text-amber-900">Configurá tu video VSL</div>
            <p className="text-sm text-amber-800/85 mt-2 leading-snug max-w-md mx-auto">
              Andá a <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">Editar curso</code> → tab{' '}
              <strong>Landing page</strong> → sección <strong>🎥 Video + gating VSL</strong> y pegá el
              ID de tu video de YouTube o Vimeo.
            </p>
            <p className="text-xs text-amber-800/60 mt-3">
              Mientras tanto, el form y el CTA están desbloqueados por default.
            </p>
          </div>
        </section>
      )}

      {/* Form multi-paso */}
      {showForm && (
        <section className="px-6 mb-12">
          <div className="max-w-md mx-auto">
            <VslMultiStepForm
              steps={config.multistep_form ?? []}
              tenantId={course.tenant_id}
              courseId={course.id}
              prefilledEmail={buyerEmail}
              primary={accent}
              onComplete={(data) => {
                setFormData(data);
                setFormSubmitted(true);
              }}
            />
          </div>
        </section>
      )}

      {/* CTA de compra */}
      {showBuyCTA && (
        <section className="px-6 mb-12">
          <div className="max-w-md mx-auto">
            <div className="rounded-2xl border-2 border-black/15 bg-white shadow-xl p-6 space-y-4">
              <div className="text-center">
                <div className="text-3xl font-black">
                  {course.price_cents === 0 ? 'Gratis' : `$${(course.price_cents / 100).toLocaleString('es-AR')} ${course.currency}`}
                </div>
                <p className="text-xs text-black/55 mt-1">Pago único · Acceso permanente</p>
              </div>
              <CouponInput
                courseId={course.id}
                priceCents={course.price_cents}
                currency={course.currency}
                primary={accent}
                defaultEmail={formData.email || buyerEmail}
                buyLabel={ctaLabel}
                ctaText={ctaLabel}
                checkoutConfig={checkoutConfig}
                calendarMode={calendarMode}
                calendarLabel={calendarLabel}
                calendarRequired={calendarRequired}
                calendarSlots={calendarSlots}
              />
              {ctaCaption && <p className="text-xs text-center text-black/55">{ctaCaption}</p>}
              <div className="rounded-lg bg-black/[0.04] p-3 text-xs space-y-1.5 text-center">
                <div className="font-semibold flex items-center justify-center gap-1.5">
                  🛡️ Garantía de {garantiaDias} días
                </div>
                {garantiaText && <p className="text-black/65 leading-snug">{garantiaText}</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Testimonios */}
      {testimonials.length > 0 && sectionReady('testimonials') && (
        <section className="px-6 py-12 bg-black/[0.02]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Lo que dicen los que ya entraron</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-xl bg-white border border-black/10 p-4">
                  <div className="text-yellow-500 mb-2">{'★'.repeat(t.rating ?? 5)}</div>
                  <p className="text-sm text-black/75 italic">"{t.text}"</p>
                  <div className="mt-3 flex items-center gap-2.5 pt-3 border-t border-black/5">
                    {t.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.photo_url} alt={t.name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: accent }}>
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
          </div>
        </section>
      )}

      {/* FAQ */}
      {faq.length > 0 && sectionReady('faq') && (
        <section className="px-6 py-12">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-6">Preguntas frecuentes</h2>
            <div className="space-y-2">
              {faq.map((q, i) => (
                <details key={i} className="rounded-lg border border-black/10 px-4 py-3">
                  <summary className="cursor-pointer font-medium">{q.q}</summary>
                  <p className="mt-2 text-sm text-black/70 whitespace-pre-line">{q.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}

/* ─────────── MultiStep form ─────────── */

type Step = NonNullable<LandingConfig['multistep_form']>[number];

function VslMultiStepForm({
  steps,
  tenantId,
  courseId,
  prefilledEmail,
  primary,
  onComplete
}: {
  steps: Step[];
  tenantId: string;
  courseId: string;
  prefilledEmail?: string;
  primary: string;
  onComplete: (data: Record<string, string>) => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<Record<string, string>>(prefilledEmail ? { email: prefilledEmail } : {});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = steps[stepIdx];
  if (!step) return null;

  const isLast = stepIdx === steps.length - 1;
  const value = data[step.name] ?? '';

  function setValue(v: string) {
    setData((d) => ({ ...d, [step.name]: v }));
  }

  function validateCurrent(): boolean {
    if (step.required && !value.trim()) {
      setError('Este campo es obligatorio');
      return false;
    }
    if (step.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Email inválido');
      return false;
    }
    setError(null);
    return true;
  }

  async function next() {
    if (!validateCurrent()) return;
    if (!isLast) {
      setStepIdx((i) => i + 1);
      return;
    }
    // Submit final → guarda lead → onComplete
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${tenantId}/${courseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, source: 'vsl' })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Error guardando tus datos. Intentá de nuevo.');
        setSubmitting(false);
        return;
      }
      onComplete(data);
    } catch {
      setError('Sin conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 bg-white shadow-xl p-6 text-black" style={{ borderColor: primary }}>
      <div className="flex items-center justify-between mb-4 text-xs text-black/55">
        <span>Paso {stepIdx + 1} de {steps.length}</span>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-6 h-1 rounded-full transition`}
              style={{ background: i <= stepIdx ? primary : '#0001' }}
            />
          ))}
        </div>
      </div>

      <label className="block font-bold text-lg mb-2">{step.label}</label>

      {step.type === 'select' ? (
        <div className="space-y-2">
          {(step.options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { setValue(opt); setError(null); }}
              className={`w-full text-left rounded border-2 px-4 py-3 transition ${
                value === opt
                  ? 'border-current bg-current/5 font-semibold'
                  : 'border-black/15 hover:border-black/40'
              }`}
              style={value === opt ? { borderColor: primary, color: primary } : undefined}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <input
          type={step.type === 'email' ? 'email' : step.type === 'tel' ? 'tel' : 'text'}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          placeholder={step.type === 'email' ? 'vos@email.com' : step.type === 'tel' ? '+54 9 11 5555-5555' : ''}
          className="w-full rounded-lg border-2 border-black/15 px-4 py-3 text-base focus:outline-none focus:border-black/40"
          autoFocus
        />
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex items-center gap-2">
        {stepIdx > 0 && (
          <button
            type="button"
            onClick={() => setStepIdx((i) => i - 1)}
            className="px-4 py-2.5 rounded-lg border border-black/15 text-sm text-black/70 hover:bg-black/5"
          >
            ← Atrás
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={submitting}
          className="flex-1 rounded-lg py-3 text-white font-bold text-base disabled:opacity-50"
          style={{ background: primary }}
        >
          {submitting ? 'Enviando…' : isLast ? '✓ Finalizar y continuar' : 'Siguiente →'}
        </button>
      </div>
    </div>
  );
}
