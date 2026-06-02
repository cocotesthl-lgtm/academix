'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCourseAction } from '@/lib/courses/actions';
import {
  type LandingTemplate,
  type LandingConfig,
  TEMPLATE_LABELS,
  defaultsForTemplate
} from '@/lib/courses/landing';
import { LandingPreview } from '@/components/owner/courses/LandingPreview';

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

  // El editor edita siempre la variante activa
  const currentTemplate = activeVariant === 'A' ? template : (variants[activeVariant]?.template ?? 'hotmart');
  const currentConfig = activeVariant === 'A' ? config : (variants[activeVariant]?.config ?? {});

  function setCurrentTemplate(t: LandingTemplate) {
    if (activeVariant === 'A') setTemplate(t);
    else setVariants((vs) => ({ ...vs, [activeVariant]: { template: t, config: vs[activeVariant]?.config ?? {} } }));
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

  function applyTemplateDefaults() {
    const defaults = defaultsForTemplate(currentTemplate, courseTitle);
    setCurrentConfig(defaults);
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
          <div className="grid md:grid-cols-2 gap-2">
            {(Object.entries(TEMPLATE_LABELS) as Array<[LandingTemplate, typeof TEMPLATE_LABELS[LandingTemplate]]>).map(([k, meta]) => {
              const disabled = k === 'vsl';
              return (
                <button
                  key={k}
                  type="button"
                  disabled={disabled}
                  onClick={() => setCurrentTemplate(k)}
                  className={`text-left rounded-lg border p-3 transition ${
                    tplForView === k
                      ? 'border-fuchsia-400 bg-fuchsia-500/10'
                      : disabled
                        ? 'border-white/10 bg-white/[0.02] opacity-50 cursor-not-allowed'
                        : 'border-white/15 bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{meta.emoji}</span>
                    <span className="font-semibold text-sm">{meta.label}</span>
                    {disabled && <span className="text-[10px] text-white/40 ml-auto">próximamente</span>}
                  </div>
                  <p className="text-xs text-white/55 mt-1.5 leading-snug">{meta.description}</p>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
            <button
              type="button"
              onClick={applyTemplateDefaults}
              className="text-xs rounded border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 px-3 py-1.5 hover:bg-fuchsia-500/20"
            >
              🪄 Cargar contenido de muestra
            </button>
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

        {tplForView === 'classic' && (
          <p className="text-sm text-white/55 rounded border border-white/10 bg-white/[0.02] p-4">
            La plantilla <strong>Clásica</strong> usa la info básica del curso (título, descripción,
            portada, precio). No tiene campos extra. Si querés más control visual, elegí <strong>Hotmart</strong>.
          </p>
        )}

        {tplForView === 'vsl' && (
          <p className="text-sm text-amber-200 rounded border border-amber-500/30 bg-amber-500/5 p-4">
            ⚠️ La plantilla VSL (video sales letter con gating + form multi-paso) viene en el próximo
            sprint. Ya quedó la estructura en DB lista para cuando se implemente el render.
          </p>
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
