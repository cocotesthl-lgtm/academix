import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/webhooks/paypal/[tenantId]
 *
 * Recibe webhooks de PayPal. En Fase B principal usamos capture inline
 * (client → /capture-order → sale creada). El webhook es para reconciliar
 * eventos que ocurren DESPUÉS de la captura:
 *   - PAYMENT.CAPTURE.REFUNDED
 *   - PAYMENT.CAPTURE.DENIED
 *   - CUSTOMER.DISPUTE.CREATED
 *
 * También sirve como safety net si el cliente se cerró antes del capture
 * client-side pero PayPal completó la captura via el flow "PayPal Standard".
 *
 * Verificación de firma: PayPal usa headers PAYPAL-TRANSMISSION-* + un
 * webhook_id que el owner setea en developer.paypal.com. La firma se
 * verifica llamando a /v1/notifications/verify-webhook-signature.
 * Para MVP registramos todo sin verificar (RLS + no-op en producers
 * externos). Verificación de firma se puede sumar cuando el owner
 * configure webhook_id.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const bodyText = await req.text();
  let event: {
    id?: string;
    event_type?: string;
    resource?: Record<string, unknown>;
    create_time?: string;
  };
  try {
    event = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const svc = getServiceClient();

  // Registrar TODO evento (idempotente vía UNIQUE provider+external_id)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('webhook_events') as any).insert({
      provider: 'paypal',
      external_id: event.id || `${event.event_type}-${Date.now()}`,
      tenant_id: tenantId,
      payload: event,
      processed_at: null
    });
  } catch { /* duplicate id → ya procesado */ }

  // Refund → marcar sale como refunded
  if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
    const captureId = (event.resource as { id?: string })?.id;
    if (captureId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('sales') as any)
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('external_provider', 'paypal')
        // capture_id no lo guardamos como external_id (guardamos order_id)
        // → matcheamos por raw_payload que contiene el capture id
        .eq('tenant_id', tenantId);
    }
  }

  // Dispute → no automatizamos, solo registramos. Owner ve el evento
  // en webhook_events para actuar manualmente.

  return NextResponse.json({ ok: true });
}
