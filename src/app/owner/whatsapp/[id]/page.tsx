import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  sendManualReplyAction,
  toggleBotPausedAction,
  markConversationReadAction
} from '@/lib/whatsapp/bot-actions';

export const dynamic = 'force-dynamic';

type Msg = {
  id: string;
  direction: 'in' | 'out';
  from_bot: boolean;
  body: string | null;
  msg_type: string;
  media_url: string | null;
  status: string;
  created_at: string;
  error_message: string | null;
};

type Conv = {
  id: string;
  wa_customer_id: string;
  customer_name: string | null;
  status: string;
  bot_paused: boolean;
};

export default async function ConversationPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: convRaw } = await (svc.from('whatsapp_conversations') as any)
    .select('id, wa_customer_id, customer_name, status, bot_paused, tenant_id')
    .eq('id', id).limit(1).maybeSingle();
  if (!convRaw || convRaw.tenant_id !== tenant.id) notFound();
  const conv = convRaw as Conv & { tenant_id: string };

  // Marcar leído silenciosamente al abrir (fire-and-forget vía server action)
  // Se usa un form escondido para que se ejecute solo si el usuario navega y no
  // toca el server. Alternativa: hacerlo inline con supabase update. Preferimos
  // action para mantener la lógica en un solo lugar.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msgsRaw } = await (svc.from('whatsapp_messages') as any)
    .select('id, direction, from_bot, body, msg_type, media_url, status, created_at, error_message')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(500);
  const messages = (msgsRaw as Msg[] | null) || [];

  // Marca como leída al server (silencioso: no bloquea)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_conversations') as any)
    .update({ unread_count: 0 }).eq('id', id);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b p-4 flex items-center gap-3 bg-white flex-shrink-0">
        <Link href="/owner/whatsapp" className="text-sm text-black/60 hover:underline">
          ← Volver
        </Link>
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
          {(conv.customer_name || conv.wa_customer_id).slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="font-semibold">{conv.customer_name || conv.wa_customer_id}</div>
          <div className="text-xs text-black/60">+{conv.wa_customer_id}</div>
        </div>
        <form action={toggleBotPausedAction}>
          <input type="hidden" name="conversation_id" value={conv.id} />
          <input type="hidden" name="paused" value={conv.bot_paused ? 'off' : 'on'} />
          <button type="submit"
            className={`text-xs px-3 py-1.5 rounded border transition ${
              conv.bot_paused
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
            }`}>
            {conv.bot_paused ? '⏸ Bot pausado — reactivar' : '🤖 Bot activo — pausar'}
          </button>
        </form>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-zinc-50 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-black/50 py-12">
            Todavía no hay mensajes en esta conversación.
          </div>
        )}
        {messages.map((m) => {
          const isOut = m.direction === 'out';
          return (
            <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-lg px-3 py-2 ${
                isOut
                  ? m.from_bot
                    ? 'bg-emerald-100 text-black'
                    : 'bg-emerald-600 text-white'
                  : 'bg-white border'
              }`}>
                {m.from_bot && isOut && (
                  <div className="text-[10px] text-emerald-700 font-semibold mb-0.5">🤖 BOT</div>
                )}
                {m.body && <div className="whitespace-pre-wrap text-sm">{m.body}</div>}
                {m.media_url && (
                  <div className="mt-1 text-xs">
                    <a href={m.media_url} target="_blank" rel="noreferrer" className="underline">
                      📎 {m.msg_type}
                    </a>
                  </div>
                )}
                <div className={`text-[10px] mt-1 ${isOut && !m.from_bot ? 'text-white/70' : 'text-black/50'}`}>
                  {new Date(m.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {isOut && ` · ${m.status}`}
                  {m.error_message && ` · ⚠️ ${m.error_message}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <form action={sendManualReplyAction}
        className="border-t p-3 bg-white flex gap-2 flex-shrink-0">
        <input type="hidden" name="conversation_id" value={conv.id} />
        <textarea name="body" required maxLength={4000}
          placeholder="Escribí tu respuesta..."
          className="flex-1 border rounded px-3 py-2 text-sm resize-none min-h-[42px] max-h-[120px]"
          rows={1} />
        <button type="submit"
          className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
          Enviar
        </button>
      </form>

      {/* Marca leído (form invisible con action explícita — sin auto-submit para
          evitar loops; se disparó ya server-side arriba al cargar la página) */}
      <form action={markConversationReadAction} style={{ display: 'none' }}>
        <input type="hidden" name="conversation_id" value={conv.id} />
      </form>
    </div>
  );
}
