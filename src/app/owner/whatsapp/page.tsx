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
  tags: string[] | null;
  crm_lead_id: string | null;
};

type Config = {
  provider: 'cloud_api' | 'qr' | null;
  phone_number_id: string | null;
  display_phone: string | null;
  bot_enabled: boolean;
  connected_at: string | null;
  qr_status: string | null;
  evolution_instance: string | null;
};

type SearchParams = { q?: string; filter?: string; tag?: string };

export default async function WhatsAppInboxPage(
  { searchParams }: { searchParams: Promise<SearchParams> }
) {
  const sp = await searchParams;
  const q = (sp.q || '').trim();
  const filter = sp.filter || 'all';
  const tagFilter = sp.tag || '';

  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfg } = await (svc.from('whatsapp_config') as any)
    .select('provider, phone_number_id, display_phone, bot_enabled, connected_at, qr_status, evolution_instance')
    .eq('tenant_id', tenant.id).limit(1).maybeSingle();
  const config = cfg as Config | null;
  const cloudReady = config?.provider === 'cloud_api' && !!config.phone_number_id;
  const qrReady = config?.provider === 'qr' && config.qr_status === 'connected';
  const notConnected = !cloudReady && !qrReady;
  const providerLabel = config?.provider === 'qr'
    ? `QR · ${config.evolution_instance || 'instancia'}`
    : config?.display_phone || config?.phone_number_id || '';

  // Conversaciones + filtros server-side
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (svc.from('whatsapp_conversations') as any)
    .select('id, wa_customer_id, customer_name, last_message_at, last_message_body, last_message_from_bot, unread_count, status, bot_paused, tags, crm_lead_id')
    .eq('tenant_id', tenant.id);

  if (filter === 'unread') query = query.gt('unread_count', 0);
  else if (filter === 'with_lead') query = query.not('crm_lead_id', 'is', null);
  else if (filter === 'without_lead') query = query.is('crm_lead_id', null);
  else if (filter === 'archived') query = query.eq('status', 'archived');
  else if (filter === 'closed') query = query.eq('status', 'closed');
  else if (filter === 'open') query = query.eq('status', 'open');

  if (tagFilter) query = query.contains('tags', [tagFilter]);
  if (q) {
    // OR: nombre O número O último preview matchea el término
    const safe = q.replace(/[%_]/g, '\\$&');
    query = query.or(`customer_name.ilike.%${safe}%,wa_customer_id.ilike.%${safe}%,last_message_body.ilike.%${safe}%`);
  }

  query = query.order('last_message_at', { ascending: false }).limit(200);
  const { data: convsRaw } = await query;
  const conversations = (convsRaw as Conversation[] | null) || [];

  // Recopilar tags únicos para el filtro chip bar (top 20)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allConvsForTags } = await (svc.from('whatsapp_conversations') as any)
    .select('tags').eq('tenant_id', tenant.id).not('tags', 'is', null).limit(500);
  const tagCounts = new Map<string, number>();
  for (const c of ((allConvsForTags as Array<{ tags: string[] | null }> | null) || [])) {
    for (const t of (c.tags || [])) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 20).map((e) => e[0]);

  // Contadores de filtros (para mostrar (N) en las pills)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: unreadCount } = await (svc.from('whatsapp_conversations') as any)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id).gt('unread_count', 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp</h1>
          <p className="text-sm text-black/60 mt-1">
            {notConnected
              ? 'Conectá tu número para recibir mensajes y activar el bot.'
              : `${conversations.length} de ${providerLabel}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/owner/whatsapp/broadcast" className="text-sm px-3 py-2 rounded border hover:bg-black/5">
            📢 Broadcast
          </Link>
          <Link href="/owner/whatsapp/scheduled" className="text-sm px-3 py-2 rounded border hover:bg-black/5">
            ⏰ Agendados
          </Link>
          <Link href="/owner/whatsapp/analytics" className="text-sm px-3 py-2 rounded border hover:bg-black/5">
            📊 Analytics
          </Link>
          <Link href="/owner/whatsapp/bot" className="text-sm px-3 py-2 rounded border hover:bg-black/5">
            🤖 Reglas
          </Link>
          <Link href="/owner/whatsapp/templates" className="text-sm px-3 py-2 rounded border hover:bg-black/5">
            📋 Templates
          </Link>
          <Link href={notConnected ? '/owner/whatsapp/connect' : (config?.provider === 'qr' ? '/owner/whatsapp/qr' : '/owner/whatsapp/config')}
            className="text-sm px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700">
            {notConnected ? 'Conectar' : 'Configuración'}
          </Link>
        </div>
      </div>

      {notConnected ? (
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          <div className="text-4xl mb-3">💬</div>
          <h2 className="font-semibold mb-2">Bot de WhatsApp aún no conectado</h2>
          <p className="text-sm text-black/60 max-w-md mx-auto mb-4">
            Conectá tu número — hay 2 modos, uno simple con QR (2 min) y otro con la API oficial de Meta.
          </p>
          <Link href="/owner/whatsapp/connect" className="inline-block px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700">
            Empezar
          </Link>
        </div>
      ) : (
        <>
          {/* Search + filters */}
          <form method="get" className="mb-4 flex flex-wrap gap-2 items-center">
            {tagFilter && <input type="hidden" name="tag" value={tagFilter} />}
            <input name="q" type="search" defaultValue={q}
              placeholder="🔍 Buscar por nombre, número o texto..."
              className="flex-1 min-w-[200px] border rounded px-3 py-2 text-sm" />
            <select name="filter" defaultValue={filter}
              className="border rounded px-3 py-2 text-sm bg-white">
              <option value="all">Todas</option>
              <option value="unread">No leídas{unreadCount ? ` (${unreadCount})` : ''}</option>
              <option value="open">Abiertas</option>
              <option value="closed">Cerradas</option>
              <option value="archived">Archivadas</option>
              <option value="with_lead">Con lead CRM</option>
              <option value="without_lead">Sin lead CRM</option>
            </select>
            <button type="submit"
              className="text-sm px-4 py-2 rounded bg-black text-white hover:bg-black/80">
              Aplicar
            </button>
            {(q || filter !== 'all' || tagFilter) && (
              <Link href="/owner/whatsapp" className="text-sm px-3 py-2 text-black/60 hover:underline">
                Limpiar
              </Link>
            )}
          </form>

          {/* Tag chips */}
          {topTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className="text-xs text-black/50 self-center mr-1">Etiquetas:</span>
              {topTags.map((t) => (
                <Link key={t}
                  href={`/owner/whatsapp?tag=${encodeURIComponent(t)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                    tagFilter === t
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white hover:bg-emerald-50 hover:border-emerald-300'
                  }`}>
                  #{t}
                </Link>
              ))}
              {tagFilter && (
                <Link href="/owner/whatsapp"
                  className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200">
                  × quitar filtro
                </Link>
              )}
            </div>
          )}

          {conversations.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-black/60">
              {q || tagFilter || filter !== 'all'
                ? 'Ninguna conversación matchea los filtros.'
                : `Todavía no llegaron mensajes. Cuando alguien te escriba al ${providerLabel}, aparece acá.`}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold truncate">
                        {c.customer_name || c.wa_customer_id}
                      </div>
                      {c.bot_paused && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">bot pausado</span>
                      )}
                      {c.status === 'closed' && (
                        <span className="text-[10px] bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded">cerrada</span>
                      )}
                      {c.status === 'archived' && (
                        <span className="text-[10px] bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded">archivada</span>
                      )}
                      {c.crm_lead_id && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">lead</span>
                      )}
                      {(c.tags || []).slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                          #{t}
                        </span>
                      ))}
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
        </>
      )}
    </div>
  );
}
