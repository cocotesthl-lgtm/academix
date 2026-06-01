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
export function LandingEditor({
  courseId,
  courseTitle,
  initialTemplate,
  initialConfig,
  courseCoverUrl,
  coursePriceCents,
  courseCurrency,
  primaryColor
}: {
  courseId: string;
  courseTitle: string;
  initialTemplate: LandingTemplate;
  initialConfig: LandingConfig;
  courseCoverUrl: string | null;
  coursePriceCents: number;
  courseCurrency: string;
  primaryColor: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [template, setTemplate] = useState<LandingTemplate>(initialTemplate);
  const [config, setConfig] = useState<LandingConfig>(initialConfig);

  function field<K extends keyof LandingConfig>(key: K, value: LandingConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function applyTemplateDefaults() {
    const defaults = defaultsForTemplate(template, courseTitle);
    // Pisa todo lo actual (es lo que pide el user con "cargar contenido de muestra")
    setConfig(defaults);
  }

  function save() {
    const fd = new FormData();
    fd.set('id', courseId);
    fd.set('title', courseTitle);
    fd.set('landing_template', template);
    fd.set('landing_config', JSON.stringify(config));
    start(async () => {
      await updateCourseAction(null, fd);
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-4">
        {/* Selector de template */}
        <div>
          <h3 className="text-sm font-bold text-white/80 mb-2">Plantilla de la landing</h3>
          <div className="grid md:grid-cols-2 gap-2">
            {(Object.entries(TEMPLATE_LABELS) as Array<[LandingTemplate, typeof TEMPLATE_LABELS[LandingTemplate]]>).map(([k, meta]) => {
              const disabled = k === 'vsl';
              return (
                <button
                  key={k}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTemplate(k)}
                  className={`text-left rounded-lg border p-3 transition ${
                    template === k
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
          <button
            type="button"
            onClick={applyTemplateDefaults}
            className="mt-2 text-xs rounded border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 px-3 py-1.5 hover:bg-fuchsia-500/20"
          >
            🪄 Cargar contenido de muestra para {TEMPLATE_LABELS[template].label}
          </button>
          <p className="text-[10px] text-white/40 mt-1.5">
            Pisa todos los campos con contenido de ejemplo realista. Después editás a tu gusto.
          </p>
        </div>

        {template === 'classic' && (
          <p className="text-sm text-white/55 rounded border border-white/10 bg-white/[0.02] p-4">
            La plantilla <strong>Clásica</strong> usa la info básica del curso (título, descripción,
            portada, precio). No tiene campos extra. Si querés más control visual, elegí <strong>Hotmart</strong>.
          </p>
        )}

        {template === 'vsl' && (
          <p className="text-sm text-amber-200 rounded border border-amber-500/30 bg-amber-500/5 p-4">
            ⚠️ La plantilla VSL (video sales letter con gating + form multi-paso) viene en el próximo
            sprint. Ya quedó la estructura en DB lista para cuando se implemente el render.
          </p>
        )}

        {/* Todos los editores cuando NO es classic ni vsl */}
        {(template === 'hotmart' || template === 'funnel') && (
          <div className="space-y-3">
            <Section title="🎯 Hero / banner" defaultOpen>
              <FieldText label="Eyebrow (pill arriba del título)" value={config.eyebrow ?? ''} onChange={(v) => field('eyebrow', v)} placeholder="Ej: 🔥 50% OFF · termina hoy" />
              <FieldText label="Headline custom (vacío = título del curso)" value={config.headline ?? ''} onChange={(v) => field('headline', v)} placeholder={courseTitle} />
              <FieldTextarea label="Subtítulo (texto bajo el título)" value={config.subtitle ?? ''} onChange={(v) => field('subtitle', v)} rows={2} />
              <FieldUrl label="URL del banner principal" value={config.hero_image_url ?? ''} onChange={(v) => field('hero_image_url', v)} hint="Recomendado: 2400×1200px panorámico" />
              <div className="grid grid-cols-2 gap-3">
                <FieldText label="Texto del CTA" value={config.cta_label ?? ''} onChange={(v) => field('cta_label', v)} placeholder="Comprar curso" />
                <FieldText label="Caption bajo el CTA" value={config.cta_caption ?? ''} onChange={(v) => field('cta_caption', v)} placeholder="7 días de garantía" />
              </div>
            </Section>

            <Section title="✅ Qué vas a aprender (bullets)">
              <ListEditor
                items={config.learn_points ?? []}
                onChange={(arr) => field('learn_points', arr)}
                placeholder="Ej: Fundamentos completos desde cero"
              />
            </Section>

            <Section title="📖 Sobre el curso (descripción extendida)">
              <FieldTextarea label="Cuerpo del 'sobre este producto'" value={config.about_body ?? ''} onChange={(v) => field('about_body', v)} rows={6} />
            </Section>

            <Section title="👤 Instructor / productor">
              <div className="grid grid-cols-2 gap-3">
                <FieldText label="Nombre" value={config.instructor_name ?? ''} onChange={(v) => field('instructor_name', v)} />
                <FieldText label="Rol / credenciales" value={config.instructor_role ?? ''} onChange={(v) => field('instructor_role', v)} placeholder="Ej: +10 años, +2k alumnos" />
              </div>
              <FieldTextarea label="Bio corta" value={config.instructor_bio ?? ''} onChange={(v) => field('instructor_bio', v)} rows={3} />
              <FieldUrl label="URL foto del instructor" value={config.instructor_photo_url ?? ''} onChange={(v) => field('instructor_photo_url', v)} hint="400×400px cuadrada" />
            </Section>

            <Section title="🛡️ Garantía y trust badges">
              <div className="grid grid-cols-2 gap-3">
                <FieldNumber label="Días de garantía" value={config.garantia_dias ?? 7} onChange={(v) => field('garantia_dias', v)} />
                <FieldText label="Texto de garantía corto" value={config.garantia_text ?? ''} onChange={(v) => field('garantia_text', v)} placeholder="100% reembolso sin preguntas" />
              </div>
              <label className="block text-xs text-white/60 mb-1 mt-2">Trust badges (lista del sidebar)</label>
              <ListEditor
                items={config.trust_badges ?? []}
                onChange={(arr) => field('trust_badges', arr)}
                placeholder="Ej: Acceso de por vida"
              />
            </Section>

            <Section title="⭐ Testimonios del curso">
              <TestimonialsEditor
                items={config.testimonials ?? []}
                onChange={(arr) => field('testimonials', arr)}
              />
            </Section>

            <Section title="❓ FAQ (preguntas frecuentes)">
              <FaqEditor
                items={config.faq ?? []}
                onChange={(arr) => field('faq', arr)}
              />
            </Section>

            <Section title="🎁 Bonus / stack de regalos">
              <BonusEditor
                items={config.bonuses ?? []}
                onChange={(arr) => field('bonuses', arr)}
              />
            </Section>

            <Section title="⏰ Oferta / urgencia">
              <FieldTextarea label="Texto de la oferta" value={config.offer_text ?? ''} onChange={(v) => field('offer_text', v)} rows={2} placeholder="⏰ Esta oferta termina pronto…" />
              <FieldText label="Fecha de fin de la oferta (ISO, opcional)" value={config.offer_ends_at ?? ''} onChange={(v) => field('offer_ends_at', v)} placeholder="2026-12-31T23:59:59Z" />
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
          template={template}
          config={config}
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
