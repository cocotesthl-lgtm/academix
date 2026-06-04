import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getPreapproval, getPayment } from '@/lib/payments/mercadopago';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Integration = {
  access_token_enc: string;
  webhook_secret: string;
};

/**
 * Webhook MP para suscripciones (preapproval).
 *
 * MP envía dos tipos de eventos a este webhook:
 *  - topic=preapproval: cambios de estado de la suscripción
 *    (authorized / paused / cancelled)
 *  - topic=authorized_payment: cada cobro recurrente exitoso (un payment real)
 *
 * Para el primer authorized_payment del preapproval, creamos enrollment +
 * sale (igual que one-time). Cobros siguientes solo agregan sales.
 *
 * Idempotente vía webhook_events (UNIQUE en provider+external_id).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  return NextResponse.json({ ok: true, route: 'mp_preapproval_webhook', tenant_id: tenantId });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const svc = getServiceClient();

  let body: { type?: string; action?: string; data?: { id?: string | number } };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const dataId = body?.data?.id;
  if (!dataId) return NextResponse.json({ ok: true, note: 'no data.id' });

  // Lookup integration
  const { data: integration } = await svc
    .from('integrations')
    .select('access_token_enc, webhook_secret')
    .eq('tenant_id', tenantId).eq('provider', 'mercadopago').eq('status', 'connected')
    .maybeSingle<Integration>();
  if (!integration) return NextResponse.json({ error: 'no_integration' }, { status: 404 });

  // Idempotency
  const eventPayload = {
    provider: 'mercadopago_preapproval',
    external_id: `${body.type ?? 'unknown'}:${dataId}`,
    tenant_id: tenantId,
    payload: body
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dupErr } = await (svc.from('webhook_events') as any).insert(eventPayload);
  if (dupErr) {
    if (dupErr.message.includes('duplicate')) return NextResponse.json({ ok: true, note: 'duplicate' });
    return NextResponse.json({ error: dupErr.message }, { status: 500 });
  }

  const topic = body.type ?? body.action;

  // ─── topic=preapproval: cambio de estado de la suscripción ───
  if (topic?.includes('preapproval') && !topic.includes('authorized_payment')) {
    try {
      const pre = await getPreapproval(String(dataId), integration.access_token_enc);
      // Actualizar subscription local
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('subscriptions') as any)
        .update({
          status: pre.status,
          next_billing_at: pre.next_payment_date,
          ...(pre.status === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}),
          raw_payload: pre
        })
        .eq('preapproval_id', String(dataId))
        .eq('tenant_id', tenantId);
      return NextResponse.json({ ok: true, topic, status: pre.status });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 502 });
    }
  }

  // ─── topic=authorized_payment: un cobro confirmado ───
  if (topic?.includes('authorized_payment') || topic === 'payment') {
    try {
      const payment = await getPayment(String(dataId), integration.access_token_enc);
      if (payment.status !== 'approved') {
        return NextResponse.json({ ok: true, note: `payment status ${payment.status}` });
      }
      // El payment tiene external_reference con el formato courseId::userId::affLinkId
      const ref = payment.external_reference ?? '';
      const [courseId, userIdRaw] = ref.split('::');
      const buyerUserId = userIdRaw && userIdRaw !== 'anon' ? userIdRaw : null;
      if (!courseId) return NextResponse.json({ ok: true, note: 'no course in external_reference' });

      // Insertar sale (cada cobro recurrente es una sale propia, idempotente)
      const salePayload = {
        tenant_id: tenantId,
        course_id: courseId,
        buyer_user_id: buyerUserId,
        external_provider: 'mercadopago_preapproval',
        external_id: String(payment.id),
        amount_gross_cents: Math.round(payment.transaction_amount * 100),
        amount_net_cents: Math.round(payment.transaction_amount * 100),
        currency: payment.currency_id,
        status: 'paid',
        raw_payload: payment,
        occurred_at: payment.date_approved ?? payment.date_created,
        buyer_email: payment.payer?.email ?? null
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: saleErr } = await (svc.from('sales') as any).insert(salePayload);
      if (saleErr && !saleErr.message.toLowerCase().includes('duplicate')) {
        return NextResponse.json({ error: saleErr.message }, { status: 502 });
      }

      // Si es el primer cobro de esta subscription → crear enrollment
      if (buyerUserId) {
        const { data: existing } = await svc.from('enrollments')
          .select('id').eq('tenant_id', tenantId).eq('course_id', courseId).eq('user_id', buyerUserId)
          .maybeSingle<{ id: string }>();
        if (!existing) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (svc.from('enrollments') as any).insert({
            tenant_id: tenantId,
            course_id: courseId,
            user_id: buyerUserId,
            source: 'direct',
            status: 'active',
            buyer_email: payment.payer?.email ?? null
          });
        }
      }

      // Marcar la subscription como authorized (primer cobro confirma autorización)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('subscriptions') as any)
        .update({ status: 'authorized' })
        .eq('tenant_id', tenantId)
        .eq('course_id', courseId)
        .eq('user_id', buyerUserId);

      return NextResponse.json({ ok: true, topic: 'authorized_payment' });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, note: `ignored topic ${topic}` });
}
