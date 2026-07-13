import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getPayPalAccessToken, paypalApiBase, type PayPalMode } from '@/lib/paypal/client';
import { resolvePayPalPriceCents } from '@/lib/paypal/price';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
  course_id: string;
  buyer_email?: string;
};

/**
 * POST /api/paypal/[tenantId]/create-order
 *
 * Crea una orden en PayPal para un curso. El precio y currency se leen
 * server-side desde la row del curso — nunca del cliente para evitar
 * manipulación. Devuelve el orderId que el frontend le pasa a Smart Buttons.
 *
 * Flow:
 *   1. Cliente clickea PayPal Button → llama esta ruta
 *   2. Devolvemos orderId
 *   3. PayPal SDK abre popup, buyer paga
 *   4. onApprove → cliente llama /capture-order/{orderId} con course_id
 *   5. Ahí procesamos la venta (enroll + wallet + comisiones)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const body = await req.json().catch(() => null) as Body | null;
  if (!body?.course_id) {
    return NextResponse.json({ error: 'course_id_required' }, { status: 400 });
  }

  const svc = getServiceClient();

  // Load tenant PayPal integration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integ } = await (svc.from('integrations') as any)
    .select('access_token_enc, metadata')
    .eq('tenant_id', tenantId)
    .eq('provider', 'paypal')
    .eq('status', 'connected')
    .maybeSingle();
  if (!integ?.access_token_enc) {
    return NextResponse.json({ error: 'paypal_not_connected' }, { status: 409 });
  }

  const clientId = (integ.metadata as { client_id?: string })?.client_id;
  const mode: PayPalMode = (integ.metadata as { sandbox?: boolean })?.sandbox ? 'sandbox' : 'live';
  if (!clientId) {
    return NextResponse.json({ error: 'paypal_config_incomplete' }, { status: 500 });
  }

  // Load course price. Defensivo: si migration 0065 no corrió, hacemos
  // el retry sin paypal_price_cents y caemos al fallback.
  let course: {
    id: string; title: string; price_cents: number;
    currency: string; status: string; paypal_price_cents: number | null;
  } | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('courses') as any)
      .select('id, title, price_cents, currency, status, paypal_price_cents')
      .eq('id', body.course_id).eq('tenant_id', tenantId).maybeSingle();
    course = data;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('courses') as any)
      .select('id, title, price_cents, currency, status')
      .eq('id', body.course_id).eq('tenant_id', tenantId).maybeSingle();
    if (data) course = { ...data, paypal_price_cents: null };
  }
  if (!course) return NextResponse.json({ error: 'course_not_found' }, { status: 404 });
  if (course.status === 'draft') return NextResponse.json({ error: 'course_not_published' }, { status: 409 });
  if (!course.price_cents || course.price_cents <= 0) {
    return NextResponse.json({ error: 'course_is_free_no_paypal' }, { status: 400 });
  }

  // Currency de cobro: la que el owner eligió al conectar PayPal.
  const paypalCurrency = ((integ.metadata as { currency?: string })?.currency || 'USD').toUpperCase();

  // Config de conversión automática global del tenant. Defensivo:
  // si migration 0066 no corrió, se queda en false y no rompe.
  let autoConvert = false;
  let conversionRate: number | null = null;
  let roundCents = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (svc.from('tenants') as any)
      .select('paypal_auto_convert, paypal_conversion_rate, paypal_round_cents')
      .eq('id', tenantId).maybeSingle();
    autoConvert = !!(t as { paypal_auto_convert?: boolean } | null)?.paypal_auto_convert;
    const rate = (t as { paypal_conversion_rate?: string | number | null } | null)?.paypal_conversion_rate;
    conversionRate = rate != null ? Number(rate) : null;
    roundCents = !!(t as { paypal_round_cents?: boolean } | null)?.paypal_round_cents;
  } catch { /* migration 0066 pendiente */ }

  // Resolver precio: 1º override manual del producto, 2º conversión
  // automática, 3º fallback 1:1 (comportamiento histórico).
  const priceForPaypal = resolvePayPalPriceCents({
    localPriceCents: course.price_cents,
    productOverrideCents: course.paypal_price_cents ?? null,
    tenantAutoConvert: autoConvert,
    tenantConversionRate: conversionRate,
    tenantRoundCents: roundCents
  });
  const amount = (priceForPaypal / 100).toFixed(2);

  // Get access token
  const tok = await getPayPalAccessToken({
    clientId, clientSecret: integ.access_token_enc as string, mode
  });
  if (!tok.ok) {
    return NextResponse.json({ error: 'paypal_auth_failed', detail: tok.error }, { status: 500 });
  }

  // Create order
  const orderResp = await fetch(`${paypalApiBase(mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tok.access_token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `${tenantId}-${body.course_id}-${Date.now()}`
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: body.course_id,
        description: course.title?.slice(0, 127) || 'Compra',
        amount: {
          currency_code: paypalCurrency,
          value: amount
        },
        custom_id: `${tenantId}:${body.course_id}` // para reconciliar en webhook
      }],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: 'OfferNow'
      }
    })
  });

  const orderText = await orderResp.text();
  if (!orderResp.ok) {
    return NextResponse.json({ error: 'paypal_order_create_failed', detail: orderText.slice(0, 500) }, { status: 502 });
  }
  const order = JSON.parse(orderText) as { id: string };
  return NextResponse.json({ order_id: order.id });
}
