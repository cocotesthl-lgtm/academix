'use client';

import { useState, useTransition } from 'react';
import { sendFanMessageAction } from '@/lib/dms/actions';

export type FanChatMessage = {
  id: string;
  sender_kind: 'fan' | 'owner';
  body: string;
  created_at: string;
};

/**
 * Widget flotante para que un fan enrolled escriba al owner del tenant.
 * Aparece como botón abajo a la derecha; click → abre panel con thread.
 */
export function FanChatWidget({
  tenantId,
  tenantName,
  initialMessages,
  unreadForFan,
  primary
}: {
  tenantId: string;
  tenantName: string;
  initialMessages: FanChatMessage[];
  unreadForFan: number;
  primary: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const [localMessages, setLocalMessages] = useState(initialMessages);

  function send() {
    if (!text.trim() || pending) return;
    const body = text.trim();
    start(async () => {
      const fd = new FormData();
      fd.set('tenant_id', tenantId); fd.set('body', body);
      // Optimistic
      setLocalMessages((prev) => [
        ...prev,
        { id: `temp-${Date.now()}`, sender_kind: 'fan', body, created_at: new Date().toISOString() }
      ]);
      setText('');
      await sendFanMessageAction(fd);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 rounded-full w-14 h-14 shadow-2xl flex items-center justify-center text-2xl text-white font-bold hover:scale-105 transition"
        style={{ background: primary }}
        aria-label="Chat con el creador"
      >
        {open ? '✕' : '💬'}
        {!open && unreadForFan > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
            {unreadForFan}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-80 max-w-[calc(100vw-3rem)] bg-white text-black rounded-2xl shadow-2xl border border-black/10 overflow-hidden flex flex-col"
          style={{ maxHeight: 'min(600px, calc(100vh - 7rem))' }}>
          <div className="px-4 py-3 border-b border-black/10 flex items-center gap-2"
            style={{ background: primary, color: 'white' }}>
            <span className="text-lg">💬</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Chat con {tenantName}</div>
              <div className="text-[10px] opacity-80">Respuesta en cuanto puedan</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-zinc-50">
            {localMessages.length === 0 ? (
              <p className="text-xs text-black/45 text-center py-4">
                Empezá la conversación. {tenantName} te va a responder en cuanto pueda.
              </p>
            ) : (
              localMessages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.sender_kind === 'fan'
                      ? 'ml-auto text-white'
                      : 'mr-auto bg-white border border-black/10'
                  }`}
                  style={m.sender_kind === 'fan' ? { background: primary } : undefined}
                >
                  <div className="whitespace-pre-line break-words">{m.body}</div>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-black/10 flex gap-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Escribí un mensaje…"
              className="flex-1 rounded bg-zinc-100 border border-black/10 px-3 py-2 text-sm focus:outline-none focus:border-black/30"
            />
            <button
              type="button"
              onClick={send}
              disabled={pending || !text.trim()}
              className="rounded text-white text-sm font-semibold px-3 disabled:opacity-40"
              style={{ background: primary }}
            >
              {pending ? '…' : '↑'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
