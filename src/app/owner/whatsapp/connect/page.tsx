import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/**
 * Landing de conexión: 2 tarjetas mutuamente excluyentes.
 * Ganado por el owner al hacer click — cada una lleva a su flow
 * de setup (config o qr).
 *
 * Si el tenant YA tiene un provider conectado, se muestra en la
 * tarjeta correspondiente y la otra queda en gris.
 */
export default async function WhatsAppConnectPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfg } = await (svc.from('whatsapp_config') as any)
    .select('provider, phone_number_id, evolution_instance, qr_status')
    .eq('tenant_id', tenant.id).limit(1).maybeSingle();

  const currentProvider = cfg?.provider as 'cloud_api' | 'qr' | undefined;
  const cloudConnected = currentProvider === 'cloud_api' && !!cfg?.phone_number_id;
  const qrConnected = currentProvider === 'qr' && cfg?.qr_status === 'connected';
  const qrPending = currentProvider === 'qr' && cfg?.qr_status !== 'connected';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/owner/whatsapp" className="text-sm text-black/60 hover:underline">← Volver</Link>
        <h1 className="text-3xl font-bold mt-2">Conectar WhatsApp</h1>
        <p className="text-sm text-black/60 mt-2 max-w-2xl">
          Elegí cómo querés conectar tu WhatsApp al bot. Podés cambiar más tarde,
          pero perdés el historial y las conversaciones activas al cambiar de modo.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Simple — QR */}
        <Link href="/owner/whatsapp/qr"
          className={`group relative border-2 rounded-xl p-6 transition ${
            qrConnected ? 'border-emerald-500 bg-emerald-50' :
            qrPending ? 'border-amber-500 bg-amber-50' :
            'border-zinc-300 hover:border-emerald-400 hover:shadow-md bg-white'
          }`}>
          <div className="flex items-start justify-between mb-3">
            <div className="text-4xl">📱</div>
            {qrConnected && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-semibold">
                CONECTADO
              </span>
            )}
            {qrPending && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-600 text-white font-semibold">
                PENDIENTE QR
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold mb-1">Simple (QR)</h2>
          <p className="text-xs uppercase font-semibold text-black/50 mb-3">
            Para arrancar en 2 minutos
          </p>
          <p className="text-sm text-black/70 mb-4">
            Escaneás un código QR con tu WhatsApp regular y listo. Sin cuentas de Meta
            for Business, sin templates aprobados, sin costos de API.
          </p>
          <ul className="text-xs text-black/60 space-y-1 mb-4">
            <li>✅ Setup en 2 minutos con QR</li>
            <li>✅ Usás tu WhatsApp personal o Business</li>
            <li>✅ Sin trámites con Meta</li>
            <li>⚠️ Riesgo bajo de ban por parte de Meta</li>
            <li>⚠️ Requiere una instancia Evolution API (VPS)</li>
          </ul>
          <div className="text-sm font-semibold text-emerald-700 group-hover:underline">
            {qrConnected ? 'Ver estado →' : qrPending ? 'Continuar escaneo →' : 'Configurar QR →'}
          </div>
        </Link>

        {/* Pro — Cloud API */}
        <Link href="/owner/whatsapp/config"
          className={`group relative border-2 rounded-xl p-6 transition ${
            cloudConnected ? 'border-emerald-500 bg-emerald-50' :
            'border-zinc-300 hover:border-emerald-400 hover:shadow-md bg-white'
          }`}>
          <div className="flex items-start justify-between mb-3">
            <div className="text-4xl">🏢</div>
            {cloudConnected && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-semibold">
                CONECTADO
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold mb-1">Pro (Cloud API oficial)</h2>
          <p className="text-xs uppercase font-semibold text-black/50 mb-3">
            Para negocios en serio
          </p>
          <p className="text-sm text-black/70 mb-4">
            API oficial de Meta. Cero riesgo de ban, escalable a miles de mensajes por hora,
            soporta templates aprobados para mensajes proactivos.
          </p>
          <ul className="text-xs text-black/60 space-y-1 mb-4">
            <li>✅ Oficial y estable — sin riesgo de ban</li>
            <li>✅ Escala a miles de mensajes/día</li>
            <li>✅ Templates aprobados para outbound</li>
            <li>⚠️ Setup técnico (Meta Business Suite)</li>
            <li>⚠️ Free hasta 1000 conversaciones/mes iniciadas por usuario</li>
          </ul>
          <div className="text-sm font-semibold text-emerald-700 group-hover:underline">
            {cloudConnected ? 'Ver configuración →' : 'Configurar Cloud API →'}
          </div>
        </Link>
      </div>

      <div className="text-xs text-black/50 bg-zinc-50 border rounded-lg p-4">
        💡 Ambos modos usan el mismo inbox, las mismas reglas del bot y la misma IA.
        Sólo cambia cómo se conecta el número al motor de mensajería.
      </div>
    </div>
  );
}
