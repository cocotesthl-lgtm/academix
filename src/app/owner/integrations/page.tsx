import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { disconnectIntegrationAction } from "@/lib/integrations/actions";
import { env } from "@/lib/env";
import { CopyButton } from "@/components/owner/CopyButton";
import { PaypalConnectForm } from "@/components/owner/integrations/PaypalConnectForm";

export const dynamic = "force-dynamic";

type IntegrationRow = {
  provider: string;
  status: string;
  external_account_id: string | null;
  metadata: Record<string, unknown> | null;
};

const MP_ERROR_LABELS: Record<string, string> = {
  mp_not_configured: 'La integración con MercadoPago todavía no está habilitada en la plataforma. El admin de OfferNow la activará pronto.',
  mp_oauth_failed: 'No pudimos iniciar el flujo OAuth con MercadoPago.',
  invalid_state: 'La sesión de conexión expiró. Volvé a clickear "Conectar".',
  not_owner: 'No sos owner de este tenant.',
};

export default async function IntegrationsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; detail?: string; mp_connected?: string; mp_error?: string }>;
}) {
  const { tenant } = await requireOwner();
  const sp = await searchParams;
  const svc = getServiceClient();
  const { data } = await svc
    .from("integrations")
    .select("provider, status, external_account_id, metadata")
    .eq("tenant_id", tenant.id);
  const integrations = (data ?? []) as IntegrationRow[];
  const byProvider = new Map(integrations.map((i) => [i.provider, i]));

  const platformOrigin = env.platformApiOrigin;
  const mpWebhookUrl = `${platformOrigin}/api/webhooks/mercadopago/${tenant.id}`;

  const mp = byProvider.get('mercadopago');
  const shopify = byProvider.get('shopify');
  const drive = byProvider.get('google_drive');
  const paypal = byProvider.get('paypal');

  // PayPal metadata parsing
  const paypalSandbox = paypal?.metadata && typeof (paypal.metadata as { sandbox?: unknown }).sandbox === 'boolean'
    ? (paypal.metadata as { sandbox: boolean }).sandbox
    : null;
  const paypalClientId = paypal?.metadata && typeof (paypal.metadata as { client_id?: unknown }).client_id === 'string'
    ? (paypal.metadata as { client_id: string }).client_id
    : null;
  const paypalCurrency = paypal?.metadata && typeof (paypal.metadata as { currency?: unknown }).currency === 'string'
    ? (paypal.metadata as { currency: string }).currency
    : 'USD';
  const paypalWebhookUrl = `${platformOrigin}/api/webhooks/paypal/${tenant.id}`;

  // ¿La plataforma está configurada para hacer OAuth con MP? Sin estas env
  // vars el botón "Conectar" sólo lleva al error_handler, así que mejor
  // lo deshabilitamos visualmente para no frustrar al owner.
  const mpPlatformReady = !!process.env.MERCADOPAGO_CLIENT_ID && !!process.env.MERCADOPAGO_CLIENT_SECRET;

  // ¿Cuenta conectada en modo TEST o LIVE? lo marca MP en el callback
  const mpLiveMode = mp?.metadata && typeof (mp.metadata as { live_mode?: unknown }).live_mode === 'boolean'
    ? (mp.metadata as { live_mode: boolean }).live_mode
    : null;
  const mpPublicKey = mp?.metadata && typeof (mp.metadata as { public_key?: unknown }).public_key === 'string'
    ? (mp.metadata as { public_key: string }).public_key
    : null;

  // Errores que vienen del flujo OAuth start
  const startError = sp.error;
  // Errores que devuelve el callback (?mp_error=...)
  const callbackError = sp.mp_error;
  const justConnected = sp.mp_connected === '1';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Integraciones</h1>
        <p className="text-white/60 text-sm mt-1">
          Conectá tu pasarela de pago. Cobrás vos directo a tu cuenta, sin pasar por la plataforma.
        </p>
      </div>

      {/* Banners de estado */}
      {justConnected && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
          <div className="font-semibold text-emerald-200 mb-1">✓ MercadoPago conectado correctamente</div>
          <p className="text-emerald-100/90 leading-relaxed">
            Ya podés vender. Cuando un alumno compre una publicación, el dinero entra directo a tu MP y
            quedan inscriptos automáticamente.
          </p>
        </div>
      )}

      {startError && MP_ERROR_LABELS[startError] && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="font-semibold text-amber-200 mb-1">⚠️ {MP_ERROR_LABELS[startError]}</div>
          {sp.detail && <p className="text-amber-100/80 text-xs mt-2 font-mono">{sp.detail}</p>}
        </div>
      )}

      {callbackError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <div className="font-semibold text-red-200 mb-1">❌ Falló la conexión con MercadoPago</div>
          <p className="text-red-100/90 leading-relaxed">
            {MP_ERROR_LABELS[callbackError] ?? `Error: ${callbackError}`}
          </p>
        </div>
      )}

      {/* MercadoPago */}
      <div className="rounded-xl border border-white/10 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>💳</span> MercadoPago
              {mp && (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  conectado
                </span>
              )}
              {mp && mpLiveMode === false && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-200 border border-amber-500/30">
                  modo TEST
                </span>
              )}
              {mp && mpLiveMode === true && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-200 border border-blue-500/30">
                  modo LIVE
                </span>
              )}
            </h2>
            <p className="text-sm text-white/60 mt-1">
              El dinero entra directo a tu cuenta de MP. La plataforma cobra una comisión por venta
              (la pagás aparte, no se descuenta del cobro).
            </p>
          </div>
          {!mp ? (
            mpPlatformReady ? (
              <a
                href="/api/oauth/mercadopago/start"
                className="rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 whitespace-nowrap"
              >
                Conectar MercadoPago
              </a>
            ) : (
              <span
                title="Esperando que el admin de OfferNow configure las credenciales de MP"
                className="rounded-md bg-white/10 text-white/40 border border-white/15 px-4 py-2 text-sm font-medium whitespace-nowrap cursor-not-allowed select-none"
              >
                Conectar MercadoPago
              </span>
            )
          ) : (
            <form action={disconnectIntegrationAction}>
              <input type="hidden" name="provider" value="mercadopago" />
              <button className="rounded-md border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-2 text-sm hover:bg-red-500/20 whitespace-nowrap">
                Desconectar
              </button>
            </form>
          )}
        </div>

        {mp && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">ID de cuenta MP</div>
                <div className="font-mono text-white text-xs break-all">{mp.external_account_id ?? '—'}</div>
              </div>
              {mpPublicKey && (
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Public key</div>
                  <div className="font-mono text-white/70 text-xs break-all">{mpPublicKey.slice(0, 40)}…</div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/50 uppercase tracking-wider">URL de webhook</p>
                <CopyButton value={mpWebhookUrl} />
              </div>
              <code className="block rounded bg-white/5 border border-white/10 px-3 py-2 text-xs break-all text-white/80">
                {mpWebhookUrl}
              </code>
              <p className="text-xs text-white/50 mt-1.5 leading-snug">
                Pegala en <strong>MercadoPago Developers → tu app → Webhooks</strong> (eventos: <span className="font-mono">payment</span>).
                Sin esto, las ventas no se confirman automáticamente en OfferNow.
              </p>
            </div>

            {mpLiveMode === false && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/90">
                Estás en <strong>modo TEST</strong>. Sólo se procesan tarjetas de prueba de MP.
                Cuando termines de validar, reconectá con tu cuenta real (Desconectar → Conectar).
              </div>
            )}
          </div>
        )}

        {!mp && (
          <div className="rounded border border-white/10 bg-white/[0.02] p-4 text-xs text-white/60 leading-relaxed">
            <strong className="text-white/80 block mb-2">Cómo funciona:</strong>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Hacés click en <strong>Conectar MercadoPago</strong></li>
              <li>Te redirige a MP, hacés login con tu cuenta y autorizás</li>
              <li>Volvés acá con tu cuenta conectada</li>
              <li>Tus alumnos pagan con MP y el dinero entra a tu cuenta. La plataforma factura comisión aparte.</li>
            </ol>
          </div>
        )}
      </div>

      {/* PayPal */}
      <div className="rounded-xl border border-white/10 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>🅿️</span> PayPal
              {paypal && (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  conectado
                </span>
              )}
              {paypal && paypalSandbox === true && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-200 border border-amber-500/30">
                  sandbox
                </span>
              )}
              {paypal && paypalSandbox === false && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-200 border border-blue-500/30">
                  LIVE
                </span>
              )}
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Cobrá internacional en USD (o cualquier moneda que soporte PayPal). El dinero entra directo a
              tu cuenta business.
            </p>
          </div>
          {paypal && (
            <form action={disconnectIntegrationAction}>
              <input type="hidden" name="provider" value="paypal" />
              <button className="rounded-md border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-2 text-sm hover:bg-red-500/20 whitespace-nowrap">
                Desconectar
              </button>
            </form>
          )}
        </div>

        {paypal ? (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Cuenta business</div>
                <div className="font-mono text-white text-xs break-all">{paypal.external_account_id ?? '—'}</div>
              </div>
              {paypalClientId && (
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Client ID</div>
                  <div className="font-mono text-white/70 text-xs break-all">{paypalClientId.slice(0, 20)}…</div>
                </div>
              )}
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Cobra en</div>
                <div className="font-mono text-emerald-300 text-sm font-bold">{paypalCurrency}</div>
                <div className="text-[10px] text-white/40">precio × 1 = valor a cobrar</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/50 uppercase tracking-wider">URL de webhook (Fase B — checkout)</p>
                <CopyButton value={paypalWebhookUrl} />
              </div>
              <code className="block rounded bg-white/5 border border-white/10 px-3 py-2 text-xs break-all text-white/80">
                {paypalWebhookUrl}
              </code>
              <p className="text-xs text-white/50 mt-1.5 leading-snug">
                Cuando activemos el botón PayPal en el checkout, pegá esta URL en <strong>PayPal Developer → tu app → Webhooks</strong>.
                Sin esto, los pagos igual se confirman al momento del checkout — el webhook es solo para reconciliación de refunds/disputes.
              </p>
            </div>

            {paypalSandbox === true && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/90">
                Estás en <strong>modo sandbox</strong>. Sólo se procesan cuentas de PayPal Sandbox (developer.paypal.com/dashboard/accounts).
                Para cobrar real: Desconectar → Conectar con credenciales de Live.
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="rounded border border-white/10 bg-white/[0.02] p-4 text-xs text-white/70 leading-relaxed">
              <strong className="text-white/90 block mb-2">Cómo obtener tus credenciales (60 segundos):</strong>
              <ol className="list-decimal pl-4 space-y-1.5">
                <li>Andá a <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noreferrer" className="underline text-blue-300">developer.paypal.com/dashboard/applications</a> y logueá con tu PayPal Business</li>
                <li>Click en <strong>Create App</strong> (arriba a la derecha). Nombre libre. Type: <strong>Merchant</strong></li>
                <li>Copiá el <strong>Client ID</strong> y <strong>Secret</strong> que aparecen</li>
                <li>Pegalos abajo con el email de tu cuenta business y click en <strong>Conectar PayPal</strong></li>
              </ol>
              <p className="mt-3 text-white/55">
                💡 Al principio dejá <strong>Sandbox</strong> prendido para probar sin plata real. Cuando esté todo OK,
                creá otra app en modo Live y reconectá con esas credenciales.
              </p>
            </div>
            <PaypalConnectForm />
          </>
        )}
      </div>

      {/* Shopify */}
      <div className="rounded-xl border border-white/10 p-6 opacity-60">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🛒</span> Shopify
          <span className="text-xs px-2 py-0.5 rounded border border-white/15 text-white/50">próximamente</span>
        </h2>
        <p className="text-sm text-white/60 mt-1">
          Alternativa para vender con checkout de Shopify. Disponible en la próxima versión.
        </p>
        {shopify && <p className="text-xs text-white/40 mt-2">Conexión registrada.</p>}
      </div>

      {/* Google Drive */}
      <div className="rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>📁</span> Google Drive
          <span className="text-xs px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">listo</span>
        </h2>
        <p className="text-sm text-white/65 mt-1.5">
          Subí tus videos/PDFs a tu Drive y pegá el link en cada lección. El sistema arma el embed automático
          y el alumno los ve en su panel sin poder descargarlos.
        </p>

        {/* Card de instrucciones. Antes usaba amber-100 sobre bg amber-500/[0.04]
            que no contrastaba bien. Ahora usa fondo neutral oscuro + texto
            blanco con jerarquía por opacity (mismo patrón que el resto del panel). */}
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-black/40 p-4 text-sm space-y-2.5">
          <div className="font-semibold text-amber-300 flex items-center gap-2">
            <span>⚠️</span> Importante: cómo compartir el archivo
          </div>
          <p className="text-white/80">
            Para que el embed funcione, el archivo en Drive tiene que ser <strong className="text-white">público con el link</strong>.
            Si no, el alumno ve &quot;sin permisos&quot;.
          </p>
          <ol className="list-decimal list-inside space-y-1 text-white/75">
            <li>Abrí el archivo en Drive (video, PDF, imagen).</li>
            <li>Click derecho → <strong className="text-white">Compartir</strong>.</li>
            <li>En &quot;Acceso general&quot;, elegí <strong className="text-white">&quot;Cualquier persona con el enlace&quot;</strong>.</li>
            <li>Rol: <strong className="text-white">Lector</strong>.</li>
            <li>Copiá el link y pegalo en la lección. Listo.</li>
          </ol>
          <p className="text-white/70 pt-1 text-xs">
            💡 Tip: podés crear una <strong className="text-white">carpeta entera</strong> con permisos público-con-link y cualquier
            archivo adentro hereda el permiso.
          </p>
        </div>

        <p className="text-[11px] text-white/40 mt-3">
          ✓ Acepta cualquier formato de link: <code className="bg-black/40 px-1 rounded">drive.google.com/file/d/.../view</code>,
          <code className="bg-black/40 px-1 rounded ml-1">?id=...</code>, o el ID pelado.
        </p>
        {drive && <p className="text-xs text-white/40 mt-2">OAuth conectado.</p>}
      </div>
    </div>
  );
}
