'use client';

import { useActionState } from 'react';
import {
  updateCourseAction,
  setCourseStatusAction,
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

export function CourseEditor({ course, modules, categories, primaryColor = '#0a0a0a', storefrontOrigin = '' }: { course: Course; modules: Module[]; categories: Category[]; primaryColor?: string; storefrontOrigin?: string }) {
  const [updateState, updateAction, updatePending] = useActionState<Result | null, FormData>(
    updateCourseAction,
    null
  );

  return (
    <div className="space-y-10 max-w-3xl">
      {/* Course metadata */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Información del curso</h2>
        <form action={updateAction} className="space-y-4">
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
              <span className="text-sm">Curso destacado (aparece arriba en el storefront)</span>
            </label>
          </div>

          {updateState?.ok === false && (
            <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
              {updateState.error}
            </div>
          )}
          {updateState?.ok && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm px-3 py-2">
              Cambios guardados.
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={updatePending}
              className="rounded-md bg-white text-black px-5 py-2 font-semibold hover:bg-white/90 transition disabled:opacity-50"
            >
              {updatePending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>

        {/* Publicar/Despublicar va FUERA del form principal — HTML no permite
            forms anidados (el botón quedaba silencioso). */}
        <div className="mt-3">
          {course.status !== 'published' ? (
            <form action={setCourseStatusAction}>
              <input type="hidden" name="id" value={course.id} />
              <input type="hidden" name="status" value="published" />
              <button className="rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-5 py-2 font-medium hover:bg-emerald-500/20">
                Publicar
              </button>
            </form>
          ) : (
            <form action={setCourseStatusAction}>
              <input type="hidden" name="id" value={course.id} />
              <input type="hidden" name="status" value="draft" />
              <button className="rounded-md border border-white/15 px-5 py-2 font-medium hover:bg-white/5">
                Despublicar
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Landing page del curso (template + overrides) */}
      <section>
        <h2 className="text-lg font-semibold mb-1">Landing page del curso</h2>
        <p className="text-sm text-white/55 mb-4">
          Cada curso tiene su propia landing pública (lo que ven los visitantes en{' '}
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
