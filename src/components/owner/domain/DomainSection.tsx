import Link from 'next/link';
import { getServiceClient } from '@/lib/supabase/service';
import { getTenantPlan } from '@/lib/plans/queries';
import {
  connectCustomDomainAction, verifyCustomDomainAction,
  disconnectCustomDomainAction, togglePublicListingAction
} from '@/lib/domains/actions';
import { Pill } from '@/components/owner/Pill';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_domain: 'El dominio que ingresaste no es válido.',
  plan_no_domains: 'Tu plan actual no incluye dominio propio. Actualizá tu plan para conectar uno.',
  already_connected: 'Ya tenés un dominio conectado. Desconectalo primero para cambiarlo.',
  vercel_failed: 'No pudimos agregar el dominio a Vercel.',
  vercel_not_configured: 'La plataforma no tiene configurada la integración con Vercel.',
  dns_not_propagated: 'Los DNS records todavía no se ven. Esperá 5-30 min y volvé a verificar.',
  verify_failed: 'Hubo un error al verificar. Intentá de nuevo en un rato.'
};

/**
 * Bloque completo de gestión de dominio propio + toggle de listing público.
 * Antes vivía en /owner/dominio; ahora se incrusta en /owner/branding
 * porque conceptualmente es parte de la identidad del sitio (la URL
 * también es branding). Anchor id="dominio" permite deep-link.
 */
export async function DomainSection({
  tenantId, tenantSlug,
  searchError, searchMsg, searchOk
}: {
  tenantId: string;
  tenantSlug: string;
  searchError?: string;
  searchMsg?: string;
  searchOk?: string;
}) {
  const svc = getServiceClient();
  const tenantPlan = await getTenantPlan(tenantId);
  const planDomainsMax = tenantPlan.plan?.features?.domains_max ?? 0;
  const planName = tenantPlan.plan?.name ?? 'sin plan';

  let customDomain: string | null = null;
  let publicListing = true;
  try {
    const { data } = await svc.from('tenants')
      .select('custom_domain, public_listing').eq('id', tenantId).maybeSingle<{
        custom_domain: string | null; public_listing: boolean;
      }>();
    if (data) {
      customDomain = data.custom_domain;
      publicListing = data.public_listing;
    }
  } catch { /* migration 0026 missing */ }

  type DomainStatus = {
    domain: string; vercel_verified: boolean;
    vercel_apex_a_record: string | null; vercel_cname_target: string | null;
    last_checked_at: string | null;
  };
  let status: DomainStatus | null = null;
  if (customDomain) {
    try {
      const { data } = await svc.from('tenant_domain_status')
        .select('domain, vercel_verified, vercel_apex_a_record, vercel_cname_target, last_checked_at')
        .eq('tenant_id', tenantId).maybeSingle<DomainStatus>();
      status = data;
    } catch { /* table missing */ }
  }

  const vercelConfigured = !!process.env.VERCEL_API_TOKEN && !!process.env.VERCEL_PROJECT_ID;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'bzseguridad.store';

  return (
    <section id="dominio" className="space-y-6 scroll-mt-24">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-1">Dominio</h2>
        <p className="text-xs text-white/55">
          Tu URL pública. Podés seguir con el subdominio gratuito o conectar tu propio dominio.
        </p>
      </div>

      {/* Banner de feedback de la última acción */}
      {searchError && ERROR_MESSAGES[searchError] && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <strong>✗ {ERROR_MESSAGES[searchError]}</strong>
          {searchMsg && <div className="text-xs text-rose-200/70 mt-1 font-mono">{searchMsg}</div>}
          {searchError === 'plan_no_domains' && (
            <Link href="/mi-plan" className="inline-block mt-2 text-xs underline">
              Ver planes disponibles →
            </Link>
          )}
        </div>
      )}
      {searchOk === 'connected' && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          ✓ Dominio conectado. Configurá los DNS records abajo para activarlo.
        </div>
      )}
      {searchOk === 'verified' && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          ✓ ¡Dominio verificado! Ya podés usarlo.
        </div>
      )}

      {/* Estado del plan */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs text-white/65 flex items-center justify-between flex-wrap gap-2">
        <span>
          Plan actual: <strong className="text-white">{planName}</strong> ·
          Dominios incluidos: <strong className="text-white">{planDomainsMax === 0 ? 'ninguno' : `${planDomainsMax}`}</strong>
        </span>
        {planDomainsMax === 0 && (
          <Link href="/mi-plan" className="text-amber-400 hover:text-amber-300 font-medium">
            Upgradear plan →
          </Link>
        )}
      </div>

      {/* Privacidad */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-sm">Aparecer en el marketplace público</h3>
            <p className="text-xs text-white/55 mt-1">
              Cuando está activado, tu plataforma aparece en el listado público de OfferNow.
              Si lo apagás, sigue funcionando pero solo aparece a quienes tienen el link directo.
            </p>
          </div>
          <form action={togglePublicListingAction}>
            <input type="hidden" name="is_public" value={publicListing ? 'false' : 'true'} />
            <button className={`text-sm px-4 py-2 rounded-md font-semibold whitespace-nowrap ${
              publicListing
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30'
                : 'bg-white/5 border border-white/15 text-white/70 hover:bg-white/10'
            }`}>
              {publicListing ? '✓ Listado público' : 'Oculto del marketplace'}
            </button>
          </form>
        </div>
      </div>

      {/* Dominio actual */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">Tu URL</h3>

        {!customDomain ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <p className="text-sm">Estás usando el subdominio gratuito de OfferNow:</p>
            <p className="font-mono text-lg mt-2 text-white">
              {tenantSlug}.{rootDomain}
            </p>
            <p className="text-xs text-white/45 mt-3">
              Conectá tu propio dominio abajo para que tu sitio se vea más profesional.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/15 bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-lg text-white">{customDomain}</span>
              {status?.vercel_verified ? (
                <Pill tone="success">✓ Verificado</Pill>
              ) : (
                <Pill tone="warning">⏳ Esperando DNS</Pill>
              )}
            </div>

            {!status?.vercel_verified && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                <h4 className="font-semibold text-amber-200 text-sm">Para que funcione, configurá estos DNS records donde compraste el dominio:</h4>
                <div className="space-y-2 text-xs font-mono">
                  <div className="bg-black/40 rounded p-2">
                    <div className="text-white/45 mb-1">Para dominio raíz (ej. tuempresa.com):</div>
                    <div className="text-white">
                      Tipo: <span className="text-amber-400">A</span> ·
                      Host: <span className="text-amber-400">@</span> ·
                      Valor: <span className="text-amber-400">{status?.vercel_apex_a_record ?? '76.76.21.21'}</span>
                    </div>
                  </div>
                  <div className="bg-black/40 rounded p-2">
                    <div className="text-white/45 mb-1">Para subdominio www (recomendado):</div>
                    <div className="text-white">
                      Tipo: <span className="text-amber-400">CNAME</span> ·
                      Host: <span className="text-amber-400">www</span> ·
                      Valor: <span className="text-amber-400">{status?.vercel_cname_target ?? 'cname.vercel-dns.com'}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-amber-200/80">
                  Después de configurar los records (puede tardar de 5 min a 24 hs en propagar),
                  apretá "Verificar ahora" para chequear.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <form action={verifyCustomDomainAction}>
                    <button className="rounded bg-amber-200 text-amber-900 px-3 py-1.5 text-xs font-semibold">
                      🔄 Verificar ahora
                    </button>
                  </form>
                  <form action={disconnectCustomDomainAction}>
                    <button className="rounded border border-red-500/30 text-red-300 px-3 py-1.5 text-xs hover:bg-red-500/10">
                      Desconectar
                    </button>
                  </form>
                </div>
                {status?.last_checked_at && (
                  <p className="text-[10px] text-white/40">
                    Última verificación: {new Date(status.last_checked_at).toLocaleString('es-AR')}
                  </p>
                )}
              </div>
            )}

            {status?.vercel_verified && (
              <div className="flex gap-2">
                <a
                  href={`https://${customDomain}`}
                  target="_blank" rel="noopener noreferrer"
                  className="rounded bg-white text-black px-3 py-1.5 text-xs font-semibold"
                >
                  ↗ Visitar mi sitio
                </a>
                <form action={disconnectCustomDomainAction}>
                  <button className="rounded border border-red-500/30 text-red-300 px-3 py-1.5 text-xs hover:bg-red-500/10">
                    Desconectar dominio
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conectar dominio */}
      {!customDomain && (
        planDomainsMax === 0 ? (
          <div className="rounded-xl border border-white/15 bg-white/[0.02] p-5 text-center space-y-3">
            <div className="text-4xl">🔒</div>
            <h3 className="font-bold text-lg">Tu plan no incluye dominio propio</h3>
            <p className="text-sm text-white/65 max-w-md mx-auto">
              Para conectar tu propio dominio (ej. tuempresa.com), necesitás actualizar a un plan que lo incluya.
            </p>
            <Link
              href="/mi-plan"
              className="inline-block rounded-md bg-orange-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-orange-400"
            >
              Ver planes →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-5 space-y-4">
            <div>
              <h3 className="font-bold text-lg">Conectar mi dominio propio</h3>
              <p className="text-sm text-white/65 mt-1">
                Si ya compraste un dominio en otro proveedor (NameCheap, GoDaddy, DonWeb, Cloudflare, etc),
                podés conectarlo acá. El SSL/HTTPS lo gestionamos nosotros gratis.
              </p>
            </div>
            {!vercelConfigured && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                ⚠️ La plataforma todavía no tiene configurada la integración con Vercel.
                Podés guardar tu dominio igual pero la verificación automática no va a funcionar.
              </div>
            )}
            <form action={connectCustomDomainAction} className="flex gap-2 flex-wrap">
              <input
                name="domain" type="text" required
                placeholder="tuempresa.com"
                className="flex-1 min-w-[200px] rounded bg-black/40 border border-white/20 px-3 py-2 text-sm font-mono"
              />
              <button className="rounded-md bg-orange-500 text-white px-5 py-2 text-sm font-semibold hover:bg-orange-400">
                Conectar
              </button>
            </form>
            <p className="text-[11px] text-white/45">
              Después te vamos a dar los DNS records que tenés que pegar en tu registrar.
              En 5 min a 24 hs queda funcionando con HTTPS automático.
            </p>
          </div>
        )
      )}
    </section>
  );
}
