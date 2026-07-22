import { getServiceClient } from '@/lib/supabase/service';
import { cloneLinkForAffiliateAction } from '@/lib/pay-links/actions';
import { tenantOrigin } from '@/lib/env';
import { CopyLinkButton } from '@/components/owner/pay-links/CopyLinkButton';

type ParentLink = {
  id: string;
  code: string;
  title: string;
  amount_cents: number;
  currency: string;
  affiliate_commission_pct: number | null;
};

type ChildLink = {
  id: string;
  code: string;
  parent_link_id: string;
  uses_count: number;
  revenue_cents: number;
};

/**
 * Bloque para el panel de afiliado. Lista los pay-links del tenant que
 * tengan allow_affiliates=true, y para cada uno muestra el link personal
 * del afiliado (creado a demanda con cloneLinkForAffiliateAction).
 *
 * Renderiza NADA si:
 *  - El módulo pay_links está off en el tenant
 *  - No hay ningún link con allow_affiliates=true
 *
 * Server component — hace la query en render, sin fetch client-side.
 */
export async function PayLinksAffiliateSection({
  tenantId, tenantSlug, userId, tenantCommissionPct
}: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  /** Fallback si el link no tiene su propio commission_pct — el % global
   *  del tenant. Se muestra al afiliado para que sepa qué se llevaría. */
  tenantCommissionPct: number;
}) {
  const svc = getServiceClient();
  let parents: ParentLink[] = [];
  let mine: ChildLink[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parentsRes = await (svc.from('pay_links') as any)
      .select('id, code, title, amount_cents, currency, affiliate_commission_pct')
      .eq('tenant_id', tenantId)
      .eq('allow_affiliates', true)
      .eq('status', 'active')
      .is('parent_link_id', null)
      .order('created_at', { ascending: false });
    parents = (parentsRes.data ?? []) as ParentLink[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mineRes = await (svc.from('pay_links') as any)
      .select('id, code, parent_link_id, uses_count, revenue_cents')
      .eq('tenant_id', tenantId).eq('affiliate_user_id', userId);
    mine = (mineRes.data ?? []) as ChildLink[];
  } catch { /* migración pendiente — silencio */ }

  if (parents.length === 0) return null;

  const mineByParent = new Map<string, ChildLink>();
  for (const c of mine) mineByParent.set(c.parent_link_id, c);
  const origin = tenantOrigin(tenantSlug);

  return (
    <section>
      <h2 className="text-xl font-semibold mb-1">🔗 Links de pago del sitio</h2>
      <p className="text-sm text-black/60 mb-4">
        Compartilos y quedate con la comisión de cada pago que llegue por tu link.
      </p>
      <div className="space-y-3">
        {parents.map((p) => {
          const child = mineByParent.get(p.id);
          const pct = p.affiliate_commission_pct ?? tenantCommissionPct;
          const commissionCents = Math.round((p.amount_cents * pct) / 100);
          const myUrl = child ? `${origin}/pay/${child.code}` : null;
          return (
            <div key={p.id} className="rounded-xl border border-black/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-xs text-black/50 mt-0.5">
                    {(p.amount_cents / 100).toLocaleString('es-AR')} {p.currency} · te llevás
                    <strong className="text-emerald-700 mx-1">
                      {pct.toFixed(0)}% (${(commissionCents / 100).toLocaleString('es-AR')})
                    </strong>
                    por venta
                  </div>
                </div>
                {!child && (
                  <form action={cloneLinkForAffiliateAction}>
                    <input type="hidden" name="parent_link_id" value={p.id} />
                    <button className="text-sm px-3 py-1.5 rounded bg-black text-white hover:bg-black/80 whitespace-nowrap">
                      Generar mi link
                    </button>
                  </form>
                )}
              </div>
              {child && myUrl && (
                <div className="mt-3 pt-3 border-t border-black/10">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <div className="text-[10px] uppercase tracking-wider text-black/45 mb-0.5">Tu link</div>
                      <div className="font-mono text-sm truncate">{myUrl}</div>
                    </div>
                    <div className="text-xs text-black/60">
                      {child.uses_count} pagos · ${(child.revenue_cents / 100).toLocaleString('es-AR')} vendidos
                    </div>
                    <CopyLinkButton url={myUrl} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
