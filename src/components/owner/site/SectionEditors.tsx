'use client';

import { useState, useTransition, useEffect } from 'react';
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
  addNavLinkAction,
  deleteNavLinkAction,
  toggleNavLoginAction,
  updateFooterTextAction,
  addFooterLinkAction,
  deleteFooterLinkAction,
  addSocialLinkAction,
  deleteSocialLinkAction
} from '@/lib/site/actions';
import type {
  TestimonialItem, FaqItem, StatItem, LearnItem, FeatureItem, LogoItem,
  NavLink, SocialLink, HeroLayout, PricingTier, GalleryItem,
  InstructorItem, InstructorDisplay, CustomImagePos
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

export function HeroEditor({ initial, fallbackTitle, primary, layout, imageUrl }: {
  initial: HeroValues; fallbackTitle: string; primary: string; layout: HeroLayout; imageUrl: string | null;
}) {
  const [v, setV] = useState(initial);
  const [layoutSel, setLayoutSel] = useState<HeroLayout>(layout);
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
          <Field label="Título (vacío = nombre de la academia)" value={v.title} onChange={(x) => setV({ ...v, title: x })} placeholder={fallbackTitle} />
          <Textarea label="Subtítulo" value={v.subtitle} onChange={(x) => setV({ ...v, subtitle: x })} rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Botón principal" value={v.cta_label} onChange={(x) => setV({ ...v, cta_label: x })} />
            <Field label="Destino (href)" value={v.cta_href} onChange={(x) => setV({ ...v, cta_href: x })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Botón secundario (opcional)" value={v.cta_label_2} onChange={(x) => setV({ ...v, cta_label_2: x })} />
            <Field label="Destino (href)" value={v.cta_href_2} onChange={(x) => setV({ ...v, cta_href_2: x })} />
          </div>
          <Field label="Caption (texto chico debajo de los CTAs)" value={v.caption} onChange={(x) => setV({ ...v, caption: x })} />
          <SaveBar pending={pending} saved={saved} onSave={() => fire({ ...v, layout: layoutSel })} />

          {(layoutSel === 'split' || layoutSel === 'gallery') && (
            <div className="pt-3 mt-3 border-t border-white/5">
              <UrlPicker
                label="URL de la imagen del Hero"
                section="hero"
                field="image_url"
                value={imageUrl}
                hint={layoutSel === 'split' ? 'Recomendado 1200×900px (4:3) — imagen al costado del texto' : 'Recomendado 2400×1200px — banner ancho full-width Amazon-style'}
              />
            </div>
          )}
        </div>

        <PreviewFrame>
          {layoutSel === 'centered' && (
            <div className="p-6 text-center" style={{ background: `linear-gradient(180deg, ${primary}15 0%, transparent 100%)` }}>
              {v.eyebrow && <span className="inline-block text-[9px] font-medium px-2 py-0.5 rounded-full border" style={{ borderColor: `${primary}50`, color: primary }}>{v.eyebrow}</span>}
              <h1 className="text-2xl font-bold tracking-tight mt-2">{displayTitle}</h1>
              {v.subtitle && <p className="mt-2 text-xs text-black/60">{v.subtitle}</p>}
              <div className="mt-3 flex justify-center gap-2">
                {v.cta_label && <span className="inline-block rounded px-3 py-1.5 text-xs font-semibold text-white" style={{ background: primary }}>{v.cta_label}</span>}
                {v.cta_label_2 && <span className="inline-block rounded px-3 py-1.5 text-xs font-semibold border" style={{ borderColor: primary, color: primary }}>{v.cta_label_2}</span>}
              </div>
              {v.caption && <p className="text-[9px] text-black/40 mt-2">{v.caption}</p>}
            </div>
          )}
          {layoutSel === 'split' && (
            <div className="p-4 grid grid-cols-2 gap-3 items-center" style={{ background: `linear-gradient(135deg, ${primary}12 0%, transparent 60%)` }}>
              <div>
                {v.eyebrow && <span className="inline-block text-[8px] font-medium px-1.5 py-0.5 rounded-full border" style={{ borderColor: `${primary}50`, color: primary }}>{v.eyebrow}</span>}
                <h1 className="text-base font-bold tracking-tight mt-1.5">{displayTitle}</h1>
                {v.subtitle && <p className="mt-1 text-[10px] text-black/60 line-clamp-3">{v.subtitle}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.cta_label && <span className="rounded px-2 py-1 text-[9px] font-semibold text-white" style={{ background: primary }}>{v.cta_label}</span>}
                  {v.cta_label_2 && <span className="rounded px-2 py-1 text-[9px] font-semibold border" style={{ borderColor: primary, color: primary }}>{v.cta_label_2}</span>}
                </div>
                {v.caption && <p className="text-[8px] text-black/40 mt-1.5">{v.caption}</p>}
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
                  <h1 className="mt-1 text-sm font-bold leading-tight drop-shadow">{displayTitle}</h1>
                  {v.subtitle && <p className="mt-1 text-[10px] text-white/85 line-clamp-2 drop-shadow">{v.subtitle}</p>}
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

export function TrustedByEditor({ initialTitle, items, grayscale, marquee }: {
  initialTitle: string; items: LogoItem[]; grayscale: boolean; marquee: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [gs, setGs] = useState(grayscale);
  const [mq, setMq] = useState(marquee);
  const { pending, saved, fire } = useSave('trusted_by');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [name, setName] = useState('');
  const [href, setHref] = useState('');

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
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title, grayscale: gs, marquee: mq })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">Agregar logo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Acme Corp)" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="Link (opcional)" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <form
            action={(fd) => {
              fd.set('name', name); fd.set('href', href);
              startAdd(async () => {
                await addLogoAction(fd);
                setName(''); setHref('');
              });
            }}
            className="flex items-center gap-2"
          >
            <input type="url" name="logo_url" placeholder="URL del logo (vacío = solo nombre)"
              className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <button disabled={addPending || !name} className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Agregando…' : '+ Agregar'}
            </button>
          </form>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((l) => (
              <li key={l.id} className="rounded border border-white/10 p-2 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  {l.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.logo_url} alt="" className="w-8 h-8 object-contain" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-white/10" />
                  )}
                  <span className="font-medium">{l.name}</span>
                </div>
                <button type="button" disabled={delPending} onClick={() => {
                  startDel(async () => {
                    const fd = new FormData(); fd.set('id', l.id);
                    await deleteLogoAction(fd);
                  });
                }} className="text-xs text-red-300 hover:text-red-200">✕</button>
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
        <Field label="Título" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <Textarea label="Texto" value={v.body} onChange={(x) => setV({ ...v, body: x })} rows={5} />
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
            <h2 className="text-lg font-bold">{v.title || '—'}</h2>
            <p className="text-xs text-black/60 mt-1 whitespace-pre-line line-clamp-4">{v.body || 'Tu texto aparece acá.'}</p>
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
  const [name, setName] = useState('');
  const [credentials, setCredentials] = useState('');
  const [bio, setBio] = useState('');

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
          <label className="text-xs text-white/60 block mb-1">Agregar instructor</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <input value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="Credenciales / rol" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="Bio corta (opcional)" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <form
            action={(fd) => {
              fd.set('name', name); fd.set('credentials', credentials); fd.set('bio', bio);
              startAdd(async () => {
                await addInstructorItemAction(fd);
                setName(''); setCredentials(''); setBio('');
              });
            }}
            className="flex items-center gap-2"
          >
            <input type="url" name="photo_url" placeholder="URL de la foto (opcional, cuadrada 400×400)"
              className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <button disabled={addPending || !name} className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Agregando…' : '+ Agregar'}
            </button>
          </form>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((i) => (
              <li key={i.id} className="rounded border border-white/10 p-2 flex items-start justify-between gap-3 text-sm">
                <div className="flex gap-2">
                  {i.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: primary }}>
                      {i.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{i.name}</div>
                    {i.credentials && <div className="text-white/40 text-xs">{i.credentials}</div>}
                  </div>
                </div>
                <button type="button" disabled={delPending} onClick={() => {
                  startDel(async () => {
                    const fd = new FormData(); fd.set('id', i.id);
                    await deleteInstructorItemAction(fd);
                  });
                }} className="text-xs text-red-300 hover:text-red-200">✕</button>
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
  const [num, setNum] = useState('');
  const [lbl, setLbl] = useState('');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">Agregar estadística</label>
          <div className="grid grid-cols-2 gap-2">
            <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="+2.400" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input value={lbl} onChange={(e) => setLbl(e.target.value)} placeholder="alumnos" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <button type="button" disabled={addPending || !num || !lbl}
            onClick={() => {
              startAdd(async () => {
                const fd = new FormData(); fd.set('number', num); fd.set('label', lbl);
                await addStatAction(fd); setNum(''); setLbl('');
              });
            }}
            className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            {addPending ? 'Agregando…' : '+ Agregar'}
          </button>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((s) => (
              <li key={s.id} className="rounded border border-white/10 p-2 flex items-center justify-between gap-3 text-sm">
                <div><span className="font-bold">{s.number}</span> <span className="text-white/60">{s.label}</span></div>
                <button type="button" disabled={delPending} onClick={() => {
                  startDel(async () => {
                    const fd = new FormData(); fd.set('id', s.id);
                    await deleteStatAction(fd);
                  });
                }} className="text-xs text-red-300 hover:text-red-200">✕</button>
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
  const [text, setText] = useState('');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título" value={title} onChange={setTitle} />
        <Field label="Subtítulo (opcional)" value={subtitle} onChange={setSubtitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title, subtitle })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">Agregar punto de aprendizaje</label>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Diseñar wireframes con Figma" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <button type="button" disabled={addPending || !text}
            onClick={() => {
              startAdd(async () => {
                const fd = new FormData(); fd.set('text', text);
                await addLearnPointAction(fd); setText('');
              });
            }}
            className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            {addPending ? 'Agregando…' : '+ Agregar'}
          </button>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((p) => (
              <li key={p.id} className="rounded border border-white/10 p-2 flex items-center justify-between gap-3 text-sm">
                <span>✓ {p.text}</span>
                <button type="button" disabled={delPending} onClick={() => {
                  startDel(async () => {
                    const fd = new FormData(); fd.set('id', p.id);
                    await deleteLearnPointAction(fd);
                  });
                }} className="text-xs text-red-300 hover:text-red-200">✕</button>
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
  const [icon, setIcon] = useState('⭐');
  const [t, setT] = useState('');
  const [b, setB] = useState('');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">Agregar feature (icono emoji + título + texto)</label>
          <div className="grid grid-cols-4 gap-2">
            <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="⭐" maxLength={3} className="col-span-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm text-center" />
            <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Título" className="col-span-3 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <textarea value={b} onChange={(e) => setB(e.target.value)} rows={2} placeholder="Descripción corta" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <button type="button" disabled={addPending || !t || !b}
            onClick={() => {
              startAdd(async () => {
                const fd = new FormData(); fd.set('icon', icon); fd.set('title', t); fd.set('body', b);
                await addFeatureAction(fd);
                setT(''); setB(''); setIcon('⭐');
              });
            }}
            className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            {addPending ? 'Agregando…' : '+ Agregar'}
          </button>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((f) => (
              <li key={f.id} className="rounded border border-white/10 p-2 flex items-start justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">{f.icon} {f.title}</div>
                  <div className="text-xs text-white/60 mt-0.5">{f.body}</div>
                </div>
                <button type="button" disabled={delPending} onClick={() => {
                  startDel(async () => {
                    const fd = new FormData(); fd.set('id', f.id);
                    await deleteFeatureAction(fd);
                  });
                }} className="text-xs text-red-300 hover:text-red-200">✕</button>
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

export function CatalogEditor({ initialTitle, initialShowFilters, initialMaxVisible, initialPaginationMode, primary }: {
  initialTitle: string; initialShowFilters: boolean; initialMaxVisible: number;
  initialPaginationMode: 'show_more' | 'paginated'; primary: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [showFilters, setShowFilters] = useState(initialShowFilters);
  const [maxVisible, setMaxVisible] = useState(initialMaxVisible);
  const [paginationMode, setPaginationMode] = useState<'show_more' | 'paginated'>(initialPaginationMode);
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
        <SaveBar
          pending={pending}
          saved={saved}
          onSave={() => fire({
            title,
            show_filters: showFilters,
            max_visible: String(maxVisible),
            pagination_mode: paginationMode
          })}
        />
      </div>
      <PreviewFrame>
        <div className="p-5">
          <h2 className="text-lg font-bold mb-3">{title || '—'}</h2>
          {showFilters && (
            <div className="flex gap-1 mb-3 text-[9px]">
              <span className="px-1.5 py-0.5 bg-black text-white rounded-full">Todos</span>
              <span className="px-1.5 py-0.5 border border-black/15 rounded-full">Marketing</span>
              <span className="px-1.5 py-0.5 border border-black/15 rounded-full">Diseño</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded border border-black/10 overflow-hidden">
                <div className="h-12" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }} />
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
 * TESTIMONIALS (enhanced — photo + stars + role)
 * ===================================================================== */

export function TestimonialsEditor({ initialTitle, items, primary }: {
  initialTitle: string; items: TestimonialItem[]; primary: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const { pending, saved, fire } = useSave('testimonials');
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [text, setText] = useState('');
  const [rating, setRating] = useState(5);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">Agregar testimonio</label>
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
          <form
            action={(fd) => {
              fd.set('name', name); fd.set('role', role); fd.set('text', text); fd.set('rating', String(rating));
              startAdd(async () => {
                await addTestimonialAction(fd);
                setName(''); setRole(''); setText(''); setRating(5);
              });
            }}
            className="flex items-center gap-2"
          >
            <input type="url" name="photo_url" placeholder="URL de la foto (opcional, cuadrada 400×400)"
              className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <button disabled={addPending || !name || !text} className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Agregando…' : '+ Agregar'}
            </button>
          </form>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((t) => (
              <li key={t.id} className="rounded border border-white/10 p-2 flex items-start justify-between gap-3 text-sm">
                <div className="flex gap-2">
                  {t.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: primary }}>
                      {t.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{t.name}{t.role && <span className="text-white/40"> · {t.role}</span>}</div>
                    <div className="text-yellow-400 text-xs">{'★'.repeat(t.rating ?? 5)}</div>
                    <div className="text-white/60 text-xs mt-0.5">{t.text}</div>
                  </div>
                </div>
                <button type="button" disabled={delPending} onClick={() => {
                  startDel(async () => {
                    const fd = new FormData(); fd.set('id', t.id);
                    await deleteTestimonialAction(fd);
                  });
                }} className="text-xs text-red-300 hover:text-red-200">✕</button>
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
  const [q, setQ] = useState('');
  const [a, setA] = useState('');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">Agregar pregunta</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pregunta" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <textarea value={a} onChange={(e) => setA(e.target.value)} rows={2} placeholder="Respuesta" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <button type="button" disabled={addPending || !q || !a}
            onClick={() => {
              startAdd(async () => {
                const fd = new FormData(); fd.set('q', q); fd.set('a', a);
                await addFaqAction(fd); setQ(''); setA('');
              });
            }}
            className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            {addPending ? 'Agregando…' : '+ Agregar'}
          </button>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((f) => (
              <li key={f.id} className="rounded border border-white/10 p-2 flex items-start justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">{f.q}</div>
                  <div className="text-white/60 text-xs mt-0.5 whitespace-pre-line">{f.a}</div>
                </div>
                <button type="button" disabled={delPending} onClick={() => {
                  startDel(async () => {
                    const fd = new FormData(); fd.set('id', f.id);
                    await deleteFaqAction(fd);
                  });
                }} className="text-xs text-red-300 hover:text-red-200">✕</button>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Texto del botón" value={v.cta_label} onChange={(x) => setV({ ...v, cta_label: x })} />
          <Field label="Destino (href)" value={v.cta_href} onChange={(x) => setV({ ...v, cta_href: x })} />
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Texto del botón" value={v.cta_label} onChange={(x) => setV({ ...v, cta_label: x })} />
          <Field label="Destino (href)" value={v.cta_href} onChange={(x) => setV({ ...v, cta_href: x })} />
        </div>
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

  const [tn, setTn] = useState('');
  const [tp, setTp] = useState('');
  const [td, setTd] = useState('');
  const [tf, setTf] = useState('');
  const [tc, setTc] = useState('Elegir plan');
  const [th, setTh] = useState('#cursos');
  const [hi, setHi] = useState(false);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <Field label="Subtítulo" value={subtitle} onChange={setSubtitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title, subtitle })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">Agregar plan</label>
          <div className="grid grid-cols-2 gap-2">
            <input value={tn} onChange={(e) => setTn(e.target.value)} placeholder="Nombre (ej. Pro)" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input value={tp} onChange={(e) => setTp(e.target.value)} placeholder="Precio (ej. $14.900 / mes)" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <input value={td} onChange={(e) => setTd(e.target.value)} placeholder="Descripción corta (opcional)" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <textarea value={tf} onChange={(e) => setTf(e.target.value)} rows={3} placeholder="Features, una por línea&#10;Acceso de por vida&#10;Soporte 24/7&#10;Certificado" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={tc} onChange={(e) => setTc(e.target.value)} placeholder="Texto del botón" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input value={th} onChange={(e) => setTh(e.target.value)} placeholder="Destino (href)" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hi} onChange={(e) => setHi(e.target.checked)} />
            Marcar como plan destacado
          </label>
          <button type="button" disabled={addPending || !tn || !tp}
            onClick={() => {
              startAdd(async () => {
                const fd = new FormData();
                fd.set('name', tn); fd.set('price', tp); fd.set('description', td);
                fd.set('features', tf); fd.set('cta_label', tc); fd.set('cta_href', th);
                if (hi) fd.set('highlighted', 'on');
                await addPricingTierAction(fd);
                setTn(''); setTp(''); setTd(''); setTf(''); setTc('Elegir plan'); setTh('#cursos'); setHi(false);
              });
            }}
            className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            {addPending ? 'Agregando…' : '+ Agregar plan'}
          </button>
        </div>

        {tiers.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {tiers.map((t) => (
              <li key={t.id} className="rounded border border-white/10 p-2 flex items-start justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">
                    {t.name} <span className="text-white/40">— {t.price}</span>
                    {t.highlighted && <span className="ml-2 text-xs text-amber-300">★ destacado</span>}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">{t.features.length} feature(s)</div>
                </div>
                <button type="button" disabled={delPending} onClick={() => {
                  startDel(async () => {
                    const fd = new FormData(); fd.set('id', t.id);
                    await deletePricingTierAction(fd);
                  });
                }} className="text-xs text-red-300 hover:text-red-200">✕</button>
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

        <div className="pt-3 mt-3 border-t border-white/5">
          <label className="text-xs text-white/60 block mb-1">Agregar imagen (URL)</label>
          <form
            action={(fd) => startAdd(async () => { await addGalleryImageAction(fd); })}
            className="space-y-2"
          >
            <input type="url" name="image_url" required placeholder="https://… URL de la imagen"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input name="caption" placeholder="Caption (opcional)" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <button disabled={addPending} className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {addPending ? 'Agregando…' : '+ Agregar imagen'}
            </button>
            <p className="text-[10px] text-white/40">📐 Recomendado 1200×900px (4:3) o 1200×1200px (cuadrada) para que se vean iguales</p>
          </form>
        </div>

        {items.length > 0 && (
          <div className="pt-3 mt-3 border-t border-white/5">
            <p className="text-xs text-white/60 mb-2">{items.length} imagen(es)</p>
            <ul className="grid grid-cols-3 gap-2">
              {items.map((it) => (
                <li key={it.id} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image_url} alt={it.caption ?? ''} className="w-full h-20 object-cover rounded" />
                  <button type="button" disabled={delPending}
                    onClick={() => {
                      startDel(async () => {
                        const fd = new FormData(); fd.set('id', it.id);
                        await deleteGalleryImageAction(fd);
                      });
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full opacity-0 group-hover:opacity-100">
                    ✕
                  </button>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Botón (opcional)" value={v.cta_label} onChange={(x) => setV({ ...v, cta_label: x })} />
          <Field label="Destino (href)" value={v.cta_href} onChange={(x) => setV({ ...v, cta_href: x })} />
        </div>
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

export function NavEditor({ links, showLogin, primary, tenantName }: {
  links: NavLink[]; showLogin: boolean; primary: string; tenantName: string;
}) {
  const [addPending, startAdd] = useTransition();
  const [delPending, startDel] = useTransition();
  const [togglePending, startToggle] = useTransition();
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showLogin} disabled={togglePending}
            onChange={() => startToggle(async () => { await toggleNavLoginAction(); })} />
          Mostrar botón "Iniciar sesión" en el nav
        </label>

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">Agregar link al nav</label>
          <div className="grid grid-cols-2 gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Cursos" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="#cursos o /algo" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <button type="button" disabled={addPending || !label || !href}
            onClick={() => {
              startAdd(async () => {
                const fd = new FormData(); fd.set('label', label); fd.set('href', href);
                await addNavLinkAction(fd); setLabel(''); setHref('');
              });
            }}
            className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            {addPending ? 'Agregando…' : '+ Agregar link'}
          </button>
        </div>

        {links.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {links.map((l) => (
              <li key={l.id} className="rounded border border-white/10 p-2 flex items-center justify-between gap-3 text-sm">
                <div><span className="font-medium">{l.label}</span> <span className="text-white/40 text-xs">{l.href}</span></div>
                <button type="button" disabled={delPending} onClick={() => {
                  startDel(async () => {
                    const fd = new FormData(); fd.set('id', l.id);
                    await deleteNavLinkAction(fd);
                  });
                }} className="text-xs text-red-300 hover:text-red-200">✕</button>
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

  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');
  const [network, setNetwork] = useState<SocialLink['network']>('instagram');
  const [socHref, setSocHref] = useState('');

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
          <label className="text-xs text-white/60 block mb-1">Agregar link de footer (términos, privacidad, etc.)</label>
          <div className="grid grid-cols-2 gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Términos" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="/terminos" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <button type="button" disabled={linkPending || !label || !href}
            onClick={() => {
              startLink(async () => {
                const fd = new FormData(); fd.set('label', label); fd.set('href', href);
                await addFooterLinkAction(fd); setLabel(''); setHref('');
              });
            }}
            className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            {linkPending ? 'Agregando…' : '+ Agregar link'}
          </button>
          {links.length > 0 && (
            <ul className="space-y-1.5 mt-2">
              {links.map((l) => (
                <li key={l.id} className="rounded border border-white/10 p-2 flex items-center justify-between gap-3 text-sm">
                  <div><span className="font-medium">{l.label}</span> <span className="text-white/40 text-xs">{l.href}</span></div>
                  <button type="button" disabled={delLinkPending} onClick={() => {
                    startDelLink(async () => {
                      const fd = new FormData(); fd.set('id', l.id);
                      await deleteFooterLinkAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">Agregar red social</label>
          <div className="grid grid-cols-3 gap-2">
            <select value={network} onChange={(e) => setNetwork(e.target.value as SocialLink['network'])} className="col-span-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              {SOCIAL_OPTIONS.map((n) => <option key={n} value={n}>{SOCIAL_LABEL[n]}</option>)}
            </select>
            <input value={socHref} onChange={(e) => setSocHref(e.target.value)} placeholder="https://instagram.com/tu" className="col-span-2 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <button type="button" disabled={socialPending || !socHref}
            onClick={() => {
              startSocial(async () => {
                const fd = new FormData(); fd.set('network', network); fd.set('href', socHref);
                await addSocialLinkAction(fd); setSocHref('');
              });
            }}
            className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            {socialPending ? 'Agregando…' : '+ Agregar red'}
          </button>
          {socials.length > 0 && (
            <ul className="space-y-1.5 mt-2">
              {socials.map((s) => (
                <li key={s.id} className="rounded border border-white/10 p-2 flex items-center justify-between gap-3 text-sm">
                  <div><span className="font-medium">{SOCIAL_LABEL[s.network]}</span> <span className="text-white/40 text-xs">{s.href}</span></div>
                  <button type="button" disabled={delSocialPending} onClick={() => {
                    startDelSocial(async () => {
                      const fd = new FormData(); fd.set('id', s.id);
                      await deleteSocialLinkAction(fd);
                    });
                  }} className="text-xs text-red-300 hover:text-red-200">✕</button>
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
