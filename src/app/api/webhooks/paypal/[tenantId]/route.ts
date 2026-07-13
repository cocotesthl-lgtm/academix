import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { verifyPayPalWebhookSignature, type PayPalMode } from '@/lib/paypal/client';

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
 * Seguridad (Fase C.2):
 * Si el tenant configuró webhook_id al conectar PayPal, verificamos la
 * firma con la API oficial (/v1/notifications/verify-webhook-signature).
 * Sin webhook_id el owner acepta el trade-off: procesamos igual pero un
 * atacante podría spamear eventos falsos. Registramos el estado de
 * verificación en payload.__verified para auditoría.
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

  // Verificación de firma (opt-in via webhook_id)
  let verified: 'success' | 'skipped' | 'failed' = 'skipped';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: integ } = await (svc.from('integrations') as any)
      .select('access_token_enc, metadata, webhook_secret')
      .eq('tenant_id', tenantId).eq('provider', 'paypal').eq('status', 'connected').maybeSingle();

    const webhookId = integ?.webhook_secret as string | null;
    const clientId = (integ?.metadata as { client_id?: string } | null)?.client_id;
    const mode: PayPalMode = (integ?.metadata as { sandbox?: boolean } | null)?.sandbox ? 'sandbox' : 'live';

    if (webhookId && clientId && integ?.access_token_enc) {
      const h = req.headers;
      const ok = await verifyPayPalWebhookSignature({
        clientId,
        clientSecret: integ.access_token_enc as string,
        mode,
        webhookId,
        headers: {
          transmission_id: h.get('paypal-transmission-id') ?? '',
          transmission_time: h.get('paypal-transmission-time') ?? '',
          cert_url: h.get('paypal-cert-url') ?? '',
          auth_algo: h.get('paypal-auth-algo') ?? '',
          transmission_sig: h.get('paypal-transmission-sig') ?? ''
        },
        eventBody: event
      });
      verified = ok ? 'success' : 'failed';
      // Firma inválida → descartamos. Devolvemos 200 para que PayPal no
      // reintente si es un evento genuino que rebotó por un bug nuestro,
      // pero registramos el intento fallido para investigar.
      if (!ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('webhook_events') as any).insert({
          provider: 'paypal',
          external_id: `unverified-${event.id || Date.now()}`,
          tenant_id: tenantId,
          payload: { ...event, __verified: 'failed' },
          processed_at: null
        });
        return NextResponse.json({ ok: false, error: 'signature_verification_failed' }, { status: 200 });
      }
    }
  } catch { /* si algo falla en el check, seguimos en modo skipped */ }

  // Registrar TODO evento (idempotente vía UNIQUE provider+external_id)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('webhook_events') as any).insert({
      provider: 'paypal',
      external_id: event.id || `${event.event_type}-${Date.now()}`,
      tenant_id: tenantId,
      payload: { ...event, __verified: verified },
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
        .eq('tenant_id', tenantId);
    }
  }

  return NextResponse.json({ ok: true, verified });
}
