import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { verifyMercadoPagoSignature } from '@/lib/payments/signatures';
import { getPayment } from '@/lib/payments/mercadopago';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Receives notifications from the PLATFORM's MercadoPago account when an owner
 * pays their accrued commission debt. Verifies signature against
 * PLATFORM_MP_WEBHOOK_SECRET, fetches the payment with the platform token,
 * inserts debt_payments row + negative owner_debt_ledger entry, and settles
 * open accrual rows FIFO up to the paid amount.
 */
export async function POST(req: NextRequest) {
  const platformToken = process.env.PLATFORM_MERCADOPAGO_ACCESS_TOKEN;
  const webhookSecret = process.env.PLATFORM_MP_WEBHOOK_SECRET;
  if (!platformToken || !webhookSecret) {
    return NextResponse.json({ error: 'platform_mp_not_configured' }, { status: 500 });
  }

  const raw = await req.text();
  let body: { type?: string; data?: { id?: string | number } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const dataId = body?.data?.id;
  if (!dataId) return NextResponse.json({ ok: true, note: 'no data.id' });

  if (process.env.MP_SKIP_SIG_CHECK !== '1') {
    const valid = verifyMercadoPagoSignature(req.headers, webhookSecret, dataId);
    if (!valid) return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  }

  const svc = getServiceClient();

  // Idempotency
  const eventPayload = {
    provider: 'platform-mp',
    external_id: String(dataId),
    tenant_id: null,
    payload: body
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dupErr } = await (svc.from('webhook_events') as any).insert(eventPayload);
  if (dupErr && dupErr.message.includes('duplicate')) {
    return NextResponse.json({ ok: true, note: 'duplicate' });
  }

  // Fetch payment via platform token
  let payment;
  try {
    payment = await getPayment(dataId, platformToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch_failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  if (payment.status !== 'approved') {
    return NextResponse.json({ ok: true, note: `status ${payment.status}` });
  }

  const tenantId = (payment.metadata?.tenant_id as string | undefined) ?? null;
  if (!tenantId) return NextResponse.json({ error: 'no_tenant_in_metadata' }, { status: 400 });

  const paidCents = Math.round(payment.transaction_amount * 100);

  // Insert debt_payments (idempotent on external_provider+external_id)
  const dpPayload = {
    tenant_id: tenantId,
    amount_cents: paidCents,
    external_provider: 'mercadopago-platform',
    external_id: String(payment.id),
    status: 'paid',
    paid_at: payment.date_approved ?? new Date().toISOString()
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dpErr } = await (svc.from('debt_payments') as any).insert(dpPayload);
  if (dpErr && !dpErr.message.includes('duplicate')) {
    return NextResponse.json({ error: dpErr.message }, { status: 500 });
  }

  // Compute current balance, insert negative ledger row
  const { data: ledgerSum } = await svc
    .from('owner_debt_ledger')
    .select('amount_cents')
    .eq('tenant_id', tenantId);
  const currentBalance = ((ledgerSum ?? []) as Array<{ amount_cents: number }>)
    .reduce((s, r) => s + Number(r.amount_cents), 0);
  const balanceAfter = currentBalance - paidCents;

  const negativePayload = {
    tenant_id: tenantId,
    sale_id: null,
    type: 'debt_payment',
    amount_cents: -paidCents,
    balance_after_cents: balanceAfter,
    commission_rate_applied: null,
    status: 'open',
    notes: `payment external_id=${payment.id}`
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('owner_debt_ledger') as any).insert(negativePayload);

  // FIFO settlement: mark oldest open accrual rows as settled until amount consumed
  const { data: openRows } = await svc
    .from('owner_debt_ledger')
    .select('id, amount_cents')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .eq('type', 'commission_accrued')
    .order('created_at', { ascending: true });

  let remaining = paidCents;
  const toSettle: string[] = [];
  for (const row of (openRows ?? []) as Array<{ id: string; amount_cents: number }>) {
    if (remaining <= 0) break;
    if (Number(row.amount_cents) <= remaining) {
      toSettle.push(row.id);
      remaining -= Number(row.amount_cents);
    } else {
      // Partial — leave open (sub-row split deferred to future fix)
      break;
    }
  }
  if (toSettle.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('owner_debt_ledger') as any)
      .update({ status: 'settled' })
      .in('id', toSettle);
  }

  // If balance hit zero, reactivate suspended tenant
  if (balanceAfter <= 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenants') as any)
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .eq('status', 'suspended');
  }

  return NextResponse.json({ ok: true, settled: toSettle.length });
}
