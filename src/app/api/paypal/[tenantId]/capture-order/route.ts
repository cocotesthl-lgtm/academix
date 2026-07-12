import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getPayPalAccessToken, paypalApiBase, type PayPalMode } from '@/lib/paypal/client';
import { processPayPalCapture } from '@/lib/paypal/process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
  order_id: string;
  course_id: string;
};

/**
 * POST /api/paypal/[tenantId]/capture-order
 *
 * Client llama esto en onApprove del Smart Button. Ejecutamos el CAPTURE
 * de la orden en PayPal, luego procesamos la venta.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const body = await req.json().catch(() => null) as Body | null;
  if (!body?.order_id || !body?.course_id) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integ } = await (svc.from('integrations') as any)
    .select('access_token_enc, metadata')
    .eq('tenant_id', tenantId).eq('provider', 'paypal').eq('status', 'connected').maybeSingle();
  if (!integ?.access_token_enc) {
    return NextResponse.json({ error: 'paypal_not_connected' }, { status: 409 });
  }

  const clientId = (integ.metadata as { client_id?: string })?.client_id;
  const mode: PayPalMode = (integ.metadata as { sandbox?: boolean })?.sandbox ? 'sandbox' : 'live';
  if (!clientId) return NextResponse.json({ error: 'paypal_config_incomplete' }, { status: 500 });

  const tok = await getPayPalAccessToken({
    clientId, clientSecret: integ.access_token_enc as string, mode
  });
  if (!tok.ok) {
    return NextResponse.json({ error: 'paypal_auth_failed' }, { status: 500 });
  }

  // Capture the order
  const capResp = await fetch(`${paypalApiBase(mode)}/v2/checkout/orders/${body.order_id}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tok.access_token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture-${body.order_id}` // idempotency
    }
  });
  const capText = await capResp.text();
  if (!capResp.ok) {
    // 422 UNPROCESSABLE_ENTITY es común si ya se capturó — lo tratamos como éxito
    // idempotente e igual procesamos la venta.
    if (capResp.status !== 422) {
      return NextResponse.json({ error: 'paypal_capture_failed', detail: capText.slice(0, 500) }, { status: 502 });
    }
  }

  let capture: {
    id: string;
    status: string;
    payer?: { email_address?: string; name?: { given_name?: string; surname?: string } };
    purchase_units?: Array<{
      payments?: { captures?: Array<{ id: string; amount: { value: string; currency_code: string } }> };
    }>;
  };
  try {
    capture = JSON.parse(capText);
  } catch {
    return NextResponse.json({ error: 'invalid_paypal_response' }, { status: 502 });
  }

  const captureObj = capture.purchase_units?.[0]?.payments?.captures?.[0];
  if (!captureObj) {
    return NextResponse.json({ error: 'no_capture_in_response' }, { status: 502 });
  }

  const amountCents = Math.round(parseFloat(captureObj.amount.value) * 100);
  const currency = captureObj.amount.currency_code;
  const buyerEmail = capture.payer?.email_address;
  const buyerName = capture.payer?.name
    ? [capture.payer.name.given_name, capture.payer.name.surname].filter(Boolean).join(' ')
    : null;

  if (!buyerEmail) {
    return NextResponse.json({ error: 'no_buyer_email' }, { status: 502 });
  }

  const result = await processPayPalCapture({
    tenantId,
    courseId: body.course_id,
    orderId: body.order_id,
    captureId: captureObj.id,
    amountCents,
    currency,
    buyerEmail,
    buyerName,
    rawPayload: capture
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sale_id: result.saleId, reused: result.reused });
}
