import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import {
  addPromoMaterialAction, deletePromoMaterialAction,
  addCommunityLinkAction, deleteCommunityLinkAction,
  sendBroadcastAction, deleteBroadcastAction,
  toggleAffiliateValidatorAction
} from "@/lib/affiliates/panel";
import { NETWORKS, NETWORK_EMOJI } from "@/lib/affiliates/networks";

export const dynamic = "force-dynamic";

type LinkRow = {
  id: string; code: string; created_at: string;
  course_id: string; affiliate_user_id: string;
  courses: { title: string } | null;
  profiles: { email: string | null; display_name: string | null } | null;
};

type PromoRow = { id: string; type: string; title: string; description: string | null; asset_url: string | null; copy_text: string | null; thumbnail_url: string | null };
type CommunityRow = { id: string; network: string; label: string; url: string; description: string | null; audience: string };
type BroadcastRow = { id: string; subject: string; body: string; pinned: boolean; created_at: string };

export default async function OwnerAffiliates() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const [
    { data: linksRaw },
    { data: promoRaw },
    { data: communitiesRaw },
    { data: broadcastsRaw },
    { count: affiliateCount }
  ] = await Promise.all([
    svc.from("affiliate_links")
      .select("id, code, created_at, course_id, affiliate_user_id, courses(title), profiles:affiliate_user_id(email, display_name)")
      .eq("tenant_id", tenant.id).order("created_at", { ascending: false }),
    svc.from("promo_materials").select("*").eq("tenant_id", tenant.id).order("position", { ascending: true }),
    svc.from("community_links").select("*").eq("tenant_id", tenant.id).order("position", { ascending: true }),
    svc.from("affiliate_broadcasts").select("*").eq("tenant_id", tenant.id)
      .order("pinned", { ascending: false }).order("created_at", { ascending: false }),
    svc.from("memberships")
      .select("id", { count: 'exact', head: true })
      .eq("tenant_id", tenant.id).eq("role", "affiliate").eq("status", "active")
  ]);

  // Lista de afiliados (memberships) con flag can_validate_tickets.
  // Defensivo: si migration 0022 no corrio, asumimos false.
  type AffMember = {
    user_id: string;
    can_validate_tickets?: boolean;
    profiles?: { email: string | null; display_name: string | null } | null;
  };
  let affiliates: AffMember[] = [];
  try {
    const res = await svc
      .from("memberships")
      .select("user_id, can_validate_tickets, profiles:user_id(email, display_name)")
      .eq("tenant_id", tenant.id).eq("role", "affiliate").eq("status", "active")
      .order("created_at", { ascending: false }).limit(50);
    if (!res.error) affiliates = (res.data ?? []) as unknown as AffMember[];
  } catch {
    const res = await svc
      .from("memberships")
      .select("user_id, profiles:user_id(email, display_name)")
      .eq("tenant_id", tenant.id).eq("role", "affiliate").eq("status", "active")
      .order("created_at", { ascending: false }).limit(50);
    affiliates = (res.data ?? []) as unknown as AffMember[];
  }
  const validatorsCount = affiliates.filter((a) => a.can_validate_tickets).length;

  const rows = (linksRaw ?? []) as unknown as LinkRow[];
  const promoRows = (promoRaw ?? []) as PromoRow[];
  const communityRows = (communitiesRaw ?? []) as CommunityRow[];
  const broadcastRows = (broadcastsRaw ?? []) as BroadcastRow[];

  // Stats (igual que antes)
  const linkIds = rows.map((r) => r.id);
  let clicksByLink = new Map<string, number>();
  const commByAffiliate = new Map<string, number>();
  if (linkIds.length > 0) {
    const [{ data: clicks }, { data: comms }] = await Promise.all([
      svc.from("affiliate_clicks").select("affiliate_link_id").in("affiliate_link_id", linkIds),
      svc.from("affiliate_commissions").select("user_id, amount_cents").eq("tenant_id", tenant.id)
    ]);
    for (const c of ((clicks ?? []) as Array<{ affiliate_link_id: string }>)) {
      clicksByLink.set(c.affiliate_link_id, (clicksByLink.get(c.affiliate_link_id) ?? 0) + 1);
    }
    for (const c of ((comms ?? []) as Array<{ user_id: string; amount_cents: number }>)) {
      commByAffiliate.set(c.user_id, (commByAffiliate.get(c.user_id) ?? 0) + Number(c.amount_cents));
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Afiliados</h1>
        <p className="text-white/60 text-sm mt-1">
          Tu programa de afiliados: links activos, material promocional, comunidades y broadcasts.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Afiliados activos" value={String(affiliateCount ?? 0)} />
        <MiniStat label="Links generados" value={String(rows.length)} />
        <MiniStat label="Materiales" value={String(promoRows.length)} />
        <MiniStat label="Comunidades" value={String(communityRows.length)} />
      </div>

      {/* ─── Broadcast nuevo ─── */}
      <Section title="📬 Mandar mensaje a todos los afiliados">
        <form action={sendBroadcastAction} className="space-y-2">
          <input
            name="subject" required maxLength={200}
            placeholder="Asunto del mensaje"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
          />
          <textarea
            name="body" required rows={4} maxLength={5000}
            placeholder="Mensaje para tus afiliados..."
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm resize-none"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="pinned" /> Fijar arriba en el panel
            </label>
            <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold">
              📤 Enviar
            </button>
          </div>
        </form>

        {broadcastRows.length > 0 && (
          <div className="mt-4 space-y-2">
            {broadcastRows.map((m) => (
              <div key={m.id} className="rounded border border-white/10 bg-white/[0.02] p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold flex items-center gap-1.5">
                    {m.pinned && <span>📌</span>}{m.subject}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">{new Date(m.created_at).toLocaleDateString('es-AR')}</span>
                    <form action={deleteBroadcastAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="text-xs text-red-300/70 hover:text-red-300">Eliminar</button>
                    </form>
                  </div>
                </div>
                <p className="text-white/65 mt-1 text-xs whitespace-pre-line line-clamp-3">{m.body}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Comunidades ─── */}
      <Section title="💬 Comunidades y grupos">
        <form action={addCommunityLinkAction} className="grid sm:grid-cols-[120px_1fr_1fr_auto] gap-2">
          <select name="network" className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm">
            {NETWORKS.map((n) => <option key={n.key} value={n.key}>{n.emoji} {n.label}</option>)}
          </select>
          <input name="label" required maxLength={120} placeholder="Nombre del grupo" className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
          <input name="url" type="url" required placeholder="https://chat.whatsapp.com/..." className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
          <button className="rounded bg-white text-black px-3 py-1.5 text-sm font-semibold">+ Agregar</button>
          <input name="description" maxLength={500} placeholder="Descripción opcional" className="sm:col-span-3 rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
          <select name="audience" defaultValue="affiliates" className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm">
            <option value="affiliates">Solo afiliados</option>
            <option value="students">Solo alumnos</option>
            <option value="all">Todos</option>
          </select>
        </form>

        {communityRows.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {communityRows.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.02] p-2 text-sm">
                <span className="text-xl">{NETWORK_EMOJI[c.network] ?? '🔗'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{c.label}</div>
                  <div className="text-xs text-white/45 truncate">{c.url} · {c.audience}</div>
                </div>
                <form action={deleteCommunityLinkAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-red-300/70 hover:text-red-300">✕</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Material promocional ─── */}
      <Section title="🎨 Material promocional">
        <form action={addPromoMaterialAction} className="grid sm:grid-cols-2 gap-2">
          <input name="title" required maxLength={120} placeholder="Título" className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
          <select name="type" className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm">
            <option value="banner">Banner</option>
            <option value="image">Imagen</option>
            <option value="video">Video</option>
            <option value="copy">Copy para mail/post</option>
            <option value="pdf">PDF</option>
            <option value="asset">Otro</option>
          </select>
          <input name="description" maxLength={500} placeholder="Descripción corta" className="sm:col-span-2 rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
          <input name="asset_url" type="url" placeholder="URL del recurso (Drive, Imgur, Vimeo…)" className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
          <input name="thumbnail_url" type="url" placeholder="URL del thumbnail (opcional)" className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
          <textarea name="copy_text" rows={3} maxLength={5000} placeholder="Copy sugerido para copy-paste (opcional)" className="sm:col-span-2 rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm resize-none" />
          <button className="sm:col-span-2 rounded bg-white text-black px-3 py-1.5 text-sm font-semibold">+ Agregar material</button>
        </form>

        {promoRows.length > 0 && (
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {promoRows.map((p) => (
              <div key={p.id} className="rounded border border-white/10 bg-white/[0.02] p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-wider text-white/40">{p.type}</span>
                  <form action={deletePromoMaterialAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-red-300/70 hover:text-red-300">✕</button>
                  </form>
                </div>
                {p.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail_url} alt="" className="w-full aspect-video object-cover rounded" />
                )}
                <div className="font-semibold text-sm">{p.title}</div>
                {p.description && <p className="text-white/55 line-clamp-2">{p.description}</p>}
                {p.asset_url && <a href={p.asset_url} target="_blank" rel="noopener" className="text-white/60 hover:text-white block truncate">{p.asset_url}</a>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Validadores de tickets (Fase 4) ─── */}
      <Section title="🎟️ Asistentes de molinete (validar entradas)">
        <p className="text-xs text-white/55 -mt-2 mb-2">
          Habilitá afiliados como ayudantes el día del evento. Acceden a un scanner desde su panel
          (<code className="bg-white/10 px-1 rounded">/affiliate/validar</code>) sin tocar el resto del owner panel.
          {validatorsCount > 0 && ` Actualmente ${validatorsCount} habilitado${validatorsCount === 1 ? '' : 's'}.`}
        </p>
        {affiliates.length === 0 ? (
          <p className="text-sm text-white/45 py-3">Todavía no hay afiliados activos en tu academia.</p>
        ) : (
          <div className="space-y-1.5">
            {affiliates.map((a) => (
              <div key={a.user_id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <div className="text-sm font-medium truncate">
                    {a.profiles?.display_name ?? a.profiles?.email ?? a.user_id.slice(0, 8)}
                  </div>
                  <div className="text-[11px] text-white/45 truncate">{a.profiles?.email ?? '—'}</div>
                </div>
                {a.can_validate_tickets && (
                  <span className="text-[10px] uppercase tracking-wider rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-0.5">
                    ✓ Validator
                  </span>
                )}
                <form action={toggleAffiliateValidatorAction}>
                  <input type="hidden" name="user_id" value={a.user_id} />
                  <input type="hidden" name="allow" value={a.can_validate_tickets ? 'false' : 'true'} />
                  <button className={`text-xs px-3 py-1 rounded border whitespace-nowrap ${
                    a.can_validate_tickets
                      ? 'border-white/15 hover:bg-white/5'
                      : 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20'
                  }`}>
                    {a.can_validate_tickets ? 'Quitar permiso' : '+ Habilitar validator'}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Tabla de links existentes (lo que ya teníamos) ─── */}
      <Section title="🔗 Links de afiliado generados">
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-white/50 text-sm">
              Todavía nadie generó links de afiliado para tu academia.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Afiliado</th>
                  <th className="text-left px-4 py-2.5">Curso</th>
                  <th className="text-left px-4 py-2.5">Código</th>
                  <th className="text-right px-4 py-2.5">Clicks</th>
                  <th className="text-right px-4 py-2.5">Comisiones</th>
                  <th className="text-left px-4 py-2.5">Alta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-4 py-3">{r.profiles?.display_name ?? r.profiles?.email ?? r.affiliate_user_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-white/80">{r.courses?.title ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3 text-right">{clicksByLink.get(r.id) ?? 0}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      ${((commByAffiliate.get(r.affiliate_user_id) ?? 0) / 100).toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-3 text-white/50">{new Date(r.created_at).toLocaleDateString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold mt-1 font-mono">{value}</div>
    </div>
  );
}
