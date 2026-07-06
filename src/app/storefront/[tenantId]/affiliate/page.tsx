import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getTenantById } from "@/lib/tenant/resolve";
import { AffiliateLinkButton } from "@/components/storefront/AffiliateLinkButton";
import { signupAsAffiliateAction, markBroadcastReadAction, ensureAffiliateMembership } from "@/lib/affiliates/panel";
import { NETWORK_EMOJI } from "@/lib/affiliates/networks";
import { buildCourseUrl } from "@/lib/affiliates/url";
import { tenantOrigin } from "@/lib/env";
import { getUserWorkspaces } from "@/lib/workspaces/queries";
import { AffiliateWorkspaceHeader } from "@/components/affiliate/AffiliateWorkspaceHeader";

export const dynamic = "force-dynamic";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  currency: string;
  affiliate_enabled: boolean;
};

type PromoRow = {
  id: string; type: string; title: string; description: string | null;
  asset_url: string | null; copy_text: string | null; thumbnail_url: string | null;
};

type CommunityRow = {
  id: string; network: string; label: string; url: string; description: string | null;
};

type BroadcastRow = {
  id: string; subject: string; body: string; pinned: boolean; created_at: string;
};

export default async function AffiliateDashboard({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) redirect("/");
  const primary = tenant.brand?.primary_color ?? '#0a0a0a';

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/affiliate");

  const svc = getServiceClient();

  // Afiliado platform-level (OfferNow)? Si no lo es, ofrecemos signup.
  const { data: profile } = await svc
    .from('profiles').select('is_affiliate').eq('id', user.id)
    .maybeSingle<{ is_affiliate: boolean }>();

  if (!profile?.is_affiliate) {
    return <AffiliateJoin tenantId={tenantId} tenantName={tenant.name} primary={primary} />;
  }

  // Es afiliado de OfferNow — autocreamos su membership en este tenant para
  // que el owner lo vea entre sus afiliados.
  await ensureAffiliateMembership({ tenantId, userId: user.id });

  // ¿Está habilitado como validator de tickets? (defensivo si migration falta)
  let canValidate = false;
  try {
    const res = await svc.from("memberships")
      .select("can_validate_tickets")
      .eq("tenant_id", tenantId).eq("user_id", user.id).eq("role", "affiliate")
      .maybeSingle<{ can_validate_tickets: boolean }>();
    canValidate = !!res.data?.can_validate_tickets;
  } catch { /* migration 0022 missing */ }

  // Publicaciones disponibles + mis links + comisiones (lo que ya teníamos)
  const [
    { data: courses },
    { data: links },
    { data: commissionsRaw },
    { data: promoRaw },
    { data: communitiesRaw },
    { data: broadcastsRaw },
    { data: readsRaw }
  ] = await Promise.all([
    svc.from("courses")
      .select("id, slug, title, price_cents, currency, affiliate_enabled")
      .eq("tenant_id", tenantId).eq("status", "published").eq("affiliate_enabled", true)
      .order("created_at", { ascending: false }),
    svc.from("affiliate_links")
      .select("course_id, code")
      .eq("affiliate_user_id", user.id).eq("tenant_id", tenantId),
    svc.from("affiliate_commissions")
      .select("id, level, amount_cents, status, created_at")
      .eq("user_id", user.id).eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }).limit(20),
    svc.from("promo_materials")
      .select("id, type, title, description, asset_url, copy_text, thumbnail_url")
      .eq("tenant_id", tenantId).order("position", { ascending: true }),
    svc.from("community_links")
      .select("id, network, label, url, description")
      .eq("tenant_id", tenantId).in("audience", ['affiliates', 'all'])
      .order("position", { ascending: true }),
    svc.from("affiliate_broadcasts")
      .select("id, subject, body, pinned, created_at")
      .eq("tenant_id", tenantId)
      .order("pinned", { ascending: false }).order("created_at", { ascending: false })
      .limit(20),
    svc.from("affiliate_message_reads")
      .select("message_id").eq("affiliate_user_id", user.id)
  ]);

  const courseRows = (courses ?? []) as CourseRow[];
  const byCourse = new Map<string, string>(
    ((links ?? []) as Array<{ course_id: string; code: string }>).map((l) => [l.course_id, l.code])
  );
  const commissionRows = (commissionsRaw ?? []) as Array<{
    id: string; level: number; amount_cents: number; status: string; created_at: string;
  }>;
  const promoRows = (promoRaw ?? []) as PromoRow[];
  const communityRows = (communitiesRaw ?? []) as CommunityRow[];
  const broadcastRows = (broadcastsRaw ?? []) as BroadcastRow[];
  const readIds = new Set(((readsRaw ?? []) as Array<{ message_id: string }>).map((r) => r.message_id));
  const unreadCount = broadcastRows.filter((b) => !readIds.has(b.id)).length;

  const accruedTotal = commissionRows.filter((c) => c.status === 'accrued').reduce((s, c) => s + Number(c.amount_cents), 0);
  const paidTotal = commissionRows.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.amount_cents), 0);

  const origin = tenantOrigin(tenant!.slug);
  const urlFor = (courseSlug: string, code: string) =>
    buildCourseUrl({ origin, courseSlug, ref: code });

  // F6.1: header con switcher de workspaces — reutilizado del owner sidebar.
  const workspaces = await getUserWorkspaces(user.id);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      <AffiliateWorkspaceHeader
        currentTenantName={tenant.name}
        currentTenantLogo={tenant.brand?.logo_url ?? null}
        currentBrand={primary}
        workspaces={workspaces}
        currentTenantId={tenantId}
        email={user.email ?? ''}
      />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Panel de afiliado</h1>
          <p className="text-black/60 mt-2">
            Tus links, tus comisiones, material promocional y mensajes del owner de <strong>{tenant.name}</strong>.
          </p>
        </div>
        {canValidate && (
          <a
            href="/affiliate/validar"
            className="rounded-lg px-4 py-2.5 text-white text-sm font-semibold whitespace-nowrap"
            style={{ background: primary }}
          >
            🎟️ Validar entradas
          </a>
        )}
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Acumulado (pendiente)" value={`$${(accruedTotal / 100).toLocaleString('es-AR')}`} />
        <Stat label="Cobrado" value={`$${(paidTotal / 100).toLocaleString('es-AR')}`} />
        <Stat label="Publicaciones disponibles" value={courseRows.length.toString()} />
      </section>

      {/* Mensajes del owner */}
      {broadcastRows.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            📬 Mensajes del owner
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-semibold">
                {unreadCount} nuevo{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <div className="space-y-2">
            {broadcastRows.map((m) => {
              const isUnread = !readIds.has(m.id);
              return (
                <details
                  key={m.id}
                  className={`rounded-lg border px-4 py-3 ${
                    isUnread ? 'border-amber-300 bg-amber-50' : 'border-black/10 bg-white'
                  }`}
                >
                  <summary className="cursor-pointer flex items-center justify-between gap-3 font-medium">
                    <span className="flex items-center gap-2">
                      {m.pinned && <span title="Fijado">📌</span>}
                      {isUnread && <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />}
                      {m.subject}
                    </span>
                    <span className="text-xs text-black/40 shrink-0">
                      {new Date(m.created_at).toLocaleDateString('es-AR')}
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-black/75 whitespace-pre-line">{m.body}</p>
                  {isUnread && (
                    <form action={markBroadcastReadAction} className="mt-3">
                      <input type="hidden" name="message_id" value={m.id} />
                      <button className="text-xs rounded border border-black/15 px-3 py-1 hover:bg-black/5">
                        ✓ Marcar como leído
                      </button>
                    </form>
                  )}
                </details>
              );
            })}
          </div>
        </section>
      )}

      {/* Comunidades */}
      {communityRows.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-3">💬 Comunidades y grupos</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {communityRows.map((c) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-3 rounded-lg border border-black/10 p-4 hover:border-black/30 hover:bg-black/[0.02] transition"
              >
                <div className="text-2xl shrink-0">{NETWORK_EMOJI[c.network] ?? '🔗'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{c.label}</div>
                  {c.description && <p className="text-xs text-black/55 mt-0.5 line-clamp-2">{c.description}</p>}
                </div>
                <span className="text-xs text-black/40 shrink-0">→</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Material promocional */}
      {promoRows.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-1">🎨 Material promocional</h2>
          <p className="text-sm text-black/60 mb-4">Banners, videos, copys listos para usar en tus redes y mails.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {promoRows.map((p) => (
              <div key={p.id} className="rounded-lg border border-black/10 p-4 space-y-2">
                {p.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail_url} alt="" className="w-full aspect-video object-cover rounded" />
                )}
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-black/40 font-semibold">
                    {p.type}
                  </div>
                  <div className="font-semibold mt-0.5">{p.title}</div>
                  {p.description && <p className="text-xs text-black/60 mt-1">{p.description}</p>}
                </div>
                {p.copy_text && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-black/55 hover:text-black">📝 Ver copy sugerido</summary>
                    <pre className="mt-2 p-2 bg-black/[0.03] rounded text-[11px] whitespace-pre-wrap font-sans">{p.copy_text}</pre>
                  </details>
                )}
                {p.asset_url && (
                  <a
                    href={p.asset_url}
                    target="_blank"
                    rel="noopener"
                    className="block text-center text-xs rounded text-white px-3 py-1.5 font-semibold"
                    style={{ background: primary }}
                  >
                    Ver / descargar
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comisiones recientes */}
      {commissionRows.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-3">💰 Comisiones recientes</h2>
          <div className="rounded-xl border border-black/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-black/[0.02] text-black/50 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Fecha</th>
                  <th className="text-left px-4 py-2">Nivel</th>
                  <th className="text-left px-4 py-2">Estado</th>
                  <th className="text-right px-4 py-2">Monto</th>
                </tr>
              </thead>
              <tbody>
                {commissionRows.map((c) => (
                  <tr key={c.id} className="border-t border-black/5">
                    <td className="px-4 py-2 text-black/60">{new Date(c.created_at).toLocaleDateString('es-AR')}</td>
                    <td className="px-4 py-2">L{c.level}</td>
                    <td className="px-4 py-2">{c.status}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      ${(c.amount_cents / 100).toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Mis links */}
      <section>
        <h2 className="text-xl font-bold mb-3">🔗 Tus links de afiliado</h2>
        <p className="text-sm text-black/60 mb-4">
          Compartí tu link único de cada publicación. Cuando alguien compre desde tu link, ganás comisión.
          Tip: mientras navegás el storefront vas a ver una barra arriba con un selector A/B/C de variantes.
        </p>
        {courseRows.length === 0 ? (
          <div className="rounded-xl border border-black/10 p-10 text-center text-black/50">
            Este sitio todavía no tiene publicaciones disponibles para afiliación.
          </div>
        ) : (
          <div className="space-y-3">
            {courseRows.map((c) => {
              const existingCode = byCourse.get(c.id);
              return (
                <div key={c.id} className="rounded-xl border border-black/10 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold">{c.title}</h3>
                      <p className="text-sm text-black/60">
                        {c.price_cents === 0 ? 'Gratis' : `$${(c.price_cents / 100).toLocaleString('es-AR')} ${c.currency}`}
                      </p>
                    </div>
                  </div>
                  <AffiliateLinkButton
                    courseId={c.id}
                    tenantSlug={tenant.slug}
                    initialCode={existingCode ?? null}
                    initialUrl={existingCode ? urlFor(c.slug, existingCode) : null}
                    primary={primary}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ─────────── Sub-componentes ─────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 p-5">
      <div className="text-xs text-black/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl md:text-3xl font-bold mt-1 font-mono">{value}</div>
    </div>
  );
}

function AffiliateJoin({ tenantId, tenantName, primary }: { tenantId: string; tenantName: string; primary: string }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="text-5xl mb-4">💼</div>
      <h1 className="text-3xl font-bold">Sumate al programa de afiliados</h1>
      <p className="text-black/60 mt-3 max-w-md mx-auto">
        Te registrás como afiliado de <strong>OfferNow</strong> y podés promocionar publicaciones de{' '}
        <strong>{tenantName}</strong> y de cualquier otro sitio de la plataforma. Te damos
        link único por publicación, material promocional y comisión por cada venta.
      </p>
      <form action={signupAsAffiliateAction} className="mt-8">
        <input type="hidden" name="tenant_id" value={tenantId} />
        <button
          className="rounded-lg px-6 py-3 font-semibold text-white"
          style={{ background: primary }}
        >
          ✅ Quiero ser afiliado
        </button>
      </form>
      <p className="text-xs text-black/40 mt-4">
        Aprobación inmediata · Gratis · 1 cuenta para todos los sitios
      </p>
    </div>
  );
}
