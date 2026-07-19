import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { cancelScheduledMessageAction } from '@/lib/whatsapp/bot-actions';

export const dynamic = 'force-dynamic';

type Sched = {
  id: string;
  conversation_id: string;
  wa_customer_id: string;
  body: string;
  status: string;
  send_at: string;
  sent_at: string | null;
  error_message: string | null;
};

export default async function ScheduledPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schedRaw } = await (svc.from('whatsapp_scheduled_messages') as any)
    .select('id, conversation_id, wa_customer_id, body, status, send_at, sent_at, error_message')
    .eq('tenant_id', tenant.id).order('send_at', { ascending: true }).limit(100);
  const scheduled = (schedRaw as Sched[] | null) || [];

  const pending = scheduled.filter((s) => s.status === 'pending');
  const past = scheduled.filter((s) => s.status !== 'pending');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/owner/whatsapp" className="text-sm text-black/60 hover:underline">← Volver a bandeja</Link>
        <h1 className="text-2xl font-bold mt-2">⏰ Mensajes agendados</h1>
        <p className="text-sm text-black/60 mt-1">
          Mensajes que vas a enviar en el futuro. Los agendás desde cada conversación
          con el botón &ldquo;Agendar&rdquo; en el compose.
        </p>
      </div>

      {/* Pendientes */}
      <div>
        <h2 className="font-semibold mb-3">⏳ Pendientes ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm text-black/60">
            No hay mensajes agendados. Andá a cualquier conversación y usá el botón &ldquo;Agendar&rdquo;.
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((s) => (
              <div key={s.id} className="border rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-black/60 mb-1">
                      Para <Link href={`/owner/whatsapp/${s.conversation_id}`} className="text-emerald-700 hover:underline">+{s.wa_customer_id}</Link>
                    </div>
                    <div className="text-sm text-black/80 whitespace-pre-wrap">{s.body}</div>
                    <div className="text-xs text-black/50 mt-2">
                      📅 Programado para {new Date(s.send_at).toLocaleString('es-AR')}
                    </div>
                  </div>
                  <form action={cancelScheduledMessageAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className="text-xs text-red-600 hover:underline">Cancelar</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico */}
      {past.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Historial reciente</h2>
          <div className="space-y-2">
            {past.map((s) => (
              <div key={s.id} className="border rounded-lg p-3 bg-zinc-50 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                    s.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                    s.status === 'cancelled' ? 'bg-zinc-200 text-zinc-700' :
                    'bg-red-100 text-red-700'
                  }`}>{s.status}</span>
                  <Link href={`/owner/whatsapp/${s.conversation_id}`} className="text-xs text-emerald-700 hover:underline">
                    +{s.wa_customer_id}
                  </Link>
                  <span className="text-[10px] text-black/50">
                    {s.sent_at ? `enviado ${new Date(s.sent_at).toLocaleString('es-AR')}` : `agendado ${new Date(s.send_at).toLocaleString('es-AR')}`}
                  </span>
                </div>
                <div className="text-xs text-black/70 line-clamp-2">{s.body}</div>
                {s.error_message && (
                  <div className="text-[11px] text-red-600 mt-1">⚠️ {s.error_message}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
