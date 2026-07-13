'use client';

import { useActionState, useEffect, useRef } from 'react';
import {
  updateCourseAction,
  addModuleAction,
  deleteModuleAction,
  addLessonAction,
  deleteLessonAction,
  toggleLessonPreviewAction,
  type Result
} from '@/lib/courses/actions';
import { CoverPicker } from '@/components/owner/courses/CoverPicker';
import { LandingEditor } from '@/components/owner/courses/LandingEditor';
import type { LandingConfig, LandingTemplate } from '@/lib/courses/landing';

export type Course = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  currency: string;
  status: string;
  affiliate_enabled: boolean;
  is_featured: boolean;
  category_id: string | null;
  landing_template?: 'classic' | 'hotmart' | 'funnel' | 'vsl';
  landing_config?: Record<string, unknown> | null;
  landing_variants?: Record<string, { template: 'classic' | 'hotmart' | 'funnel' | 'vsl'; config: Record<string, unknown> }> | null;
  /** Centavos a acreditar al buyer en su wallet al comprar (App Saldos). */
  wallet_bonus_cents?: number;
};

export type WalletCurrencyInfo = {
  label: string;
  symbol: string;
};

export type Category = { id: string; name: string };

export type Lesson = {
  id: string;
  title: string;
  drive_file_id: string | null;
  drive_embed_url: string | null;
  is_preview: boolean;
  position: number;
};

export type Module = {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
};

export function CourseEditor({
  course, modules, categories, primaryColor = '#0a0a0a', storefrontOrigin = '',
  walletsEnabled = false, walletCurrency = null
}: {
  course: Course;
  modules: Module[];
  categories: Category[];
  primaryColor?: string;
  storefrontOrigin?: string;
  /** App Saldos instalada — si false, no mostramos el input de bonus. */
  walletsEnabled?: boolean;
  /** Moneda default de la wallet del tenant para mostrar preview del bonus. */
  walletCurrency?: WalletCurrencyInfo | null;
}) {
  const [updateState, updateAction, updatePending] = useActionState<Result | null, FormData>(
    updateCourseAction,
    null
  );

  // Wix-style: el botón "Guardar" del toolbar dispara `cp:save-all`.
  // Este form escucha ese evento y hace requestSubmit() para persistir.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    function handler() { formRef.current?.requestSubmit(); }
    window.addEventListener('cp:save-all', handler);
    return () => window.removeEventListener('cp:save-all', handler);
  }, []);

  return (
    <div className="space-y-10 max-w-3xl">
      {/* Course metadata */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Información de la publicación</h2>
        <form action={updateAction} className="space-y-4" ref={formRef}>
          <input type="hidden" name="id" value={course.id} />
          <div>
            <label className="block text-sm mb-1.5 text-white/70">Título</label>
            <input
              name="title"
              defaultValue={course.title}
              required
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-white/70">Descripción</label>
            <textarea
              name="description"
              defaultValue={course.description ?? ''}
              rows={4}
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
            />
          </div>

          <CoverPicker initial={course.cover_url} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5 text-white/70">Precio ({course.currency})</label>
              <input
                name="price"
                type="number"
                min="0"
                step="1"
                defaultValue={(course.price_cents / 100).toString()}
                className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-white/70">Categoría</label>
              <select
                name="category_id"
                defaultValue={course.category_id ?? ''}
                className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="affiliate_enabled" defaultChecked={course.affiliate_enabled} />
              <span className="text-sm">Permitir afiliados</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="is_featured" defaultChecked={course.is_featured} />
              <span className="text-sm">Publicación destacado (aparece arriba en el storefront)</span>
            </label>
          </div>

          {/* Bonus wallet: solo visible si la app Saldos está instalada.
              Backend en migration 0061 + webhook MP/PayPal ya lo aplican. */}
          {walletsEnabled && (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <label className="text-sm font-semibold text-emerald-100 flex items-center gap-1.5">
                  💰 Bonus de saldo al comprar
                </label>
                <span className="text-[10px] text-white/45 uppercase tracking-wider">Opcional</span>
              </div>
              <p className="text-xs text-white/60 leading-snug">
                Al comprar este producto, se le acredita este monto al buyer en su wallet
                {walletCurrency ? <> en <strong>{walletCurrency.symbol} {walletCurrency.label}</strong></> : null}.
                Ideal para cashback, promos, o convertir clientes en usuarios recurrentes de tu tienda.
                Dejalo en <code className="bg-black/40 px-1 rounded">0</code> para no dar bonus.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-white/50 text-sm">{walletCurrency?.symbol ?? '$'}</span>
                <input
                  name="wallet_bonus"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={((course.wallet_bonus_cents ?? 0) / 100).toString()}
                  className="flex-1 max-w-[200px] rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/40"
                />
                {walletCurrency && (
                  <span className="text-[11px] text-white/45">{walletCurrency.label}</span>
                )}
              </div>
            </div>
          )}

          {updateState?.ok === false && (
            <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
              {updateState.error}
            </div>
          )}
          {updateState?.ok && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm px-3 py-2 text-xs">
              ✓ Guardado
            </div>
          )}
          {updatePending && (
            <div className="text-xs text-white/60 flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Guardando…
            </div>
          )}
        </form>
        {/* Los botones Guardar / Publicar / Despublicar / Eliminar se movieron
            al toolbar sticky arriba (CourseBuilderToolbar). Wix-style. */}
      </section>

      {/* Landing page de la publicación (template + overrides) */}
      <section>
        <h2 className="text-lg font-semibold mb-1">Landing page de la publicación</h2>
        <p className="text-sm text-white/55 mb-4">
          Cada publicación tiene su propia landing pública (lo que ven los visitantes en{' '}
          <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">/c/{course.slug}</code>).
          Elegí una plantilla y customizá el contenido.
        </p>
        <LandingEditor
          courseId={course.id}
          courseTitle={course.title}
          courseSlug={course.slug}
          initialTemplate={(course.landing_template ?? 'classic') as LandingTemplate}
          initialConfig={(course.landing_config ?? {}) as LandingConfig}
          initialVariants={(course.landing_variants ?? null) as Parameters<typeof LandingEditor>[0]['initialVariants']}
          courseCoverUrl={course.cover_url}
          coursePriceCents={course.price_cents}
          courseCurrency={course.currency}
          primaryColor={primaryColor}
          storefrontOrigin={storefrontOrigin}
        />
      </section>

      {/* Modules + Lessons */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Módulos y lecciones</h2>

        <div className="space-y-4">
          {modules.map((m) => (
            <ModuleBlock key={m.id} courseId={course.id} module={m} />
          ))}
        </div>

        <form action={addModuleAction} className="mt-6 flex gap-2">
          <input type="hidden" name="course_id" value={course.id} />
          <input
            name="title"
            required
            placeholder="Nombre del módulo"
            className="flex-1 rounded-md bg-white/5 border border-white/15 px-3 py-2 focus:outline-none focus:border-white/40"
          />
          <button className="rounded-md bg-white text-black px-4 py-2 font-medium hover:bg-white/90">
            Agregar módulo
          </button>
        </form>
      </section>
    </div>
  );
}

function ModuleBlock({ courseId, module }: { courseId: string; module: Module }) {
  const [lessonState, lessonAction, lessonPending] = useActionState<Result | null, FormData>(
    addLessonAction,
    null
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{module.title}</h3>
        <form action={deleteModuleAction}>
          <input type="hidden" name="id" value={module.id} />
          <input type="hidden" name="course_id" value={courseId} />
          <button className="text-xs text-red-300 hover:text-red-200">Eliminar módulo</button>
        </form>
      </div>

      <ul className="space-y-2 mb-4">
        {module.lessons.length === 0 && (
          <li className="text-sm text-white/40">Sin lecciones todavía.</li>
        )}
        {module.lessons.map((l) => (
          <li key={l.id} className="flex items-center gap-3 text-sm rounded border border-white/10 px-3 py-2">
            <span className="flex-1">{l.title}</span>
            {l.drive_file_id && (
              <a
                href={`https://drive.google.com/file/d/${l.drive_file_id}/view`}
                target="_blank"
                rel="noopener"
                className="text-xs text-white/50 hover:text-white"
              >
                Ver en Drive
              </a>
            )}
            <form action={toggleLessonPreviewAction}>
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="is_preview" value={String(l.is_preview)} />
              <input type="hidden" name="course_id" value={courseId} />
              <button className={`text-xs px-2 py-0.5 rounded border ${l.is_preview ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/15 text-white/60'}`}>
                {l.is_preview ? 'preview público' : 'sólo alumnos'}
              </button>
            </form>
            <form action={deleteLessonAction}>
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="course_id" value={courseId} />
              <button className="text-xs text-red-300 hover:text-red-200">×</button>
            </form>
          </li>
        ))}
      </ul>

      <form action={lessonAction} className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input type="hidden" name="module_id" value={module.id} />
        <input type="hidden" name="course_id" value={courseId} />
        <input
          name="title"
          required
          placeholder="Título de la lección"
          className="rounded-md bg-white/5 border border-white/15 px-3 py-2 focus:outline-none focus:border-white/40"
        />
        <input
          name="drive_link"
          placeholder="Link de Google Drive (opcional)"
          className="rounded-md bg-white/5 border border-white/15 px-3 py-2 focus:outline-none focus:border-white/40"
        />
        <div className="md:col-span-2 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" name="is_preview" />
            Vista previa pública
          </label>
          <button
            disabled={lessonPending}
            className="ml-auto rounded-md bg-white text-black px-4 py-1.5 text-sm font-medium hover:bg-white/90 disabled:opacity-50"
          >
            {lessonPending ? 'Agregando…' : 'Agregar lección'}
          </button>
        </div>
        {lessonState?.ok === false && (
          <div className="md:col-span-2 rounded bg-red-500/10 border border-red-500/30 text-red-200 text-xs px-3 py-1.5">
            {lessonState.error}
          </div>
        )}
      </form>
    </div>
  );
}
