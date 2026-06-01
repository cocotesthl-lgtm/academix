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
 * Editor de la landing del curso. Permite:
 *  1. Elegir template (classic | hotmart | funnel | vsl)
 *  2. Editar overrides comunes (eyebrow, headline, subtitle, CTA, garantía)
 *  3. Editar bullets de "qué vas a aprender"
 *  4. Editar testimonios específicos del curso
 *
 * El JSON se serializa y manda al server vía form action.
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
  /** Datos del curso que el preview muestra como base */
  courseCoverUrl: string | null;
  coursePriceCents: number;
  courseCurrency: string;
  /** Brand primary color del tenant */
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
    setConfig((c) => ({ ...defaults, ...c })); // existing values win
  }

  function save() {
    const fd = new FormData();
    fd.set('id', courseId);
    // Mandamos title vacío para que el server action no nos rechace por "Falta título"
    // — pero también queremos NO sobreescribir otros campos. Mejor solo mandamos
    // los campos de landing y el id; el handler ya respeta el "has" check para
    // otros campos.
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

  // Helpers para listas
  function addLearnPoint() {
    const arr = [...(config.learn_points ?? []), ''];
    field('learn_points', arr);
  }
  function setLearnPoint(idx: number, value: string) {
    const arr = [...(config.learn_points ?? [])];
    arr[idx] = value;
    field('learn_points', arr);
  }
  function removeLearnPoint(idx: number) {
    const arr = [...(config.learn_points ?? [])];
    arr.splice(idx, 1);
    field('learn_points', arr);
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
      {/* Selector de template */}
      <div>
        <h3 className="text-sm font-bold text-white/80 mb-2">Plantilla de la landing</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {(Object.entries(TEMPLATE_LABELS) as Array<[LandingTemplate, typeof TEMPLATE_LABELS[LandingTemplate]]>).map(([k, meta]) => {
            const disabled = k === 'vsl'; // VSL viene en Sprint B
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
        {template !== initialTemplate && (
          <button
            type="button"
            onClick={applyTemplateDefaults}
            className="mt-2 text-xs text-fuchsia-300 hover:underline"
          >
            Cargar contenido de muestra para {TEMPLATE_LABELS[template].label}
          </button>
        )}
      </div>

      {/* Editable fields — solo si NO es classic (que usa course.title/description directo) */}
      {template !== 'classic' && (
        <div className="space-y-4 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-bold text-white/80">Contenido de la landing</h3>

          <FieldText label="Eyebrow (pill arriba del título)" value={config.eyebrow ?? ''} onChange={(v) => field('eyebrow', v)} placeholder="Ej: 🔥 50% OFF · termina hoy" />
          <FieldText label="Headline custom (vacío = título del curso)" value={config.headline ?? ''} onChange={(v) => field('headline', v)} placeholder={courseTitle} />
          <FieldTextarea label="Subtítulo (texto bajo el título)" value={config.subtitle ?? ''} onChange={(v) => field('subtitle', v)} rows={2} />

          <FieldUrl label="URL del banner principal" value={config.hero_image_url ?? ''} onChange={(v) => field('hero_image_url', v)} hint="Recomendado: 2400×1200px (panorámico)" />

          <div className="grid grid-cols-2 gap-3">
            <FieldText label="Texto del botón CTA" value={config.cta_label ?? ''} onChange={(v) => field('cta_label', v)} placeholder="Comprar curso" />
            <FieldText label="Caption bajo el CTA" value={config.cta_caption ?? ''} onChange={(v) => field('cta_caption', v)} placeholder="7 días de garantía" />
          </div>

          {/* Learn points */}
          <div>
            <label className="block text-xs text-white/60 mb-1">Qué vas a aprender (bullets)</label>
            <div className="space-y-1.5">
              {(config.learn_points ?? []).map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={p}
                    onChange={(e) => setLearnPoint(i, e.target.value)}
                    placeholder={`Punto ${i + 1}`}
                    className="flex-1 rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeLearnPoint(i)}
                    className="text-xs text-red-300/70 hover:text-red-300 px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addLearnPoint}
                className="text-xs text-fuchsia-300 hover:underline"
              >
                + Agregar punto
              </button>
            </div>
          </div>

          {/* Garantía */}
          <div>
            <h4 className="text-xs font-semibold text-white/70 mb-1.5 mt-2">Garantía / trust</h4>
            <div className="grid grid-cols-2 gap-3">
              <FieldNumber label="Días de garantía" value={config.garantia_dias ?? 7} onChange={(v) => field('garantia_dias', v)} />
              <FieldText label="Texto de garantía corto" value={config.garantia_text ?? ''} onChange={(v) => field('garantia_text', v)} placeholder="100% reembolso sin preguntas" />
            </div>
          </div>

          {/* Instructor override */}
          <div className="pt-3 border-t border-white/10">
            <h4 className="text-xs font-semibold text-white/70 mb-1.5">Instructor / Productor</h4>
            <div className="grid grid-cols-2 gap-3">
              <FieldText label="Nombre" value={config.instructor_name ?? ''} onChange={(v) => field('instructor_name', v)} />
              <FieldText label="Rol / credenciales" value={config.instructor_role ?? ''} onChange={(v) => field('instructor_role', v)} placeholder="Ej: +10 años, +2k alumnos" />
            </div>
            <FieldTextarea label="Bio corta" value={config.instructor_bio ?? ''} onChange={(v) => field('instructor_bio', v)} rows={2} />
            <FieldUrl label="URL foto del instructor" value={config.instructor_photo_url ?? ''} onChange={(v) => field('instructor_photo_url', v)} hint="400×400px cuadrada" />
          </div>
        </div>
      )}

      {template === 'classic' && (
        <p className="text-sm text-white/55 rounded border border-white/10 bg-white/[0.02] p-4">
          La plantilla <strong>Clásica</strong> usa la info básica del curso (título, descripción,
          portada, precio). No tiene campos extra. Si querés más control visual, elegí <strong>Hotmart</strong>.
        </p>
      )}

      {template === 'vsl' && (
        <p className="text-sm text-amber-200 rounded border border-amber-500/30 bg-amber-500/5 p-4">
          ⚠️ La plantilla VSL (video sales letter con gating + form multi-paso) viene en el próximo
          deploy. Ya quedó la estructura en DB lista para cuando se implemente el render.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded bg-white text-black px-5 py-2 text-sm font-bold disabled:opacity-40"
        >
          {pending ? 'Guardando…' : 'Guardar landing'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400">✓ Landing actualizada</span>
        )}
      </div>
      </div>

      {/* ─── Preview en vivo ─── */}
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

function FieldText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm"
      />
    </div>
  );
}
function FieldTextarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm resize-none"
      />
    </div>
  );
}
function FieldUrl({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://…"
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm"
      />
      {hint && <p className="text-[10px] text-white/40 mt-0.5">📐 {hint}</p>}
    </div>
  );
}
function FieldNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        min={0}
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm"
      />
    </div>
  );
}
