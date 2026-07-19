import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type Conversation = {
  id: string;
  wa_customer_id: string;
  customer_name: string | null;
  last_message_at: string | null;
  last_message_body: string | null;
  last_message_from_bot: boolean;
  unread_count: number;
  status: string;
  bot_paused: boolean;
};

type Config = {
  phone_number_id: string | null;
  display_phone: string | null;
  bot_enabled: boolean;
  connected_at: string | null;
};

export default async function WhatsAppInboxPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const [{ data: cfg }, { data: convsRaw }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('whatsapp_config') as any)
      .select('phone_number_id, display_phone, bot_enabled, connected_at')
      .eq('tenant_id', tenant.id).limit(1).maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('whatsapp_conversations') as any)
      .select('id, wa_customer_id, customer_name, last_message_at, last_message_body, last_message_from_bot, unread_count, status, bot_paused')
      .eq('tenant_id', tenant.id)
      .order('last_message_at', { ascending: false })
      .limit(200)
  ]);

  const config = cfg as Config | null;
  const conversations = (convsRaw as Conversation[] | null) || [];
  const notConnected = !config?.phone_number_id;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp</h1>
          <p className="text-sm text-black/60 mt-1">
            {notConnected
              ? 'Conectá tu número para recibir mensajes y activar el bot.'
              : `${conversations.length} conversaciones · ${config?.display_phone || config?.phone_number_id}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/owner/whatsapp/bot" className="text-sm px-3 py-2 rounded border hover:bg-black/5">
            🤖 Reglas del bot
          </Link>
          <Link href="/owner/whatsapp/templates" className="text-sm px-3 py-2 rounded border hover:bg-black/5">
            📋 Templates
          </Link>
          <Link href="/owner/whatsapp/config" className="text-sm px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700">
            {notConnected ? 'Conectar' : 'Configuración'}
          </Link>
        </div>
      </div>

      {notConnected ? (
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          <div className="text-4xl mb-3">💬</div>
          <h2 className="font-semibold mb-2">Bot de WhatsApp aún no conectado</h2>
          <p className="text-sm text-black/60 max-w-md mx-auto mb-4">
            Conectá tu número de WhatsApp Business y empezá a recibir mensajes automáticos,
            responder desde acá, y setear reglas de auto-respuesta por keyword.
          </p>
          <Link href="/owner/whatsapp/config" className="inline-block px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700">
            Empezar
          </Link>
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-black/60">
          Todavía no llegaron mensajes. Cuando alguien te escriba al {config?.display_phone || 'número conectado'}, aparece acá.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {conversations.map((c) => (
            <Link key={c.id} href={`/owner/whatsapp/${c.id}`}
              className="flex items-center gap-3 p-3 hover:bg-black/5 transition">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold flex-shrink-0">
                {(c.customer_name || c.wa_customer_id).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold truncate">
                    {c.customer_name || c.wa_customer_id}
                  </div>
                  {c.bot_paused && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">bot pausado</span>
                  )}
                </div>
                <div className="text-sm text-black/60 truncate">
                  {c.last_message_from_bot && <span className="text-emerald-700">🤖 </span>}
                  {c.last_message_body || '(sin mensajes)'}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {c.last_message_at && (
                  <div className="text-[11px] text-black/50">
                    {new Date(c.last_message_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                {c.unread_count > 0 && (
                  <div className="text-[11px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {c.unread_count}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
