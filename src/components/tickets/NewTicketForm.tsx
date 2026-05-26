'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createTicketAction, type TicketResult } from '@/lib/tickets/actions';

export function NewTicketForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<TicketResult<{ id: string }> | null, FormData>(
    createTicketAction,
    null
  );

  useEffect(() => {
    if (state?.ok && state.data?.id) {
      router.push(`/tickets/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm mb-1.5 text-white/70">Asunto</label>
        <input
          name="subject"
          required
          maxLength={140}
          placeholder="Sobre qué necesitás ayuda"
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
        />
      </div>
      <div>
        <label className="block text-sm mb-1.5 text-white/70">Mensaje</label>
        <textarea
          name="body"
          required
          rows={6}
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
        />
      </div>
      {state?.ok === false && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
          {state.error}
        </div>
      )}
      <button
        disabled={pending}
        className="rounded-md bg-white text-black px-5 py-2.5 font-semibold hover:bg-white/90 disabled:opacity-50"
      >
        {pending ? 'Enviando…' : 'Abrir ticket'}
      </button>
    </form>
  );
}
