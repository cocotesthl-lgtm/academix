import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { verifyMercadoPagoSignature } from '@/lib/payments/signatures';
import { getPayment } from '@/lib/payments/mercadopago';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Integration = {
  access_token_enc: string;
  webhook_secret: string;
};

type CourseLookup = {
  id: string;
  tenant_id: string;
  price_cents: number;
  currency: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const svc = getServiceClient();

  // Read raw body once (cannot re-read after json())
  const raw = await req.text();
  let body: { type?: string; data?: { id?: string | number }; action?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const dataId = body?.data?.id;
  if (!dataId) {
    // MP also sends test pings — ack and ignore
    return NextResponse.json({ ok: true, note: 'no data.id' });
  }

  // Lookup integration
  const { data: integration } = await svc
    .from('integrations')
    .select('access_token_enc, webhook_secret')
    .eq('tenant_id', tenantId)
    .eq('provider', 'mercadopago')
    .eq('status', 'connected')
    .maybeSingle<Integration>();
  if (!integration) {
    return NextResponse.json({ error: 'no_integration' }, { status: 404 });
  }

  // Verify signature
  const valid = verifyMercadoPagoSignature(req.headers, integration.webhook_secret, dataId);
  if (!valid) {
    // In dev MP often doesn't send signatures for IPN, allow if explicit allow flag
    if (process.env.MP_SKIP_SIG_CHECK !== '1') {
      return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
    }
  }

  // Idempotency
  const eventKey = `mp:${dataId}`;
  const eventPayload = { provider: 'mercadopago', external_id: String(dataId), tenant_id: tenantId, payload: body };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dupErr } = await (svc.from('webhook_events') as any)
    .insert(eventPayload);
  if (dupErr) {
    // Duplicate => already processed
    if (dupErr.message.includes('duplicate')) {
      return NextResponse.json({ ok: true, note: 'duplicate' });
    }
    return NextResponse.json({ error: dupErr.message }, { status: 500 });
  }
  void eventKey;

  // We only care about payment notifications
  if (body.type && body.type !== 'payment') {
    return NextResponse.json({ ok: true, note: `ignored type ${body.type}` });
  }

  // Fetch full payment
  let payment;
  try {
    payment = await getPayment(dataId, integration.access_token_enc);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch_failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Insert sale (idempotent on external_provider,external_id)
  const buyerEmail = payment.payer?.email ?? null;
  const courseIdFromMeta = (payment.metadata?.course_id as string | undefined) ?? null;

  let courseId: string | null = courseIdFromMeta;
  let resolvedCourse: CourseLookup | null = null;
  if (courseId) {
    const { data: c } = await svc
      .from('courses')
      .select('id, tenant_id, price_cents, currency')
      .eq('id', courseId)
      .eq('tenant_id', tenantId)
      .maybeSingle<CourseLookup>();
    if (c) resolvedCourse = c;
  }

  // Find buyer profile by email (if known)
  let buyerUserId: string | null = (payment.metadata?.buyer_user_id as string | undefined) ?? null;
  if (!buyerUserId && buyerEmail) {
    const { data: prof } = await svc
      .from('profiles')
      .select('id')
      .eq('email', buyerEmail)
      .maybeSingle<{ id: string }>();
    buyerUserId = prof?.id ?? null;
  }

  const status = payment.status === 'approved' ? 'paid'
    : payment.status === 'refunded' ? 'refunded'
    : payment.status === 'pending' ? 'pending'
    : payment.status;

  const salePayload = {
    tenant_id: tenantId,
    course_id: resolvedCourse?.id ?? null,
    buyer_user_id: buyerUserId,
    external_provider: 'mercadopago',
    external_id: String(payment.id),
    amount_gross_cents: Math.round(payment.transaction_amount * 100),
    amount_net_cents: Math.round(payment.transaction_amount * 100),
    currency: payment.currency_id,
    status,
    raw_payload: payment,
    occurred_at: payment.date_approved ?? payment.date_created
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: saleRow, error: saleErr } = await (svc.from('sales') as any)
    .insert(salePayload)
    .select('id')
    .single();
  if (saleErr && !saleErr.message.includes('duplicate')) {
    return NextResponse.json({ error: saleErr.message }, { status: 500 });
  }

  // Auto-enroll on approved payment if we know buyer + course
  if (payment.status === 'approved' && resolvedCourse && buyerUserId) {
    const enrollPayload = {
      tenant_id: tenantId,
      course_id: resolvedCourse.id,
      user_id: buyerUserId,
      source: 'direct',
      sale_id: (saleRow as { id?: string } | null)?.id ?? null,
      status: 'active'
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('enrollments') as any).insert(enrollPayload);
  }

  return NextResponse.json({ ok: true });
}
