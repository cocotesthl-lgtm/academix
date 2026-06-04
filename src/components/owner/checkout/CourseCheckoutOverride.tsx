'use client';

import { useTransition } from 'react';
import {
  setCourseUseDefaultAction,
  setCourseBaseFieldAction,
  addCourseExtraFieldAction,
  updateCourseExtraFieldAction,
  deleteCourseExtraFieldAction,
  moveCourseExtraFieldAction
} from '@/lib/checkout/actions';
import type { CheckoutConfig } from '@/lib/checkout/types';
import { CheckoutFieldsEditor } from './CheckoutFieldsEditor';

/**
 * Sección en /owner/courses/[id] para el override por curso.
 * Toggle "usar default de la academia" / "tener config propia".
 * Si tiene config propia → renderiza el editor con las actions versión curso.
 */
export function CourseCheckoutOverride({
  courseId,
  hasOverride,
  config
}: {
  courseId: string;
  hasOverride: boolean;
  config: CheckoutConfig;
}) {
  const [pending, start] = useTransition();

  function toggleOverride() {
    const fd = new FormData();
    fd.set('course_id', courseId);
    fd.set('use_default', hasOverride ? 'true' : 'false');
    start(async () => { await setCourseUseDefaultAction(fd); });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-medium text-sm">
            {hasOverride ? '⚙️ Este curso usa una config propia' : '🔗 Este curso usa el default de la academia'}
          </div>
          <p className="text-xs text-white/55 mt-1">
            {hasOverride
              ? 'Editás los campos solo para este curso. Cambios al default global no afectan acá.'
              : 'Editás los campos en /checkout y se aplican a todos los cursos por igual.'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleOverride}
          disabled={pending}
          className={`text-xs px-3 py-1.5 rounded border whitespace-nowrap ${
            hasOverride
              ? 'border-white/15 hover:bg-white/5'
              : 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20'
          } disabled:opacity-40`}
        >
          {pending
            ? '…'
            : hasOverride
              ? '← Volver al default'
              : 'Tener config propia para este curso →'}
        </button>
      </div>

      {hasOverride && (
        <CheckoutFieldsEditor
          config={config}
          actions={{
            setBaseField: setCourseBaseFieldAction,
            addExtra:     addCourseExtraFieldAction,
            updateExtra:  updateCourseExtraFieldAction,
            deleteExtra:  deleteCourseExtraFieldAction,
            moveExtra:    moveCourseExtraFieldAction
          }}
          hiddenExtras={{ course_id: courseId }}
        />
      )}
    </div>
  );
}
