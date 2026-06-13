import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import {
  getPreapproval, getPayment, verifyMpWebhookSignature
} from '@/lib/payments/platform-mp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Webhook de MP para eventos de suscripciones (plataforma).
 * MP envia eventos cuando:
 *  - "subscription_preapproval": la preapproval cambió de estado
 *    (pending → authorized → paused → cancelled)
 *  - "subscription_authorized_payment" / "payment": cobro mensual ejecutado
 *
 * Lo que hacemos:
 * 1. Verificar firma del webhook (HMAC con secret).
 * 2. Idempotencia: si el evento ya lo procesamos, devolver 200.
 * 3. Fetch del recurso desde MP (preapproval o payment) para tener
 *    el estado actualizado.
 * 4. Actualizar nuestra tabla platform_subscriptions + tenants.
 */
export async function POST(req: NextRequest) {
  const sigHeader = req.headers.get('x-signature');
  const requestId = req.headers.get('x-request-id');

  // MP manda el dataId via querystring en algunos eventos, en body otros
  const url = new URL(req.url);
  const dataIdFromQs = url.searchParams.get('data.id') ?? url.searchParams.get('id');
  const eventType = url.searchParams.get('type') ?? url.searchParams.get('topic');

  let parsedBody: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try { parsedBody = await req.json(); } catch { /* body vacío en algunos pings */ }

  const dataId = dataIdFromQs ?? (parsedBody.data?.id ? String(parsedBody.data.id) : null);
  const type = eventType ?? parsedBody.type ?? '';

  // Verificar firma (modo permisivo si secret no configurado)
  if (!verifyMpWebhookSignature({ signatureHeader: sigHeader, requestId, dataId })) {
    console.warn('[platform-mp webhook] signature mismatch', { type, dataId });
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  if (!dataId || !type) {
    return NextResponse.json({ ok: true, ignored: 'no_data' });
  }

  const svc = getServiceClient();

  // Idempotencia: si ya procesamos este evento, salir
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: idemErr } = await (svc.from('platform_webhook_events') as any)
      .insert({ provider: 'mercadopago', external_id: `${type}:${dataId}:${requestId ?? ''}`, raw: parsedBody });
    if (idemErr && !idemErr.message?.includes('duplicate')) {
      // Tabla puede no existir todavia — no rompemos por eso
      console.warn('[platform-mp webhook] idempotency table missing or error:', idemErr.message);
    } else if (idemErr) {
      return NextResponse.json({ ok: true, already_processed: true });
    }
  } catch { /* tabla no existe */ }

  try {
    if (type === 'subscription_preapproval' || type.includes('preapproval')) {
      await handlePreapprovalEvent(svc, dataId);
    } else if (type === 'payment' || type.includes('payment')) {
      await handlePaymentEvent(svc, dataId);
    } else {
      console.log('[platform-mp webhook] unknown type:', type);
    }
  } catch (e) {
    console.error('[platform-mp webhook] handler error:', e);
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Update del estado de la suscripción cuando MP nos avisa.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePreapprovalEvent(svc: any, preapprovalId: string) {
  const preapproval = await getPreapproval(preapprovalId);

  // Mapeo MP status → nuestro status
  // MP: pending | authorized | paused | cancelled
  // Nuestro: trial | active | paused | cancelled | past_due
  let subStatus: string;
  switch (preapproval.status) {
    case 'authorized': subStatus = 'active'; break;
    case 'paused': subStatus = 'paused'; break;
    case 'cancelled': subStatus = 'cancelled'; break;
    default: subStatus = 'pending'; break;
  }

  // Update platform_subscriptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('platform_subscriptions') as any).update({
    status: subStatus,
    raw_payload: preapproval,
    updated_at: new Date().toISOString()
  }).eq('mp_preapproval_id', preapprovalId);

  // Update tenant — buscamos por external_reference si la tenemos
  // Formato: "tenant_id::plan_id::period::promo_code?"
  if (preapproval.external_reference) {
    const parts = preapproval.external_reference.split('::');
    const tenantId = parts[0];
    const planId = parts[1];
    const period = parts[2] === 'annual' ? 'annual' : 'monthly';

    if (tenantId && planId) {
      const tenantUpdate: Record<string, unknown> = {
        plan_id: planId,
        billing_period: period,
        subscription_status: subStatus === 'active' ? 'active' : subStatus
      };
      if (subStatus === 'active') {
        // Ya autorizada: setear current_period_end según frequency
        const monthsAhead = period === 'annual' ? 12 : 1;
        const end = new Date();
        end.setMonth(end.getMonth() + monthsAhead);
        tenantUpdate.current_period_end = end.toISOString();
        tenantUpdate.trial_ends_at = null;
        tenantUpdate.last_paid_at = new Date().toISOString();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('tenants') as any).update(tenantUpdate).eq('id', tenantId);
    }
  }
}

/**
 * Cobro mensual: cuando MP cobra el mes a la tarjeta, nos avisa.
 * Acumulamos el cobro + extendemos current_period_end del tenant.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentEvent(svc: any, paymentId: string) {
  const payment = await getPayment(paymentId);
  if (payment.status !== 'approved') return;

  // Si tiene external_reference, lo linkeamos al tenant
  // (MP repite el external_reference del preapproval en los payments asociados)
  const extRef = payment.external_reference;
  if (!extRef) return;
  const parts = extRef.split('::');
  const tenantId = parts[0];
  const planId = parts[1];
  const period = parts[2] === 'annual' ? 'annual' : 'monthly';

  if (!tenantId || !planId) return;

  // Extender period_end
  const monthsAhead = period === 'annual' ? 12 : 1;
  const end = new Date();
  end.setMonth(end.getMonth() + monthsAhead);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    subscription_status: 'active',
    current_period_end: end.toISOString(),
    last_paid_at: new Date().toISOString()
  }).eq('id', tenantId);

  // Guardar registro del pago
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('platform_subscription_payments') as any).insert({
    tenant_id: tenantId,
    plan_id: planId,
    mp_payment_id: String(payment.id),
    amount_cents: Math.round(payment.transaction_amount * 100),
    currency: payment.currency_id,
    status: 'paid',
    occurred_at: payment.date_approved ?? payment.date_created,
    raw_payload: payment
  });
}

// Permitir GET para que MP haga health check
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'platform-mp subscription webhook' });
}
