import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader, HeaderSecondary } from "@/components/owner/PageHeader";
import { Pill } from "@/components/owner/Pill";
import {
  connectCustomDomainAction, verifyCustomDomainAction,
  disconnectCustomDomainAction, togglePublicListingAction
} from "@/lib/domains/actions";

export const dynamic = "force-dynamic";

/**
 * Owner gestiona su dominio propio + privacidad del listado público.
 * El dominio se conecta via Vercel API — si VERCEL_API_TOKEN no está
 * seteado, igual se guarda en DB pero no se agrega al proyecto.
 */
export default async function DomainPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Defensivo: si migration 0026 no corrió, devolvemos defaults
  let customDomain: string | null = null;
  let publicListing = true;
  try {
    const { data } = await svc.from('tenants')
      .select('custom_domain, public_listing').eq('id', tenant.id).maybeSingle<{
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
        .eq('tenant_id', tenant.id).maybeSingle<DomainStatus>();
      status = data;
    } catch { /* table missing */ }
  }

  const vercelConfigured = !!process.env.VERCEL_API_TOKEN && !!process.env.VERCEL_PROJECT_ID;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com';

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="Dominio propio"
        description="Conectá tu propio dominio (ej. tuempresa.com) o seguí usando el subdominio gratuito."
        actions={<HeaderSecondary href="/branding">← Branding</HeaderSecondary>}
      />

      {/* ─── Privacidad ─── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold">Aparecer en el marketplace público</h2>
            <p className="text-xs text-white/55 mt-1">
              Cuando está activado, tu plataforma aparece en el listado público de Curplat (donde la gente busca academias).
              Si lo apagás, sigue funcionando todo pero solo aparece a quienes tienen el link directo.
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
      </section>

      {/* ─── Dominio actual ─── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">Tu URL</h2>

        {!customDomain ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <p className="text-sm">
              Estás usando el subdominio gratuito de Curplat:
            </p>
            <p className="font-mono text-lg mt-2 text-white">
              {tenant.slug}.{rootDomain}
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
                <h3 className="font-semibold text-amber-200 text-sm">Para que funcione, configurá estos DNS records en donde compraste el dominio:</h3>

                <div className="space-y-2 text-xs font-mono">
                  <div className="bg-black/40 rounded p-2">
                    <div className="text-white/45 mb-1">Para dominio raíz (ej. tuempresa.com):</div>
                    <div className="text-white">
                      Tipo: <span className="text-fuchsia-300">A</span> ·
                      Host: <span className="text-fuchsia-300">@</span> ·
                      Valor: <span className="text-fuchsia-300">{status?.vercel_apex_a_record ?? '76.76.21.21'}</span>
                    </div>
                  </div>
                  <div className="bg-black/40 rounded p-2">
                    <div className="text-white/45 mb-1">Para subdominio www (recomendado):</div>
                    <div className="text-white">
                      Tipo: <span className="text-fuchsia-300">CNAME</span> ·
                      Host: <span className="text-fuchsia-300">www</span> ·
                      Valor: <span className="text-fuchsia-300">{status?.vercel_cname_target ?? 'cname.vercel-dns.com'}</span>
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
      </section>

      {/* ─── Conectar dominio ─── */}
      {!customDomain && (
        <section className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 p-5 space-y-4">
          <div>
            <h2 className="font-bold text-lg">Conectar mi dominio propio</h2>
            <p className="text-sm text-white/65 mt-1">
              Si ya compraste un dominio en otro proveedor (NameCheap, GoDaddy, DonWeb, Cloudflare, etc),
              podés conectarlo acá. El SSL/HTTPS lo gestionamos nosotros gratis.
            </p>
          </div>

          {!vercelConfigured && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              ⚠️ La plataforma todavía no tiene configurada la integración con Vercel.
              Podés guardar tu dominio igual pero la verificación automática no va a funcionar.
              El admin debe setear VERCEL_API_TOKEN + VERCEL_PROJECT_ID.
            </div>
          )}

          <form action={connectCustomDomainAction} className="flex gap-2 flex-wrap">
            <input
              name="domain" type="text" required
              placeholder="tuempresa.com"
              className="flex-1 min-w-[200px] rounded bg-black/40 border border-white/20 px-3 py-2 text-sm font-mono"
            />
            <button className="rounded-md bg-fuchsia-500 text-white px-5 py-2 text-sm font-semibold hover:bg-fuchsia-400">
              Conectar
            </button>
          </form>

          <p className="text-[11px] text-white/45">
            Después te vamos a dar los DNS records que tenés que pegar en tu registrar.
            En 5 min a 24 hs queda funcionando con HTTPS automático.
          </p>
        </section>
      )}
    </div>
  );
}
