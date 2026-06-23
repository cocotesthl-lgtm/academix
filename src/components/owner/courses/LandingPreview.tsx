'use client';

import type { LandingConfig, LandingTemplate } from '@/lib/courses/landing';

/**
 * Preview liviano del landing del publicación. Se actualiza en vivo mientras
 * el owner edita los campos. NO es el render real (eso vive en
 * /storefront/[tenantId]/c/[slug]) — es una versión escalada que muestra
 * el layout general para que el owner vea cómo va a quedar antes de guardar.
 */
export function LandingPreview({
  template,
  config,
  courseTitle,
  coverUrl,
  priceCents,
  currency,
  primary
}: {
  template: LandingTemplate;
  config: LandingConfig;
  courseTitle: string;
  coverUrl: string | null;
  priceCents: number;
  currency: string;
  primary: string;
}) {
  return (
    <div className="sticky top-4">
      <div className="text-xs text-white/50 mb-2 flex items-center gap-2">
        <span>👁 Preview en vivo</span>
        <span className="text-white/30">·</span>
        <span className="text-white/40 text-[10px]">Aproximado. La landing real está en /c/&lt;slug&gt;</span>
      </div>
      <div className="rounded-xl border border-white/15 bg-white text-black overflow-hidden shadow-xl">
        {template === 'hotmart' && <HotmartPreview config={config} courseTitle={courseTitle} coverUrl={coverUrl} priceCents={priceCents} currency={currency} primary={primary} />}
        {template === 'classic' && <ClassicPreview courseTitle={courseTitle} coverUrl={coverUrl} priceCents={priceCents} currency={currency} primary={primary} />}
        {template === 'funnel' && <FunnelPreview config={config} courseTitle={courseTitle} coverUrl={coverUrl} priceCents={priceCents} currency={currency} primary={primary} />}
        {template === 'vsl' && <VslPreview config={config} courseTitle={courseTitle} priceCents={priceCents} currency={currency} primary={primary} />}
      </div>
    </div>
  );
}

/* ─────────── Hotmart preview ─────────── */

function HotmartPreview({
  config, courseTitle, coverUrl, priceCents, currency, primary
}: {
  config: LandingConfig;
  courseTitle: string;
  coverUrl: string | null;
  priceCents: number;
  currency: string;
  primary: string;
}) {
  const headline = config.headline?.trim() || courseTitle;
  const subtitle = config.subtitle?.trim();
  const eyebrow = config.eyebrow?.trim();
  const heroImg = config.hero_image_url || coverUrl;
  const learnPoints = (config.learn_points ?? []).filter((p) => p.trim()).slice(0, 4);
  const ctaCaption = config.cta_caption?.trim();
  const garantiaDias = config.garantia_dias ?? 7;
  const garantiaText = config.garantia_text?.trim();
  const trustBadges = (config.trust_badges ?? ['Acceso de por vida', 'Certificado', 'Soporte directo']).slice(0, 3);
  const instructorName = config.instructor_name?.trim();
  const instructorPhoto = config.instructor_photo_url;
  const instructorRole = config.instructor_role?.trim();

  return (
    <div className="text-[10px] leading-tight">
      {/* Banner */}
      <div className="relative h-28 overflow-hidden">
        {heroImg ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.7) 100%)' }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}99 100%)` }} />
        )}
        <div className="relative h-full flex items-end p-2 text-white">
          <div className="max-w-[70%]">
            {eyebrow && (
              <span className="inline-block text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-white/20 backdrop-blur border border-white/30">
                {eyebrow.slice(0, 40)}
              </span>
            )}
            <div className="mt-1 text-sm font-bold leading-tight drop-shadow line-clamp-2">{headline}</div>
            {subtitle && <div className="mt-0.5 text-[9px] text-white/85 line-clamp-2 drop-shadow">{subtitle}</div>}
          </div>
        </div>
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-3 gap-2 p-2">
        {/* Left content */}
        <div className="col-span-2 space-y-2">
          {learnPoints.length > 0 && (
            <div>
              <div className="font-bold text-[10px] mb-1">Lo que vas a llevarte</div>
              <ul className="space-y-0.5">
                {learnPoints.map((p, i) => (
                  <li key={i} className="flex gap-1">
                    <span className="shrink-0 mt-0.5 w-2.5 h-2.5 rounded-full text-white text-[7px] flex items-center justify-center font-bold" style={{ background: primary }}>✓</span>
                    <span className="text-black/75 line-clamp-1 text-[9px]">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="font-bold text-[10px] mb-1">Sobre este producto</div>
            <div className="text-black/60 text-[9px] leading-tight">
              {(config.about_body ?? '').slice(0, 100) || 'Descripción del publicación…'}
            </div>
          </div>

          <div>
            <div className="font-bold text-[10px] mb-1">Contenido del publicación</div>
            <div className="rounded border border-black/10 px-1.5 py-1 text-[8px] text-black/60">
              Módulo 1 · 4 lecciones
            </div>
            <div className="rounded border border-black/10 px-1.5 py-1 mt-1 text-[8px] text-black/60">
              Módulo 2 · 6 lecciones
            </div>
          </div>

          {(instructorName || instructorPhoto) && (
            <div>
              <div className="font-bold text-[10px] mb-1">Sobre el productor</div>
              <div className="flex gap-1.5 items-center rounded border border-black/10 p-1.5">
                {instructorPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={instructorPhoto} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full" style={{ background: `${primary}40` }} />
                )}
                <div>
                  <div className="text-[9px] font-bold">{instructorName ?? 'Tu nombre'}</div>
                  {instructorRole && <div className="text-[8px] text-black/50">{instructorRole}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Testimonios — solo primeros 2 en mini */}
          {(config.testimonials ?? []).length > 0 && (
            <div>
              <div className="font-bold text-[10px] mb-1">Lo que dicen los alumnos</div>
              <div className="grid grid-cols-2 gap-1">
                {(config.testimonials ?? []).slice(0, 2).map((t, i) => (
                  <div key={i} className="rounded border border-black/10 p-1.5">
                    <div className="text-yellow-500 text-[8px]">{'★'.repeat(t.rating ?? 5)}</div>
                    <p className="text-[8px] text-black/70 italic line-clamp-2 mt-0.5">"{t.text}"</p>
                    <div className="flex items-center gap-1 mt-1 pt-1 border-t border-black/5">
                      {t.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.photo_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <div className="w-4 h-4 rounded-full" style={{ background: `${primary}40` }} />
                      )}
                      <span className="text-[8px] font-semibold">{t.name}</span>
                    </div>
                  </div>
                ))}
              </div>
              {(config.testimonials ?? []).length > 2 && (
                <p className="text-[7px] text-black/40 mt-0.5">+{(config.testimonials ?? []).length - 2} más en la landing real</p>
              )}
            </div>
          )}

          {/* Bonuses */}
          {(config.bonuses ?? []).length > 0 && (
            <div className="rounded border-2 border-dashed p-1.5" style={{ borderColor: `${primary}50`, background: `${primary}08` }}>
              <div className="font-bold text-[10px] mb-1">🎁 Bonus que te llevás ({(config.bonuses ?? []).length})</div>
              <ul className="space-y-0.5">
                {(config.bonuses ?? []).slice(0, 3).map((b, i) => (
                  <li key={i} className="text-[8px] text-black/70 line-clamp-1">• {b.title}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Offer */}
          {config.offer_text && (
            <div className="rounded bg-amber-50 border-2 border-amber-300 p-1.5 text-center">
              <p className="text-[8px] text-amber-900 font-semibold line-clamp-2">{config.offer_text}</p>
            </div>
          )}

          {/* FAQ count */}
          {(config.faq ?? []).length > 0 && (
            <div>
              <div className="font-bold text-[10px] mb-1">❓ Preguntas frecuentes ({(config.faq ?? []).length})</div>
              <div className="space-y-0.5">
                {(config.faq ?? []).slice(0, 2).map((q, i) => (
                  <div key={i} className="rounded border border-black/10 px-1.5 py-1 text-[8px] text-black/70 line-clamp-1">
                    {q.q}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar sticky precio */}
        <div className="col-span-1">
          <div className="rounded border border-black/15 bg-white p-1.5 space-y-1.5 shadow-sm">
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="w-full aspect-video rounded object-cover" />
            )}
            <div>
              <div className="text-base font-bold leading-none">
                {priceCents === 0 ? 'Gratis' : `$${(priceCents / 100).toLocaleString('es-AR')}`}
              </div>
              <div className="text-[8px] text-black/50">{currency} · pago único</div>
            </div>
            <div className="rounded text-white text-[8px] py-1 text-center font-semibold" style={{ background: primary }}>
              {(config.cta_label ?? 'Continuar al pago').slice(0, 24)}
            </div>
            {ctaCaption && <div className="text-[7px] text-black/55 text-center line-clamp-2">{ctaCaption}</div>}
            <div className="rounded bg-black/[0.04] p-1 text-[7px]">
              <div className="font-bold flex items-center gap-0.5">🛡️ {garantiaDias}d garantía</div>
              {garantiaText && <div className="text-black/55 line-clamp-2 mt-0.5">{garantiaText}</div>}
            </div>
            <ul className="text-[7px] space-y-0.5">
              {trustBadges.map((b, i) => (
                <li key={i} className="flex items-center gap-1">
                  <span style={{ color: primary }}>✓</span>
                  <span className="text-black/65 line-clamp-1">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Classic preview ─────────── */

function ClassicPreview({
  courseTitle, coverUrl, priceCents, currency, primary
}: {
  courseTitle: string;
  coverUrl: string | null;
  priceCents: number;
  currency: string;
  primary: string;
}) {
  return (
    <div className="p-3 text-[10px] grid grid-cols-3 gap-2">
      <div className="col-span-2 space-y-1.5">
        <div className="text-sm font-bold leading-tight line-clamp-2">{courseTitle}</div>
        <div className="text-black/60 text-[9px] leading-tight">Descripción del publicación aparece acá…</div>
        <div className="mt-2">
          <div className="font-semibold text-[10px] mb-1">Contenido del publicación</div>
          <div className="rounded border border-black/10 px-1.5 py-1 text-[8px] text-black/60">Módulo 1 · 4 lecciones</div>
          <div className="rounded border border-black/10 px-1.5 py-1 mt-1 text-[8px] text-black/60">Módulo 2 · 6 lecciones</div>
        </div>
      </div>
      <div className="col-span-1">
        <div className="rounded border border-black/15 p-1.5 space-y-1.5">
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="w-full aspect-video rounded object-cover" />
          )}
          <div className="text-base font-bold leading-none">
            {priceCents === 0 ? 'Gratis' : `$${(priceCents / 100).toLocaleString('es-AR')}`}
          </div>
          <div className="text-[8px] text-black/50">{currency} · pago único</div>
          <div className="rounded text-white text-[8px] py-1 text-center font-semibold" style={{ background: primary }}>
            Comprar publicación
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Funnel preview ─────────── */

function FunnelPreview({
  config, courseTitle, coverUrl, priceCents, currency, primary
}: {
  config: LandingConfig;
  courseTitle: string;
  coverUrl: string | null;
  priceCents: number;
  currency: string;
  primary: string;
}) {
  const headline = config.headline?.trim() || courseTitle;
  const eyebrow = config.eyebrow?.trim();
  const ctaLabel = config.cta_label?.trim() || 'Quiero entrar AHORA';
  const heroImg = config.hero_image_url || coverUrl;
  return (
    <div className="text-[10px]">
      {/* Urgencia bar */}
      {config.offer_text && (
        <div className="text-white text-center py-1 px-2 text-[8px] font-bold" style={{ background: primary }}>
          {config.offer_text.slice(0, 50)}
        </div>
      )}
      {/* Hero centered */}
      <div className="p-3 text-center">
        {eyebrow && (
          <span className="inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ background: `${primary}15`, color: primary }}>
            {eyebrow.slice(0, 30)}
          </span>
        )}
        <div className="mt-1.5 text-sm font-black leading-tight">{headline}</div>
        <div className="mt-2 rounded text-white text-[9px] py-1.5 font-bold" style={{ background: primary }}>{ctaLabel}</div>
      </div>
      {/* Video placeholder */}
      {heroImg && (
        <div className="mx-3 mb-2 aspect-video rounded overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-white/95 flex items-center justify-center" style={{ color: primary }}>▶</div>
          </div>
        </div>
      )}
      {/* Stats */}
      <div className="grid grid-cols-3 gap-1 px-3 py-2 border-y border-black/10 bg-black/[0.02] text-center">
        {['+2.400 alumnos', '4.9★', `${config.garantia_dias ?? 7}d garantía`].map((s, i) => (
          <div key={i}>
            <div className="text-[10px] font-black" style={{ color: primary }}>{s.split(' ')[0]}</div>
            <div className="text-[7px] text-black/55">{s.split(' ').slice(1).join(' ')}</div>
          </div>
        ))}
      </div>
      {/* Bullets */}
      <div className="p-3 space-y-1">
        {(config.learn_points ?? []).slice(0, 3).map((p, i) => (
          <div key={i} className="flex gap-1 text-[8px]">
            <span className="shrink-0 mt-0.5 w-2.5 h-2.5 rounded-full text-white text-[6px] flex items-center justify-center" style={{ background: primary }}>✓</span>
            <span className="text-black/75 line-clamp-1">{p}</span>
          </div>
        ))}
        <div className="rounded text-white text-[8px] py-1 mt-2 text-center font-bold" style={{ background: primary }}>
          {ctaLabel.slice(0, 24)}
        </div>
      </div>
      {/* Bonuses */}
      {(config.bonuses ?? []).length > 0 && (
        <div className="mx-3 mb-3 rounded border-2 border-dashed p-1.5" style={{ borderColor: `${primary}50` }}>
          <div className="text-[9px] font-bold">🎁 {(config.bonuses ?? []).length} bonus incluidos</div>
        </div>
      )}
      {/* CTA final */}
      <div className="text-white text-center p-3 mt-2" style={{ background: primary }}>
        <div className="text-[10px] font-black">🚀 Última oportunidad</div>
        <div className="text-[8px] text-white/90 mt-0.5">
          {priceCents === 0 ? 'GRATIS' : `$${(priceCents / 100).toLocaleString('es-AR')} ${currency}`}
        </div>
      </div>
    </div>
  );
}

/* ─────────── VSL preview ─────────── */

function VslPreview({
  config, courseTitle, priceCents, currency, primary
}: {
  config: LandingConfig;
  courseTitle: string;
  priceCents: number;
  currency: string;
  primary: string;
}) {
  const headline = config.headline?.trim() || courseTitle;
  const eyebrow = config.eyebrow?.trim();
  const unlockS = config.vsl_unlock_seconds ?? 60;
  const steps = config.multistep_form ?? [];
  return (
    <div className="text-[10px]">
      {/* Hero compacto */}
      <div className="p-3 text-center">
        {eyebrow && (
          <span className="inline-block text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full" style={{ background: `${primary}15`, color: primary }}>
            {eyebrow.slice(0, 32)}
          </span>
        )}
        <div className="mt-1.5 text-sm font-black leading-tight line-clamp-2">{headline}</div>
      </div>
      {/* Video placeholder */}
      <div className="mx-3 mb-2 aspect-video rounded bg-black flex items-center justify-center">
        <div className="text-white text-2xl">▶</div>
      </div>
      {/* Gating bar */}
      <div className="mx-3 rounded p-2 mb-3" style={{ background: `${primary}10`, border: `1px solid ${primary}40` }}>
        <div className="text-[8px] font-bold flex items-center gap-1" style={{ color: primary }}>
          🔒 Desbloqueando en {unlockS}s…
        </div>
        <div className="h-1 rounded-full bg-black/10 mt-1 overflow-hidden">
          <div className="h-full" style={{ width: '30%', background: primary }} />
        </div>
      </div>
      {/* Form multistep preview */}
      {steps.length > 0 && (
        <div className="mx-3 mb-3 rounded border-2 p-2" style={{ borderColor: primary }}>
          <div className="flex items-center justify-between text-[8px] text-black/55 mb-1.5">
            <span>Paso 1 de {steps.length}</span>
            <div className="flex gap-0.5">
              {steps.map((_, i) => (
                <div key={i} className="w-3 h-0.5 rounded" style={{ background: i === 0 ? primary : '#0001' }} />
              ))}
            </div>
          </div>
          <div className="text-[9px] font-bold mb-1.5">{steps[0]?.label ?? '¿Cuál es tu nombre?'}</div>
          <div className="h-6 rounded border border-black/15 bg-white" />
          <div className="rounded text-white text-[8px] py-1 mt-1.5 text-center font-bold" style={{ background: primary }}>
            Siguiente →
          </div>
        </div>
      )}
      {/* CTA preview */}
      <div className="mx-3 mb-3 rounded border-2 border-black/15 p-2 text-center">
        <div className="text-base font-black">
          {priceCents === 0 ? 'Gratis' : `$${(priceCents / 100).toLocaleString('es-AR')}`}
        </div>
        <div className="text-[7px] text-black/55">{currency} · pago único</div>
        <div className="rounded text-white text-[8px] py-1 mt-1.5 font-bold" style={{ background: primary }}>
          {(config.cta_label ?? 'Reservar mi lugar').slice(0, 24)}
        </div>
      </div>
    </div>
  );
}
