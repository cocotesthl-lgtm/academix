import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { sendOwnerMessageAction, markThreadReadAction } from '@/lib/dms/actions';

export const dynamic = 'force-dynamic';

type ThreadRow = {
  id: string;
  fan_user_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_for_owner: number;
  profiles: { display_name: string | null; email: string | null } | null;
};

type MessageRow = {
  id: string;
  sender_kind: string;
  body: string;
  created_at: string;
};

export default async function MessagesPage({ searchParams }: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { tenant } = await requireOwner();
  const { t: openThreadId } = await searchParams;
  const svc = getServiceClient();

  let migrationMissing = false;
  let threads: ThreadRow[] = [];
  try {
    const { data, error } = await svc
      .from('dm_threads')
      .select('id, fan_user_id, last_message_at, last_message_preview, unread_for_owner, profiles!dm_threads_fan_user_id_fkey(display_name, email)')
      .eq('tenant_id', tenant.id)
      .order('last_message_at', { ascending: false });
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    threads = (data ?? []) as unknown as ThreadRow[];
  } catch { migrationMissing = true; }

  // Si el FK name custom no funciona, fallback: cargar profiles aparte
  if (threads.length > 0 && !threads[0].profiles) {
    const ids = threads.map((t) => t.fan_user_id);
    const { data: profs } = await svc.from('profiles').select('id, display_name, email').in('id', ids);
    const map = new Map(((profs ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>).map((p) => [p.id, p]));
    threads = threads.map((t) => ({ ...t, profiles: map.get(t.fan_user_id) ?? null }));
  }

  const openThread = openThreadId ? threads.find((t) => t.id === openThreadId) : null;
  let openMessages: MessageRow[] = [];
  if (openThread) {
    // Mark as read on view
    if (openThread.unread_for_owner > 0) {
      const fd = new FormData(); fd.set('thread_id', openThread.id);
      await markThreadReadAction(fd);
    }
    const { data: msgs } = await svc
      .from('dm_messages')
      .select('id, sender_kind, body, created_at')
      .eq('thread_id', openThread.id)
      .order('created_at', { ascending: true });
    openMessages = (msgs ?? []) as MessageRow[];
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">💬 Mensajes</h1>
        <p className="text-white/55 text-sm mt-1">Chat directo con tus fans. Solo los enrolled pueden escribirte.</p>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración. Pegá <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en Supabase SQL Editor.
        </div>
      )}

      {!migrationMissing && (
        <div className="grid md:grid-cols-3 gap-4 h-[70vh]">
          {/* Thread list */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-y-auto">
            <h2 className="px-4 py-3 border-b border-white/10 text-sm font-semibold">
              Conversaciones ({threads.length})
            </h2>
            {threads.length === 0 ? (
              <p className="p-4 text-xs text-white/40">Sin mensajes aún. Cuando un fan que compró un pack te escriba, aparece acá.</p>
            ) : (
              <ul>
                {threads.map((t) => {
                  const name = t.profiles?.display_name || t.profiles?.email || 'Fan';
                  const isOpen = openThreadId === t.id;
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/owner/mensajes?t=${t.id}`}
                        className={`block px-4 py-3 border-b border-white/5 hover:bg-white/5 transition ${isOpen ? 'bg-white/5' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{name}</span>
                          {t.unread_for_owner > 0 && (
                            <span className="bg-rose-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                              {t.unread_for_owner}
                            </span>
                          )}
                        </div>
                        {t.last_message_preview && (
                          <div className="text-[11px] text-white/55 mt-0.5 truncate">{t.last_message_preview}</div>
                        )}
                        <div className="text-[10px] text-white/35 mt-1">
                          {new Date(t.last_message_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Conversation pane */}
          <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col">
            {openThread ? (
              <>
                <div className="px-4 py-3 border-b border-white/10">
                  <div className="font-semibold text-sm">
                    {openThread.profiles?.display_name || openThread.profiles?.email || 'Fan'}
                  </div>
                  <div className="text-[10px] text-white/45">{openThread.profiles?.email}</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {openMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.sender_kind === 'owner'
                          ? 'bg-fuchsia-500/20 ml-auto'
                          : 'bg-white/5 mr-auto'
                      }`}
                    >
                      <div className="whitespace-pre-line">{m.body}</div>
                      <div className="text-[10px] text-white/40 mt-1 text-right">
                        {new Date(m.created_at).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
                <form action={sendOwnerMessageAction} className="p-3 border-t border-white/10 flex gap-2">
                  <input type="hidden" name="thread_id" value={openThread.id} />
                  <input
                    name="body"
                    required
                    placeholder="Escribí tu respuesta…"
                    autoFocus
                    className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
                  />
                  <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2">
                    Enviar
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
                Elegí una conversación para empezar
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
