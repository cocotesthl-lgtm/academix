import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';
import { resolveAffiliateLinkById, resolveTree } from '@/lib/affiliates/tracking';

type Sale = {
  id: string;
  tenant_id: string;
  course_id: string | null;
  buyer_user_id: string | null;
  amount_gross_cents: number;
  status: string;
};

type TenantSplit = {
  affiliate_budget_pct: number;
  affiliate_split: { l1?: number; l2?: number; l3?: number } | null;
};

const DEFAULT_SPLIT = { l1: 0.20, l2: 0.10, l3: 0.05 };

/**
 * Given a paid sale and the ref_code from MP metadata, resolve the affiliate
 * tree, dedupe attribution, and insert up to 3 affiliate_commissions rows.
 *
 * Idempotent on (sale_id, level).
 */
export async function accrueAffiliateCommissionsForSale(opts: {
  saleId: string;
  linkId: string | null;
}): Promise<{ ok: boolean; reason?: string; commissionsCreated?: number }> {
  if (!opts.linkId) return { ok: true, reason: 'no_link_id' };

  const svc = getServiceClient();

  const { data: sale } = await svc
    .from('sales')
    .select('id, tenant_id, course_id, buyer_user_id, amount_gross_cents, status')
    .eq('id', opts.saleId)
    .maybeSingle<Sale>();
  if (!sale) return { ok: false, reason: 'sale_not_found' };
  if (sale.status !== 'paid') return { ok: false, reason: 'not_paid' };
  if (!sale.course_id) return { ok: false, reason: 'no_course' };

  const link = await resolveAffiliateLinkById(opts.linkId);
  if (!link) return { ok: false, reason: 'invalid_link' };
  if (link.tenant_id !== sale.tenant_id) return { ok: false, reason: 'tenant_mismatch' };
  if (link.course_id !== sale.course_id) return { ok: false, reason: 'course_mismatch' };

  // Anti-fraud: buyer can't be in their own tree
  const { l2, l3 } = await resolveTree(link.affiliate_user_id);
  if (sale.buyer_user_id && [link.affiliate_user_id, l2, l3].includes(sale.buyer_user_id)) {
    return { ok: false, reason: 'self_referral' };
  }

  // Read tenant split config
  const { data: tenant } = await svc
    .from('tenants')
    .select('affiliate_budget_pct, affiliate_split')
    .eq('id', sale.tenant_id)
    .maybeSingle<TenantSplit>();
  const budgetPct = Number(tenant?.affiliate_budget_pct ?? 0.30);
  const split = tenant?.affiliate_split ?? DEFAULT_SPLIT;

  // Create or fetch attribution row
  let attributionId: string | null = null;
  const { data: existingAttr } = await svc
    .from('affiliate_attributions')
    .select('id')
    .eq('sale_id', sale.id)
    .maybeSingle<{ id: string }>();
  if (existingAttr) {
    attributionId = existingAttr.id;
  } else {
    const attrPayload = {
      tenant_id: sale.tenant_id,
      course_id: sale.course_id,
      buyer_user_id: sale.buyer_user_id,
      l1_user_id: link.affiliate_user_id,
      l2_user_id: l2,
      l3_user_id: l3,
      origin_link_id: link.id,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      consumed_at: new Date().toISOString(),
      sale_id: sale.id
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: attrErr } = await (svc.from('affiliate_attributions') as any)
      .insert(attrPayload)
      .select('id')
      .single();
    if (attrErr) return { ok: false, reason: attrErr.message };
    attributionId = (inserted as { id: string }).id;
  }

  // Insert per-level commissions (unique on sale_id,level)
  const levels: Array<{ level: 1 | 2 | 3; userId: string | null; rate: number }> = [
    { level: 1, userId: link.affiliate_user_id, rate: Number(split.l1 ?? DEFAULT_SPLIT.l1) },
    { level: 2, userId: l2, rate: Number(split.l2 ?? DEFAULT_SPLIT.l2) },
    { level: 3, userId: l3, rate: Number(split.l3 ?? DEFAULT_SPLIT.l3) }
  ];

  let created = 0;
  for (const lvl of levels) {
    if (!lvl.userId) continue;
    const affiliatePoolCents = Math.round(sale.amount_gross_cents * budgetPct);
    const amountCents = Math.round(affiliatePoolCents * lvl.rate);
    if (amountCents <= 0) continue;

    const payload = {
      tenant_id: sale.tenant_id,
      sale_id: sale.id,
      attribution_id: attributionId,
      level: lvl.level,
      user_id: lvl.userId,
      rate: lvl.rate,
      amount_cents: amountCents,
      status: 'accrued'
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('affiliate_commissions') as any).insert(payload);
    if (!error) created++;
  }

  return { ok: true, commissionsCreated: created };
}
