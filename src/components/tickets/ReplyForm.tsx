'use client';

import { useTransition, useState } from 'react';
import { replyTicketAction, setTicketStatusAction } from '@/lib/tickets/actions';

export function ReplyForm({ ticketId, status }: { ticketId: string; status: string }) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        start(async () => {
          const fd = new FormData();
          fd.set('ticket_id', ticketId);
          fd.set('body', body);
          await replyTicketAction(fd);
          setBody('');
        });
      }}
      className="space-y-3"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Escribí tu respuesta…"
        className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
      />
      <div className="flex gap-2 items-center">
        <button
          disabled={pending || !body.trim()}
          className="rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar respuesta'}
        </button>
        {status !== 'closed' && (
          <form action={setTicketStatusAction} className="inline">
            <input type="hidden" name="ticket_id" value={ticketId} />
            <input type="hidden" name="status" value="closed" />
            <button className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5">
              Cerrar ticket
            </button>
          </form>
        )}
        {status === 'closed' && (
          <form action={setTicketStatusAction} className="inline">
            <input type="hidden" name="ticket_id" value={ticketId} />
            <input type="hidden" name="status" value="open" />
            <button className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5">
              Reabrir
            </button>
          </form>
        )}
      </div>
    </form>
  );
}
