import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { saveBotRuleAction, deleteBotRuleAction } from '@/lib/whatsapp/bot-actions';

export const dynamic = 'force-dynamic';

type Rule = {
  id: string;
  name: string;
  trigger_type: 'keyword' | 'welcome' | 'fallback';
  keywords: string[] | null;
  match_mode: 'contains' | 'exact' | 'starts_with';
  reply_body: string;
  active: boolean;
  position: number;
  hit_count: number | null;
};

export default async function BotRulesPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rulesRaw } = await (svc.from('whatsapp_bot_rules') as any)
    .select('id, name, trigger_type, keywords, match_mode, reply_body, active, position, hit_count')
    .eq('tenant_id', tenant.id)
    .order('position', { ascending: true });
  const rules = (rulesRaw as Rule[] | null) || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/owner/whatsapp" className="text-sm text-black/60 hover:underline">← Volver a bandeja</Link>
        <h1 className="text-2xl font-bold mt-2">Reglas del bot</h1>
        <p className="text-sm text-black/60 mt-1">
          Cuando alguien te escriba palabras clave, el bot responde automáticamente. Se evalúan en orden — la primera que matchea gana.
        </p>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {rules.length === 0 && (
          <div className="rounded-lg border-2 border-dashed p-6 text-center text-sm text-black/60">
            Todavía no hay reglas. Agregá la primera abajo — por ejemplo &ldquo;precio&rdquo; → &ldquo;Los precios están en /pricing&rdquo;.
          </div>
        )}
        {rules.map((r) => (
          <div key={r.id} className="border rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                    r.trigger_type === 'fallback' ? 'bg-amber-100 text-amber-700' :
                    r.trigger_type === 'welcome' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {r.trigger_type}
                  </span>
                  <h3 className="font-semibold">{r.name}</h3>
                  {!r.active && <span className="text-[10px] bg-zinc-200 px-1.5 py-0.5 rounded">pausada</span>}
                  {(r.hit_count ?? 0) > 0 && (
                    <span className="text-[10px] text-black/50">· disparó {r.hit_count} veces</span>
                  )}
                </div>
                {r.trigger_type === 'keyword' && r.keywords && r.keywords.length > 0 && (
                  <div className="text-xs text-black/60 mb-2">
                    <span className="font-semibold">Trigger ({r.match_mode}):</span>{' '}
                    {r.keywords.map((k) => (
                      <code key={k} className="mx-0.5 px-1.5 py-0.5 bg-zinc-100 rounded">{k}</code>
                    ))}
                  </div>
                )}
                <div className="text-sm text-black/80 whitespace-pre-wrap">{r.reply_body}</div>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <details className="text-xs">
                  <summary className="cursor-pointer text-blue-600 hover:underline">Editar</summary>
                  <RuleForm rule={r} />
                </details>
                <form action={deleteBotRuleAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="text-xs text-red-600 hover:underline">Borrar</button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form nueva regla */}
      <div className="border-2 border-emerald-300 rounded-lg p-5 bg-emerald-50">
        <h2 className="font-semibold mb-3">➕ Agregar nueva regla</h2>
        <RuleForm />
      </div>

      {/* Tip */}
      <div className="text-xs text-black/60 bg-zinc-50 border rounded-lg p-3">
        💡 Podés usar <code className="bg-white px-1 rounded">{'{{nombre}}'}</code> en la respuesta para insertar el nombre del cliente.
        Ejemplo: <em>&ldquo;Hola {'{{nombre}}'}, gracias por escribirnos&rdquo;</em>.
      </div>
    </div>
  );
}

function RuleForm({ rule }: { rule?: Rule }) {
  return (
    <form action={saveBotRuleAction} className="mt-2 space-y-2 text-sm">
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-semibold">Nombre interno</span>
          <input name="name" required defaultValue={rule?.name ?? ''}
            className="mt-1 w-full border rounded px-2 py-1.5" placeholder="Ej: Pregunta por precios" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold">Tipo</span>
          <select name="trigger_type" defaultValue={rule?.trigger_type ?? 'keyword'}
            className="mt-1 w-full border rounded px-2 py-1.5">
            <option value="keyword">Keyword — matchea palabra clave</option>
            <option value="fallback">Fallback — si nada matcheó</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold">Keywords (separadas por coma)</span>
        <input name="keywords" defaultValue={(rule?.keywords ?? []).join(', ')}
          className="mt-1 w-full border rounded px-2 py-1.5"
          placeholder="precio, cuánto sale, valor, tarifa" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-semibold">Modo de match</span>
          <select name="match_mode" defaultValue={rule?.match_mode ?? 'contains'}
            className="mt-1 w-full border rounded px-2 py-1.5">
            <option value="contains">contiene la palabra (recomendado)</option>
            <option value="exact">exacto (mensaje = keyword)</option>
            <option value="starts_with">arranca con</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold">Orden</span>
          <input name="position" type="number" defaultValue={rule?.position ?? 0}
            className="mt-1 w-full border rounded px-2 py-1.5" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold">Respuesta</span>
        <textarea name="reply_body" required rows={3} defaultValue={rule?.reply_body ?? ''}
          className="mt-1 w-full border rounded px-2 py-1.5"
          placeholder="Hola {{nombre}}! Los precios están en https://..." />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={rule?.active ?? true} />
        <span className="text-xs">Activa</span>
      </label>
      <button type="submit"
        className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
        {rule ? 'Guardar cambios' : 'Crear regla'}
      </button>
    </form>
  );
}
