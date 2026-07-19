import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  sendManualReplyAction,
  toggleBotPausedAction,
  markConversationReadAction,
  sendMediaReplyAction,
  sendTemplateAction,
  addConversationTagAction,
  removeConversationTagAction,
  toggleConversationStatusAction,
  scheduleMessageAction
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
  tags: string[] | null;
  crm_lead_id: string | null;
};

export default async function ConversationPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: convRaw } = await (svc.from('whatsapp_conversations') as any)
    .select('id, wa_customer_id, customer_name, status, bot_paused, tenant_id, tags, crm_lead_id')
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

  // Ventana de 24hs: si el último mensaje IN del cliente tiene más de 24h,
  // Meta bloquea texto plano y sólo acepta templates aprobados. Mostramos
  // aviso en el compose + botón para usar template.
  const lastIn = [...messages].reverse().find((m) => m.direction === 'in');
  const outsideWindow = lastIn ? (Date.now() - new Date(lastIn.created_at).getTime()) > 24 * 60 * 60 * 1000 : true;

  // Templates disponibles del tenant (para el modal)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tplsRaw } = await (svc.from('whatsapp_templates') as any)
    .select('name, language, body, params_count, category')
    .eq('tenant_id', tenant.id)
    .order('last_used_at', { ascending: false, nullsFirst: false });
  const templates = (tplsRaw as Array<{ name: string; language: string; body: string; params_count: number; category: string | null }> | null) || [];

  // Marca como leída al server (silencioso: no bloquea)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_conversations') as any)
    .update({ unread_count: 0 }).eq('id', id);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b bg-white flex-shrink-0">
        <div className="p-4 flex items-center gap-3">
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
          <form action={toggleConversationStatusAction} className="flex items-center gap-1">
            <input type="hidden" name="conversation_id" value={conv.id} />
            <select name="status" defaultValue={conv.status}
              className="text-xs border rounded px-2 py-1 bg-white">
              <option value="open">🟢 Abierta</option>
              <option value="closed">🔴 Cerrada</option>
              <option value="archived">📦 Archivada</option>
            </select>
            <button type="submit" className="text-[11px] px-2 py-1 border rounded hover:bg-black/5">
              OK
            </button>
          </form>
          <form action={toggleBotPausedAction}>
            <input type="hidden" name="conversation_id" value={conv.id} />
            <input type="hidden" name="paused" value={conv.bot_paused ? 'off' : 'on'} />
            <button type="submit"
              className={`text-xs px-3 py-1.5 rounded border transition ${
                conv.bot_paused
                  ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
              }`}>
              {conv.bot_paused ? '⏸ Bot pausado' : '🤖 Bot activo'}
            </button>
          </form>
        </div>
        {/* Tags row */}
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
          {(conv.tags || []).map((t) => (
            <form key={t} action={removeConversationTagAction} className="inline-flex">
              <input type="hidden" name="conversation_id" value={conv.id} />
              <input type="hidden" name="tag" value={t} />
              <button type="submit"
                className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition">
                #{t} ✕
              </button>
            </form>
          ))}
          <form action={addConversationTagAction} className="inline-flex items-center gap-1">
            <input type="hidden" name="conversation_id" value={conv.id} />
            <input name="tag" placeholder="+ etiqueta" maxLength={40}
              className="text-[11px] border rounded-full px-2 py-0.5 w-24 focus:w-32 transition-all" />
          </form>
          {conv.crm_lead_id && (
            <Link href={`/owner/crm`}
              className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full hover:bg-blue-100">
              🎯 Lead CRM
            </Link>
          )}
        </div>
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

      {/* Aviso ventana 24hs */}
      {outsideWindow && (
        <div className="border-t bg-amber-50 px-4 py-2 text-xs text-amber-800">
          ⏳ El último mensaje del cliente fue hace más de 24hs. Meta requiere que uses un template aprobado para responder.
          <Link href="/owner/whatsapp/templates" className="ml-2 underline">Gestionar templates →</Link>
        </div>
      )}

      {/* Compose: texto + adjunto + template */}
      <div className="border-t bg-white flex-shrink-0">
        {/* Texto libre */}
        <form action={sendManualReplyAction} className="p-3 flex gap-2">
          <input type="hidden" name="conversation_id" value={conv.id} />
          <textarea name="body" required maxLength={4000}
            placeholder={outsideWindow ? 'Fuera de ventana 24hs — usá un template' : 'Escribí tu respuesta...'}
            disabled={outsideWindow}
            className="flex-1 border rounded px-3 py-2 text-sm resize-none min-h-[42px] max-h-[120px] disabled:bg-zinc-100"
            rows={1} />
          <button type="submit" disabled={outsideWindow}
            className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">
            Enviar
          </button>
        </form>

        {/* Agendar mensaje */}
        <details className="border-t px-3 py-2">
          <summary className="text-xs font-semibold text-black/70 cursor-pointer">
            ⏰ Agendar mensaje
          </summary>
          <form action={scheduleMessageAction} className="mt-2 space-y-2">
            <input type="hidden" name="conversation_id" value={conv.id} />
            <textarea name="body" required rows={2} maxLength={4000}
              placeholder="Mensaje a enviar..."
              className="w-full border rounded px-2 py-1 text-xs" />
            <div className="flex items-center gap-2">
              <input name="send_at" type="datetime-local" required
                min={new Date().toISOString().slice(0, 16)}
                className="border rounded px-2 py-1 text-xs" />
              <button type="submit"
                className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50">
                Agendar
              </button>
              <Link href="/owner/whatsapp/scheduled" className="text-[11px] text-black/60 hover:underline ml-auto">
                Ver todos →
              </Link>
            </div>
          </form>
        </details>

        {/* Media picker */}
        <form action={sendMediaReplyAction} className="px-3 pb-3 flex items-center gap-2 border-t pt-2"
          encType="multipart/form-data">
          <input type="hidden" name="conversation_id" value={conv.id} />
          <label className="flex items-center gap-2 text-xs text-black/70 flex-shrink-0">
            📎 Adjuntar
            <input type="file" name="file" required accept="image/*,application/pdf,audio/*,video/*"
              className="text-xs" />
          </label>
          <input type="text" name="caption" placeholder="Caption opcional"
            className="flex-1 border rounded px-2 py-1 text-xs" />
          <button type="submit"
            className="text-xs px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            Enviar adjunto
          </button>
        </form>

        {/* Templates (solo si hay al menos 1 disponible) */}
        {templates.length > 0 && (
          <details className="border-t px-3 py-2">
            <summary className="text-xs font-semibold text-black/70 cursor-pointer">
              📋 Enviar template ({templates.length} aprobados)
            </summary>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {templates.map((t) => (
                <form key={`${t.name}:${t.language}`} action={sendTemplateAction}
                  className="p-2 rounded border bg-zinc-50 space-y-1.5">
                  <input type="hidden" name="conversation_id" value={conv.id} />
                  <input type="hidden" name="template_name" value={t.name} />
                  <input type="hidden" name="language" value={t.language} />
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-black/50">· {t.language} · {t.category}</span>
                  </div>
                  <div className="text-[11px] text-black/60 line-clamp-2">{t.body}</div>
                  {t.params_count > 0 && (
                    <input name="body_params" required
                      placeholder={`Variables separadas por | (${t.params_count} en total)`}
                      className="w-full border rounded px-2 py-1 text-xs" />
                  )}
                  <button type="submit"
                    className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">
                    Enviar este template
                  </button>
                </form>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Marca leído — form invisible; también corrimos el update server-side arriba */}
      <form action={markConversationReadAction} style={{ display: 'none' }}>
        <input type="hidden" name="conversation_id" value={conv.id} />
      </form>
    </div>
  );
}
