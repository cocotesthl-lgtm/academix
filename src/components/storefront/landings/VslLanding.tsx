'use client';

import { useState, useEffect, useMemo } from 'react';
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
  buyerEmail
}: {
  course: CourseInfo;
  primary: string;
  config: LandingConfig;
  buyerEmail: string;
}) {
  const headline = config.headline?.trim() || course.title;
  const subtitle = config.subtitle?.trim();
  const eyebrow = config.eyebrow?.trim();
  const unlockSeconds = Math.max(5, config.vsl_unlock_seconds ?? 60);
  const formAfterWatch = config.vsl_form_after_watch ?? true;
  const videoId = config.vsl_video_id?.trim();
  const videoProvider = config.vsl_video_provider ?? 'youtube';
  const garantiaDias = config.garantia_dias ?? 7;
  const garantiaText = config.garantia_text?.trim();
  const testimonials = config.testimonials ?? [];
  const faq = config.faq ?? [];
  const ctaLabel = config.cta_label?.trim() || 'Reservar mi lugar';
  const ctaCaption = config.cta_caption?.trim();

  // Timer de gating
  const [secondsLeft, setSecondsLeft] = useState(unlockSeconds);
  const [unlocked, setUnlocked] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);

  // Form state
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Tick del contador (solo después de play del video)
  useEffect(() => {
    if (!videoStarted || unlocked) return;
    if (secondsLeft <= 0) {
      setUnlocked(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [videoStarted, secondsLeft, unlocked]);

  // Auto-unlock si el owner no configuró formAfterWatch + no hay form
  const showForm = unlocked && formAfterWatch && !formSubmitted && (config.multistep_form ?? []).length > 0;
  const showBuyCTA = unlocked && (!formAfterWatch || formSubmitted || (config.multistep_form ?? []).length === 0);

  // URL del embed
  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    if (videoProvider === 'vimeo') {
      return `https://player.vimeo.com/video/${videoId}?autoplay=0`;
    }
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  }, [videoId, videoProvider]);

  return (
    <article className="bg-white min-h-screen">
      {/* Hero compacto */}
      <section className="px-6 pt-12 pb-6 text-center">
        <div className="max-w-3xl mx-auto">
          {eyebrow && (
            <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full" style={{ background: `${primary}15`, color: primary }}>
              {eyebrow}
            </span>
          )}
          <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight leading-tight">
            {headline}
          </h1>
          {subtitle && <p className="mt-4 text-lg text-black/70 max-w-2xl mx-auto">{subtitle}</p>}
        </div>
      </section>

      {/* Video gated */}
      <section className="px-6 mb-8">
        <div className="max-w-3xl mx-auto">
          {embedUrl ? (
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-black aspect-video relative">
              <iframe
                src={embedUrl}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
                title="VSL"
                onLoad={() => {
                  /* Heurística: marcamos started al cargar el iframe.
                     Sin acceso al state real del player el conteo arranca al cargar. */
                  setVideoStarted(true);
                }}
              />
            </div>
          ) : (
            <div className="rounded-2xl bg-black/5 border-2 border-dashed border-black/15 aspect-video flex items-center justify-center text-black/40 text-sm">
              ▶ El owner aún no configuró el video del VSL
            </div>
          )}

          {!unlocked && (
            <div className="mt-4 rounded-xl border-2 p-4 text-center" style={{ borderColor: `${primary}50`, background: `${primary}08` }}>
              <div className="text-sm font-semibold" style={{ color: primary }}>
                🔒 {videoStarted
                  ? `Desbloqueando en ${secondsLeft}s — mirá el video completo para acceder al formulario`
                  : 'Mirá el video para desbloquear el formulario'}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div
                  className="h-full transition-all duration-1000"
                  style={{
                    width: `${((unlockSeconds - secondsLeft) / unlockSeconds) * 100}%`,
                    background: primary
                  }}
                />
              </div>
              {!videoStarted && embedUrl && (
                <button
                  type="button"
                  onClick={() => setVideoStarted(true)}
                  className="mt-3 text-xs text-black/60 hover:text-black underline-offset-2 hover:underline"
                >
                  Ya empecé a verlo, iniciar contador →
                </button>
              )}
            </div>
          )}

          {unlocked && (
            <div className="mt-4 rounded-xl border-2 border-emerald-400 bg-emerald-50 p-3 text-center">
              <div className="text-sm font-semibold text-emerald-800">
                ✓ ¡Acceso desbloqueado!
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Form multi-paso */}
      {showForm && (
        <section className="px-6 mb-12">
          <div className="max-w-md mx-auto">
            <VslMultiStepForm
              steps={config.multistep_form ?? []}
              tenantId={course.tenant_id}
              courseId={course.id}
              prefilledEmail={buyerEmail}
              primary={primary}
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
                primary={primary}
                defaultEmail={formData.email || buyerEmail}
                buyLabel={ctaLabel}
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
      {testimonials.length > 0 && (
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
          </div>
        </section>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
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
    <div className="rounded-2xl border-2 bg-white shadow-xl p-6" style={{ borderColor: primary }}>
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
