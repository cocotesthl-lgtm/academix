'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createCourseAction, type Result } from '@/lib/courses/actions';

export function NewCourseForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<Result<{ id: string }> | null, FormData>(
    createCourseAction,
    null
  );

  useEffect(() => {
    if (state?.ok && state.data?.id) {
      router.push(`/courses/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm mb-1.5 text-white/70">Título</label>
        <input
          name="title"
          required
          maxLength={140}
          placeholder="UX Research desde cero"
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
        />
      </div>
      <div>
        <label className="block text-sm mb-1.5 text-white/70">Descripción corta</label>
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1.5 text-white/70">Precio</label>
          <input
            name="price"
            type="number"
            min="0"
            step="1"
            defaultValue="0"
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5 text-white/70">Moneda</label>
          <select
            name="currency"
            defaultValue="ARS"
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {state?.ok === false && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-white text-black px-6 py-2.5 font-semibold hover:bg-white/90 transition disabled:opacity-50"
      >
        {pending ? 'Creando…' : 'Crear curso'}
      </button>
    </form>
  );
}
