import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { disconnectIntegrationAction } from "@/lib/integrations/actions";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type IntegrationRow = {
  provider: string;
  status: string;
  external_account_id: string | null;
  metadata: Record<string, unknown> | null;
};

export default async function IntegrationsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; detail?: string }>;
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

  const platformOrigin = env.appUrl;
  const mpWebhookUrl = `${platformOrigin}/api/webhooks/mercadopago/${tenant.id}`;

  const mp = byProvider.get('mercadopago');
  const shopify = byProvider.get('shopify');
  const drive = byProvider.get('google_drive');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Integraciones</h1>
        <p className="text-white/60 text-sm mt-1">
          Conectá tu pasarela de pago y tu Drive. Cobrás vos directo, sin pasar por la plataforma.
        </p>
      </div>

      {sp.error === 'mp_not_configured' && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="font-semibold text-amber-200 mb-1">⚠️ MercadoPago todavía no está habilitado en la plataforma</div>
          <p className="text-amber-100/90 leading-relaxed">
            La integración con MercadoPago está pendiente de configuración por parte del administrador
            de Curplat. Mientras tanto, podés seguir armando tu sitio y tus cursos. Cuando esté listo,
            volvé a esta página y vas a poder conectar tu cuenta de MP.
          </p>
        </div>
      )}

      {sp.error === 'mp_oauth_failed' && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <div className="font-semibold text-red-200 mb-1">❌ Falló el inicio del OAuth de MercadoPago</div>
          <p className="text-red-100/90 leading-relaxed">
            {sp.detail || 'Reintentá en un momento. Si persiste, contactá al equipo de Curplat.'}
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
            </h2>
            <p className="text-sm text-white/60 mt-1">
              El dinero entra directo a tu cuenta de MP. La plataforma cobra comisión por venta.
            </p>
          </div>
          {!mp ? (
            <a
              href="/api/oauth/mercadopago/start"
              className="rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90"
            >
              Conectar
            </a>
          ) : (
            <form action={disconnectIntegrationAction}>
              <input type="hidden" name="provider" value="mercadopago" />
              <button className="rounded-md border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-2 text-sm hover:bg-red-500/20">
                Desconectar
              </button>
            </form>
          )}
        </div>

        {mp && (
          <div className="space-y-2">
            <p className="text-xs text-white/50">
              Cuenta MP: <span className="text-white font-mono">{mp.external_account_id}</span>
            </p>
            <div>
              <p className="text-xs text-white/50 mb-1">URL de webhook (pegala en MP → Webhooks):</p>
              <code className="block rounded bg-white/5 border border-white/10 px-3 py-2 text-xs break-all">
                {mpWebhookUrl}
              </code>
            </div>
          </div>
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
      <div className="rounded-xl border border-white/10 p-6 opacity-60">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>📁</span> Google Drive
          <span className="text-xs px-2 py-0.5 rounded border border-white/15 text-white/50">manual por ahora</span>
        </h2>
        <p className="text-sm text-white/60 mt-1">
          Por ahora pegás directamente el link de Drive en cada lección. OAuth + file picker en la próxima versión.
        </p>
        {drive && <p className="text-xs text-white/40 mt-2">OAuth conectado.</p>}
      </div>
    </div>
  );
}
