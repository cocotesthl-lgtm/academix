import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { becomeAffiliateAction } from "@/lib/affiliates/panel";
import { tenantOrigin } from "@/lib/env";
import { NETWORK_EMOJI } from "@/lib/affiliates/networks";

export const dynamic = "force-dynamic";

type TenantBrand = { primary_color?: string; logo_url?: string } | null;
type TenantRow = { id: string; slug: string; name: string; brand: TenantBrand };
type MembershipRow = { tenant_id: string };

export default async function AffiliateGlobalPage({
  searchParams
}: {
  searchParams: Promise<{ activate?: string }>;
}) {
  const { activate } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // (1) No logueado → CTA login/signup
  if (!user) {
    return <NotLoggedIn />;
  }

  const svc = getServiceClient();
  const { data: profile } = await svc
    .from('profiles').select('is_affiliate, display_name').eq('id', user.id)
    .maybeSingle<{ is_affiliate: boolean; display_name: string | null }>();

  // (2a) Logueado + !is_affiliate + ?activate=1 → auto-flip y limpiar URL.
  // Esto es lo que dispara el signup-as-affiliate: en vez de mostrar otro
  // botón "activar", lo flippeamos ahí mismo.
  if (!profile?.is_affiliate && activate === '1') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('profiles') as any)
      .update({ is_affiliate: true, affiliate_signup_at: new Date().toISOString() })
      .eq('id', user.id);
    redirect('/affiliate');
  }

  // (2b) Logueado pero no afiliado y no pidió activar → form para serlo
  if (!profile?.is_affiliate) {
    return <BecomeAffiliate displayName={profile?.display_name ?? null} />;
  }

  // (3) Ya es afiliado → panel cross-tenant
  // ─ memberships del user como afiliado → tenants donde tiene presencia
  // ─ comisiones agregadas
  // ─ broadcasts no leídos agregados
  const [
    { data: membershipsRaw },
    { data: commissionsRaw },
    { data: allTenantsRaw }
  ] = await Promise.all([
    svc.from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id).eq('role', 'affiliate').eq('status', 'active'),
    svc.from('affiliate_commissions')
      .select('id, tenant_id, level, amount_cents, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50),
    // Para CTA "afiliate a más" — mostramos academias donde NO está aún
    svc.from('tenants')
      .select('id, slug, name, brand')
      .eq('status', 'active')
      .order('created_at', { ascending: false }).limit(30)
  ]);

  const memberships = (membershipsRaw ?? []) as MembershipRow[];
  const memberTenantIds = new Set(memberships.map((m) => m.tenant_id));

  // Tenants donde es afiliado (en una query separada con detalle)
  const myTenantIds = memberships.map((m) => m.tenant_id);
  const myTenants: TenantRow[] = [];
  if (myTenantIds.length > 0) {
    const { data } = await svc
      .from('tenants')
      .select('id, slug, name, brand')
      .in('id', myTenantIds);
    myTenants.push(...((data ?? []) as TenantRow[]));
  }

  const commissions = (commissionsRaw ?? []) as Array<{
    id: string; tenant_id: string; level: number; amount_cents: number;
    status: string; created_at: string;
  }>;
  const accruedTotal = commissions.filter((c) => c.status === 'accrued')
    .reduce((s, c) => s + Number(c.amount_cents), 0);
  const paidTotal = commissions.filter((c) => c.status === 'paid')
    .reduce((s, c) => s + Number(c.amount_cents), 0);

  // Por tenant: $acumulado
  const accruedByTenant = new Map<string, number>();
  for (const c of commissions) {
    if (c.status !== 'accrued') continue;
    accruedByTenant.set(c.tenant_id, (accruedByTenant.get(c.tenant_id) ?? 0) + Number(c.amount_cents));
  }

  // Otras academias para explorar (no soy afiliado todavía)
  const allTenants = (allTenantsRaw ?? []) as TenantRow[];
  const exploreTenants = allTenants.filter((t) => !memberTenantIds.has(t.id)).slice(0, 12);

  // Comunidades + broadcasts combinados de TODOS los tenants donde soy afiliado
  let communities: Array<{ id: string; tenant_id: string; network: string; label: string; url: string }> = [];
  let broadcasts: Array<{ id: string; tenant_id: string; subject: string; body: string; pinned: boolean; created_at: string }> = [];
  if (myTenantIds.length > 0) {
    const [{ data: comRaw }, { data: brRaw }] = await Promise.all([
      svc.from('community_links')
        .select('id, tenant_id, network, label, url')
        .in('tenant_id', myTenantIds).in('audience', ['affiliates', 'all'])
        .order('position', { ascending: true }).limit(30),
      svc.from('affiliate_broadcasts')
        .select('id, tenant_id, subject, body, pinned, created_at')
        .in('tenant_id', myTenantIds)
        .order('pinned', { ascending: false }).order('created_at', { ascending: false })
        .limit(20)
    ]);
    communities = (comRaw ?? []) as typeof communities;
    broadcasts = (brRaw ?? []) as typeof broadcasts;
  }

  const tenantById = new Map<string, TenantRow>(myTenants.map((t) => [t.id, t]));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">Curplat</Link>
          <div className="flex items-center gap-3">
            <Link href="/buscar" className="text-sm text-white/80 hover:text-white">
              🔍 Explorar academias
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200 mb-3">
            💼 Afiliado de Curplat
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Tu panel global de afiliado</h1>
          <p className="text-white/60 mt-2 max-w-2xl">
            Una sola cuenta para promocionar cursos de todas las academias de la plataforma.
            Acá ves tus comisiones, las academias donde estás activo y las que podés sumar.
          </p>
        </div>

        {/* Stats globales */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Stat label="Acumulado total" value={`$${(accruedTotal / 100).toLocaleString('es-AR')}`} />
          <Stat label="Cobrado total" value={`$${(paidTotal / 100).toLocaleString('es-AR')}`} />
          <Stat label="Academias activas" value={myTenants.length.toString()} />
        </section>

        {/* Mis academias */}
        <section>
          <h2 className="text-xl font-bold mb-3">🏫 Tus academias</h2>
          {myTenants.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/60">
              <p>Todavía no generaste links en ninguna academia.</p>
              <p className="text-sm mt-2">Explorá las academias abajo y entrá a su sección de afiliados para empezar.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myTenants.map((t) => {
                const accrued = accruedByTenant.get(t.id) ?? 0;
                const color = t.brand?.primary_color ?? '#a855f7';
                const origin = tenantOrigin(t.slug);
                return (
                  <a
                    key={t.id}
                    href={`${origin}/affiliate`}
                    className="block rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:border-white/30 hover:bg-white/[0.04] transition"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {t.brand?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.brand.logo_url} alt={t.name} className="h-10 w-10 object-contain rounded" />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ background: color }}
                        >
                          {t.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{t.name}</div>
                        <div className="text-xs text-white/40 truncate">{t.slug}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN}</div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-white/40">Acumulado</div>
                        <div className="font-mono font-bold">${(accrued / 100).toLocaleString('es-AR')}</div>
                      </div>
                      <span className="text-xs text-white/40">Ir al panel →</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Mensajes recientes de owners */}
        {broadcasts.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-3">📬 Mensajes de los owners</h2>
            <div className="space-y-2">
              {broadcasts.slice(0, 8).map((m) => {
                const t = tenantById.get(m.tenant_id);
                return (
                  <details key={m.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                    <summary className="cursor-pointer flex items-center justify-between gap-3 font-medium">
                      <span className="flex items-center gap-2 min-w-0">
                        {m.pinned && <span title="Fijado">📌</span>}
                        <span className="text-xs px-2 py-0.5 rounded bg-white/10 shrink-0">{t?.name ?? '—'}</span>
                        <span className="truncate">{m.subject}</span>
                      </span>
                      <span className="text-xs text-white/40 shrink-0">
                        {new Date(m.created_at).toLocaleDateString('es-AR')}
                      </span>
                    </summary>
                    <p className="mt-3 text-sm text-white/75 whitespace-pre-line">{m.body}</p>
                  </details>
                );
              })}
            </div>
          </section>
        )}

        {/* Comunidades combinadas */}
        {communities.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-3">💬 Comunidades y grupos</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {communities.map((c) => {
                const t = tenantById.get(c.tenant_id);
                return (
                  <a
                    key={c.id}
                    href={c.url}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 hover:border-white/30 transition"
                  >
                    <div className="text-2xl shrink-0">{NETWORK_EMOJI[c.network] ?? '🔗'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{c.label}</div>
                      <div className="text-xs text-white/40 truncate">{t?.name ?? '—'}</div>
                    </div>
                    <span className="text-xs text-white/40 shrink-0">→</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Explorar más academias */}
        {exploreTenants.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-1">🚀 Sumá más academias</h2>
            <p className="text-sm text-white/60 mb-4">
              Entrá a cualquier academia y generá tu primer link en su panel de afiliados — la sumás automáticamente acá.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {exploreTenants.map((t) => {
                const color = t.brand?.primary_color ?? '#a855f7';
                const origin = tenantOrigin(t.slug);
                return (
                  <a
                    key={t.id}
                    href={`${origin}/affiliate`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/30 transition"
                  >
                    {t.brand?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.brand.logo_url} alt={t.name} className="h-9 w-9 object-contain rounded" />
                    ) : (
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ background: color }}
                      >
                        {t.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate text-sm">{t.name}</div>
                      <div className="text-[11px] text-white/40 truncate">{t.slug}</div>
                    </div>
                    <span className="text-xs text-white/40 shrink-0">→</span>
                  </a>
                );
              })}
            </div>
            <div className="text-center mt-4">
              <Link href="/buscar" className="text-sm text-fuchsia-300 hover:text-fuchsia-200">
                Ver todas las academias →
              </Link>
            </div>
          </section>
        )}

        {/* Últimas comisiones */}
        {commissions.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-3">💰 Comisiones recientes</h2>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-white/50 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-left px-4 py-2">Academia</th>
                    <th className="text-left px-4 py-2">Nivel</th>
                    <th className="text-left px-4 py-2">Estado</th>
                    <th className="text-right px-4 py-2">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.slice(0, 20).map((c) => {
                    const t = tenantById.get(c.tenant_id);
                    return (
                      <tr key={c.id} className="border-t border-white/5">
                        <td className="px-4 py-2 text-white/60">{new Date(c.created_at).toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-2">{t?.name ?? '—'}</td>
                        <td className="px-4 py-2">L{c.level}</td>
                        <td className="px-4 py-2 text-white/70">{c.status}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          ${(c.amount_cents / 100).toLocaleString('es-AR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/* ─────────── Sub-componentes ─────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl md:text-3xl font-bold mt-1 font-mono">{value}</div>
    </div>
  );
}

function NotLoggedIn() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">Curplat</Link>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4">💼</div>
        <h1 className="text-3xl md:text-4xl font-bold">Volvete afiliado de Curplat</h1>
        <p className="text-white/65 mt-4 max-w-md mx-auto">
          Una sola cuenta para promocionar cursos de <strong>todas</strong> las academias
          de la plataforma. Generás link único por curso, te damos material promocional,
          ganás comisión por cada venta.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup?next=/affiliate"
            className="rounded-lg bg-fuchsia-500 text-white px-6 py-3 font-semibold hover:bg-fuchsia-400"
          >
            Crear cuenta gratis →
          </Link>
          <Link
            href="/login?next=/affiliate"
            className="rounded-lg border border-white/20 px-6 py-3 font-semibold hover:bg-white/5"
          >
            Ya tengo cuenta
          </Link>
        </div>
        <ul className="text-sm text-white/55 mt-10 space-y-2 max-w-sm mx-auto text-left">
          <li>✅ 1 cuenta para todas las academias</li>
          <li>✅ Aprobación inmediata, gratis</li>
          <li>✅ Link único por curso + material promocional</li>
          <li>✅ Panel global con comisiones de todas las academias</li>
        </ul>
      </main>
    </div>
  );
}

function BecomeAffiliate({ displayName }: { displayName: string | null }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">Curplat</Link>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4">💼</div>
        <h1 className="text-3xl md:text-4xl font-bold">
          {displayName ? `Hola ${displayName.split(' ')[0]}, ` : ''}sumate como afiliado
        </h1>
        <p className="text-white/65 mt-4 max-w-md mx-auto">
          Activá tu cuenta de afiliado de <strong>Curplat</strong>. Vas a poder promocionar
          cursos de cualquier academia de la plataforma y ver tus comisiones en un solo panel.
        </p>
        <form action={becomeAffiliateAction} className="mt-8">
          <input type="hidden" name="redirect_to" value="/affiliate" />
          <button
            className="rounded-lg bg-fuchsia-500 text-white px-6 py-3 font-semibold hover:bg-fuchsia-400"
          >
            ✅ Activar mi cuenta de afiliado
          </button>
        </form>
        <p className="text-xs text-white/40 mt-4">
          Aprobación inmediata · Gratis · 1 cuenta para todas las academias
        </p>
      </main>
    </div>
  );
}
