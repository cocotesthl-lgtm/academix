'use client';

import { useState, useTransition } from 'react';
import {
  updateSectionFieldsAction,
  uploadAboutImageAction,
  addTestimonialAction,
  deleteTestimonialAction,
  addFaqAction,
  deleteFaqAction
} from '@/lib/site/actions';
import type { TestimonialItem, FaqItem } from '@/lib/site/types';

/* =====================================================================
 * Generic save button + helpers
 * ===================================================================== */

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input
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
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="rounded bg-white text-black px-4 py-1.5 text-sm font-medium hover:bg-white/90 disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
      {saved && <span className="text-xs text-emerald-300">✓ Guardado</span>}
    </div>
  );
}

function PreviewFrame({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div>
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
        {label ?? 'Preview en vivo'}
      </div>
      <div className="rounded-xl border border-white/10 bg-white text-black overflow-hidden">
        {children}
      </div>
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
        if (typeof v === 'boolean') {
          if (v) fd.set(k, 'on');
        } else {
          fd.set(k, v);
        }
      }
      await updateSectionFieldsAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }
  return { pending, saved, fire };
}

/* =====================================================================
 * Hero
 * ===================================================================== */

type HeroValues = { title: string; subtitle: string; cta_label: string; cta_href: string };

export function HeroEditor({ initial, fallbackTitle, primary }: {
  initial: HeroValues; fallbackTitle: string; primary: string;
}) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('hero');
  const displayTitle = v.title || fallbackTitle;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título (vacío = nombre de la academia)" value={v.title} onChange={(x) => setV({ ...v, title: x })} placeholder={fallbackTitle} />
        <Field label="Subtítulo" value={v.subtitle} onChange={(x) => setV({ ...v, subtitle: x })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Texto del botón" value={v.cta_label} onChange={(x) => setV({ ...v, cta_label: x })} />
          <Field label="Destino (href)" value={v.cta_href} onChange={(x) => setV({ ...v, cta_href: x })} />
        </div>
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />
      </div>
      <PreviewFrame>
        <div className="p-6 text-center" style={{ background: `linear-gradient(180deg, ${primary}15 0%, transparent 100%)` }}>
          <h1 className="text-2xl font-bold tracking-tight">{displayTitle}</h1>
          {v.subtitle && <p className="mt-2 text-sm text-black/60">{v.subtitle}</p>}
          {v.cta_label && (
            <span className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: primary }}>
              {v.cta_label}
            </span>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}

/* =====================================================================
 * About
 * ===================================================================== */

type AboutValues = { title: string; body: string };

export function AboutEditor({ initial, imageUrl, primary }: {
  initial: AboutValues; imageUrl: string | null; primary: string;
}) {
  const [v, setV] = useState(initial);
  const { pending, saved, fire } = useSave('about');
  const [uploadPending, startUpload] = useTransition();

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <Textarea label="Texto" value={v.body} onChange={(x) => setV({ ...v, body: x })} rows={5} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire(v)} />

        <div className="pt-3 mt-3 border-t border-white/5">
          <label className="block text-xs text-white/60 mb-2">Foto (opcional)</label>
          <form
            action={(fd) => startUpload(async () => { await uploadAboutImageAction(fd); })}
            className="flex items-center gap-3"
          >
            <input type="file" name="image" accept="image/png,image/jpeg,image/webp"
              className="text-sm text-white/70 file:mr-3 file:rounded-md file:border-0 file:bg-white file:text-black file:px-3 file:py-1.5 file:font-medium" />
            <button className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium hover:bg-white/90" disabled={uploadPending}>
              {uploadPending ? 'Subiendo…' : 'Subir'}
            </button>
          </form>
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
 * Featured (just title)
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
 * Catalog
 * ===================================================================== */

export function CatalogEditor({ initialTitle, initialShowFilters, primary }: {
  initialTitle: string; initialShowFilters: boolean; primary: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [showFilters, setShowFilters] = useState(initialShowFilters);
  const { pending, saved, fire } = useSave('catalog');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showFilters} onChange={(e) => setShowFilters(e.target.checked)} />
          Mostrar filtros por categoría
        </label>
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title, show_filters: showFilters })} />
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
 * Testimonials
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

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Título de la sección" value={title} onChange={setTitle} />
        <SaveBar pending={pending} saved={saved} onSave={() => fire({ title })} />

        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <label className="text-xs text-white/60 block mb-1">Agregar testimonio</label>
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rol (opcional)" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Lo que dijo" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <button
            type="button"
            disabled={addPending || !name || !text}
            onClick={() => {
              startAdd(async () => {
                const fd = new FormData();
                fd.set('name', name); fd.set('role', role); fd.set('text', text);
                await addTestimonialAction(fd);
                setName(''); setRole(''); setText('');
              });
            }}
            className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {addPending ? 'Agregando…' : '+ Agregar'}
          </button>
        </div>

        {items.length > 0 && (
          <ul className="space-y-2 pt-3 mt-3 border-t border-white/5">
            {items.map((t) => (
              <li key={t.id} className="rounded border border-white/10 p-2 flex items-start justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">{t.name}{t.role && <span className="text-white/40"> · {t.role}</span>}</div>
                  <div className="text-white/60 text-xs mt-0.5">{t.text}</div>
                </div>
                <button
                  type="button"
                  disabled={delPending}
                  onClick={() => {
                    startDel(async () => {
                      const fd = new FormData();
                      fd.set('id', t.id);
                      await deleteTestimonialAction(fd);
                    });
                  }}
                  className="text-xs text-red-300 hover:text-red-200"
                >
                  ✕
                </button>
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
                  <p className="text-[10px] text-black/80 italic line-clamp-2">"{t.text}"</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ background: primary }}>
                      {t.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="text-[9px] font-medium">{t.name}</div>
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
          <button
            type="button"
            disabled={addPending || !q || !a}
            onClick={() => {
              startAdd(async () => {
                const fd = new FormData();
                fd.set('q', q); fd.set('a', a);
                await addFaqAction(fd);
                setQ(''); setA('');
              });
            }}
            className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
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
                <button
                  type="button"
                  disabled={delPending}
                  onClick={() => {
                    startDel(async () => {
                      const fd = new FormData();
                      fd.set('id', f.id);
                      await deleteFaqAction(fd);
                    });
                  }}
                  className="text-xs text-red-300 hover:text-red-200"
                >
                  ✕
                </button>
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
 * CTA final
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
          {v.cta_label && (
            <span className="mt-3 inline-block rounded-md px-4 py-2 text-xs font-semibold text-white" style={{ background: primary }}>
              {v.cta_label}
            </span>
          )}
        </div>
      </PreviewFrame>
    </div>
  );
}
