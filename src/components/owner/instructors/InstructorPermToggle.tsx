'use client';

import { useState, useTransition } from 'react';
import { setInstructorPermissionAction } from '@/lib/instructors/actions';

/**
 * Toggle de permiso individual por (instructor × publicación × field).
 * Auto-save al click. Color verde = on, gris = off.
 */
export function InstructorPermToggle({
  userId, courseId, field, initial, label
}: {
  userId: string;
  courseId: string;
  field: 'can_edit_calendar' | 'can_reschedule' | 'can_view_students';
  initial: boolean;
  label: string;
}) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    const fd = new FormData();
    fd.set('user_id', userId);
    fd.set('course_id', courseId);
    fd.set('field', field);
    fd.set('value', String(next));
    start(async () => { await setInstructorPermissionAction(fd); });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`text-[10px] px-2 py-1 rounded border whitespace-nowrap transition ${
        on
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
          : 'border-white/15 text-white/50 hover:bg-white/5'
      } disabled:opacity-50`}
    >
      {on ? '✓' : '○'} {label}
    </button>
  );
}
