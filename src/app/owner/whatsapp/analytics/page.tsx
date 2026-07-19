import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/**
 * Analytics dashboard del WhatsApp: métricas de volumen, primera
 * respuesta, hit rate del bot, top reglas y top keywords. Calcula
 * todo en runtime — para tenants con miles de mensajes conviene
 * cachear con revalidate:300 más adelante.
 */
export default async function AnalyticsPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Volumen: total conversations, mensajes in/out 7d, unique customers 30d
  const [
    { count: totalConvs },
    { count: msgsIn7 },
    { count: msgsOut7 },
    { count: msgsBot7 },
    { count: unread },
    { data: uniqueCustomersRaw }
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('whatsapp_conversations') as any).select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('whatsapp_messages') as any).select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('direction', 'in').gte('created_at', last7.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('whatsapp_messages') as any).select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('direction', 'out').gte('created_at', last7.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('whatsapp_messages') as any).select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('direction', 'out').eq('from_bot', true).gte('created_at', last7.toISOString()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('whatsapp_conversations') as any).select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).gt('unread_count', 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('whatsapp_conversations') as any).select('wa_customer_id')
      .eq('tenant_id', tenant.id).gte('last_message_at', last30.toISOString())
  ]);

  const uniqueCustomers30 = new Set(((uniqueCustomersRaw as Array<{ wa_customer_id: string }> | null) || []).map((r) => r.wa_customer_id)).size;
  const botHitRate = (msgsOut7 || 0) > 0 ? Math.round(((msgsBot7 || 0) / (msgsOut7 || 1)) * 100) : 0;

  // Series diaria de últimos 30 días — 1 query trae todos y agregamos en memoria
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msgs30Raw } = await (svc.from('whatsapp_messages') as any)
    .select('created_at, direction')
    .eq('tenant_id', tenant.id).gte('created_at', last30.toISOString());
  const dayBuckets = new Map<string, { in: number; out: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dayBuckets.set(key, { in: 0, out: 0 });
  }
  for (const m of ((msgs30Raw as Array<{ created_at: string; direction: string }> | null) || [])) {
    const key = (m.created_at || '').slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (bucket) bucket[m.direction === 'in' ? 'in' : 'out']++;
  }
  const dailySeries = Array.from(dayBuckets.entries()).map(([day, v]) => ({ day, ...v }));
  const maxDaily = Math.max(1, ...dailySeries.map((d) => Math.max(d.in, d.out)));

  // Reglas del bot con hit_count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rulesRaw } = await (svc.from('whatsapp_bot_rules') as any)
    .select('name, trigger_type, hit_count, keywords, active')
    .eq('tenant_id', tenant.id).order('hit_count', { ascending: false, nullsFirst: false }).limit(10);
  const topRules = (rulesRaw as Array<{ name: string; trigger_type: string; hit_count: number | null; keywords: string[] | null; active: boolean }> | null) || [];

  // First response time (avg + p95) sobre las últimas 200 conversaciones
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentConvs } = await (svc.from('whatsapp_conversations') as any)
    .select('id').eq('tenant_id', tenant.id).order('last_message_at', { ascending: false }).limit(200);
  const convIds = ((recentConvs as Array<{ id: string }> | null) || []).map((c) => c.id);
  const responseTimes: number[] = [];
  if (convIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allMsgs } = await (svc.from('whatsapp_messages') as any)
      .select('conversation_id, direction, from_bot, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true });
    const byConv = new Map<string, Array<{ direction: string; from_bot: boolean; created_at: string }>>();
    for (const m of ((allMsgs as Array<{ conversation_id: string; direction: string; from_bot: boolean; created_at: string }> | null) || [])) {
      if (!byConv.has(m.conversation_id)) byConv.set(m.conversation_id, []);
      byConv.get(m.conversation_id)!.push(m);
    }
    for (const [, msgs] of byConv) {
      // Primera respuesta HUMANA (no bot) a un mensaje in
      let lastInAt: number | null = null;
      for (const m of msgs) {
        if (m.direction === 'in') lastInAt = new Date(m.created_at).getTime();
        else if (lastInAt && !m.from_bot) {
          const diff = (new Date(m.created_at).getTime() - lastInAt) / 1000;
          if (diff > 0 && diff < 24 * 60 * 60) responseTimes.push(diff);
          lastInAt = null;
        }
      }
    }
  }
  responseTimes.sort((a, b) => a - b);
  const avgResp = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
  const p95Resp = responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.95)] || 0 : 0;

  function fmtDur(s: number): string {
    if (s === 0) return '—';
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.round(s / 60)}min`;
    return `${(s / 3600).toFixed(1)}h`;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <Link href="/owner/whatsapp" className="text-sm text-black/60 hover:underline">← Volver a bandeja</Link>
        <h1 className="text-2xl font-bold mt-2">📊 Analytics WhatsApp</h1>
        <p className="text-sm text-black/60 mt-1">Métricas de los últimos 7-30 días. Se actualiza al cargar (no cacheado).</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Conversaciones" value={String(totalConvs || 0)} sub="totales" />
        <Kpi label="Clientes únicos" value={String(uniqueCustomers30)} sub="últimos 30d" />
        <Kpi label="No leídas" value={String(unread || 0)} sub="ahora mismo" accent={unread ? 'red' : undefined} />
        <Kpi label="Bot hit rate" value={`${botHitRate}%`} sub="7d out del bot / total out" accent="emerald" />
        <Kpi label="Mensajes entrantes" value={String(msgsIn7 || 0)} sub="últimos 7d" />
        <Kpi label="Mensajes salientes" value={String(msgsOut7 || 0)} sub="últimos 7d" />
        <Kpi label="Respuesta promedio" value={fmtDur(avgResp)} sub="humano · avg" />
        <Kpi label="Respuesta p95" value={fmtDur(p95Resp)} sub="humano · p95" />
      </div>

      {/* Chart daily volume */}
      <div className="border rounded-lg p-4 bg-white">
        <h2 className="font-semibold mb-3">Volumen diario — últimos 30 días</h2>
        <div className="flex items-end gap-1 h-40 overflow-x-auto">
          {dailySeries.map((d) => (
            <div key={d.day} className="flex flex-col items-center gap-0.5 min-w-[16px] flex-1">
              <div className="w-full flex flex-col justify-end h-32 gap-px">
                <div className="bg-emerald-500 w-full rounded-t"
                  style={{ height: `${(d.in / maxDaily) * 100}%` }}
                  title={`${d.day} · in: ${d.in}`} />
                <div className="bg-blue-500 w-full"
                  style={{ height: `${(d.out / maxDaily) * 100}%` }}
                  title={`${d.day} · out: ${d.out}`} />
              </div>
              <div className="text-[9px] text-black/40 rotate-45 origin-top-left translate-y-1 whitespace-nowrap">
                {d.day.slice(5)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded" /> entrantes</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded" /> salientes</span>
        </div>
      </div>

      {/* Top reglas del bot */}
      <div className="border rounded-lg p-4 bg-white">
        <h2 className="font-semibold mb-3">Top reglas del bot</h2>
        {topRules.length === 0 ? (
          <div className="text-sm text-black/60">Todavía no hay reglas configuradas. <Link href="/owner/whatsapp/bot" className="text-emerald-700 underline">Agregar la primera →</Link></div>
        ) : (
          <div className="divide-y">
            {topRules.map((r) => (
              <div key={r.name} className="py-2 flex items-center gap-2 text-sm">
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                  r.trigger_type === 'fallback' ? 'bg-amber-100 text-amber-700' :
                  r.trigger_type === 'welcome' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-blue-100 text-blue-700'
                }`}>{r.trigger_type}</span>
                <span className="flex-1 truncate">{r.name}</span>
                {!r.active && <span className="text-[10px] bg-zinc-200 px-1.5 py-0.5 rounded">pausada</span>}
                <span className="text-sm font-mono font-bold text-emerald-700">{r.hit_count || 0}</span>
                <span className="text-xs text-black/50">hits</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: 'red' | 'emerald' }) {
  const accentCls = accent === 'red' ? 'text-red-600' : accent === 'emerald' ? 'text-emerald-600' : 'text-black';
  return (
    <div className="border rounded-lg p-3 bg-white">
      <div className="text-[10px] uppercase font-semibold text-black/50 tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accentCls}`}>{value}</div>
      <div className="text-[10px] text-black/40 mt-0.5">{sub}</div>
    </div>
  );
}
