'use client';

import { useEffect, useRef } from 'react';
import { setCourseContentLabelsAction } from '@/lib/courses/actions';

/**
 * Form de "Contenido — títulos personalizados" del editor de publicación.
 * Extraído a client component para poder escuchar el evento global
 * `cp:save-all` que dispara el botón "Guardar" del toolbar.
 */
export function ContentLabelsForm({
  courseId,
  contentTitle,
  moduleLabel,
  lessonLabel,
  showContentSection
}: {
  courseId: string;
  contentTitle: string | null | undefined;
  moduleLabel: string | null | undefined;
  lessonLabel: string | null | undefined;
  showContentSection: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function handler() { formRef.current?.requestSubmit(); }
    window.addEventListener('cp:save-all', handler);
    return () => window.removeEventListener('cp:save-all', handler);
  }, []);

  return (
    <form ref={formRef} action={setCourseContentLabelsAction} className="grid sm:grid-cols-2 gap-3">
      <input type="hidden" name="id" value={courseId} />
      <label className="block sm:col-span-2">
        <span className="text-xs text-white/55">Título de la sección</span>
        <input name="content_title" defaultValue={contentTitle ?? ''}
          placeholder="Contenido de la publicación"
          maxLength={80}
          className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="text-xs text-white/55">Etiqueta &quot;módulos&quot; (plural)</span>
        <input name="module_label" defaultValue={moduleLabel ?? ''}
          placeholder="módulos"
          maxLength={40}
          className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="text-xs text-white/55">Etiqueta &quot;lecciones&quot; (plural)</span>
        <input name="lesson_label" defaultValue={lessonLabel ?? ''}
          placeholder="lecciones"
          maxLength={40}
          className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="show_content_section" defaultChecked={showContentSection} />
        Mostrar la sección de contenido en la página pública
      </label>
      {/* Sin botón "Guardar": lo dispara el toolbar arriba vía cp:save-all */}
    </form>
  );
}
