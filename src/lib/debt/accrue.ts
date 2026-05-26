import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';

type Sale = {
  id: string;
  tenant_id: string;
  amount_gross_cents: number;
  occurred_at: string;
  status: string;
};

/**
 * Insert a commission_accrued row into owner_debt_ledger for the given paid sale.
 * Idempotent: if a ledger row already references this sale_id with type
 * 'commission_accrued', it returns without re-inserting.
 */
export async function accrueCommissionForSale(saleId: string): Promise<{ ok: boolean; reason?: string }> {
  const svc = getServiceClient();

  const { data: sale } = await svc
    .from('sales')
    .select('id, tenant_id, amount_gross_cents, occurred_at, status')
    .eq('id', saleId)
    .maybeSingle<Sale>();
  if (!sale) return { ok: false, reason: 'sale_not_found' };
  if (sale.status !== 'paid') return { ok: false, reason: 'not_paid' };

  // Idempotency: skip if accrual already exists for this sale.
  const { data: existing } = await svc
    .from('owner_debt_ledger')
    .select('id')
    .eq('sale_id', sale.id)
    .eq('type', 'commission_accrued')
    .maybeSingle();
  if (existing) return { ok: true, reason: 'already_accrued' };

  // Effective rate from SQL function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rateData, error: rateErr } = await (svc.rpc as any)('effective_commission_rate', {
    p_tenant: sale.tenant_id,
    p_at: sale.occurred_at
  });
  if (rateErr) return { ok: false, reason: rateErr.message };
  const rate = Number(rateData ?? 0.05);
  const amount = Math.round(sale.amount_gross_cents * rate);

  // Current balance: sum of all ledger entries for this tenant.
  // (For high-volume tenants we'd cache this; for MVP it's fine.)
  const { data: ledgerSum } = await svc
    .from('owner_debt_ledger')
    .select('amount_cents')
    .eq('tenant_id', sale.tenant_id);
  const currentBalance = ((ledgerSum ?? []) as Array<{ amount_cents: number }>)
    .reduce((s, r) => s + Number(r.amount_cents), 0);
  const balanceAfter = currentBalance + amount;

  const payload = {
    tenant_id: sale.tenant_id,
    sale_id: sale.id,
    type: 'commission_accrued',
    amount_cents: amount,
    balance_after_cents: balanceAfter,
    commission_rate_applied: rate,
    status: 'open'
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('owner_debt_ledger') as any).insert(payload);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function getOwnerBalance(tenantId: string): Promise<number> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('owner_debt_ledger')
    .select('amount_cents')
    .eq('tenant_id', tenantId);
  return ((data ?? []) as Array<{ amount_cents: number }>)
    .reduce((s, r) => s + Number(r.amount_cents), 0);
}
