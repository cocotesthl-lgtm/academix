import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createBroadcastAction, cancelBroadcastAction } from '@/lib/whatsapp/bot-actions';

export const dynamic = 'force-dynamic';

type Broadcast = {
  id: string;
  name: string;
  message_body: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
};

export default async function BroadcastPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Historial de broadcasts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bcastsRaw } = await (svc.from('whatsapp_broadcasts') as any)
    .select('id, name, message_body, status, total_recipients, sent_count, failed_count, created_at, completed_at')
    .eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(30);
  const broadcasts = (bcastsRaw as Broadcast[] | null) || [];

  // Tags disponibles para seleccionar destinatarios
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allConvsForTags } = await (svc.from('whatsapp_conversations') as any)
    .select('tags').eq('tenant_id', tenant.id).not('tags', 'is', null).limit(500);
  const tagSet = new Set<string>();
  for (const c of ((allConvsForTags as Array<{ tags: string[] | null }> | null) || [])) {
    for (const t of (c.tags || [])) tagSet.add(t);
  }
  const availableTags = Array.from(tagSet).sort();

  // Contadores por tag para preview
  const tagCounts = new Map<string, number>();
  for (const c of ((allConvsForTags as Array<{ tags: string[] | null }> | null) || [])) {
    for (const t of (c.tags || [])) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/owner/whatsapp" className="text-sm text-black/60 hover:underline">← Volver a bandeja</Link>
        <h1 className="text-2xl font-bold mt-2">📢 Broadcast</h1>
        <p className="text-sm text-black/60 mt-1">
          Enviá un mismo mensaje a varias conversaciones a la vez. El envío se hace
          escalonado (throttling) para no gatillar el detector de spam de Meta o Baileys.
        </p>
      </div>

      {/* Form crear nuevo */}
      <form action={createBroadcastAction} className="border-2 border-emerald-300 rounded-lg p-5 bg-emerald-50 space-y-3">
        <h2 className="font-semibold">➕ Nuevo broadcast</h2>
        <label className="block text-sm">
          <span className="text-xs font-semibold">Nombre interno</span>
          <input name="name" required maxLength={100}
            className="mt-1 w-full border rounded px-3 py-2 text-sm bg-white"
            placeholder="Promo Black Friday" />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold">Mensaje</span>
          <textarea name="body" required rows={4} maxLength={4000}
            className="mt-1 w-full border rounded px-3 py-2 text-sm bg-white"
            placeholder="🎉 30% OFF hoy! Escribinos si te interesa alguno de nuestros productos." />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-xs font-semibold">Destinatarios por tags (separados por coma)</span>
            <input name="tags"
              className="mt-1 w-full border rounded px-3 py-2 text-sm bg-white font-mono"
              placeholder="cliente, vip" />
            {availableTags.length > 0 && (
              <div className="mt-1 text-[11px] text-black/50">
                Tags disponibles: {availableTags.map((t) => `${t} (${tagCounts.get(t) || 0})`).join(', ')}
              </div>
            )}
          </label>
          <label className="block text-sm">
            <span className="text-xs font-semibold">Segundos entre envíos (throttle)</span>
            <input name="throttle_secs" type="number" min={3} max={60} defaultValue={8}
              className="mt-1 w-full border rounded px-3 py-2 text-sm bg-white" />
            <span className="text-[11px] text-black/50 block mt-1">
              Recomendado 8-15s para QR (Baileys). Cloud API tolera 3-5s.
            </span>
          </label>
        </div>
        <button type="submit"
          className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
          Crear y encolar broadcast
        </button>
      </form>

      {/* Historial */}
      <div>
        <h2 className="font-semibold mb-3">Historial</h2>
        {broadcasts.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm text-black/60">
            Todavía no hay broadcasts. Creá el primero arriba.
          </div>
        ) : (
          <div className="space-y-2">
            {broadcasts.map((b) => {
              const progress = b.total_recipients > 0
                ? Math.round(((b.sent_count + b.failed_count) / b.total_recipients) * 100)
                : 0;
              return (
                <div key={b.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{b.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                          b.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                          b.status === 'sending' ? 'bg-blue-100 text-blue-700' :
                          b.status === 'cancelled' ? 'bg-zinc-200 text-zinc-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{b.status}</span>
                      </div>
                      <div className="text-xs text-black/60 line-clamp-2 mb-2">{b.message_body}</div>
                      <div className="text-xs text-black/70 flex gap-3">
                        <span>📬 <b>{b.sent_count}</b> enviados</span>
                        {b.failed_count > 0 && <span className="text-red-600">❌ <b>{b.failed_count}</b> fallidos</span>}
                        <span>👥 {b.total_recipients} total</span>
                      </div>
                    </div>
                    {b.status === 'sending' && (
                      <form action={cancelBroadcastAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">Cancelar</button>
                      </form>
                    )}
                  </div>
                  <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-[10px] text-black/50 mt-1">
                    Creado {new Date(b.created_at).toLocaleString('es-AR')}
                    {b.completed_at && ` · Completado ${new Date(b.completed_at).toLocaleString('es-AR')}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-xs text-black/60 bg-zinc-50 border rounded-lg p-3">
        💡 El cron corre cada minuto y procesa los jobs vencidos. Los mensajes se envían
        con el throttling configurado y quedan registrados en cada conversación como si
        los hubieras escrito manualmente.
      </div>
    </div>
  );
}
