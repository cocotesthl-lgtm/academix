import Link from 'next/link';
import { headers } from 'next/headers';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  connectWhatsAppBotAction,
  updateBotSettingsAction,
  disconnectWhatsAppBotAction,
  updateAiConfigAction
} from '@/lib/whatsapp/bot-actions';

export const dynamic = 'force-dynamic';

type Config = {
  phone_number_id: string | null;
  business_account_id: string | null;
  access_token: string | null;
  display_phone: string | null;
  verify_token: string | null;
  webhook_signature_secret: string | null;
  bot_enabled: boolean;
  greeting_enabled: boolean;
  greeting_body: string | null;
  away_enabled: boolean;
  away_body: string | null;
  away_start: string | null;
  away_end: string | null;
  connected_at: string | null;
  ai_enabled: boolean;
  ai_system_prompt: string | null;
  ai_model: string | null;
};

export default async function WhatsAppConfigPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('whatsapp_config') as any)
    .select('*').eq('tenant_id', tenant.id).limit(1).maybeSingle();
  const cfg = (data as Config | null);

  // Detectar el host actual para armar la URL del webhook que el owner
  // pegará en el panel de Meta.
  const h = await headers();
  const host = h.get('host') || 'bzseguridad.store';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const webhookUrl = `${proto}://${host}/api/whatsapp/webhook`;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/owner/whatsapp" className="text-sm text-black/60 hover:underline">← Volver a bandeja</Link>
        <h1 className="text-2xl font-bold mt-2">Configuración WhatsApp</h1>
        <p className="text-sm text-black/60 mt-1">
          Conectá tu bot con la API oficial de WhatsApp Business (Meta Cloud API).
        </p>
      </div>

      {/* Guía rápida */}
      <details className="border rounded-lg p-4 bg-emerald-50 text-sm" open={!cfg?.phone_number_id}>
        <summary className="font-semibold cursor-pointer">📖 Cómo obtener las credenciales de Meta</summary>
        <ol className="mt-3 space-y-2 list-decimal ml-5 text-black/80">
          <li>Andá a <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-emerald-700 underline">developers.facebook.com/apps</a> y creá una app tipo "Business".</li>
          <li>En el panel de la app, activá el producto <b>WhatsApp</b>.</li>
          <li>Anotate el <b>Phone number ID</b> y el <b>WhatsApp Business Account ID</b> del número de test o de producción.</li>
          <li>Generá un <b>System User access token</b> permanente en Meta Business Suite → Users → System Users. Los tokens temporales de 24h no sirven.</li>
          <li>En "Configuración" del producto WhatsApp, seteá el webhook con esta URL y tu Verify Token:</li>
        </ol>
        <div className="mt-3 p-3 rounded bg-white border font-mono text-xs break-all">
          <div><b>Webhook URL:</b> {webhookUrl}</div>
          <div><b>Verify Token:</b> {cfg?.verify_token || '(se genera al guardar)'}</div>
        </div>
        <p className="mt-2 text-black/60">Suscribí los campos: <code>messages</code>, <code>message_status</code>.</p>
      </details>

      {/* Form: credenciales */}
      <form action={connectWhatsAppBotAction} className="border rounded-lg p-5 space-y-3 bg-white">
        <h2 className="font-semibold">Credenciales Meta</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-black/70">Phone Number ID *</span>
            <input name="phone_number_id" required defaultValue={cfg?.phone_number_id ?? ''}
              className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="1234567890" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-black/70">WhatsApp Business Account ID</span>
            <input name="business_account_id" defaultValue={cfg?.business_account_id ?? ''}
              className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="opcional" />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-black/70">Access Token permanente *</span>
          <input name="access_token" required defaultValue={cfg?.access_token ?? ''} type="password"
            className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono" placeholder="EAAB..." />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-black/70">Número visible</span>
            <input name="display_phone" defaultValue={cfg?.display_phone ?? ''}
              className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="+54 9 11 1234-5678" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-black/70">App Secret (para validar webhook)</span>
            <input name="webhook_signature_secret" defaultValue={cfg?.webhook_signature_secret ?? ''} type="password"
              className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono" placeholder="opcional pero recomendado" />
          </label>
        </div>
        <button type="submit"
          className="mt-2 px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
          {cfg?.phone_number_id ? 'Actualizar credenciales' : 'Conectar bot'}
        </button>
        {cfg?.connected_at && (
          <p className="text-xs text-black/50 mt-2">
            Conectado el {new Date(cfg.connected_at).toLocaleString('es-AR')}
          </p>
        )}
      </form>

      {/* Form: settings del bot */}
      {cfg?.phone_number_id && (
        <form action={updateBotSettingsAction} className="border rounded-lg p-5 space-y-4 bg-white">
          <h2 className="font-semibold">Comportamiento del bot</h2>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="bot_enabled" defaultChecked={cfg.bot_enabled} />
            <span>Bot activado (responde automáticamente según reglas)</span>
          </label>

          <div className="border-t pt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="greeting_enabled" defaultChecked={cfg.greeting_enabled} />
              <span className="font-semibold">Mensaje de bienvenida (primer contacto)</span>
            </label>
            <textarea name="greeting_body" defaultValue={cfg.greeting_body ?? ''}
              rows={2} maxLength={1000}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Hola! Gracias por escribirnos. En breve te respondemos." />
          </div>

          <div className="border-t pt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="away_enabled" defaultChecked={cfg.away_enabled} />
              <span className="font-semibold">Respuesta fuera de horario</span>
            </label>
            <textarea name="away_body" defaultValue={cfg.away_body ?? ''}
              rows={2} maxLength={1000}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Estamos fuera de horario. Te contestamos en cuanto volvamos." />
            <div className="flex gap-3 items-center text-sm">
              <label>Desde
                <input type="time" name="away_start" defaultValue={cfg.away_start ?? ''}
                  className="ml-2 border rounded px-2 py-1" />
              </label>
              <label>Hasta
                <input type="time" name="away_end" defaultValue={cfg.away_end ?? ''}
                  className="ml-2 border rounded px-2 py-1" />
              </label>
            </div>
          </div>

          <button type="submit"
            className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
            Guardar cambios
          </button>
        </form>
      )}

      {/* IA (Claude) fallback */}
      {cfg?.phone_number_id && (
        <form action={updateAiConfigAction} className="border rounded-lg p-5 space-y-4 bg-white">
          <h2 className="font-semibold flex items-center gap-2">
            🧠 Respuestas con IA (fallback)
          </h2>
          <p className="text-xs text-black/60">
            Si el mensaje del cliente no matchea ninguna regla, la IA (Claude) responde con contexto de los últimos 10 turnos de la conversación. Requiere que la plataforma tenga <code>ANTHROPIC_API_KEY</code> configurada.
          </p>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ai_enabled" defaultChecked={cfg.ai_enabled} />
            <span>Activar IA como fallback</span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-black/70">System prompt (personalidad + info del negocio)</span>
            <textarea name="ai_system_prompt" rows={5} maxLength={4000}
              defaultValue={cfg.ai_system_prompt ?? ''}
              className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono"
              placeholder="Sos el asistente de {nombre del negocio}. Vendemos {productos}. Nuestro horario es {horario}. Respondé breve en español, no inventes precios ni prometas descuentos. Si te preguntan por catálogo, mandá el link https://..." />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-black/70">Modelo</span>
            <select name="ai_model" defaultValue={cfg.ai_model ?? 'claude-haiku-4-5-20251001'}
              className="mt-1 w-full border rounded px-3 py-2 text-sm">
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (rápido y barato — recomendado para WA)</option>
              <option value="claude-sonnet-5">Claude Sonnet 5 (más caro pero más inteligente)</option>
            </select>
          </label>

          <button type="submit"
            className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
            Guardar IA
          </button>
        </form>
      )}

      {cfg?.phone_number_id && (
        <form action={disconnectWhatsAppBotAction} className="text-right">
          <button type="submit"
            className="text-xs text-red-600 hover:underline"
            formNoValidate>
            Desconectar bot
          </button>
        </form>
      )}
    </div>
  );
}
