import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { connectQrAction, disconnectQrAction } from '@/lib/whatsapp/bot-actions';
import { QrPoller } from '@/components/owner/whatsapp/QrPoller';

export const dynamic = 'force-dynamic';

export default async function QrConnectPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfg } = await (svc.from('whatsapp_config') as any)
    .select('provider, evolution_url, evolution_instance, evolution_api_key, qr_status')
    .eq('tenant_id', tenant.id).limit(1).maybeSingle();

  const isSetup = cfg?.provider === 'qr' && cfg?.evolution_url && cfg?.evolution_instance;
  const isConnected = cfg?.qr_status === 'connected';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/owner/whatsapp/connect" className="text-sm text-black/60 hover:underline">← Elegir otro modo</Link>
        <h1 className="text-2xl font-bold mt-2 flex items-center gap-2">📱 Modo Simple (QR)</h1>
      </div>

      {!isSetup ? (
        <>
          <div className="rounded-lg border p-5 bg-white space-y-3">
            <h2 className="font-semibold">1. Necesitás una instancia Evolution API</h2>
            <p className="text-sm text-black/70">
              Evolution API es un servicio open-source que corre en un VPS y expone WhatsApp Web
              como API. Podés instalarlo en Railway, Fly.io, DigitalOcean, o cualquier VPS chico
              (5–10 USD/mes).
            </p>
            <div className="text-xs text-black/60 space-y-1">
              <div>➜ Docs oficiales: <a href="https://doc.evolution-api.com" target="_blank" rel="noreferrer" className="text-emerald-700 underline">doc.evolution-api.com</a></div>
              <div>➜ Deploy rápido en Railway: <a href="https://railway.app/template/evolution-api" target="_blank" rel="noreferrer" className="text-emerald-700 underline">1-click Railway template</a></div>
            </div>
          </div>

          <form action={connectQrAction} className="rounded-lg border p-5 bg-white space-y-3">
            <h2 className="font-semibold">2. Conectar tu instancia</h2>
            <label className="block text-sm">
              <span className="text-xs font-semibold text-black/70">URL de la instancia *</span>
              <input name="evolution_url" required type="url"
                placeholder="https://mi-evolution.railway.app"
                className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono" />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold text-black/70">API Key global *</span>
              <input name="evolution_api_key" required type="password"
                placeholder="La apikey que seteaste en AUTHENTICATION_API_KEY"
                className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono" />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold text-black/70">Nombre de instancia (opcional)</span>
              <input name="evolution_instance"
                placeholder={`tenant_${tenant.id.replace(/-/g, '').slice(0, 12)}`}
                className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono" />
              <span className="text-xs text-black/50 mt-1 block">
                Si dejás en blanco, generamos uno único basado en tu tenant. La instancia se crea
                automáticamente en tu Evolution API.
              </span>
            </label>
            <button type="submit"
              className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
              Conectar y generar QR →
            </button>
          </form>
        </>
      ) : (
        <div className="rounded-lg border p-5 bg-white space-y-4">
          {isConnected ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-2">✅</div>
              <h2 className="text-xl font-bold text-emerald-700 mb-1">Conectado</h2>
              <p className="text-sm text-black/60 mb-4">
                Tu WhatsApp está conectado y listo para recibir mensajes.
              </p>
              <div className="flex gap-2 justify-center">
                <Link href="/owner/whatsapp" className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold">
                  Ir a la bandeja →
                </Link>
                <form action={disconnectQrAction} className="inline">
                  <button type="submit" className="px-4 py-2 rounded border text-sm hover:bg-red-50 hover:border-red-300 hover:text-red-700">
                    Desconectar
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-center">📲 Escaneá el QR con tu WhatsApp</h2>
              <div className="text-sm text-black/70 space-y-1">
                <p><b>1.</b> Abrí WhatsApp en tu teléfono.</p>
                <p><b>2.</b> Andá a <b>Ajustes → Dispositivos vinculados → Vincular un dispositivo</b>.</p>
                <p><b>3.</b> Escaneá el código QR de abajo.</p>
              </div>
              <QrPoller intervalMs={4000} />
              <div className="text-xs text-black/50 text-center">
                El QR se refresca automáticamente cada pocos segundos. Cuando el escaneo funcione,
                esta página cambia sola a &ldquo;conectado&rdquo;.
              </div>
              <form action={disconnectQrAction} className="text-right pt-2 border-t">
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  Cancelar y desconectar
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
