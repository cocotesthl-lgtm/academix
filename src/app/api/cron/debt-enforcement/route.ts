import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COLLECTION_THRESHOLD = 200_000_00;     // ARS 200.000 in cents
const GRACE_DAYS = 14;

/**
 * Hit daily by Vercel Cron (or any scheduler) with header
 * Authorization: Bearer <CRON_SECRET>.
 *
 * For every active tenant whose oldest open accrual is >= GRACE_DAYS old AND
 * whose balance >= COLLECTION_THRESHOLD, set status='suspended' and audit.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const svc = getServiceClient();
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Pull all active tenants with ledger rows
  const { data: tenants } = await svc
    .from('tenants')
    .select('id, status')
    .eq('status', 'active');

  const suspended: string[] = [];
  for (const t of ((tenants ?? []) as Array<{ id: string; status: string }>)) {
    const { data: ledgerSum } = await svc
      .from('owner_debt_ledger')
      .select('amount_cents')
      .eq('tenant_id', t.id);
    const balance = ((ledgerSum ?? []) as Array<{ amount_cents: number }>)
      .reduce((s, r) => s + Number(r.amount_cents), 0);
    if (balance < COLLECTION_THRESHOLD) continue;

    const { data: oldestOpen } = await svc
      .from('owner_debt_ledger')
      .select('created_at')
      .eq('tenant_id', t.id)
      .eq('status', 'open')
      .eq('type', 'commission_accrued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ created_at: string }>();
    if (!oldestOpen || oldestOpen.created_at > cutoff) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenants') as any)
      .update({ status: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', t.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('audit_log') as any).insert({
      tenant_id: t.id,
      action: 'tenant.suspended_by_cron',
      target_type: 'tenant',
      target_id: t.id,
      reason: `Auto-suspended: balance >= ${COLLECTION_THRESHOLD/100} ARS for ${GRACE_DAYS}+ days`
    });

    suspended.push(t.id);
  }

  return NextResponse.json({ ok: true, suspended_count: suspended.length, suspended });
}
