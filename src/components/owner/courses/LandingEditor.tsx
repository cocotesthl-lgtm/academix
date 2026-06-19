'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCourseAction } from '@/lib/courses/actions';
import {
  type LandingTemplate,
  type LandingConfig,
  TEMPLATE_LABELS,
  defaultsForTemplate,
  parseVideoUrl
} from '@/lib/courses/landing';
import { LandingPreview } from '@/components/owner/courses/LandingPreview';
import { TemplateMockup } from '@/components/owner/courses/TemplateMockup';

/**
 * Editor de la landing del curso con TODAS las secciones editables
 * (hero, learn_points, about, instructor, trust, testimonios, FAQ,
 * bonuses, offer). Cada sección colapsable para no abrumar.
 * Preview en vivo a la derecha que se actualiza en tiempo real.
 */
type VariantKey = 'A' | 'B' | 'C';
type VariantData = { template: LandingTemplate; config: LandingConfig };
type VariantsMap = Partial<Record<'B' | 'C', VariantData>>;

export function LandingEditor({
  courseId,
  courseTitle,
  courseSlug,
  initialTemplate,
  initialConfig,
  initialVariants,
  courseCoverUrl,
  coursePriceCents,
  courseCurrency,
  primaryColor,
  storefrontOrigin
}: {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  initialTemplate: LandingTemplate;
  initialConfig: LandingConfig;
  initialVariants: VariantsMap | null;
  courseCoverUrl: string | null;
  coursePriceCents: number;
  courseCurrency: string;
  primaryColor: string;
  /** Para mostrar el link "Ver landing real" al lado de cada variante */
  storefrontOrigin: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  // Variante activa (A = visible público; B, C = alternativas para afiliados)
  const [activeVariant, setActiveVariant] = useState<VariantKey>('A');

  // Estado para cada variante. A vive en (template, config); B/C viven en variants.
  const [template, setTemplate] = useState<LandingTemplate>(initialTemplate);
  const [config, setConfig] = useState<LandingConfig>(initialConfig);

  const [variants, setVariants] = useState<VariantsMap>(initialVariants ?? {});

  // Modal "vacía vs con muestra" cuando el owner cambia el template
  const [pendingTemplate, setPendingTemplate] = useState<LandingTemplate | null>(null);

  // El editor edita siempre la variante activa
  const currentTemplate = activeVariant === 'A' ? template : (variants[activeVariant]?.template ?? 'hotmart');
  const currentConfig = activeVariant === 'A' ? config : (variants[activeVariant]?.config ?? {});

  function setCurrentTemplate(t: LandingTemplate) {
    if (activeVariant === 'A') setTemplate(t);
    else setVariants((vs) => ({ ...vs, [activeVariant]: { template: t, config: vs[activeVariant]?.config ?? {} } }));
  }

  /** Cuando el owner clickea una plantilla, abrimos un modal preguntando si
   *  la quiere vacía o con contenido de muestra precargado.
   *  Si es la misma que ya tiene, no preguntamos. */
  function chooseTemplate(t: LandingTemplate) {
    if (t === currentTemplate) return;
    setPendingTemplate(t);
  }
  /** Aplica el template pendiente con (sample=true) o sin (sample=false) contenido de muestra. */
  function applyPending(withSample: boolean) {
    if (!pendingTemplate) return;
    setCurrentTemplate(pendingTemplate);
    setCurrentConfig(withSample ? defaultsForTemplate(pendingTemplate, courseTitle) : {});
    setPendingTemplate(null);
  }

  function setCurrentConfig(newConfig: LandingConfig | ((c: LandingConfig) => LandingConfig)) {
    if (activeVariant === 'A') {
      setConfig((c) => typeof newConfig === 'function' ? newConfig(c) : newConfig);
    } else {
      setVariants((vs) => {
        const prev = vs[activeVariant]?.config ?? {};
        const next = typeof newConfig === 'function' ? newConfig(prev) : newConfig;
        return { ...vs, [activeVariant]: { template: vs[activeVariant]?.template ?? 'hotmart', config: next } };
      });
    }
  }

  function field<K extends keyof LandingConfig>(key: K, value: LandingConfig[K]) {
    setCurrentConfig((c) => ({ ...c, [key]: value }));
  }

  function enableVariant(key: 'B' | 'C') {
    // Cuando habilitan B o C por primera vez, pre-cargamos con defaults
    // (el owner pidió: contenido ya cargado, no botón).
    if (variants[key]) {
      setActiveVariant(key);
      return;
    }
    const defaultTpl: LandingTemplate = key === 'B' ? 'funnel' : 'classic';
    setVariants((vs) => ({
      ...vs,
      [key]: { template: defaultTpl, config: defaultsForTemplate(defaultTpl, courseTitle) }
    }));
    setActiveVariant(key);
  }

  function removeVariant(key: 'B' | 'C') {
    setVariants((vs) => {
      const next = { ...vs };
      delete next[key];
      return next;
    });
    setActiveVariant('A');
  }

  function save() {
    const fd = new FormData();
    fd.set('id', courseId);
    fd.set('title', courseTitle);
    // Versión A → columnas landing_template + landing_config
    fd.set('landing_template', template);
    fd.set('landing_config', JSON.stringify(config));
    // B y C → landing_variants (null si está vacío)
    const cleanVariants: VariantsMap = {};
    if (variants.B) cleanVariants.B = variants.B;
    if (variants.C) cleanVariants.C = variants.C;
    fd.set('landing_variants', Object.keys(cleanVariants).length > 0 ? JSON.stringify(cleanVariants) : '');
    start(async () => {
      await updateCourseAction(null, fd);
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    });
  }

  /* Alias para mantener el resto del JSX usando 'template'/'config' como antes */
  const tplForView = currentTemplate;
  const cfgForView = currentConfig;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-4">
        {/* ─── Tabs de variantes A/B/C ─── */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <VariantTab
              label="🟢 Visible (A)"
              hint="lo que ve todo el mundo por default"
              active={activeVariant === 'A'}
              onClick={() => setActiveVariant('A')}
            />
            <VariantTab
              label="🅱️ Versión B"
              hint={variants.B ? 'editar variante B' : 'crear variante B'}
              active={activeVariant === 'B'}
              empty={!variants.B}
              onClick={() => enableVariant('B')}
              onRemove={variants.B ? () => removeVariant('B') : undefined}
            />
            <VariantTab
              label="🅲 Versión C"
              hint={variants.C ? 'editar variante C' : 'crear variante C'}
              active={activeVariant === 'C'}
              empty={!variants.C}
              onClick={() => enableVariant('C')}
              onRemove={variants.C ? () => removeVariant('C') : undefined}
            />
          </div>
          <p className="text-[11px] text-white/55 mt-2 leading-snug px-1">
            <strong className="text-white/80">Visible (A)</strong> es la landing pública por default.{' '}
            <strong className="text-white/80">B</strong> y <strong className="text-white/80">C</strong> son
            alternativas que los afiliados pueden elegir en sus links{' '}
            (<code className="text-[10px] bg-white/5 px-1 rounded">?v=B</code> o{' '}
            <code className="text-[10px] bg-white/5 px-1 rounded">?v=C</code>) para A/B/C testing.
          </p>
        </div>

        {/* Selector de template (de la variante activa) */}
        <div>
          <h3 className="text-sm font-bold text-white/80 mb-2">
            Plantilla {activeVariant !== 'A' && <span className="text-fuchsia-300">— editando variante {activeVariant}</span>}
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {(Object.entries(TEMPLATE_LABELS) as Array<[LandingTemplate, typeof TEMPLATE_LABELS[LandingTemplate]]>).map(([k, meta]) => {
              const isSelected = tplForView === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => chooseTemplate(k)}
                  className={`text-left rounded-lg border p-3 transition relative ${
                    isSelected
                      ? 'border-fuchsia-400 bg-fuchsia-500/10 ring-1 ring-fuchsia-400/40'
                      : 'border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/25'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wide bg-fuchsia-400 text-black font-bold px-1.5 py-0.5 rounded">
                      Activa
                    </span>
                  )}
                  <TemplateMockup template={k} primary={primaryColor} />
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-lg leading-none">{meta.emoji}</span>
                    <span className="font-semibold text-sm">{meta.label}</span>
                  </div>
                  <p className="text-[11px] text-white/55 mt-1 leading-snug">{meta.description}</p>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-end mt-2">
            <a
              href={`${storefrontOrigin}/c/${courseSlug}${activeVariant === 'A' ? '' : `?v=${activeVariant}`}`}
              target="_blank"
              rel="noopener"
              className="text-xs text-white/60 hover:text-white underline-offset-2 hover:underline"
            >
              Ver landing real {activeVariant !== 'A' && `(?v=${activeVariant})`} →
            </a>
          </div>
        </div>

        {/* Modal "vacía vs con muestra" cuando el owner clickea cambiar template */}
        {pendingTemplate && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPendingTemplate(null)}
          >
            <div
              className="w-full max-w-md rounded-xl border border-white/15 bg-[#111] shadow-2xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h2 className="text-lg font-bold">
                  {TEMPLATE_LABELS[pendingTemplate].emoji} Cambiar a {TEMPLATE_LABELS[pendingTemplate].label}
                </h2>
                <p className="text-sm text-white/65 mt-2 leading-relaxed">
                  ¿Cómo querés arrancar esta plantilla? Cualquier opción reemplaza el contenido
                  que tenés ahora en esta variante.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => applyPending(true)}
                  className="w-full text-left rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-4 hover:bg-emerald-500/20"
                >
                  <div className="font-semibold text-sm flex items-center gap-2">
                    ✨ Con contenido de muestra <span className="text-[10px] text-emerald-300 ml-auto">recomendado</span>
                  </div>
                  <p className="text-xs text-white/65 mt-1.5">
                    Llena todos los campos con textos, testimonios, FAQ, bonus y colores listos
                    para que solo cambies nombres. Lo más rápido para empezar.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => applyPending(false)}
                  className="w-full text-left rounded-lg border border-white/15 bg-white/[0.02] p-4 hover:bg-white/[0.05]"
                >
                  <div className="font-semibold text-sm">📄 Vacía</div>
                  <p className="text-xs text-white/55 mt-1.5">
                    Solo cambia la plantilla. Empezás con todos los campos vacíos para llenar a tu gusto.
                  </p>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPendingTemplate(null)}
                className="w-full text-sm text-white/50 hover:text-white py-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Visibilidad universal (todos los templates) */}
        <Section title="👁 Visibilidad del header/footer del storefront">
          <label className="flex items-center gap-2 text-sm text-white/85 cursor-pointer">
            <input
              type="checkbox"
              checked={cfgForView.hide_nav ?? false}
              onChange={(e) => field('hide_nav', e.target.checked)}
            />
            Ocultar menú/nav superior en esta landing
          </label>
          <label className="flex items-center gap-2 text-sm text-white/85 cursor-pointer">
            <input
              type="checkbox"
              checked={cfgForView.hide_footer ?? false}
              onChange={(e) => field('hide_footer', e.target.checked)}
            />
            Ocultar footer en esta landing
          </label>
          <p className="text-[10px] text-white/40 leading-snug">
            Ideal para landings sin distracciones (tipo VSL o funnel directo a venta). Solo afecta
            esta landing puntual, no el resto del storefront.
          </p>
        </Section>

        {/* Colores (override del brand del tenant solo para esta landing) */}
        <Section title="🎨 Colores de esta landing">
          <p className="text-xs text-white/55 leading-snug mb-2">
            Estos colores reemplazan los del storefront solo para esta landing puntual. Útil
            para VSLs que necesitan look diferente al resto del sitio (ej: negro + dorado).
          </p>
          <div className="grid grid-cols-3 gap-2">
            <ColorPicker label="Fondo" value={cfgForView.bg_color ?? ''} onChange={(v) => field('bg_color', v)} defaultColor="#ffffff" />
            <ColorPicker label="Texto" value={cfgForView.text_color ?? ''} onChange={(v) => field('text_color', v)} defaultColor="#0a0a0a" />
            <ColorPicker label="Acento (CTAs)" value={cfgForView.accent_color ?? ''} onChange={(v) => field('accent_color', v)} defaultColor="#a855f7" />
          </div>
        </Section>

        {tplForView === 'classic' && (
          <p className="text-sm text-white/55 rounded border border-white/10 bg-white/[0.02] p-4">
            La plantilla <strong>Clásica</strong> usa la info básica del curso (título, descripción,
            portada, precio). No tiene campos extra. Si querés más control visual, elegí <strong>Hotmart</strong>.
          </p>
        )}

        {/* Editor específico de VSL */}
        {tplForView === 'vsl' && (
          <div className="space-y-3">
            <Section title="🎥 Video + gating VSL" defaultOpen>
              <VideoUrlField
                value={cfgForView.vsl_video_id ?? ''}
                onChange={(url, parsed) => {
                  // Guardamos la URL completa en vsl_video_id (el render parsea
                  // de vuelta para sacar el ID). Provider se guarda explícito
                  // por si querés overridear.
                  field('vsl_video_id', url);
                  if (parsed) field('vsl_video_provider', parsed.provider);
                }}
              />
              <FieldNumber label="Desbloquear después de (segundos)" value={cfgForView.vsl_unlock_seconds ?? 60} onChange={(v) => field('vsl_unlock_seconds', v)} />
              <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfgForView.vsl_form_after_watch ?? true}
                  onChange={(e) => field('vsl_form_after_watch', e.target.checked)}
                />
                Después del video, mostrar form multipaso antes del CTA
              </label>
              <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfgForView.vsl_block_pause ?? true}
                  onChange={(e) => field('vsl_block_pause', e.target.checked)}
                />
                Modo VSL bloqueado (oculta controles + bloquea pause con click)
              </label>
              <p className="text-[10px] text-white/40 leading-snug">
                ⚠️ En YouTube el spacebar igual pausa (limitación pública). Para 100% control
                usá Vimeo Plus, Wistia o Bunny Stream. Con el modo bloqueado activo, hay un
                botón ▶ inicial (los browsers exigen click del usuario para autoplay) y después
                del play no se puede clickear el video.
              </p>
            </Section>

            <Section title="📝 Form multipaso (campos)">
              <MultiStepFormEditor
                items={cfgForView.multistep_form ?? []}
                onChange={(arr) => field('multistep_form', arr)}
              />
            </Section>

            <Section title="🎚️ Gating progresivo (revelar secciones en el tiempo)">
              <p className="text-xs text-white/55 leading-snug mb-2">
                Cada sección aparece cuando el visitante lleva X segundos viendo el video.
                Dejar vacío (o 0) = la sección es visible desde el inicio (sin gating).
              </p>
              <SectionUnlocksEditor
                unlocks={cfgForView.section_unlocks ?? {}}
                onChange={(u) => field('section_unlocks', u)}
              />
            </Section>

            {/* Compartimos los mismos editores que hotmart/funnel para hero, testimonios, FAQ, garantía */}
            <Section title="🎯 Hero (texto arriba del video)">
              <FieldText label="Eyebrow" value={cfgForView.eyebrow ?? ''} onChange={(v) => field('eyebrow', v)} />
              <FieldText label="Headline custom (vacío = título del curso)" value={cfgForView.headline ?? ''} onChange={(v) => field('headline', v)} placeholder={courseTitle} />
              <FieldTextarea label="Subtítulo" value={cfgForView.subtitle ?? ''} onChange={(v) => field('subtitle', v)} rows={2} />
              <FieldText label="Texto del CTA final" value={cfgForView.cta_label ?? ''} onChange={(v) => field('cta_label', v)} placeholder="Reservar mi lugar" />
              <FieldText label="Caption bajo el CTA" value={cfgForView.cta_caption ?? ''} onChange={(v) => field('cta_caption', v)} placeholder="Acceso inmediato · 7 días garantía" />
            </Section>

            <Section title="🛡️ Garantía">
              <div className="grid grid-cols-2 gap-3">
                <FieldNumber label="Días" value={cfgForView.garantia_dias ?? 7} onChange={(v) => field('garantia_dias', v)} />
                <FieldText label="Texto" value={cfgForView.garantia_text ?? ''} onChange={(v) => field('garantia_text', v)} />
              </div>
            </Section>

            <Section title="⭐ Testimonios">
              <TestimonialsEditor items={cfgForView.testimonials ?? []} onChange={(arr) => field('testimonials', arr)} />
            </Section>

            <Section title="❓ FAQ">
              <FaqEditor items={cfgForView.faq ?? []} onChange={(arr) => field('faq', arr)} />
            </Section>
          </div>
        )}

        {/* Todos los editores cuando NO es classic ni vsl */}
        {(tplForView === 'hotmart' || tplForView === 'funnel') && (
          <div className="space-y-3">
            <Section title="🎯 Hero / banner" defaultOpen>
              <FieldText label="Eyebrow (pill arriba del título)" value={cfgForView.eyebrow ?? ''} onChange={(v) => field('eyebrow', v)} placeholder="Ej: 🔥 50% OFF · termina hoy" />
              <FieldText label="Headline custom (vacío = título del curso)" value={cfgForView.headline ?? ''} onChange={(v) => field('headline', v)} placeholder={courseTitle} />
              <FieldTextarea label="Subtítulo (texto bajo el título)" value={cfgForView.subtitle ?? ''} onChange={(v) => field('subtitle', v)} rows={2} />
              <FieldUrl label="URL del banner principal" value={cfgForView.hero_image_url ?? ''} onChange={(v) => field('hero_image_url', v)} hint="Recomendado: 2400×1200px panorámico" />
              <div className="grid grid-cols-2 gap-3">
                <FieldText label="Texto del CTA" value={cfgForView.cta_label ?? ''} onChange={(v) => field('cta_label', v)} placeholder="Comprar curso" />
                <FieldText label="Caption bajo el CTA" value={cfgForView.cta_caption ?? ''} onChange={(v) => field('cta_caption', v)} placeholder="7 días de garantía" />
              </div>
            </Section>

            <Section title="✅ Qué vas a aprender (bullets)">
              <ListEditor
                items={cfgForView.learn_points ?? []}
                onChange={(arr) => field('learn_points', arr)}
                placeholder="Ej: Fundamentos completos desde cero"
              />
            </Section>

            <Section title="📖 Sobre el curso (descripción extendida)">
              <FieldTextarea label="Cuerpo del 'sobre este producto'" value={cfgForView.about_body ?? ''} onChange={(v) => field('about_body', v)} rows={6} />
            </Section>

            <Section title="👤 Instructor / productor">
              <div className="grid grid-cols-2 gap-3">
                <FieldText label="Nombre" value={cfgForView.instructor_name ?? ''} onChange={(v) => field('instructor_name', v)} />
                <FieldText label="Rol / credenciales" value={cfgForView.instructor_role ?? ''} onChange={(v) => field('instructor_role', v)} placeholder="Ej: +10 años, +2k alumnos" />
              </div>
              <FieldTextarea label="Bio corta" value={cfgForView.instructor_bio ?? ''} onChange={(v) => field('instructor_bio', v)} rows={3} />
              <FieldUrl label="URL foto del instructor" value={cfgForView.instructor_photo_url ?? ''} onChange={(v) => field('instructor_photo_url', v)} hint="400×400px cuadrada" />
            </Section>

            <Section title="🛡️ Garantía y trust badges">
              <div className="grid grid-cols-2 gap-3">
                <FieldNumber label="Días de garantía" value={cfgForView.garantia_dias ?? 7} onChange={(v) => field('garantia_dias', v)} />
                <FieldText label="Texto de garantía corto" value={cfgForView.garantia_text ?? ''} onChange={(v) => field('garantia_text', v)} placeholder="100% reembolso sin preguntas" />
              </div>
              <label className="block text-xs text-white/60 mb-1 mt-2">Trust badges (lista del sidebar)</label>
              <ListEditor
                items={cfgForView.trust_badges ?? []}
                onChange={(arr) => field('trust_badges', arr)}
                placeholder="Ej: Acceso de por vida"
              />
            </Section>

            <Section title="⭐ Testimonios del curso">
              <TestimonialsEditor
                items={cfgForView.testimonials ?? []}
                onChange={(arr) => field('testimonials', arr)}
              />
            </Section>

            <Section title="❓ FAQ (preguntas frecuentes)">
              <FaqEditor
                items={cfgForView.faq ?? []}
                onChange={(arr) => field('faq', arr)}
              />
            </Section>

            <Section title="🎁 Bonus / stack de regalos">
              <BonusEditor
                items={cfgForView.bonuses ?? []}
                onChange={(arr) => field('bonuses', arr)}
              />
            </Section>

            <Section title="⏰ Oferta / urgencia">
              <FieldTextarea label="Texto de la oferta" value={cfgForView.offer_text ?? ''} onChange={(v) => field('offer_text', v)} rows={2} placeholder="⏰ Esta oferta termina pronto…" />
              <FieldText label="Fecha de fin de la oferta (ISO, opcional)" value={cfgForView.offer_ends_at ?? ''} onChange={(v) => field('offer_ends_at', v)} placeholder="2026-12-31T23:59:59Z" />
            </Section>
          </div>
        )}

        {/* Botón guardar */}
        <div className="flex items-center gap-3 pt-3 border-t border-white/10 sticky bottom-0 bg-[#0a0a0a] py-3 -mx-1 px-1">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded bg-white text-black px-5 py-2 text-sm font-bold disabled:opacity-40"
          >
            {pending ? 'Guardando…' : '💾 Guardar landing'}
          </button>
          {saved && <span className="text-sm text-emerald-400">✓ Landing actualizada</span>}
        </div>
      </div>

      {/* Preview en vivo */}
      <div>
        <LandingPreview
          template={tplForView}
          config={cfgForView}
          courseTitle={courseTitle}
          coverUrl={courseCoverUrl}
          priceCents={coursePriceCents}
          currency={courseCurrency}
          primary={primaryColor}
        />
      </div>
    </div>
  );
}

/* ─────────── Variant tab ─────────── */

function VariantTab({
  label, hint, active, empty, onClick, onRemove
}: {
  label: string;
  hint: string;
  active: boolean;
  empty?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className={`relative rounded-md flex items-center transition ${
      active
        ? 'bg-fuchsia-500/15 border border-fuchsia-400/50'
        : empty
          ? 'bg-white/[0.02] border border-dashed border-white/15 hover:bg-white/[0.05]'
          : 'bg-white/[0.04] border border-white/15 hover:bg-white/[0.08]'
    }`}>
      <button
        type="button"
        onClick={onClick}
        title={hint}
        className="px-3 py-2 text-sm font-semibold"
      >
        {label}
        {empty && <span className="text-[10px] text-white/40 ml-1.5">+ crear</span>}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Eliminar esta variante"
          className="px-2 text-xs text-white/40 hover:text-red-300 border-l border-white/10"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ─────────── Section collapsible ─────────── */

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-white/10 bg-white/[0.02]" open={defaultOpen}>
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold flex items-center justify-between hover:bg-white/[0.03] rounded-lg">
        <span>{title}</span>
        <span className="text-white/40 text-xs">▼</span>
      </summary>
      <div className="px-4 py-3 space-y-3 border-t border-white/5">
        {children}
      </div>
    </details>
  );
}

/* ─────────── Field primitives ─────────── */

function FieldText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
    </div>
  );
}

function FieldTextarea({ label, value, onChange, rows = 3, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm resize-none" />
    </div>
  );
}

function FieldUrl({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…"
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
      {hint && <p className="text-[10px] text-white/40 mt-0.5">📐 {hint}</p>}
    </div>
  );
}

function FieldNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)} min={0}
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
    </div>
  );
}

/* ─────────── Lista simple (strings) ─────────── */

function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (arr: string[]) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      {items.map((p, i) => (
        <div key={i} className="flex gap-2">
          <input type="text" value={p}
            onChange={(e) => {
              const arr = [...items]; arr[i] = e.target.value; onChange(arr);
            }}
            placeholder={placeholder}
            className="flex-1 rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
          <button type="button"
            onClick={() => {
              const arr = [...items]; arr.splice(i, 1); onChange(arr);
            }}
            className="text-xs text-red-300/70 hover:text-red-300 px-2">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className="text-xs text-fuchsia-300 hover:underline">
        + Agregar
      </button>
    </div>
  );
}

/* ─────────── Testimonios ─────────── */

type Testimonial = NonNullable<LandingConfig['testimonials']>[number];

function TestimonialsEditor({ items, onChange }: { items: Testimonial[]; onChange: (arr: Testimonial[]) => void }) {
  function update(idx: number, patch: Partial<Testimonial>) {
    const arr = [...items]; arr[idx] = { ...arr[idx], ...patch }; onChange(arr);
  }
  function remove(idx: number) {
    const arr = [...items]; arr.splice(idx, 1); onChange(arr);
  }
  function add() {
    onChange([...items, { name: '', role: '', text: '', rating: 5, photo_url: null }]);
  }
  return (
    <div className="space-y-3">
      {items.map((t, i) => (
        <div key={i} className="rounded border border-white/10 p-3 space-y-2 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Testimonio #{i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-xs text-red-300/70 hover:text-red-300">Eliminar</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FieldText label="Nombre" value={t.name} onChange={(v) => update(i, { name: v })} />
            <FieldText label="Rol / ciudad" value={t.role ?? ''} onChange={(v) => update(i, { role: v })} />
          </div>
          <FieldTextarea label="Texto del testimonio" value={t.text} onChange={(v) => update(i, { text: v })} rows={2} />
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <FieldUrl label="URL foto" value={t.photo_url ?? ''} onChange={(v) => update(i, { photo_url: v })} hint="400×400 cuadrada" />
            <FieldNumber label="★ rating (1-5)" value={t.rating ?? 5} onChange={(v) => update(i, { rating: Math.min(5, Math.max(1, v)) })} />
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs rounded border border-white/15 bg-white/5 text-white/70 px-3 py-1.5 hover:bg-white/10">
        + Agregar testimonio
      </button>
    </div>
  );
}

/* ─────────── FAQ ─────────── */

type Faq = NonNullable<LandingConfig['faq']>[number];

function FaqEditor({ items, onChange }: { items: Faq[]; onChange: (arr: Faq[]) => void }) {
  function update(idx: number, patch: Partial<Faq>) {
    const arr = [...items]; arr[idx] = { ...arr[idx], ...patch }; onChange(arr);
  }
  function remove(idx: number) {
    const arr = [...items]; arr.splice(idx, 1); onChange(arr);
  }
  return (
    <div className="space-y-3">
      {items.map((q, i) => (
        <div key={i} className="rounded border border-white/10 p-3 space-y-2 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Pregunta #{i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-xs text-red-300/70 hover:text-red-300">Eliminar</button>
          </div>
          <FieldText label="Pregunta" value={q.q} onChange={(v) => update(i, { q: v })} />
          <FieldTextarea label="Respuesta" value={q.a} onChange={(v) => update(i, { a: v })} rows={3} />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { q: '', a: '' }])} className="text-xs rounded border border-white/15 bg-white/5 text-white/70 px-3 py-1.5 hover:bg-white/10">
        + Agregar pregunta
      </button>
    </div>
  );
}

/* ─────────── Bonus stack ─────────── */

type Bonus = NonNullable<LandingConfig['bonuses']>[number];

function BonusEditor({ items, onChange }: { items: Bonus[]; onChange: (arr: Bonus[]) => void }) {
  function update(idx: number, patch: Partial<Bonus>) {
    const arr = [...items]; arr[idx] = { ...arr[idx], ...patch }; onChange(arr);
  }
  function remove(idx: number) {
    const arr = [...items]; arr.splice(idx, 1); onChange(arr);
  }
  return (
    <div className="space-y-3">
      {items.map((b, i) => (
        <div key={i} className="rounded border border-white/10 p-3 space-y-2 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Bonus #{i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-xs text-red-300/70 hover:text-red-300">Eliminar</button>
          </div>
          <FieldText label="Título del bonus" value={b.title} onChange={(v) => update(i, { title: v })} placeholder="🎁 Plantillas premium" />
          <FieldTextarea label="Descripción" value={b.description} onChange={(v) => update(i, { description: v })} rows={2} />
          <FieldText label="Valor / leyenda (opcional)" value={b.value ?? ''} onChange={(v) => update(i, { value: v })} placeholder="Valor $50 — HOY GRATIS" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { title: '', description: '', value: '' }])} className="text-xs rounded border border-white/15 bg-white/5 text-white/70 px-3 py-1.5 hover:bg-white/10">
        + Agregar bonus
      </button>
    </div>
  );
}

/* ─────────── Section unlocks (gating progresivo VSL) ─────────── */

type UnlocksMap = NonNullable<LandingConfig['section_unlocks']>;
type UnlockKey = 'form' | 'testimonials' | 'bonuses' | 'faq' | 'cta';

const UNLOCK_LABELS: Record<UnlockKey, { label: string; emoji: string; hint: string }> = {
  form:         { emoji: '📝', label: 'Formulario multipaso', hint: 'cuándo aparece el form después del video' },
  testimonials: { emoji: '⭐', label: 'Testimonios',          hint: 'cuándo se revelan las opiniones' },
  bonuses:      { emoji: '🎁', label: 'Bonus stack',           hint: 'cuándo aparece la sección de bonus' },
  faq:          { emoji: '❓', label: 'FAQ',                   hint: 'cuándo se muestran las preguntas frecuentes' },
  cta:          { emoji: '🛒', label: 'Botón de compra',       hint: 'cuándo aparece el CTA de pago final' }
};

function SectionUnlocksEditor({
  unlocks,
  onChange
}: {
  unlocks: UnlocksMap;
  onChange: (u: UnlocksMap) => void;
}) {
  function set(key: UnlockKey, value: number | undefined) {
    const next = { ...unlocks };
    if (value === undefined || value === 0 || Number.isNaN(value)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  }
  return (
    <div className="space-y-2">
      {(Object.keys(UNLOCK_LABELS) as UnlockKey[]).map((k) => {
        const meta = UNLOCK_LABELS[k];
        const cur = unlocks[k];
        return (
          <div key={k} className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.02] px-3 py-2">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm">
                <span>{meta.emoji}</span>
                <span className="font-semibold">{meta.label}</span>
              </div>
              <p className="text-[10px] text-white/40 mt-0.5">{meta.hint}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={cur ?? ''}
                onChange={(e) => set(k, parseInt(e.target.value, 10))}
                placeholder="—"
                className="w-20 rounded bg-white/5 border border-white/15 px-2 py-1 text-sm text-right font-mono"
              />
              <span className="text-xs text-white/40">seg</span>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-white/40">
        Ejemplo: dejá form en 60s, testimonios en 90s, bonus en 150s, FAQ en 180s, CTA en 240s
        para revelar todo progresivamente mientras se reproduce el video.
      </p>
    </div>
  );
}

/* ─────────── Color picker (con default reseteable) ─────────── */

function ColorPicker({
  label,
  value,
  onChange,
  defaultColor
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  defaultColor: string;
}) {
  const active = value || defaultColor;
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={active}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-8 rounded bg-transparent border border-white/15 cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultColor}
          className="flex-1 min-w-0 rounded bg-white/5 border border-white/15 px-2 py-1 text-xs font-mono"
        />
      </div>
      {value && value !== defaultColor && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-[10px] text-white/40 hover:text-white mt-1"
        >
          ↺ default ({defaultColor})
        </button>
      )}
    </div>
  );
}

/* ─────────── Video URL con auto-parse YouTube/Vimeo ─────────── */

function VideoUrlField({
  value,
  onChange
}: {
  value: string;
  onChange: (url: string, parsed: ReturnType<typeof parseVideoUrl>) => void;
}) {
  const parsed = parseVideoUrl(value);
  const providerLabel = parsed?.provider === 'youtube' ? 'YouTube' : parsed?.provider === 'vimeo' ? 'Vimeo' : null;
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">URL del video</label>
      <input
        type="url"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v, parseVideoUrl(v));
        }}
        placeholder="https://www.youtube.com/watch?v=…  o  https://vimeo.com/…"
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm font-mono"
      />
      <div className="mt-1.5 flex items-center justify-between text-[10px]">
        <p className="text-white/40">
          Pegá la URL completa de YouTube o Vimeo. Aceptamos cualquier formato:{' '}
          <code>youtu.be/abc</code>, <code>watch?v=abc</code>, <code>vimeo.com/123</code>, etc.
        </p>
        {value.trim() && (
          parsed ? (
            <span className="text-emerald-400 font-semibold shrink-0 ml-2">
              ✓ {providerLabel}
            </span>
          ) : (
            <span className="text-red-300 font-semibold shrink-0 ml-2">
              ❌ URL no reconocida
            </span>
          )
        )}
      </div>
    </div>
  );
}

/* ─────────── Multistep form (campos del VSL) ─────────── */

type FormStep = NonNullable<LandingConfig['multistep_form']>[number];

function MultiStepFormEditor({ items, onChange }: { items: FormStep[]; onChange: (arr: FormStep[]) => void }) {
  function update(idx: number, patch: Partial<FormStep>) {
    const arr = [...items]; arr[idx] = { ...arr[idx], ...patch }; onChange(arr);
  }
  function remove(idx: number) {
    const arr = [...items]; arr.splice(idx, 1); onChange(arr);
  }
  function move(idx: number, dir: -1 | 1) {
    const arr = [...items];
    const ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    onChange(arr);
  }
  return (
    <div className="space-y-3">
      {items.map((s, i) => (
        <div key={i} className="rounded border border-white/10 p-3 space-y-2 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Paso {i + 1}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-xs text-white/40 hover:text-white disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-xs text-white/40 hover:text-white disabled:opacity-30">↓</button>
              <button type="button" onClick={() => remove(i)} className="text-xs text-red-300/70 hover:text-red-300">Eliminar</button>
            </div>
          </div>
          <FieldText label="Etiqueta (lo que ve el visitante)" value={s.label} onChange={(v) => update(i, { label: v })} placeholder="¿Cuál es tu nombre?" />
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <FieldText label="Nombre del campo (interno)" value={s.name} onChange={(v) => update(i, { name: v.replace(/\s/g, '_').toLowerCase() })} placeholder="name / email / situation" />
            <div>
              <label className="block text-xs text-white/60 mb-1">Tipo</label>
              <select
                value={s.type}
                onChange={(e) => update(i, { type: e.target.value as FormStep['type'] })}
                className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm"
              >
                <option value="text">Texto</option>
                <option value="email">Email</option>
                <option value="tel">Teléfono</option>
                <option value="select">Selección</option>
              </select>
            </div>
          </div>
          {s.type === 'select' && (
            <div>
              <label className="block text-xs text-white/60 mb-1">Opciones (una por línea)</label>
              <textarea
                value={(s.options ?? []).join('\n')}
                onChange={(e) => update(i, { options: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })}
                rows={4}
                placeholder="Recién empiezo&#10;Estoy intentando solo&#10;Ya probé y no funcionó"
                className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm font-mono"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={s.required ?? true}
              onChange={(e) => update(i, { required: e.target.checked })}
            />
            Campo obligatorio
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { label: '', name: `campo_${items.length + 1}`, type: 'text', required: true }])}
        className="text-xs rounded border border-white/15 bg-white/5 text-white/70 px-3 py-1.5 hover:bg-white/10"
      >
        + Agregar paso
      </button>
      <p className="text-[10px] text-white/40">
        Los leads se guardan en la DB y los podés ver desde el panel del owner (en una próxima versión).
      </p>
    </div>
  );
}
