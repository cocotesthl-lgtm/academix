import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { syncTemplatesAction } from '@/lib/whatsapp/bot-actions';

export const dynamic = 'force-dynamic';

type Template = {
  name: string;
  language: string;
  category: string | null;
  status: string;
  body: string;
  params_count: number;
  last_used_at: string | null;
  synced_at: string;
};

export default async function TemplatesPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tplsRaw } = await (svc.from('whatsapp_templates') as any)
    .select('name, language, category, status, body, params_count, last_used_at, synced_at')
    .eq('tenant_id', tenant.id)
    .order('last_used_at', { ascending: false, nullsFirst: false });
  const templates = (tplsRaw as Template[] | null) || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/owner/whatsapp" className="text-sm text-black/60 hover:underline">← Volver a bandeja</Link>
          <h1 className="text-2xl font-bold mt-2">Templates aprobados</h1>
          <p className="text-sm text-black/60 mt-1">
            Meta obliga a usar templates aprobados para responder <b>fuera de la ventana de 24hs</b> desde el último mensaje del cliente.
            Los templates se crean en Meta Business Suite → luego los sincronizás acá.
          </p>
        </div>
        <form action={syncTemplatesAction}>
          <button type="submit" className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
            🔄 Sincronizar con Meta
          </button>
        </form>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          <div className="text-3xl mb-2">📋</div>
          <h2 className="font-semibold mb-2">Todavía no hay templates sincronizados</h2>
          <p className="text-sm text-black/60 max-w-md mx-auto">
            Andá a <a href="https://business.facebook.com/wa/manage/message-templates" target="_blank" rel="noreferrer" className="text-emerald-700 underline">business.facebook.com → Message Templates</a>,
            creá tu primer template (categoría UTILITY o MARKETING) y esperá la aprobación de Meta (24-48hs).
            Cuando aparezca como APPROVED, tocá &ldquo;Sincronizar&rdquo; acá para bajarlo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={`${t.name}:${t.language}`} className="border rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold">{t.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase font-bold">
                      {t.language}
                    </span>
                    {t.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 uppercase">
                        {t.category}
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                      {t.status}
                    </span>
                    {t.params_count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        {t.params_count} variables
                      </span>
                    )}
                  </div>
                  <pre className="text-sm text-black/80 whitespace-pre-wrap font-sans">{t.body}</pre>
                </div>
                <div className="text-[10px] text-black/50 text-right flex-shrink-0">
                  {t.last_used_at ? (
                    <>Último uso:<br />{new Date(t.last_used_at).toLocaleDateString('es-AR')}</>
                  ) : 'Sin usar aún'}
                  <div className="mt-1">Sync: {new Date(t.synced_at).toLocaleDateString('es-AR')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-black/60 bg-zinc-50 border rounded-lg p-3">
        💡 Los templates se usan directamente desde el chat de cada conversación (sección <em>&ldquo;Enviar template&rdquo;</em>), y si el cliente lleva más de 24h sin escribir el aviso naranja te lo sugiere.
      </div>
    </div>
  );
}
