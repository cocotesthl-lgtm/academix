'use client';

import { useState, useTransition, useEffect } from 'react';
import { withSaveStatus } from '@/lib/ui/save-status';
import { RichTextField } from './RichTextField';
import { HrefField } from './HrefSelect';

/**
 * Helper para renderizar un string que puede ser HTML (del RichTextField)
 * o texto plano legacy. Strippea el outer <p> cuando el contenedor es
 * inline (h1, p, span). Usado en TODOS los previews del builder para que
 * muestren formato real (negrita, color, italic) en vez de tags crudas.
 */
function richHtml(input: string | null | undefined, fallback = ''): { __html: string } {
  const raw = (input ?? '').trim() || fallback;
  const stripped = raw.replace(/^<p(\s[^>]*)?>([\s\S]*)<\/p>$/i, '$2');
  return { __html: stripped };
}
import {
  updateSectionFieldsAction,
  setSectionImageUrlAction,
  addPricingTierAction,
  deletePricingTierAction,
  addGalleryImageAction,
  deleteGalleryImageAction,
  addInstructorItemAction,
  deleteInstructorItemAction,
  addTestimonialAction,
  deleteTestimonialAction,
  addFaqAction,
  deleteFaqAction,
  addStatAction,
  deleteStatAction,
  addLearnPointAction,
  deleteLearnPointAction,
  addFeatureAction,
  deleteFeatureAction,
  addLogoAction,
  deleteLogoAction,
  addManualCardAction,
  updateManualCardAction,
  deleteManualCardAction,
  moveManualCardAction,
  addCardItemAction,
  updateCardItemAction,
  deleteCardItemAction,
  moveCardItemAction,
  updateInstructorItemAction,
  updateTestimonialAction,
  updateFaqAction,
  updateStatAction,
  updateLearnPointAction,
  updateFeatureAction,
  updateLogoAction,
  updatePricingTierAction,
  updateGalleryImageAction,
  updateNavLinkAction,
  updateFooterLinkAction,
  updateSocialLinkAction,
  addNavLinkAction,
  deleteNavLinkAction,
  toggleNavLoginAction,
  toggleNavFlagAction,
  setNavLabelAction,
  updateFooterTextAction,
  addFooterLinkAction,
  deleteFooterLinkAction,
  addSocialLinkAction,
  deleteSocialLinkAction
} from '@/lib/site/actions';
import type {
  TestimonialItem, FaqItem, StatItem, LearnItem, FeatureItem, LogoItem,
  NavLink, SocialLink, HeroLayout, PricingTier, GalleryItem,
  InstructorItem, InstructorDisplay, CustomImagePos, ManualCard
} from '@/lib/site/types';

/* =====================================================================
 * Shared helpers
 * ===================================================================== */

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
      />
    </div>
  );
}

function Textarea({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
      />
    </div>
  );
}

function SaveBar({ pending, saved, onSave }: { pending: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button type="button" onClick={onSave} disabled={pending}
        className="rounded bg-white text-black px-4 py-1.5 text-sm font-medium hover:bg-white/90 disabled:opacity-50">
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
      {saved && <span className="text-xs text-emerald-300">✓ Guardado</span>}
    </div>
  );
}

/**
 * Picker de URL de imagen. NO sube archivos — solo URL.
 * Muestra hint con el tamaño recomendado para evitar recortes.
 */
function UrlPicker({
  label, section, field, value, hint, onLocalChange
}: {
  label: string;
  section: string;
  field: string;
  value: string | null;
  hint?: string;
  onLocalChange?: (v: string) => void;
}) {
  const [v, setV] = useState(value ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="url"
          value={v}
          onChange={(e) => { setV(e.target.value); onLocalChange?.(e.target.value); setSaved(false); }}
          placeholder="https://… (pegá la URL de la imagen)"
          className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setSaved(false);
            start(async () => {
              const fd = new FormData();
              fd.set('section', section);
              fd.set('field', field);
              fd.set('url', v);
              await setSectionImageUrlAction(fd);
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            });
          }}
          className="rounded bg-white text-black px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? '…' : 'Guardar'}
        </button>
      </div>
      <div className="flex items-center justify-between mt-1">
        {hint && <span className="text-[10px] text-white/40">📐 {hint}</span>}
        {saved && <span className="text-[10px] text-emerald-300">✓ Guardado</span>}
      </div>
    </div>
  );
}

/**
 * Frame de preview. Marcado con data-pf para que el CSS scoped en
 * /owner/site page (data-sec-editor → data-pf) pise los gradients
 * internos y aplique el bg_color / text_color elegidos por el owner.
 */
function PreviewFrame({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div>
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">{label ?? 'Preview en vivo'}</div>
      <div data-pf className="rounded-xl border border-white/10 bg-white text-black overflow-hidden">{children}</div>
    </div>
  );
}

function useSave(section: string) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  function fire(fields: Record<string, string | boolean>) {
    setSaved(false);
    start(async () => {
      const fd = new FormData();
      fd.set('section', section);
      for (const [k, v] of Object.entries(fields)) {
        if (typeof v === 'boolean') { if (v) fd.set(k, 'on'); }
        else fd.set(k, v);
      }
      await updateSectionFieldsAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }
  return { pending, saved, fire };
}

/* =====================================================================
 * HERO with layout variants + image upload
 * ===================================================================== */

type HeroValues = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  cta_label_2: string;
  cta_href_2: string;
  caption: string;
};

export function HeroEditor({
  initial, fallbackTitle, primary, layout, imageUrl,
  mediaType, videoUrl, formId, availableForms
}: {
  initial: HeroValues; fallbackTitle: string; primary: string; layout: HeroLayout; imageUrl: string | null;
  mediaType?: 'image' | 'video' | 'carousel' | 'form';
  videoUrl?: string;
  formId?: string;
  availableForms?: Array<{ id: string; title: string }>;
}) {
  const [v, setV] = useState(initial);
  const [layoutSel, setLayoutSel] = useState<HeroLayout>(layout);
  const [mt, setMt] = useState<'image' | 'video' | 'carousel' | 'form'>(mediaType ?? 'image');
  const [vUrl, setVUrl] = useState(videoUrl ?? '');
  const [fId, setFId] = useState(formId ?? '');
  const { pending, saved, fire } = useSave('hero');
  const displayTitle = v.title || fallbackTitle;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-white/60 mb-2">Plantilla del Hero</label>
        <div className="grid grid-cols-3 gap-2">
          {(['centered', 'split', 'gallery'] as HeroLayout[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => { setLayoutSel(l); fire({ ...v, layout: l }); }}
              className={`text-xs px-3 py-2 rounded border ${layoutSel === l ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'}`}
            >
              {l === 'centered' ? 'Centrado' : l === 'split' ? 'Texto + imagen' : 'Banner Amazon-style'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Field label="Eyebrow (pill arriba del título, ej. '🟢 Beta abierta')" value={v.eyebrow} onChange={(x) => setV({ ...v, eyebrow: x })} />
          <RichTextField label="Título (vacío = nombre de la academia)" value={v.title} onChange={(x) => setV({ ...v, title: x })} placeholder={fallbackTitle} />
          <RichTextField label="Subtítulo" value={v.subtitle} onChange={(x) => setV({ ...v, subtitle: x })} multiline />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Botón principal" value={v.cta_label} onChange={(x) => setV({ ...v, cta_label: x })} />
            <HrefField label="Destino (href)" value={v.cta_href} onChange={(x) => setV({ ...v, cta_href: x })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Botón secundario (opcional)" value={v.cta_label_2} onChange={(x) => setV({ ...v, cta_label_2: x })} />
            <HrefField label="Destino (href)" value={v.cta_href_2} onChange={(x) => setV({ ...v, cta_href_2: x })} />
          </div>
          <RichTextField label="Caption (texto chico debajo de los CTAs)" value={v.caption} onChange={(x) => setV({ ...v, caption: x })} />
          <SaveBar pending={pending} saved={saved} onSave={() => fire({ ...v, layout: layoutSel, media_type: mt, video_url: vUrl, form_id: fId })} />

          {layoutSel === 'split' && (
            <div className="pt-3 mt-3 border-t border-white/5 space-y-3">
              <div>
                <label className="block text-xs text-white/60 mb-1.5">Qué mostrar al lado del texto</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: 'image',    label: '🖼 Imagen' },
                    { v: 'video',    label: '🎬 Video' },
                    { v: 'carousel', label: '🎞 Carrusel' },
                    { v: 'form',     label: '📝 Formulario' }
                  ] as { v: typeof mt; label: string }[]).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setMt(opt.v)}
                      className={`text-[10px] px-2 py-2 rounded border transition ${
                        mt === opt.v ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/40 mt-1.5">Acordate de tocar Guardar para aplicar el cambio.</p>
              </div>

              {mt === 'image' && (
                <UrlPicker
                  label="URL de la imagen del Hero"
                  section="hero"
                  field="image_url"
                  value={imageUrl}
                  hint="Recomendado 1200×900px (4:3) — imagen al costado del texto"
                />
              )}
              {mt === 'video' && (
                <div>
                  <label className="text-xs text-white/60 block mb-1">URL del video (YouTube o Google Drive)</label>
                  <input
                    type="url"
                    value={vUrl}
                    onChange={(e) => setVUrl(e.target.value)}
                    placeholder="https://youtu.be/... o https://drive.google.com/file/d/..."
                    className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono"
                  />
                </div>
              )}
              {mt === 'carousel' && (
                <div className="text-xs text-white/55">
                  📐 Carrusel de imágenes: por ahora se cargan automáticamente desde la sección{' '}
                  <code className="text-white/80">🖼️ Galería</code> si está habilitada.
                  El editor inline de carrusel viene en próxima fase.
                </div>
              )}
              {mt === 'form' && (
                <div>
                  <label className="text-xs text-white/60 block mb-1">Formulario a mostrar</label>
                  {(availableForms ?? []).length === 0 ? (
                    <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                      Todavía no creaste ningún formulario.{' '}
                      <a href="/owner/forms" className="underline">Crear uno ahora →</a>
                    </div>
                  ) : (
                    <select
                      value={fId}
                      onChange={(e) => setFId(e.target.value)}
                      className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
                    >
                      <option value="">— elegir formulario —</option>
                      {(availableForms ?? []).map((f) => (
                        <option key={f.id} value={f.id}>{f.title}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {layoutSel === 'gallery' && (
            <div className="pt-3 mt-3 border-t border-white/5">
              <UrlPicker
                label="URL de la imagen del Hero"
                section="hero"
                field="image_url"
                value={imageUrl}
                hint="Recomendado 2400×1200px — banner ancho full-width Amazon-style"
              />
            </div>
          )}
        </div>

        <PreviewFrame>
          {layoutSel === 'centered' && (
            <div className="p-6 text-center" style={{ background: `linear-gradient(180deg, ${primary}15 0%, transparent 100%)` }}>
              {v.eyebrow && <span className="inline-block text-[9px] font-medium px-2 py-0.5 rounded-full border" style={{ borderColor: `${primary}50`, color: primary }}>{v.eyebrow}</span>}
              <h1 className="text-2xl font-bold tracking-tight mt-2"
                dangerouslySetInnerHTML={richHtml(v.title, displayTitle)} />
              {v.subtitle && <div className="mt-2 text-xs text-black/60"
                dangerouslySetInnerHTML={richHtml(v.subtitle)} />}
              <div className="mt-3 flex justify-center gap-2">
                {v.cta_label && <span className="inline-block rounded px-3 py-1.5 text-xs font-semibold text-white" style={{ background: primary }}>{v.cta_label}</span>}
                {v.cta_label_2 && <span className="inline-block rounded px-3 py-1.5 text-xs font-semibold border" style={{ borderColor: primary, color: primary }}>{v.cta_label_2}</span>}
              </div>
              {v.caption && <div className="text-[9px] text-black/40 mt-2"
                dangerouslySetInnerHTML={richHtml(v.caption)} />}
            </div>
          )}
          {layoutSel === 'split' && (
            <div className="p-4 grid grid-cols-2 gap-3 items-center" style={{ background: `linear-gradient(135deg, ${primary}12 0%, transparent 60%)` }}>
              <div>
                {v.eyebrow && <span className="inline-block text-[8px] font-medium px-1.5 py-0.5 rounded-full border" style={{ borderColor: `${primary}50`, color: primary }}>{v.eyebrow}</span>}
                <h1 className="text-base font-bold tracking-tight mt-1.5"
                  dangerouslySetInnerHTML={richHtml(v.title, displayTitle)} />
                {v.subtitle && <div className="mt-1 text-[10px] text-black/60 line-clamp-3"
                  dangerouslySetInnerHTML={richHtml(v.subtitle)} />}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.cta_label && <span className="rounded px-2 py-1 text-[9px] font-semibold text-white" style={{ background: primary }}>{v.cta_label}</span>}
                  {v.cta_label_2 && <span className="rounded px-2 py-1 text-[9px] font-semibold border" style={{ borderColor: primary, color: primary }}>{v.cta_label_2}</span>}
                </div>
                {v.caption && <div className="text-[8px] text-black/40 mt-1.5"
                  dangerouslySetInnerHTML={richHtml(v.caption)} />}
              </div>
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="rounded-lg w-full h-28 object-cover shadow" />
              ) : (
                <div className="rounded-lg w-full h-28 border-2 border-dashed border-black/15 bg-black/[0.03] flex items-center justify-center">
                  <span className="text-[10px] text-black/40">Pegá la URL de tu imagen →</span>
                </div>
              )}
            </div>
          )}
          {layoutSel === 'gallery' && (
            <div className="relative h-44 overflow-hidden rounded">
              {imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)' }} />
                </>
              ) : (
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}99 100%)` }} />
              )}
              <div className="relative h-full flex items-end p-3">
                <div className="text-white max-w-[80%]">
                  {v.eyebrow && (
                    <span className="inline-block text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-white/20 backdrop-blur border border-white/30">
                      {v.eyebrow}
                    </span>
                  )}
                  <h1 className="mt-1 text-sm font-bold leading-tight drop-shadow"
                    dangerouslySetInnerHTML={richHtml(v.title, displayTitle)} />
                  {v.subtitle && <div className="mt-1 text-[10px] text-white/85 line-clamp-2 drop-shadow"
                    dangerouslySetInnerHTML={richHtml(v.subtitle)} />}
                  <div className="mt-2 flex gap-1.5">
                    {v.cta_label && <span className="rounded px-2 py-1 text-[9px] font-semibold text-white" style={{ background: primary }}>{v.cta_label}</span>}
                    {v.cta_label_2 && <span className="rounded px-2 py-1 text-[9px] font-semibold bg-white/10 backdrop-blur border border-white text-white">{v.cta_label_2}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </PreviewFrame>
      </div>
    </div>
  );
}

/* =====================================================================
 * TRUSTED BY
 * ===================================================================== */

export function TrustedByEditor({ initialTitle, items, grayscale, marquee, marqueeSpeed, logoHeight, logoGap }: {
  initialTitle: string; items: LogoItem[]; grayscale: boolean; marquee: boolean;
  marqueeSpeed?: number;
  logoHeight?: number;
  logoGap?: number;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [gs, setGs] = useState(grayscale);
  const [mq, setMq] = useState(marquee);
  const [speed, setSpeed] = useState(marqueeSpeed ?? 30);
  const [logoH, setLogoH] = useState(logoHeight ?? 40);
  const [gap, setGap] = useState(logoGap ?? 64);
  const { pending, saved, fire } = useSave('trusted_by');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [href, setHref] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  function startEdit(l: LogoItem) { setEditingId(l.id); setName(l.name); setHref(l.href ?? ''); setLogoUrl(l.logo_url ?? ''); }
  function reset() { setEditingId(null); setName(''); setHref(''); setLogoUrl(''); }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={gs} onChange={(e) => setGs(e.target.checked)} />
          Aplicar filtro grayscale a los logos
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mq} onChange={(e) => setMq(e.target.checked)} />
          Modo cinta (auto-scroll infinito)
        </label>
        {mq && (
          <div className="pl-6 space-y-1.5">
            <label className="text-xs text-white/60 flex items-center justify-between">
              <span>Velocidad del scroll</span>
              <span className="text-white/45 tabular-nums">{speed}s por loop</span>
            </label>
            <input
              type="range"
              min={5}
              max={120}
              step={1}
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
              className="w-full accent-fuchsia-500"
            />
            <div className="flex items-center justify-between text-[10px] text-white/40">
              <span>⚡ Rápido (5s)</span>
              <span>🐢 Lento (120s)</span>
            </div>
            <p className="text-[10px] text-white/40">
              💡 Para una cinta totalmente estática (logos sin moverse), desactivá el checkbox de arriba.
            </p>
          </div>
        )}

        {/* Tamaño + separación de logos (aplica con o sin marquee) */}
        <div className="pt-3 mt-3 border-t border-white/5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-white/60 flex items-center justify-between">
              <span>🔍 Tamaño de los logos</span>
              <span className="text-white/45 tabular-nums">{logoH}px de alto</span>
            </label>
            <input
              type="range" min={24} max={160} step={2}
              value={logoH} onChange={(e) => setLogoH(parseInt(e.target.value, 10))}
              className="w-full accent-fuchsia-500"
            />
            <div className="flex items-center justify-between text-[10px] text-white/40">
              <span>🐜 Chico (24px)</span>
              <span>🐘 Grande (160px)</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-white/60 flex items-center justify-between">
              <span>📏 Separación entre logos</span>
              <span className="text-white/45 tabular-nums">{gap}px</span>
            </label>
            <input
              type="range" min={8} max={160} step={2}
              value={gap} onChange={(e) => setGap(parseInt(e.target.value, 10))}
              className="w-full accent-fuchsia-500"
            />
            <div className="flex items-center justify-between text-[10px] text-white/40">
              <span>🤝 Pegados (8px)</span>
              <span>🌌 Espaciosos (160px)</span>
            </div>
          </div>
        </div>

        <SaveBar pending={pending} saved={saved} onSave={() => fire({
          title, grayscale: gs, marquee: mq,
          marquee_speed: String(speed),
          logo_height: String(logoH),
          logo_gap: String(gap)
        })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingId ? '✎ Editando logo' : 'Agregar logo'}
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Acme Corp)" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <HrefField label="Link (opcional)" value={href} onChange={setHref} />
          <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="URL del logo (vacío = solo nombre)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={addPending || !name}
              onClick={() => {
                startAdd(async () => {
                  const fd = new FormData();
                  fd.set('name', name); fd.set('href', href); fd.set('logo_url', logoUrl);
                  if (editingId) { fd.set('id', editingId); await updateLogoAction(fd); }
                  else { await addLogoAction(fd); }
                  reset();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Agregar'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">Cancelar</button>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((l) => (
              <li key={l.id} className={`rounded border p-2 flex items-center justify-between gap-3 text-sm ${editingId === l.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                <div className="flex items-center gap-2">
                  {l.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.logo_url} alt="" className="w-8 h-8 object-contain" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-white/10" />
                  )}
                  <span className="font-medium">{l.name}</span>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => startEdit(l)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                  <button type="button" disabled={delPending} onClick={() => {
                    if (!confirm('¿Eliminar?')) return;
                    startDel(async () => {
                      const fd = new FormData(); fd.set('id', l.id);
                      await deleteLogoAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PreviewFrame>
        <div className="p-5">
          <p className="text-xs text-center text-black/40 uppercase tracking-widest mb-3">{title || '—'}</p>
          {items.length === 0 ? (
            <div className="text-center text-xs text-black/40 py-4">Agregá logos para verlos acá.</div>
          ) : (
            <div className="flex flex-wrap justify-center items-center gap-4">
              {items.map((l) => (
                <div key={l.id} className={`flex items-center justify-center ${gs ? 'grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition' : ''}`}>
                  {l.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.logo_url} alt={l.name} className="h-8 object-contain" />
                  ) : (
                    <span className="text-xs font-semibold text-black/60">{l.name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * ABOUT
 * ===================================================================== */

type AboutValues = { title: string; body: string };

export function AboutEditor({ initial, imageUrl, primary }: {
  initial: AboutValues; imageUrl: string | null; primary: string;
}) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('about');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <RichTextField label="Título" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <RichTextField label="Texto" value={v.body} onChange={(x) => setV({ ...v, body: x })} multiline />
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />

        <div className="pt-3 mt-3 border-t border-white/5">
          <UrlPicker
            label="URL de la foto (opcional)"
            section="about"
            field="image_url"
            value={imageUrl}
            hint="Recomendado 1200×900px, formato 4:3"
          />
        </div>
      </div>
      <PreviewFrame>
        <div className="p-5 grid grid-cols-2 gap-4 items-center" style={{ background: 'rgba(0,0,0,0.02)' }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="rounded-lg w-full h-32 object-cover" />
          ) : (
            <div className="rounded-lg w-full h-32 flex items-center justify-center text-3xl" style={{ background: `${primary}15` }}>👋</div>
          )}
          <div>
            <h2 className="text-lg font-bold"
              dangerouslySetInnerHTML={richHtml(v.title, '—')} />
            <div className="text-xs text-black/60 mt-1 whitespace-pre-line line-clamp-4"
              dangerouslySetInnerHTML={richHtml(v.body, 'Tu texto aparece acá.')} />
          </div>
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * INSTRUCTOR
 * ===================================================================== */

type InstructorValues = { title: string; display_mode: InstructorDisplay };

export function InstructorEditor({ initial, items, primary }: {
  initial: InstructorValues; items: InstructorItem[]; primary: string;
}) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('instructor');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [credentials, setCredentials] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  function startEdit(it: InstructorItem) {
    setEditingId(it.id); setName(it.name); setCredentials(it.credentials ?? '');
    setBio(it.bio ?? ''); setPhotoUrl(it.photo_url ?? '');
  }
  function reset() { setEditingId(null); setName(''); setCredentials(''); setBio(''); setPhotoUrl(''); }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <div>
          <label className="block text-xs text-white/60 mb-2">Modo de visualización</label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(['single', 'grid', 'carousel'] as InstructorDisplay[]).map((m) => (
              <button key={m} type="button"
                onClick={() => setV({ ...v, display_mode: m })}
                className={`px-3 py-2 rounded border ${v.display_mode === m ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'}`}>
                {m === 'single' ? '1 solo' : m === 'grid' ? 'Grilla' : 'Carrusel (cinta)'}
              </button>
            ))}
          </div>
        </div>
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingId ? '✎ Editando instructor' : 'Agregar instructor'}
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <input value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="Credenciales / rol" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="Bio corta (opcional)" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="URL de la foto (opcional, cuadrada 400×400)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={addPending || !name}
              onClick={() => {
                startAdd(async () => {
                  const fd = new FormData();
                  fd.set('name', name); fd.set('credentials', credentials); fd.set('bio', bio); fd.set('photo_url', photoUrl);
                  if (editingId) { fd.set('id', editingId); await updateInstructorItemAction(fd); }
                  else { await addInstructorItemAction(fd); }
                  reset();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Agregar'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">Cancelar</button>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((i) => (
              <li key={i.id} className={`rounded border p-2 flex items-start justify-between gap-3 text-sm ${editingId === i.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                <div className="flex gap-2 flex-1 min-w-0">
                  {i.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: primary }}>
                      {i.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{i.name}</div>
                    {i.credentials && <div className="text-white/40 text-xs truncate">{i.credentials}</div>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" onClick={() => startEdit(i)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                  <button type="button" disabled={delPending} onClick={() => {
                    if (!confirm('¿Eliminar?')) return;
                    startDel(async () => {
                      const fd = new FormData(); fd.set('id', i.id);
                      await deleteInstructorItemAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PreviewFrame>
        <div className="p-5 text-center">
          <h2 className="text-lg font-bold mb-3">{v.title || '—'}</h2>
          {items.length === 0 ? (
            <div className="text-xs text-black/40 py-4">Agregá al menos un instructor.</div>
          ) : v.display_mode === 'single' ? (
            (() => {
              const first = items[0];
              return (
                <div>
                  {first.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={first.photo_url} alt="" className="w-20 h-20 rounded-full mx-auto object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white" style={{ background: primary }}>
                      {first.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="mt-2 font-semibold">{first.name}</div>
                  {first.credentials && <div className="text-xs text-black/50">{first.credentials}</div>}
                </div>
              );
            })()
          ) : v.display_mode === 'grid' ? (
            <div className={`grid gap-2 ${items.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {items.slice(0, 3).map((i) => (
                <div key={i.id}>
                  {i.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.photo_url} alt="" className="w-12 h-12 rounded-full mx-auto object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-base font-bold text-white" style={{ background: primary }}>
                      {i.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="text-[10px] font-semibold mt-1">{i.name}</div>
                </div>
              ))}
            </div>
          ) : (
            // carousel preview = sliding strip
            <div className="overflow-hidden">
              <div className="flex gap-2 animate-[scroll-x_15s_linear_infinite]" style={{ width: 'max-content' }}>
                {[...items, ...items].map((i, idx) => (
                  <div key={idx} className="flex-shrink-0 w-16 text-center">
                    {i.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.photo_url} alt="" className="w-12 h-12 rounded-full mx-auto object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-base font-bold text-white" style={{ background: primary }}>
                        {i.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="text-[9px] font-semibold mt-1 truncate">{i.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * STATS
 * ===================================================================== */

export function StatsEditor({ initialTitle, items, primary }: {
  initialTitle: string; items: StatItem[]; primary: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const { pending, saved, fire } = useSave('stats');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [num, setNum] = useState('');
  const [lbl, setLbl] = useState('');

  function startEdit(s: StatItem) { setEditingId(s.id); setNum(s.number); setLbl(s.label); }
  function reset() { setEditingId(null); setNum(''); setLbl(''); }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingId ? '✎ Editando estadística' : 'Agregar estadística'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="+2.400" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input value={lbl} onChange={(e) => setLbl(e.target.value)} placeholder="alumnos" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={addPending || !num || !lbl}
              onClick={() => {
                startAdd(async () => {
                  const fd = new FormData(); fd.set('number', num); fd.set('label', lbl);
                  if (editingId) { fd.set('id', editingId); await updateStatAction(fd); }
                  else { await addStatAction(fd); }
                  reset();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Agregar'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">Cancelar</button>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((s) => (
              <li key={s.id} className={`rounded border p-2 flex items-center justify-between gap-3 text-sm ${editingId === s.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                <div><span className="font-bold">{s.number}</span> <span className="text-white/60">{s.label}</span></div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => startEdit(s)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                  <button type="button" disabled={delPending} onClick={() => {
                    if (!confirm('¿Eliminar?')) return;
                    startDel(async () => {
                      const fd = new FormData(); fd.set('id', s.id);
                      await deleteStatAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-lg font-bold mb-3 text-center">{title || '—'}</h2>
          {items.length === 0 ? (
            <div className="text-center text-xs text-black/40 py-4">Agregá estadísticas para verlas acá.</div>
          ) : (
            <div className={`grid gap-2 ${items.length === 1 ? 'grid-cols-1' : items.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {items.slice(0, 6).map((s) => (
                <div key={s.id} className="text-center p-3 rounded border border-black/10">
                  <div className="text-xl font-bold" style={{ color: primary }}>{s.number}</div>
                  <div className="text-[10px] text-black/60">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * LEARN POINTS (Qué vas a aprender)
 * ===================================================================== */

export function LearnPointsEditor({ initialTitle, initialSubtitle, items, primary }: {
  initialTitle: string; initialSubtitle: string; items: LearnItem[]; primary: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const { pending, saved, fire } = useSave('learn_points');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState('');

  function startEdit(p: LearnItem) { setEditingId(p.id); setText(p.text); }
  function reset() { setEditingId(null); setText(''); }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título" value={title} onChange={setTitle} />
        <Field label="Subtítulo (opcional)" value={subtitle} onChange={setSubtitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title, subtitle })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingId ? '✎ Editando punto' : 'Agregar punto de aprendizaje'}
          </label>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Diseñar wireframes con Figma" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={addPending || !text}
              onClick={() => {
                startAdd(async () => {
                  const fd = new FormData(); fd.set('text', text);
                  if (editingId) { fd.set('id', editingId); await updateLearnPointAction(fd); }
                  else { await addLearnPointAction(fd); }
                  reset();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Agregar'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">Cancelar</button>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((p) => (
              <li key={p.id} className={`rounded border p-2 flex items-center justify-between gap-3 text-sm ${editingId === p.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                <span>✓ {p.text}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => startEdit(p)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                  <button type="button" disabled={delPending} onClick={() => {
                    if (!confirm('¿Eliminar?')) return;
                    startDel(async () => {
                      const fd = new FormData(); fd.set('id', p.id);
                      await deleteLearnPointAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-lg font-bold text-center">{title || '—'}</h2>
          {subtitle && <p className="text-center text-xs text-black/60 mt-1">{subtitle}</p>}
          {items.length === 0 ? (
            <div className="text-center text-xs text-black/40 py-4">Agregá puntos para verlos acá.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {items.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-start gap-2 text-xs">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] shrink-0 mt-0.5" style={{ background: primary }}>✓</span>
                  <span className="text-black/80">{p.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * FEATURES (3-card)
 * ===================================================================== */

export function FeaturesEditor({ initialTitle, items, primary }: {
  initialTitle: string; items: FeatureItem[]; primary: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const { pending, saved, fire } = useSave('features');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [icon, setIcon] = useState('⭐');
  const [t, setT] = useState('');
  const [b, setB] = useState('');

  function startEdit(f: FeatureItem) { setEditingId(f.id); setIcon(f.icon); setT(f.title); setB(f.body); }
  function reset() { setEditingId(null); setT(''); setB(''); setIcon('⭐'); }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingId ? '✎ Editando feature' : 'Agregar feature (icono emoji + título + texto)'}
          </label>
          <div className="grid grid-cols-4 gap-2">
            <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="⭐" maxLength={3} className="col-span-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm text-center" />
            <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Título" className="col-span-3 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <textarea value={b} onChange={(e) => setB(e.target.value)} rows={2} placeholder="Descripción corta" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={addPending || !t || !b}
              onClick={() => {
                startAdd(async () => {
                  const fd = new FormData(); fd.set('icon', icon); fd.set('title', t); fd.set('body', b);
                  if (editingId) { fd.set('id', editingId); await updateFeatureAction(fd); }
                  else { await addFeatureAction(fd); }
                  reset();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Agregar'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">Cancelar</button>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((f) => (
              <li key={f.id} className={`rounded border p-2 flex items-start justify-between gap-3 text-sm ${editingId === f.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                <div>
                  <div className="font-medium">{f.icon} {f.title}</div>
                  <div className="text-xs text-white/60 mt-0.5">{f.body}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" onClick={() => startEdit(f)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                  <button type="button" disabled={delPending} onClick={() => {
                    if (!confirm('¿Eliminar?')) return;
                    startDel(async () => {
                      const fd = new FormData(); fd.set('id', f.id);
                      await deleteFeatureAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-lg font-bold text-center mb-3">{title || '—'}</h2>
          {items.length === 0 ? (
            <div className="text-center text-xs text-black/40 py-4">Agregá features para verlas acá.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {items.slice(0, 3).map((f) => (
                <div key={f.id} className="text-center p-3 rounded border border-black/10">
                  <div className="text-2xl mb-1">{f.icon}</div>
                  <div className="text-[10px] font-semibold" style={{ color: primary }}>{f.title}</div>
                  <div className="text-[9px] text-black/60 mt-1 line-clamp-2">{f.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * FEATURED (just title)
 * ===================================================================== */

export function FeaturedEditor({ initialTitle, primary }: { initialTitle: string; primary: string }) {
  const [title, setTitle] = useState(initialTitle);
  const { pending, saved, fire } = useSave('featured');
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <p className="text-xs text-white/40">Los cursos destacados los marcás desde el editor de cada curso.</p>
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title })} />
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-lg font-bold mb-3">{title || '—'}</h2>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded border border-black/10 overflow-hidden">
                <div className="h-14 relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
                  <span className="absolute top-1 left-1 bg-white text-[8px] font-semibold px-1 py-0.5 rounded">⭐</span>
                </div>
                <div className="p-2 text-[9px]">Curso #{i}</div>
              </div>
            ))}
          </div>
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * CATALOG
 * ===================================================================== */

export function CatalogEditor({
  initialTitle, initialShowFilters, initialMaxVisible, initialPaginationMode,
  initialCtaMode, initialCtaCustomHref,
  initialManualCardsPosition, initialShowAutoCourses,
  initialCardStyle,
  primary
}: {
  initialTitle: string; initialShowFilters: boolean; initialMaxVisible: number;
  initialPaginationMode: 'show_more' | 'paginated';
  initialCtaMode?: 'course_link' | 'no_button' | 'custom_url';
  initialCtaCustomHref?: string;
  initialManualCardsPosition?: 'before' | 'after';
  initialShowAutoCourses?: boolean;
  initialCardStyle?: 'classic' | 'compact';
  primary: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [showFilters, setShowFilters] = useState(initialShowFilters);
  const [maxVisible, setMaxVisible] = useState(initialMaxVisible);
  const [paginationMode, setPaginationMode] = useState<'show_more' | 'paginated'>(initialPaginationMode);
  const [ctaMode, setCtaMode] = useState<'course_link' | 'no_button' | 'custom_url'>(initialCtaMode ?? 'course_link');
  const [ctaCustomHref, setCtaCustomHref] = useState(initialCtaCustomHref ?? '');
  // Backwards-compat: estos antes vivían en catalog; ahora las tarjetas están en su propia sección.
  // Mantenemos los valores actuales del config para no perderlos en el save.
  const manualCardsPosition = initialManualCardsPosition ?? 'before';
  const showAutoCourses = initialShowAutoCourses ?? true;
  const [cardStyle, setCardStyle] = useState<'classic' | 'compact'>(initialCardStyle ?? 'classic');
  const { pending, saved, fire } = useSave('catalog');
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showFilters} onChange={(e) => setShowFilters(e.target.checked)} />
          Mostrar filtros por categoría
        </label>
        <div>
          <label className="block text-xs text-white/60 mb-1.5">Modo de paginación</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaginationMode('show_more')}
              className={`text-left rounded border p-3 text-xs ${
                paginationMode === 'show_more' ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'
              }`}
            >
              <div className="font-semibold">📜 Ver más / Ver menos</div>
              <div className="text-white/50 mt-0.5">Botón expande el resto en la misma página.</div>
            </button>
            <button
              type="button"
              onClick={() => setPaginationMode('paginated')}
              className={`text-left rounded border p-3 text-xs ${
                paginationMode === 'paginated' ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'
              }`}
            >
              <div className="font-semibold">🔢 Páginas numeradas</div>
              <div className="text-white/50 mt-0.5">Navegador ← 1 2 3 → al final.</div>
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1.5">
            {paginationMode === 'show_more' ? 'Cursos visibles al inicio' : 'Cursos por página'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1} max={48}
              value={maxVisible}
              onChange={(e) => setMaxVisible(Math.max(1, parseInt(e.target.value || '3', 10)))}
              className="w-24 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
            />
            <span className="text-xs text-white/45">cursos</span>
          </div>
        </div>
        <div className="pt-3 border-t border-white/10 space-y-2">
          <label className="block text-xs text-white/60 mb-1.5">Estilo de las tarjetas</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCardStyle('classic')}
              className={`text-left rounded border p-3 text-xs ${
                cardStyle === 'classic' ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'
              }`}
            >
              <div className="font-semibold">🎴 Clásico</div>
              <div className="text-white/50 mt-0.5">3 por fila, imagen horizontal grande.</div>
            </button>
            <button
              type="button"
              onClick={() => setCardStyle('compact')}
              className={`text-left rounded border p-3 text-xs ${
                cardStyle === 'compact' ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'
              }`}
            >
              <div className="font-semibold">🛍 Compacto (MeLi)</div>
              <div className="text-white/50 mt-0.5">4-5 por fila, imagen cuadrada estilo ecommerce.</div>
            </button>
          </div>
        </div>
        <div className="pt-3 border-t border-white/10 space-y-2">
          <label className="block text-xs text-white/60">Botón de cada tarjeta</label>
          <select
            value={ctaMode}
            onChange={(e) => setCtaMode(e.target.value as typeof ctaMode)}
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
          >
            <option value="course_link">🎓 Ir al curso (default)</option>
            <option value="no_button">ℹ Sin botón (tarjeta informativa)</option>
            <option value="custom_url">🔗 URL custom (todas las tarjetas)</option>
          </select>
          {ctaMode === 'custom_url' && (
            <input
              type="text"
              value={ctaCustomHref}
              onChange={(e) => setCtaCustomHref(e.target.value)}
              placeholder="https://otro-sitio.com  o  /pagina"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono"
            />
          )}
          <p className="text-[10px] text-white/40">
            💡 La cinta destacada (ej. OFERTA, NUEVO) de cada curso se configura desde el editor del curso.
          </p>
        </div>
        <div className="pt-3 border-t border-white/10">
          <p className="text-[11px] text-white/50">
            💡 Las tarjetas custom (info / producto / link / banner) ahora viven en su propia sección <strong className="text-white/80">🧩 Tarjetas</strong>.
            Activala desde la lista de secciones para configurarlas.
          </p>
        </div>
        <SaveBar
          pending={pending}
          saved={saved}
          onSave={() => fire({
            title,
            show_filters: showFilters,
            max_visible: String(maxVisible),
            pagination_mode: paginationMode,
            cta_mode: ctaMode,
            cta_custom_href: ctaCustomHref,
            manual_cards_position: manualCardsPosition,
            show_auto_courses: showAutoCourses,
            card_style: cardStyle
          })}
        />
      </div>
      <PreviewFrame>
        <div className="p-3">
          <h2 className="text-base font-bold mb-2">{title || '—'}</h2>
          {showFilters && (
            <div className="flex gap-1 mb-2 text-[8px]">
              <span className="px-1.5 py-0.5 bg-black text-white rounded-full">Todos</span>
              <span className="px-1.5 py-0.5 border border-black/15 rounded-full">Marketing</span>
              <span className="px-1.5 py-0.5 border border-black/15 rounded-full">Diseño</span>
            </div>
          )}
          {cardStyle === 'compact' ? (
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={`c-${i}`} className="rounded border border-black/10 overflow-hidden bg-white">
                  <div className="aspect-square relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
                    <span className="absolute top-1 left-1 text-[7px] bg-white/90 text-black px-1 rounded">★</span>
                  </div>
                  <div className="p-1">
                    <div className="text-[8px] truncate">Curso #{i}</div>
                    <div className="text-[9px] font-bold">$ 9.999</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={`c-${i}`} className="rounded border border-black/10 overflow-hidden bg-white">
                  <div className="h-12" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }} />
                  <div className="p-2 text-[9px]">Curso #{i}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PreviewFrame>

    </div>
  );
}

/* ─── Mini-previews para el editor (no se ven en storefront) ─── */

function CompactPreviewCard({ card, primary }: { card: ManualCard; primary: string }) {
  const tone = RIBBON_TONES_UI.find((t) => t.value === card.ribbon_tone) ?? RIBBON_TONES_UI[0];
  return (
    <div className="rounded border border-black/10 overflow-hidden bg-white relative">
      <div className="aspect-square relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
        {card.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {card.ribbon_text && (
          <span className={`absolute top-1 left-1 text-[7px] px-1 rounded uppercase font-bold ${tone.cls}`}>
            {card.ribbon_text}
          </span>
        )}
      </div>
      <div className="p-1">
        <div className="text-[8px] truncate">{card.title}</div>
        {card.price && <div className="text-[9px] font-bold">{card.price}</div>}
      </div>
    </div>
  );
}

function ClassicPreviewCard({ card, primary }: { card: ManualCard; primary: string }) {
  const tone = RIBBON_TONES_UI.find((t) => t.value === card.ribbon_tone) ?? RIBBON_TONES_UI[0];
  return (
    <div className="rounded border border-black/10 overflow-hidden bg-white">
      <div className="h-12 relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }}>
        {card.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {card.ribbon_text && (
          <span className={`absolute top-1 left-1 text-[7px] px-1 rounded uppercase font-bold ${tone.cls}`}>
            {card.ribbon_text}
          </span>
        )}
      </div>
      <div className="p-2">
        <div className="text-[9px] truncate">{card.title}</div>
        {card.price && <div className="text-[9px] font-bold">{card.price}</div>}
      </div>
    </div>
  );
}

/* ─── Sub-editor: tarjetas manuales del catálogo ─── */

const RIBBON_TONES_UI: { value: ManualCard['ribbon_tone']; label: string; cls: string }[] = [
  { value: 'featured', label: '★ Destacado', cls: 'bg-fuchsia-500 text-white' },
  { value: 'sale',     label: '💸 Oferta',    cls: 'bg-rose-500 text-white' },
  { value: 'urgent',   label: '⏰ Urgente',   cls: 'bg-amber-500 text-amber-950' },
  { value: 'new',      label: '✨ Nuevo',     cls: 'bg-emerald-500 text-white' },
  { value: 'info',     label: 'ℹ Info',       cls: 'bg-sky-500 text-white' }
];

type CardTemplate = 'info' | 'product' | 'link' | 'banner_h' | 'banner_v';

const TEMPLATE_DEFAULTS: Record<CardTemplate, Partial<ManualCard>> = {
  info: {
    layout: 'standard',
    title: 'Bloque informativo',
    subtitle: 'Información',
    body: 'Texto descriptivo para destacar algo importante. Sin botón.',
    ribbon_text: '',
    cta_text: ''
  },
  product: {
    layout: 'standard',
    title: 'Producto premium',
    subtitle: 'Producto físico',
    body: 'Descripción corta del producto y por qué vale la pena.',
    price: '$ 9.999',
    old_price: '$ 14.999',
    stock_label: 'Pocas unidades',
    ribbon_text: 'OFERTA',
    ribbon_tone: 'sale',
    cta_text: 'Comprar ahora',
    cta_href: '#'
  },
  link: {
    layout: 'standard',
    title: 'Conocé más',
    subtitle: 'Página externa',
    body: 'Tarjeta que lleva a otra sección o sitio.',
    ribbon_text: '',
    cta_text: 'Ver más',
    cta_href: '/sobre-nosotros'
  },
  banner_h: {
    layout: 'banner_h',
    title: 'Aprovechá esta oferta',
    subtitle: 'Por tiempo limitado',
    body: 'Texto corto sobre la imagen — ideal para destacar promos.',
    image_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=80&auto=format&fit=crop',
    text_color: '#ffffff',
    overlay_opacity: 0.4,
    ribbon_text: 'OFERTA',
    ribbon_tone: 'sale',
    cta_text: 'Aprovecharla',
    cta_href: '#'
  },
  banner_v: {
    layout: 'banner_v',
    title: 'Nuevo lanzamiento',
    subtitle: 'Recién llegado',
    body: 'Texto corto sobre una imagen vertical — perfecto para destacar un producto.',
    image_url: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=900&q=80&auto=format&fit=crop',
    text_color: '#ffffff',
    overlay_opacity: 0.45,
    ribbon_text: 'NUEVO',
    ribbon_tone: 'new',
    cta_text: 'Ver más',
    cta_href: '#'
  }
};

/**
 * Editor de la sección "Tarjetas" — manejada como sección propia, separada del catálogo.
 * Permite mezclar tarjetas de info, producto (con precio + descuento + stock), link,
 * banner horizontal y banner vertical (estos últimos con imagen de fondo + texto encima).
 */
export function CardsEditor({
  initialTitle, initialSubtitle, initialColumns, items, primary
}: {
  initialTitle: string;
  initialSubtitle: string;
  initialColumns: 2 | 3 | 4;
  items: ManualCard[];
  primary: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [columns, setColumns] = useState<2 | 3 | 4>(initialColumns);
  const { pending, saved, fire } = useSave('cards');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <Field label="Subtítulo (opcional)" value={subtitle} onChange={setSubtitle} />
        <div>
          <label className="block text-xs text-white/60 mb-1">Columnas en grid</label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {([2, 3, 4] as const).map((c) => (
              <button key={c} type="button" onClick={() => setColumns(c)}
                className={`px-3 py-2 rounded border ${columns === c ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'}`}>
                {c}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/40 mt-1">
            💡 Las tarjetas tipo banner horizontal ocupan toda la fila — el grid solo afecta a info/producto/link.
          </p>
        </div>
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title, subtitle, columns: String(columns) })} />
      </div>
      <PreviewFrame>
        <div className="p-3">
          <h2 className="text-base font-bold">{title || '—'}</h2>
          {subtitle && <p className="text-[10px] text-black/55 mb-2">{subtitle}</p>}
          {items.length === 0 ? (
            <div className="text-center text-[10px] text-black/40 py-6 border border-dashed border-black/15 rounded">
              Sin tarjetas. Agregá una abajo.
            </div>
          ) : (
            <div className={`grid gap-2 grid-cols-${columns}`}>
              {items.slice(0, 6).map((c) => (
                c.layout === 'banner_h' ? <BannerHPreview key={c.id} card={c} /> :
                c.layout === 'banner_v' ? <BannerVPreview key={c.id} card={c} /> :
                <ClassicPreviewCard key={c.id} card={c} primary={primary} />
              ))}
            </div>
          )}
        </div>
      </PreviewFrame>

      <div className="md:col-span-2 pt-6 border-t border-white/10">
        <CardsManager items={items} primary={primary} />
      </div>
    </div>
  );
}

function BannerHPreview({ card }: { card: ManualCard }) {
  const ov = card.overlay_opacity ?? 0.4;
  return (
    <div className="col-span-full rounded overflow-hidden relative h-20 bg-gray-200">
      {card.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${ov})` }} />
      <div className="absolute inset-0 flex flex-col justify-center px-3" style={{ color: card.text_color ?? '#fff' }}>
        <div className="text-[8px] opacity-80">{card.subtitle}</div>
        <div className="text-xs font-bold">{card.title}</div>
      </div>
    </div>
  );
}

function BannerVPreview({ card }: { card: ManualCard }) {
  const ov = card.overlay_opacity ?? 0.45;
  return (
    <div className="rounded overflow-hidden relative aspect-[3/4] bg-gray-200">
      {card.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, rgba(0,0,0,${ov + 0.3}), rgba(0,0,0,${ov - 0.2}))` }} />
      <div className="absolute inset-x-0 bottom-0 p-2" style={{ color: card.text_color ?? '#fff' }}>
        <div className="text-[7px] opacity-80">{card.subtitle}</div>
        <div className="text-[10px] font-bold leading-tight">{card.title}</div>
      </div>
    </div>
  );
}

function CardsManager({ items, primary }: { items: ManualCard[]; primary: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [template, setTemplate] = useState<CardTemplate>('info');
  const [draft, setDraft] = useState<Partial<ManualCard>>(TEMPLATE_DEFAULTS.info);
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [movePending, startMove] = useTransition();

  function applyTemplate(t: CardTemplate) {
    setTemplate(t);
    setDraft(TEMPLATE_DEFAULTS[t]);
  }

  function makeFormData(d: Partial<ManualCard>, id?: string): FormData {
    const fd = new FormData();
    if (id) fd.set('id', id);
    fd.set('title', d.title ?? '');
    fd.set('subtitle', d.subtitle ?? '');
    fd.set('body', d.body ?? '');
    fd.set('image_url', d.image_url ?? '');
    fd.set('price', d.price ?? '');
    fd.set('old_price', d.old_price ?? '');
    fd.set('stock_label', d.stock_label ?? '');
    fd.set('ribbon_text', d.ribbon_text ?? '');
    fd.set('ribbon_tone', d.ribbon_tone ?? 'featured');
    fd.set('cta_text', d.cta_text ?? '');
    fd.set('cta_href', d.cta_href ?? '');
    fd.set('layout', d.layout ?? 'standard');
    fd.set('text_color', d.text_color ?? '');
    fd.set('overlay_opacity', d.overlay_opacity != null ? String(d.overlay_opacity) : '');
    return fd;
  }

  const TEMPLATES: { v: CardTemplate; label: string; desc: string }[] = [
    { v: 'info',     label: 'ℹ Info',           desc: 'Solo texto, sin botón' },
    { v: 'product',  label: '🛒 Producto',       desc: 'Precio + descuento + stock' },
    { v: 'link',     label: '🔗 Link',           desc: 'CTA a otra página' },
    { v: 'banner_h', label: '🖼 Banner horizontal', desc: 'Imagen ancha con texto encima' },
    { v: 'banner_v', label: '🎨 Banner vertical',   desc: 'Imagen alta con texto encima' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">🧩 Tarjetas configuradas</h3>
          <p className="text-[11px] text-white/45">{items.length} {items.length === 1 ? 'tarjeta' : 'tarjetas'}.</p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => { setShowAddForm(true); applyTemplate('info'); }}
            className="text-xs px-3 py-1.5 rounded bg-white text-black font-semibold hover:bg-white/90 transition"
          >
            + Agregar tarjeta
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="rounded-xl border border-white/15 bg-white/[0.02] p-4 space-y-3">
          <div>
            <label className="block text-[10px] text-white/45 mb-1.5">Empezar con plantilla</label>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => applyTemplate(t.v)}
                  className={`text-left rounded border p-2.5 text-xs transition ${
                    template === t.v ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'
                  }`}
                >
                  <div className="font-semibold">{t.label}</div>
                  <div className="text-white/40 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <ManualCardForm value={draft} onChange={setDraft} />

          <div className="flex gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              disabled={addPending || !draft.title?.trim()}
              onClick={() => startAdd(async () => {
                await addCardItemAction(makeFormData(draft));
                setShowAddForm(false);
                setDraft(TEMPLATE_DEFAULTS.info);
              })}
              className="flex-1 rounded bg-white text-black text-xs font-semibold py-2 hover:bg-white/90 disabled:opacity-40 transition"
            >
              {addPending ? 'Guardando…' : 'Crear tarjeta'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setDraft(TEMPLATE_DEFAULTS.info); }}
              className="rounded border border-white/20 text-xs px-3 py-2 hover:bg-white/5 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((card, idx) => {
            const isEditing = editingId === card.id;
            const tone = RIBBON_TONES_UI.find((t) => t.value === card.ribbon_tone) ?? RIBBON_TONES_UI[0];
            const layoutBadge = card.layout === 'banner_h' ? '🖼 H' : card.layout === 'banner_v' ? '🎨 V' : '';
            return (
              <li key={card.id} className="rounded-lg border border-white/10 bg-white/[0.02]">
                {isEditing ? (
                  <InlineEditCard
                    card={card}
                    onSave={(data) => updateCardItemAction(makeFormData(data, card.id)).then(() => setEditingId(null))}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-12 h-12 rounded bg-white/5 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {card.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white/30 text-xl">🖼</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-semibold truncate">{card.title}</div>
                        {layoutBadge && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">{layoutBadge}</span>
                        )}
                        {card.ribbon_text && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${tone.cls}`}>
                            {card.ribbon_text}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-white/40 truncate">
                        {card.price ? `${card.price}${card.old_price ? ` (era ${card.old_price})` : ''} · ` : ''}
                        {card.cta_text ? `Botón: "${card.cta_text}"` : 'Sin botón'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={movePending || idx === 0}
                        onClick={() => startMove(async () => {
                          const fd = new FormData(); fd.set('id', card.id); fd.set('dir', 'up');
                          await moveCardItemAction(fd);
                        })}
                        className="text-xs px-2 py-1 rounded border border-white/15 hover:bg-white/5 disabled:opacity-30 transition"
                        title="Subir"
                      >↑</button>
                      <button
                        type="button"
                        disabled={movePending || idx === items.length - 1}
                        onClick={() => startMove(async () => {
                          const fd = new FormData(); fd.set('id', card.id); fd.set('dir', 'down');
                          await moveCardItemAction(fd);
                        })}
                        className="text-xs px-2 py-1 rounded border border-white/15 hover:bg-white/5 disabled:opacity-30 transition"
                        title="Bajar"
                      >↓</button>
                      <button
                        type="button"
                        onClick={() => setEditingId(card.id)}
                        className="text-xs px-2 py-1 rounded border border-white/15 hover:bg-white/5 transition"
                      >✎ Editar</button>
                      <button
                        type="button"
                        disabled={delPending}
                        onClick={() => {
                          if (!confirm('¿Eliminar esta tarjeta?')) return;
                          startDel(async () => {
                            const fd = new FormData(); fd.set('id', card.id);
                            await deleteCardItemAction(fd);
                          });
                        }}
                        className="text-xs px-2 py-1 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 transition"
                      >×</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      <div hidden>{primary}</div>
    </div>
  );
}

function ManualCardForm({ value, onChange }: { value: Partial<ManualCard>; onChange: (v: Partial<ManualCard>) => void }) {
  function set<K extends keyof ManualCard>(k: K, v: ManualCard[K] | undefined) {
    onChange({ ...value, [k]: v });
  }
  const layout = value.layout ?? 'standard';
  const isBanner = layout === 'banner_h' || layout === 'banner_v';

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="col-span-2">
        <label className="block text-xs text-white/60 mb-1">Estilo de la tarjeta</label>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { v: 'standard', label: '🎴 Estándar' },
            { v: 'banner_h', label: '🖼 Banner H' },
            { v: 'banner_v', label: '🎨 Banner V' }
          ] as { v: 'standard' | 'banner_h' | 'banner_v'; label: string }[]).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => set('layout', opt.v)}
              className={`text-[10px] px-2 py-1.5 rounded border transition ${
                layout === opt.v ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <Field label="Título *" value={value.title ?? ''} onChange={(v) => set('title', v)} placeholder="Nombre de la tarjeta" />
      </div>
      <Field label="Subtítulo / Categoría" value={value.subtitle ?? ''} onChange={(v) => set('subtitle', v)} placeholder="Ej. Producto físico" />
      <Field label="URL de imagen" value={value.image_url ?? ''} onChange={(v) => set('image_url', v)} placeholder="https://…" />
      <div className="col-span-2">
        <Textarea label="Descripción" value={value.body ?? ''} onChange={(v) => set('body', v)} rows={2} />
      </div>
      {!isBanner && (
        <>
          <Field label="Precio (libre)" value={value.price ?? ''} onChange={(v) => set('price', v)} placeholder="$ 9.999  o  Gratis" />
          <Field label="Precio anterior (tachado)" value={value.old_price ?? ''} onChange={(v) => set('old_price', v)} placeholder="$ 14.999" />
          <Field label="Etiqueta de stock" value={value.stock_label ?? ''} onChange={(v) => set('stock_label', v)} placeholder="Pocas unidades" />
        </>
      )}
      <Field label="Cinta destacada" value={value.ribbon_text ?? ''} onChange={(v) => set('ribbon_text', v)} placeholder="OFERTA, NUEVO…" />
      <div className="col-span-2">
        <label className="block text-xs text-white/60 mb-1">Color de la cinta</label>
        <div className="flex flex-wrap gap-1.5">
          {RIBBON_TONES_UI.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set('ribbon_tone', t.value)}
              className={`text-[10px] px-2 py-1 rounded uppercase font-bold tracking-wider transition ${t.cls} ${
                (value.ribbon_tone ?? 'featured') === t.value ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {isBanner && (
        <>
          <div className="col-span-2 pt-2 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-white/45 mb-2">Personalización del banner</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2">
                <label className="text-xs text-white/60 flex-1">Color del texto</label>
                <input
                  type="color"
                  value={value.text_color ?? '#ffffff'}
                  onChange={(e) => set('text_color', e.target.value)}
                  className="w-7 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/45 mb-1">Oscurecer imagen ({Math.round((value.overlay_opacity ?? 0.4) * 100)}%)</label>
                <input
                  type="range"
                  min={0} max={1} step={0.05}
                  value={value.overlay_opacity ?? 0.4}
                  onChange={(e) => set('overlay_opacity', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </>
      )}
      <Field label="Texto del botón (vacío = sin botón)" value={value.cta_text ?? ''} onChange={(v) => set('cta_text', v)} placeholder="Comprar ahora" />
      <div className="col-span-2">
        <HrefField label="Destino del botón" value={value.cta_href ?? ''} onChange={(v) => set('cta_href', v)} />
      </div>
    </div>
  );
}

function InlineEditCard({ card, onSave, onCancel }: {
  card: ManualCard; onSave: (data: Partial<ManualCard>) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Partial<ManualCard>>(card);
  const [pending, start] = useTransition();
  return (
    <div className="p-3 space-y-3">
      <ManualCardForm value={draft} onChange={setDraft} />
      <div className="flex gap-2 pt-2 border-t border-white/10">
        <button
          type="button"
          disabled={pending || !draft.title?.trim()}
          onClick={() => start(async () => { await onSave(draft); })}
          className="flex-1 rounded bg-white text-black text-xs font-semibold py-2 hover:bg-white/90 disabled:opacity-40 transition"
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-white/20 text-xs px-3 py-2 hover:bg-white/5 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* =====================================================================
 * TESTIMONIALS (enhanced — photo + stars + role)
 * ===================================================================== */

export function TestimonialsEditor({ initialTitle, items, primary }: {
  initialTitle: string; items: TestimonialItem[]; primary: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const { pending, saved, fire } = useSave('testimonials');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [text, setText] = useState('');
  const [rating, setRating] = useState(5);
  const [photoUrl, setPhotoUrl] = useState('');

  function startEdit(t: TestimonialItem) {
    setEditingId(t.id);
    setName(t.name); setRole(t.role ?? ''); setText(t.text);
    setRating(t.rating ?? 5); setPhotoUrl(t.photo_url ?? '');
  }
  function reset() {
    setEditingId(null); setName(''); setRole(''); setText(''); setRating(5); setPhotoUrl('');
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingId ? '✎ Editando testimonio' : 'Agregar testimonio'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rol o ciudad (opcional)" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Lo que dijo" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-xs text-white/60">Rating:</span>
            {[1, 2, 3, 4, 5].map((r) => (
              <button key={r} type="button" onClick={() => setRating(r)} className={`text-base ${r <= rating ? 'text-yellow-400' : 'text-white/20'}`}>★</button>
            ))}
            <span className="text-xs text-white/40">({rating})</span>
          </div>
          <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="URL de la foto (opcional, cuadrada 400×400)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={addPending || !name || !text}
              onClick={() => {
                startAdd(async () => {
                  const fd = new FormData();
                  fd.set('name', name); fd.set('role', role); fd.set('text', text);
                  fd.set('rating', String(rating)); fd.set('photo_url', photoUrl);
                  if (editingId) {
                    fd.set('id', editingId);
                    await updateTestimonialAction(fd);
                  } else {
                    await addTestimonialAction(fd);
                  }
                  reset();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Agregar'}
            </button>
            {editingId && (
              <button type="button" onClick={reset}
                className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">
                Cancelar
              </button>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((t) => (
              <li key={t.id} className={`rounded border p-2 flex items-start justify-between gap-3 text-sm ${editingId === t.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                <div className="flex gap-2 flex-1 min-w-0">
                  {t.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: primary }}>
                      {t.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.name}{t.role && <span className="text-white/40"> · {t.role}</span>}</div>
                    <div className="text-yellow-400 text-xs">{'★'.repeat(t.rating ?? 5)}</div>
                    <div className="text-white/60 text-xs mt-0.5 line-clamp-2">{t.text}</div>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" onClick={() => startEdit(t)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                  <button type="button" disabled={delPending} onClick={() => {
                    if (!confirm('¿Eliminar este testimonio?')) return;
                    startDel(async () => {
                      const fd = new FormData(); fd.set('id', t.id);
                      await deleteTestimonialAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PreviewFrame>
        <div className="p-5" style={{ background: 'rgba(0,0,0,0.02)' }}>
          <h2 className="text-lg font-bold mb-3 text-center">{title || '—'}</h2>
          {items.length === 0 ? (
            <div className="text-center text-xs text-black/40 py-4">Agregá testimonios para verlos acá.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {items.slice(0, 4).map((t) => (
                <div key={t.id} className="rounded bg-white border border-black/10 p-2.5">
                  <div className="text-yellow-500 text-[10px] mb-1">{'★'.repeat(t.rating ?? 5)}</div>
                  <p className="text-[10px] text-black/80 italic line-clamp-2">"{t.text}"</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {t.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.photo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ background: primary }}>
                        {t.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="text-[9px]">
                      <div className="font-medium">{t.name}</div>
                      {t.role && <div className="text-black/40">{t.role}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * FAQ
 * ===================================================================== */

export function FaqEditor({ initialTitle, items }: { initialTitle: string; items: FaqItem[] }) {
  const [title, setTitle] = useState(initialTitle);
  const { pending, saved, fire } = useSave('faq');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');

  function startEdit(item: FaqItem) {
    setEditingId(item.id);
    setQ(item.q);
    setA(item.a);
  }
  function cancelEdit() {
    setEditingId(null); setQ(''); setA('');
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingId ? '✎ Editando pregunta' : 'Agregar pregunta'}
          </label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pregunta" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <textarea value={a} onChange={(e) => setA(e.target.value)} rows={2} placeholder="Respuesta" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={addPending || !q || !a}
              onClick={() => {
                startAdd(async () => {
                  const fd = new FormData(); fd.set('q', q); fd.set('a', a);
                  if (editingId) {
                    fd.set('id', editingId);
                    await updateFaqAction(fd);
                  } else {
                    await addFaqAction(fd);
                  }
                  setQ(''); setA(''); setEditingId(null);
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Agregar'}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit}
                className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">
                Cancelar
              </button>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((f) => (
              <li key={f.id} className={`rounded border p-2 flex items-start justify-between gap-3 text-sm ${editingId === f.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{f.q}</div>
                  <div className="text-white/60 text-xs mt-0.5 whitespace-pre-line line-clamp-2">{f.a}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" onClick={() => startEdit(f)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                  <button type="button" disabled={delPending} onClick={() => {
                    if (!confirm('¿Eliminar esta pregunta?')) return;
                    startDel(async () => {
                      const fd = new FormData(); fd.set('id', f.id);
                      await deleteFaqAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-lg font-bold mb-3 text-center">{title || '—'}</h2>
          {items.length === 0 ? (
            <div className="text-center text-xs text-black/40 py-4">Agregá preguntas para verlas acá.</div>
          ) : (
            <div className="space-y-1.5">
              {items.slice(0, 5).map((f) => (
                <div key={f.id} className="rounded border border-black/10 px-3 py-2 text-xs">
                  <div className="font-medium">{f.q}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * OFFER (countdown)
 * ===================================================================== */

type OfferValues = { title: string; subtitle: string; ends_at: string; cta_label: string; cta_href: string };

export function OfferEditor({ initial, primary }: { initial: OfferValues; primary: string }) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('offer');

  // Live countdown in preview
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const endsMs = v.ends_at ? new Date(v.ends_at).getTime() : 0;
  const diff = Math.max(0, endsMs - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <Field label="Subtítulo" value={v.subtitle} onChange={(x) => setV({ ...v, subtitle: x })} />
        <Field
          label="Termina el (datetime local)"
          value={v.ends_at}
          onChange={(x) => setV({ ...v, ends_at: x })}
          placeholder="2026-12-31T23:59"
          type="datetime-local"
        />
        <Field label="Texto del botón" value={v.cta_label} onChange={(x) => setV({ ...v, cta_label: x })} />
        <HrefField label="Destino del botón" value={v.cta_href} onChange={(x) => setV({ ...v, cta_href: x })} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />
      </div>
      <PreviewFrame>
        <div className="p-5 text-center text-white" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
          <h2 className="text-lg font-bold">{v.title || '—'}</h2>
          {v.subtitle && <p className="text-xs opacity-90 mt-1">{v.subtitle}</p>}
          {v.ends_at ? (
            <div className="flex justify-center gap-2 my-3">
              {[{ n: d, l: 'd' }, { n: h, l: 'h' }, { n: m, l: 'm' }, { n: s, l: 's' }].map((b, i) => (
                <div key={i} className="bg-white/15 rounded px-2 py-1.5 min-w-[40px]">
                  <div className="text-lg font-bold leading-none">{String(b.n).padStart(2, '0')}</div>
                  <div className="text-[9px] opacity-70">{b.l}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs opacity-70 mt-2">Cargá la fecha de fin →</p>
          )}
          {v.cta_label && (
            <span className="mt-2 inline-block rounded px-4 py-2 text-xs font-semibold bg-white text-black">{v.cta_label}</span>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * NEWSLETTER
 * ===================================================================== */

type NewsletterValues = { title: string; subtitle: string; cta_label: string };

export function NewsletterEditor({ initial, primary }: { initial: NewsletterValues; primary: string }) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('newsletter');
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <Field label="Subtítulo" value={v.subtitle} onChange={(x) => setV({ ...v, subtitle: x })} />
        <Field label="Texto del botón" value={v.cta_label} onChange={(x) => setV({ ...v, cta_label: x })} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />
      </div>
      <PreviewFrame>
        <div className="p-5 text-center" style={{ background: `${primary}10` }}>
          <h2 className="text-lg font-bold">{v.title || '—'}</h2>
          {v.subtitle && <p className="text-xs text-black/60 mt-1">{v.subtitle}</p>}
          <div className="mt-3 flex gap-1 max-w-xs mx-auto">
            <input disabled placeholder="tu@email.com" className="flex-1 rounded border border-black/15 px-2 py-1.5 text-xs bg-white" />
            <span className="rounded px-3 py-1.5 text-xs font-semibold text-white" style={{ background: primary }}>{v.cta_label || '—'}</span>
          </div>
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * CTA FINAL
 * ===================================================================== */

type CtaValues = { title: string; body: string; cta_label: string; cta_href: string };

export function CtaFinalEditor({ initial, primary }: { initial: CtaValues; primary: string }) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('cta_final');
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <Textarea label="Texto" value={v.body} onChange={(x) => setV({ ...v, body: x })} rows={3} />
        <Field label="Texto del botón" value={v.cta_label} onChange={(x) => setV({ ...v, cta_label: x })} />
        <HrefField label="Destino del botón" value={v.cta_href} onChange={(x) => setV({ ...v, cta_href: x })} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />
      </div>
      <PreviewFrame>
        <div className="p-6 text-center" style={{ background: `linear-gradient(0deg, ${primary}15 0%, transparent 100%)` }}>
          <h2 className="text-lg font-bold">{v.title || '—'}</h2>
          {v.body && <p className="text-xs text-black/60 mt-1.5">{v.body}</p>}
          {v.cta_label && <span className="mt-3 inline-block rounded-md px-4 py-2 text-xs font-semibold text-white" style={{ background: primary }}>{v.cta_label}</span>}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * BEFORE / AFTER
 * ===================================================================== */

type BAValues = { title: string; before_label: string; after_label: string; before_body: string; after_body: string };

export function BeforeAfterEditor({ initial, beforeUrl, afterUrl, primary }: {
  initial: BAValues; beforeUrl: string | null; afterUrl: string | null; primary: string;
}) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('before_after');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Label izquierda" value={v.before_label} onChange={(x) => setV({ ...v, before_label: x })} />
          <Field label="Label derecha" value={v.after_label} onChange={(x) => setV({ ...v, after_label: x })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Textarea label="Texto Antes" value={v.before_body} onChange={(x) => setV({ ...v, before_body: x })} rows={3} />
          <Textarea label="Texto Después" value={v.after_body} onChange={(x) => setV({ ...v, after_body: x })} rows={3} />
        </div>
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />

        <div className="grid grid-cols-1 gap-3 pt-3 mt-3 border-t border-white/5">
          <UrlPicker
            label="URL imagen Antes"
            section="before_after"
            field="before_image_url"
            value={beforeUrl}
            hint="Recomendado 800×600px, 4:3"
          />
          <UrlPicker
            label="URL imagen Después"
            section="before_after"
            field="after_image_url"
            value={afterUrl}
            hint="Recomendado 800×600px, 4:3 (mismas dimensiones que la de Antes)"
          />
        </div>
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-lg font-bold text-center mb-3">{v.title || '—'}</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-center font-semibold py-1 rounded-t text-white" style={{ background: `${primary}aa` }}>{v.before_label || 'Antes'}</div>
              {beforeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={beforeUrl} alt="" className="w-full h-28 object-cover rounded-b" />
              ) : (
                <div className="w-full h-28 rounded-b flex items-center justify-center text-2xl bg-black/5">🖼️</div>
              )}
              {v.before_body && <p className="text-[10px] text-black/70 mt-2 line-clamp-3">{v.before_body}</p>}
            </div>
            <div>
              <div className="text-[10px] text-center font-semibold py-1 rounded-t text-white" style={{ background: primary }}>{v.after_label || 'Después'}</div>
              {afterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={afterUrl} alt="" className="w-full h-28 object-cover rounded-b" />
              ) : (
                <div className="w-full h-28 rounded-b flex items-center justify-center text-2xl bg-black/5">🖼️</div>
              )}
              {v.after_body && <p className="text-[10px] text-black/70 mt-2 line-clamp-3">{v.after_body}</p>}
            </div>
          </div>
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * PRICING TIERS
 * ===================================================================== */

export function PricingEditor({ initialTitle, initialSubtitle, tiers, primary }: {
  initialTitle: string; initialSubtitle: string; tiers: PricingTier[]; primary: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const { pending, saved, fire } = useSave('pricing');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tn, setTn] = useState('');
  const [tp, setTp] = useState('');
  const [td, setTd] = useState('');
  const [tf, setTf] = useState('');
  const [tc, setTc] = useState('Elegir plan');
  const [th, setTh] = useState('#cursos');
  const [hi, setHi] = useState(false);

  function startEdit(t: PricingTier) {
    setEditingId(t.id);
    setTn(t.name); setTp(t.price); setTd(t.description ?? '');
    setTf(t.features.join('\n')); setTc(t.cta_label); setTh(t.cta_href);
    setHi(!!t.highlighted);
  }
  function reset() {
    setEditingId(null); setTn(''); setTp(''); setTd(''); setTf('');
    setTc('Elegir plan'); setTh('#cursos'); setHi(false);
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <Field label="Subtítulo" value={subtitle} onChange={setSubtitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title, subtitle })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingId ? '✎ Editando plan' : 'Agregar plan'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input value={tn} onChange={(e) => setTn(e.target.value)} placeholder="Nombre (ej. Pro)" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input value={tp} onChange={(e) => setTp(e.target.value)} placeholder="Precio (ej. $14.900 / mes)" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <input value={td} onChange={(e) => setTd(e.target.value)} placeholder="Descripción corta (opcional)" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <textarea value={tf} onChange={(e) => setTf(e.target.value)} rows={3} placeholder="Features, una por línea&#10;Acceso de por vida&#10;Soporte 24/7&#10;Certificado" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <input value={tc} onChange={(e) => setTc(e.target.value)} placeholder="Texto del botón" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <HrefField label="Destino del botón" value={th} onChange={setTh} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hi} onChange={(e) => setHi(e.target.checked)} />
            Marcar como plan destacado
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={addPending || !tn || !tp}
              onClick={() => {
                startAdd(async () => {
                  const fd = new FormData();
                  fd.set('name', tn); fd.set('price', tp); fd.set('description', td);
                  fd.set('features', tf); fd.set('cta_label', tc); fd.set('cta_href', th);
                  if (hi) fd.set('highlighted', 'on');
                  if (editingId) { fd.set('id', editingId); await updatePricingTierAction(fd); }
                  else { await addPricingTierAction(fd); }
                  reset();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Agregar plan'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">Cancelar</button>
            )}
          </div>
        </div>

        {tiers.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {tiers.map((t) => (
              <li key={t.id} className={`rounded border p-2 flex items-start justify-between gap-3 text-sm ${editingId === t.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                <div>
                  <div className="font-medium">
                    {t.name} <span className="text-white/40">— {t.price}</span>
                    {t.highlighted && <span className="ml-2 text-xs text-amber-300">★ destacado</span>}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">{t.features.length} feature(s)</div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => startEdit(t)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                  <button type="button" disabled={delPending} onClick={() => {
                    if (!confirm('¿Eliminar este plan?')) return;
                    startDel(async () => {
                      const fd = new FormData(); fd.set('id', t.id);
                      await deletePricingTierAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-base font-bold text-center">{title || '—'}</h2>
          {subtitle && <p className="text-xs text-black/60 text-center mt-1">{subtitle}</p>}
          {tiers.length === 0 ? (
            <div className="text-center text-xs text-black/40 py-4">Agregá planes para verlos acá.</div>
          ) : (
            <div className={`grid gap-2 mt-3 ${tiers.length === 1 ? 'grid-cols-1' : tiers.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {tiers.slice(0, 3).map((t) => (
                <div key={t.id} className={`rounded-lg border p-2.5 ${t.highlighted ? 'border-2' : 'border-black/10'}`} style={t.highlighted ? { borderColor: primary } : undefined}>
                  <div className="text-[10px] font-semibold uppercase" style={{ color: primary }}>{t.name}</div>
                  <div className="text-sm font-bold mt-0.5">{t.price}</div>
                  {t.description && <div className="text-[9px] text-black/60 mt-0.5">{t.description}</div>}
                  <ul className="mt-2 space-y-0.5">
                    {t.features.slice(0, 3).map((f, i) => (
                      <li key={i} className="text-[9px] text-black/70">✓ {f}</li>
                    ))}
                    {t.features.length > 3 && <li className="text-[9px] text-black/40">+{t.features.length - 3}</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * VIDEO embed
 * ===================================================================== */

type VideoValues = { title: string; subtitle: string; provider: 'youtube' | 'drive'; video_id: string };

export function VideoEditor({ initial, primary }: { initial: VideoValues; primary: string }) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('video');

  function extractId(input: string): string {
    const trimmed = input.trim();
    // YouTube patterns
    const yt = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{8,})/);
    if (yt) return yt[1];
    // Drive
    const drv = trimmed.match(/\/file\/d\/([\w-]{15,})/);
    if (drv) return drv[1];
    // bare id
    return trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function embedSrc() {
    if (!v.video_id) return null;
    if (v.provider === 'youtube') return `https://www.youtube.com/embed/${v.video_id}`;
    return `https://drive.google.com/file/d/${v.video_id}/preview`;
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <Field label="Subtítulo (opcional)" value={v.subtitle} onChange={(x) => setV({ ...v, subtitle: x })} />
        <div>
          <label className="block text-xs text-white/60 mb-1">Plataforma</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(['youtube', 'drive'] as const).map((p) => (
              <button key={p} type="button"
                onClick={() => setV({ ...v, provider: p })}
                className={`px-3 py-2 rounded border ${v.provider === p ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'}`}>
                {p === 'youtube' ? '▶ YouTube' : '📁 Google Drive'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1">URL del video o ID</label>
          <input
            value={v.video_id}
            onChange={(e) => setV({ ...v, video_id: extractId(e.target.value) })}
            placeholder={v.provider === 'youtube' ? 'https://youtu.be/... o ID' : 'https://drive.google.com/file/d/... o ID'}
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
          {v.video_id && <p className="text-xs text-white/40 mt-1 font-mono">ID: {v.video_id}</p>}
        </div>
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-base font-bold text-center">{v.title || '—'}</h2>
          {v.subtitle && <p className="text-xs text-black/60 text-center mt-1">{v.subtitle}</p>}
          <div className="mt-3 aspect-video rounded-lg overflow-hidden border border-black/10 bg-black flex items-center justify-center">
            {embedSrc() ? (
              <iframe src={embedSrc()!} className="w-full h-full" allowFullScreen title="preview video" />
            ) : (
              <div className="text-white/40 text-sm">📺 Cargá un video</div>
            )}
          </div>
          <p className="text-xs text-black/40 text-center mt-2" style={{ color: primary }}>
            {v.provider === 'youtube' ? 'YouTube' : 'Google Drive'}
          </p>
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * GALLERY
 * ===================================================================== */

export function GalleryEditor({ initialTitle, initialSubtitle, items, columns }: {
  initialTitle: string; initialSubtitle: string; items: GalleryItem[]; columns: 2 | 3 | 4;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [cols, setCols] = useState<2 | 3 | 4>(columns);
  const { pending, saved, fire } = useSave('gallery');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState('');
  const [caption, setCaption] = useState('');

  function startEdit(it: GalleryItem) { setEditingId(it.id); setImgUrl(it.image_url); setCaption(it.caption ?? ''); }
  function reset() { setEditingId(null); setImgUrl(''); setCaption(''); }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título" value={title} onChange={setTitle} />
        <Field label="Subtítulo (opcional)" value={subtitle} onChange={setSubtitle} />
        <div>
          <label className="block text-xs text-white/60 mb-1">Columnas</label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {([2, 3, 4] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCols(c)}
                className={`px-3 py-2 rounded border ${cols === c ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title, subtitle, columns: String(cols) })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingId ? '✎ Editando imagen' : 'Agregar imagen (URL)'}
          </label>
          <input type="url" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)}
            placeholder="https://… URL de la imagen"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <input value={caption} onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (opcional)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={addPending || !imgUrl}
              onClick={() => {
                startAdd(async () => {
                  const fd = new FormData();
                  fd.set('image_url', imgUrl); fd.set('caption', caption);
                  if (editingId) { fd.set('id', editingId); await updateGalleryImageAction(fd); }
                  else { await addGalleryImageAction(fd); }
                  reset();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Agregar imagen'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">Cancelar</button>
            )}
          </div>
          <p className="text-[10px] text-white/40">📐 Recomendado 1200×900px (4:3) o 1200×1200px (cuadrada) para que se vean iguales</p>
        </div>

        {items.length > 0 && (
          <div className="pt-3 mt-3 border-t border-white/5">
            <p className="text-xs text-white/60 mb-2">{items.length} imagen(es)</p>
            <ul className="grid grid-cols-3 gap-2">
              {items.map((it) => (
                <li key={it.id} className={`relative group rounded overflow-hidden ${editingId === it.id ? 'ring-2 ring-fuchsia-500' : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image_url} alt={it.caption ?? ''} className="w-full h-20 object-cover rounded" />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button type="button" onClick={() => startEdit(it)}
                      className="bg-white text-black text-xs w-5 h-5 rounded-full flex items-center justify-center"
                      title="Editar">✎</button>
                    <button type="button" disabled={delPending}
                      onClick={() => {
                        if (!confirm('¿Eliminar?')) return;
                        startDel(async () => {
                          const fd = new FormData(); fd.set('id', it.id);
                          await deleteGalleryImageAction(fd);
                        });
                      }}
                      className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-base font-bold text-center">{title || '—'}</h2>
          {subtitle && <p className="text-xs text-black/60 text-center mt-1">{subtitle}</p>}
          {items.length === 0 ? (
            <div className="text-center text-xs text-black/40 py-4">Subí imágenes para verlas acá.</div>
          ) : (
            <div className={`grid gap-1 mt-3 grid-cols-${cols}`}>
              {items.slice(0, 12).map((it) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={it.id} src={it.image_url} alt={it.caption ?? ''} className="w-full h-14 object-cover rounded" />
              ))}
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * CONTACT
 * ===================================================================== */

type ContactValues = {
  title: string; subtitle: string; email: string; whatsapp: string;
  name_label: string; email_label: string; message_label: string; submit_label: string;
};

/* =====================================================================
 * MAP — Google Maps embed (sin API key)
 * ===================================================================== */

type MapValues = {
  title: string; subtitle: string; address: string;
  zoom: number; height_px: number; show_directions_cta: boolean;
};

export function MapEditor({ initial }: { initial: MapValues }) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('map');
  const encoded = encodeURIComponent(v.address.trim() || 'Buenos Aires, Argentina');
  const embedSrc = `https://www.google.com/maps?q=${encoded}&z=${v.zoom}&output=embed`;
  const searchLink = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <Field label="Subtítulo" value={v.subtitle} onChange={(x) => setV({ ...v, subtitle: x })} />

        <div>
          <label className="block text-xs text-white/60 mb-1">Dirección (la que se muestra en el mapa)</label>
          <input
            value={v.address}
            onChange={(e) => setV({ ...v, address: e.target.value })}
            placeholder="Av. Corrientes 1234, CABA, Argentina"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
          <p className="text-[10px] text-white/40 mt-1">
            💡 Tipeá tu dirección lo más completa posible (calle + número + ciudad + país).
            {' '}
            <a href={searchLink} target="_blank" rel="noopener noreferrer" className="underline text-white/65 hover:text-white">
              Verificá en Google Maps →
            </a>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 flex items-center justify-between">
              <span>🔍 Zoom</span><span className="text-white/45 tabular-nums">{v.zoom}</span>
            </label>
            <input type="range" min={1} max={20} step={1}
              value={v.zoom} onChange={(e) => setV({ ...v, zoom: parseInt(e.target.value, 10) })}
              className="w-full mt-1 accent-fuchsia-500" />
            <div className="flex justify-between text-[10px] text-white/40">
              <span>🌍 Mundo</span><span>🏠 Detalle</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 flex items-center justify-between">
              <span>📐 Alto</span><span className="text-white/45 tabular-nums">{v.height_px}px</span>
            </label>
            <input type="range" min={200} max={800} step={10}
              value={v.height_px} onChange={(e) => setV({ ...v, height_px: parseInt(e.target.value, 10) })}
              className="w-full mt-1 accent-fuchsia-500" />
            <div className="flex justify-between text-[10px] text-white/40">
              <span>Bajo</span><span>Alto</span>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.show_directions_cta}
            onChange={(e) => setV({ ...v, show_directions_cta: e.target.checked })} />
          Mostrar botón &quot;🗺 Cómo llegar&quot; debajo del mapa
        </label>

        <SaveBar pending={pending} saved={saved} onSave={() => fire({
          title: v.title, subtitle: v.subtitle, address: v.address,
          zoom: String(v.zoom), height_px: String(v.height_px),
          show_directions_cta: v.show_directions_cta
        })} />

        <p className="text-[10px] text-white/40 pt-2 border-t border-white/5">
          ✅ Sin API key — usa el embed gratis de Google Maps.
        </p>
      </div>
      <PreviewFrame>
        <div className="p-3">
          {(v.title || v.subtitle) && (
            <div className="text-center mb-2">
              {v.title && <h2 className="text-base font-bold">{v.title}</h2>}
              {v.subtitle && <p className="text-[10px] text-black/55">{v.subtitle}</p>}
            </div>
          )}
          {v.address.trim() ? (
            <div className="rounded overflow-hidden border border-black/15" style={{ height: '180px' }}>
              <iframe
                src={embedSrc}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                title="preview map"
              />
            </div>
          ) : (
            <div className="rounded border-2 border-dashed border-black/15 flex items-center justify-center text-black/40 text-xs" style={{ height: '180px' }}>
              📍 Tipeá una dirección
            </div>
          )}
          {v.address.trim() && <p className="text-[10px] text-black/65 text-center mt-2">📍 {v.address}</p>}
        </div>
      </PreviewFrame>
    </div>
  );
}

export function ContactEditor({ initial, primary }: { initial: ContactValues; primary: string }) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('contact');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <Field label="Subtítulo" value={v.subtitle} onChange={(x) => setV({ ...v, subtitle: x })} />
        <Field label="Email para recibir consultas" value={v.email} onChange={(x) => setV({ ...v, email: x })} placeholder="contacto@tuacademia.com" type="email" />
        <Field label="WhatsApp (opcional, ej. 5491112345678)" value={v.whatsapp} onChange={(x) => setV({ ...v, whatsapp: x })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Label Nombre" value={v.name_label} onChange={(x) => setV({ ...v, name_label: x })} />
          <Field label="Label Email" value={v.email_label} onChange={(x) => setV({ ...v, email_label: x })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Label Mensaje" value={v.message_label} onChange={(x) => setV({ ...v, message_label: x })} />
          <Field label="Label Botón" value={v.submit_label} onChange={(x) => setV({ ...v, submit_label: x })} />
        </div>
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-base font-bold text-center">{v.title || '—'}</h2>
          {v.subtitle && <p className="text-xs text-black/60 text-center mt-1">{v.subtitle}</p>}
          <div className="mt-3 space-y-2">
            <input disabled placeholder={v.name_label || 'Nombre'} className="w-full rounded border border-black/15 px-2 py-1.5 text-xs bg-white" />
            <input disabled placeholder={v.email_label || 'Email'} className="w-full rounded border border-black/15 px-2 py-1.5 text-xs bg-white" />
            <textarea disabled rows={2} placeholder={v.message_label || 'Mensaje'} className="w-full rounded border border-black/15 px-2 py-1.5 text-xs bg-white" />
            <span className="inline-block rounded px-3 py-1.5 text-xs font-semibold text-white" style={{ background: primary }}>{v.submit_label || 'Enviar'}</span>
          </div>
          {v.whatsapp && <p className="text-[10px] text-center text-black/40 mt-2">📱 También por WhatsApp</p>}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * CUSTOM block (comodín)
 * ===================================================================== */

type CustomValues = { title: string; subtitle: string; body: string; image_pos: CustomImagePos; cta_label: string; cta_href: string };

export function CustomEditor({ initial, imageUrl, primary }: {
  initial: CustomValues; imageUrl: string | null; primary: string;
}) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('custom');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <Field label="Subtítulo (opcional)" value={v.subtitle} onChange={(x) => setV({ ...v, subtitle: x })} />
        <Textarea label="Texto principal (HTML básico permitido)" value={v.body} onChange={(x) => setV({ ...v, body: x })} rows={6} />
        <div>
          <label className="block text-xs text-white/60 mb-2">Posición de la imagen</label>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {(['none', 'left', 'right', 'top'] as CustomImagePos[]).map((p) => (
              <button key={p} type="button"
                onClick={() => setV({ ...v, image_pos: p })}
                className={`px-2 py-1.5 rounded border ${v.image_pos === p ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'}`}>
                {p === 'none' ? 'sin imagen' : p === 'left' ? '← imagen' : p === 'right' ? 'imagen →' : '↑ arriba'}
              </button>
            ))}
          </div>
        </div>
        <Field label="Botón (opcional)" value={v.cta_label} onChange={(x) => setV({ ...v, cta_label: x })} />
        <HrefField label="Destino del botón" value={v.cta_href} onChange={(x) => setV({ ...v, cta_href: x })} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />

        <div className="pt-3 mt-3 border-t border-white/5">
          <UrlPicker
            label="URL de la imagen del bloque"
            section="custom"
            field="image_url"
            value={imageUrl}
            hint="Recomendado 1200×900px (4:3) o cuadrada"
          />
        </div>
      </div>
      <PreviewFrame>
        <div className="p-5">
          {v.image_pos === 'top' && imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-28 object-cover rounded-lg mb-3" />
          )}
          <div className={`flex gap-3 items-center ${v.image_pos === 'left' ? 'flex-row' : v.image_pos === 'right' ? 'flex-row-reverse' : 'flex-col'}`}>
            {(v.image_pos === 'left' || v.image_pos === 'right') && imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-24 h-24 object-cover rounded-lg flex-shrink-0" />
            )}
            <div className={v.image_pos === 'none' || v.image_pos === 'top' ? 'text-center w-full' : 'flex-1'}>
              <h2 className="text-base font-bold">{v.title || '—'}</h2>
              {v.subtitle && <p className="text-xs text-black/60 mt-0.5">{v.subtitle}</p>}
              {v.body && <p className="text-xs text-black/70 mt-2 line-clamp-3 whitespace-pre-line">{v.body.replace(/<[^>]+>/g, '')}</p>}
              {v.cta_label && <span className="inline-block mt-2 rounded px-3 py-1.5 text-xs font-semibold text-white" style={{ background: primary }}>{v.cta_label}</span>}
            </div>
          </div>
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * NAV EDITOR
 * ===================================================================== */

export function NavEditor({
  links, showLogin, primary, tenantName,
  showMyCourses = true, showAffiliates = true,
  myCoursesLabel = '', affiliatesLabel = ''
}: {
  links: NavLink[]; showLogin: boolean; primary: string; tenantName: string;
  showMyCourses?: boolean; showAffiliates?: boolean;
  myCoursesLabel?: string; affiliatesLabel?: string;
}) {
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [togglePending, startToggle] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');

  function startEdit(l: NavLink) { setEditingId(l.id); setLabel(l.label); setHref(l.href); }
  function reset() { setEditingId(null); setLabel(''); setHref(''); }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showLogin} disabled={togglePending}
            onChange={() => startToggle(() => withSaveStatus(() => toggleNavLoginAction()))} />
          Mostrar botón "Iniciar sesión" en el nav
        </label>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-white/45 font-semibold">
            Links automáticos del nav
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showMyCourses} disabled={togglePending}
              onChange={() => startToggle(() => withSaveStatus(async () => {
                const fd = new FormData(); fd.set('flag', 'show_my_courses');
                await toggleNavFlagAction(fd);
              }))} />
            Mostrar &quot;{myCoursesLabel || 'Mis cursos'}&quot;
          </label>
          {showMyCourses && (
            <input
              defaultValue={myCoursesLabel}
              placeholder="Mis cursos"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (myCoursesLabel ?? '').trim()) return;
                startToggle(() => withSaveStatus(async () => {
                  const fd = new FormData();
                  fd.set('key', 'my_courses_label'); fd.set('value', v);
                  await setNavLabelAction(fd);
                }));
              }}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-1.5 text-xs"
            />
          )}

          <label className="flex items-center gap-2 text-sm mt-2">
            <input type="checkbox" checked={showAffiliates} disabled={togglePending}
              onChange={() => startToggle(() => withSaveStatus(async () => {
                const fd = new FormData(); fd.set('flag', 'show_affiliates');
                await toggleNavFlagAction(fd);
              }))} />
            Mostrar &quot;{affiliatesLabel || 'Afiliados'}&quot;
          </label>
          {showAffiliates && (
            <input
              defaultValue={affiliatesLabel}
              placeholder="Afiliados"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (affiliatesLabel ?? '').trim()) return;
                startToggle(() => withSaveStatus(async () => {
                  const fd = new FormData();
                  fd.set('key', 'affiliates_label'); fd.set('value', v);
                  await setNavLabelAction(fd);
                }));
              }}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-1.5 text-xs"
            />
          )}

          <p className="text-[10px] text-white/35 mt-1">
            Si tu sitio no vende cursos (ej. e-commerce), podés ocultar ambos.
            El label es libre: &quot;Mis compras&quot;, &quot;Mi cuenta&quot;, &quot;Ser embajador&quot;, etc.
          </p>
        </div>

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingId ? '✎ Editando link' : 'Agregar link al nav'}
          </label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Cursos" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <HrefField label="Destino" value={href} onChange={setHref} />
          <div className="flex gap-2">
            <button type="button" disabled={addPending || !label || !href}
              onClick={() => {
                startAdd(async () => {
                  const fd = new FormData(); fd.set('label', label); fd.set('href', href);
                  if (editingId) { fd.set('id', editingId); await updateNavLinkAction(fd); }
                  else { await addNavLinkAction(fd); }
                  reset();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Agregar link'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">Cancelar</button>
            )}
          </div>
        </div>

        {links.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {links.map((l) => (
              <li key={l.id} className={`rounded border p-2 flex items-center justify-between gap-3 text-sm ${editingId === l.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                <div><span className="font-medium">{l.label}</span> <span className="text-white/40 text-xs">{l.href}</span></div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => startEdit(l)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                  <button type="button" disabled={delPending} onClick={() => {
                    if (!confirm('¿Eliminar?')) return;
                    startDel(async () => {
                      const fd = new FormData(); fd.set('id', l.id);
                      await deleteNavLinkAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PreviewFrame label="Preview del nav del storefront">
        <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ background: primary }}>
              {tenantName.slice(0, 1).toUpperCase()}
            </div>
            <span className="font-bold text-xs">{tenantName}</span>
          </div>
          <nav className="flex gap-3 text-xs text-black/70">
            {links.length === 0 && <span className="text-black/30">Sin links custom</span>}
            {links.map((l) => <span key={l.id}>{l.label}</span>)}
          </nav>
          {showLogin && <span className="rounded bg-black text-white px-2.5 py-1 text-[10px] font-medium">Iniciar sesión</span>}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * FOOTER EDITOR
 * ===================================================================== */

const SOCIAL_OPTIONS: SocialLink['network'][] = ['instagram', 'youtube', 'linkedin', 'twitter', 'tiktok', 'facebook', 'web'];
const SOCIAL_LABEL: Record<SocialLink['network'], string> = {
  instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn',
  twitter: 'Twitter / X', tiktok: 'TikTok', facebook: 'Facebook', web: 'Sitio web'
};

export function FooterEditor({ initialText, links, socials, tenantName }: {
  initialText: string; links: NavLink[]; socials: SocialLink[]; tenantName: string;
}) {
  const [text, setText] = useState(initialText);
  const [textPending, startText] = useTransition();
  const [linkPending, startLink] = useTransition();
  const [delLinkPending, startDelLink] = useTransition();
  const [socialPending, startSocial] = useTransition();
  const [delSocialPending, startDelSocial] = useTransition();

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');
  const [network, setNetwork] = useState<SocialLink['network']>('instagram');
  const [socHref, setSocHref] = useState('');

  function startEditLink(l: NavLink) { setEditingLinkId(l.id); setLabel(l.label); setHref(l.href); }
  function resetLink() { setEditingLinkId(null); setLabel(''); setHref(''); }
  function startEditSocial(s: SocialLink) { setEditingSocialId(s.id); setNetwork(s.network); setSocHref(s.href); }
  function resetSocial() { setEditingSocialId(null); setNetwork('instagram'); setSocHref(''); }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Textarea label="Texto principal del footer" value={text} onChange={setText} rows={2} />
        <button type="button" disabled={textPending} onClick={() => {
          startText(async () => {
            const fd = new FormData(); fd.set('text', text);
            await updateFooterTextAction(fd);
          });
        }} className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
          {textPending ? 'Guardando…' : 'Guardar texto'}
        </button>

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingLinkId ? '✎ Editando link' : 'Agregar link de footer (términos, privacidad, etc.)'}
          </label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Términos" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <HrefField label="Destino" value={href} onChange={setHref} />
          <div className="flex gap-2">
            <button type="button" disabled={linkPending || !label || !href}
              onClick={() => {
                startLink(async () => {
                  const fd = new FormData(); fd.set('label', label); fd.set('href', href);
                  if (editingLinkId) { fd.set('id', editingLinkId); await updateFooterLinkAction(fd); }
                  else { await addFooterLinkAction(fd); }
                  resetLink();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {linkPending ? 'Guardando…' : editingLinkId ? 'Guardar cambios' : '+ Agregar link'}
            </button>
            {editingLinkId && (
              <button type="button" onClick={resetLink} className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">Cancelar</button>
            )}
          </div>
          {links.length > 0 && (
            <ul className="space-y-1.5 mt-2">
              {links.map((l) => (
                <li key={l.id} className={`rounded border p-2 flex items-center justify-between gap-3 text-sm ${editingLinkId === l.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                  <div><span className="font-medium">{l.label}</span> <span className="text-white/40 text-xs">{l.href}</span></div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => startEditLink(l)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                    <button type="button" disabled={delLinkPending} onClick={() => {
                      if (!confirm('¿Eliminar?')) return;
                      startDelLink(async () => {
                        const fd = new FormData(); fd.set('id', l.id);
                        await deleteFooterLinkAction(fd);
                      });
                    }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">
            {editingSocialId ? '✎ Editando red social' : 'Agregar red social'}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <select value={network} onChange={(e) => setNetwork(e.target.value as SocialLink['network'])} className="col-span-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              {SOCIAL_OPTIONS.map((n) => <option key={n} value={n}>{SOCIAL_LABEL[n]}</option>)}
            </select>
            <input value={socHref} onChange={(e) => setSocHref(e.target.value)} placeholder="https://instagram.com/tu" className="col-span-2 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={socialPending || !socHref}
              onClick={() => {
                startSocial(async () => {
                  const fd = new FormData(); fd.set('network', network); fd.set('href', socHref);
                  if (editingSocialId) { fd.set('id', editingSocialId); await updateSocialLinkAction(fd); }
                  else { await addSocialLinkAction(fd); }
                  resetSocial();
                });
              }}
              className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {socialPending ? 'Guardando…' : editingSocialId ? 'Guardar cambios' : '+ Agregar red'}
            </button>
            {editingSocialId && (
              <button type="button" onClick={resetSocial} className="rounded border border-white/20 text-white/70 px-3 py-1.5 text-sm hover:bg-white/5">Cancelar</button>
            )}
          </div>
          {socials.length > 0 && (
            <ul className="space-y-1.5 mt-2">
              {socials.map((s) => (
                <li key={s.id} className={`rounded border p-2 flex items-center justify-between gap-3 text-sm ${editingSocialId === s.id ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10'}`}>
                  <div><span className="font-medium">{SOCIAL_LABEL[s.network]}</span> <span className="text-white/40 text-xs">{s.href}</span></div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => startEditSocial(s)} className="text-xs text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5" title="Editar">✎</button>
                    <button type="button" disabled={delSocialPending} onClick={() => {
                      if (!confirm('¿Eliminar?')) return;
                      startDelSocial(async () => {
                        const fd = new FormData(); fd.set('id', s.id);
                        await deleteSocialLinkAction(fd);
                      });
                    }} className="text-xs text-red-300 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <PreviewFrame label="Preview del footer">
        <div className="px-4 py-5 text-center bg-black/[0.02]">
          <p className="text-xs text-black/70 mb-3 whitespace-pre-line">{text || `© ${new Date().getFullYear()} ${tenantName}`}</p>
          {socials.length > 0 && (
            <div className="flex justify-center gap-2 mb-3">
              {socials.map((s) => (
                <span key={s.id} className="text-[10px] px-2 py-0.5 rounded border border-black/15">{SOCIAL_LABEL[s.network]}</span>
              ))}
            </div>
          )}
          {links.length > 0 && (
            <div className="flex justify-center gap-3 text-[10px] text-black/60">
              {links.map((l) => <span key={l.id}>{l.label}</span>)}
            </div>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}
