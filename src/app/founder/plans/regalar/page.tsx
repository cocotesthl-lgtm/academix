import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { getAllPlans } from "@/lib/plans/queries";
import { giftPlanToTenantAction, revokeTenantPlanAction } from "@/lib/plans/actions";
import { relativeTime, absoluteTime } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Founder regala/asigna planes a tenants manualmente — sin pasar por
 * MP. Usado para: embajadores, beta testers, compensaciones, lanzamiento.
 *
 * El plan dura N meses y después vence (el tenant queda en past_due).
 * Para extender, regalás de nuevo.
 */
export default async function GiftPlansPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const search = (sp.q ?? '').trim().toLowerCase();

  const svc = getServiceClient();
  const [plans, { data: tenantsRaw }] = await Promise.all([
    getAllPlans(),
    svc.from('tenants')
      .select('id, slug, name, status, plan_id, billing_period, subscription_status, current_period_end, subscription_notes, owner_user_id')
      .order('created_at', { ascending: false })
      .limit(500)
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenants = (tenantsRaw ?? []) as Array<{
    id: string; slug: string; name: string; status: string;
    plan_id: string | null; billing_period: string | null;
    subscription_status: string | null; current_period_end: string | null;
    subscription_notes: string | null; owner_user_id: string;
  }>;

  // Owners para mostrar email
  const ownerIds = Array.from(new Set(tenants.map((t) => t.owner_user_id)));
  let ownersById = new Map<string, { email: string | null; display_name: string | null }>();
  if (ownerIds.length > 0) {
    const { data: profs } = await svc.from('profiles')
      .select('id, email, display_name').in('id', ownerIds);
    ownersById = new Map(((profs ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>)
      .map((p) => [p.id, p]));
  }

  // Filtro por search
  const filtered = search
    ? tenants.filter((t) => {
        const o = ownersById.get(t.owner_user_id);
        return [t.name, t.slug, o?.email, o?.display_name]
          .filter(Boolean).join(' ').toLowerCase().includes(search);
      })
    : tenants;

  const planById = new Map(plans.map((p) => [p.id, p]));

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Regalar planes</h1>
          <p className="text-white/55 text-sm mt-1">
            Asignale un plan a un tenant sin pasar por MercadoPago. Usalo para embajadores,
            beta testers, compensaciones, etc.
          </p>
        </div>
        <Link href="/plans" className="text-xs text-white/55 hover:text-white underline">← Planes</Link>
      </div>

      {/* Search */}
      <form method="get" className="flex gap-2">
        <input
          type="text" name="q" defaultValue={sp.q ?? ''}
          placeholder="Buscar por nombre, slug o email del owner…"
          className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
        />
        <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold">Buscar</button>
        {search && (
          <Link href="/plans/regalar" className="text-xs text-white/50 self-center underline">Limpiar</Link>
        )}
      </form>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/45">
          Sin tenants con esos filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const owner = ownersById.get(t.owner_user_id);
            const currentPlan = t.plan_id ? planById.get(t.plan_id) : null;
            const hasActivePlan = t.subscription_status === 'active' && t.plan_id;
            const expired = t.current_period_end && new Date(t.current_period_end).getTime() < Date.now();
            return (
              <div key={t.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-white/55">
                      {t.slug} · {owner?.email ?? '—'}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    {hasActivePlan && !expired ? (
                      <>
                        <div>
                          <span className="text-emerald-300 font-semibold">{currentPlan?.name ?? '?'}</span>
                          <span className="text-white/55"> · {t.billing_period}</span>
                        </div>
                        {t.current_period_end && (
                          <div className="text-white/45" title={absoluteTime(t.current_period_end)}>
                            vence {relativeTime(t.current_period_end)}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-white/40">Sin plan activo</span>
                    )}
                  </div>
                </div>

                {t.subscription_notes && (
                  <div className="text-[11px] text-fuchsia-200/80 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded px-2 py-1 mb-3">
                    📝 {t.subscription_notes}
                  </div>
                )}

                {/* Form para regalar */}
                <form action={giftPlanToTenantAction} className="flex flex-wrap items-end gap-2 pt-3 border-t border-white/5">
                  <input type="hidden" name="tenant_id" value={t.id} />
                  <div className="min-w-[140px]">
                    <label className="block text-[10px] uppercase tracking-wider text-white/45 mb-1">Plan</label>
                    <select name="plan_id" required defaultValue={t.plan_id ?? ''}
                      className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm">
                      <option value="" disabled>Elegir…</option>
                      {plans.filter((p) => p.is_active).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[110px]">
                    <label className="block text-[10px] uppercase tracking-wider text-white/45 mb-1">Período</label>
                    <select name="billing_period" defaultValue="monthly"
                      className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm">
                      <option value="monthly">Mensual</option>
                      <option value="annual">Anual</option>
                    </select>
                  </div>
                  <div className="min-w-[80px]">
                    <label className="block text-[10px] uppercase tracking-wider text-white/45 mb-1">Meses</label>
                    <input name="months" type="number" min={1} max={60} defaultValue={1} required
                      className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] uppercase tracking-wider text-white/45 mb-1">Nota (opcional)</label>
                    <input name="notes" type="text" maxLength={500}
                      placeholder="Regalo lanzamiento, embajador, etc"
                      className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
                  </div>
                  <button className="rounded bg-fuchsia-500 text-white px-4 py-1.5 text-sm font-semibold hover:bg-fuchsia-400">
                    🎁 Regalar
                  </button>
                  {hasActivePlan && (
                    <button
                      formAction={revokeTenantPlanAction}
                      className="rounded border border-red-500/30 text-red-300 px-3 py-1.5 text-xs hover:bg-red-500/10"
                      title="Quita el plan actual y deja el tenant sin plan"
                    >
                      Revocar
                    </button>
                  )}
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
