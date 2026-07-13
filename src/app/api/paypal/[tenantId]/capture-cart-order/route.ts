import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getPayPalAccessToken, paypalApiBase, type PayPalMode } from '@/lib/paypal/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
  paypal_order_id: string;
};

/**
 * POST /api/paypal/[tenantId]/capture-cart-order
 *
 * Captura la orden PayPal, marca physical_order como pagada, decrementa
 * stock y (best-effort) manda email al buyer.
 *
 * Reconciliación: el physical_order tiene `notes: paypal:<order_id>` que
 * dejamos al crear. Buscamos por ese tag.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const body = await req.json().catch(() => null) as Body | null;
  if (!body?.paypal_order_id) {
    return NextResponse.json({ error: 'paypal_order_id_required' }, { status: 400 });
  }

  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integ } = await (svc.from('integrations') as any)
    .select('access_token_enc, metadata')
    .eq('tenant_id', tenantId).eq('provider', 'paypal').eq('status', 'connected').maybeSingle();
  if (!integ?.access_token_enc) return NextResponse.json({ error: 'paypal_not_connected' }, { status: 409 });
  const clientId = (integ.metadata as { client_id?: string })?.client_id;
  const mode: PayPalMode = (integ.metadata as { sandbox?: boolean })?.sandbox ? 'sandbox' : 'live';
  if (!clientId) return NextResponse.json({ error: 'paypal_config_incomplete' }, { status: 500 });

  const tok = await getPayPalAccessToken({
    clientId, clientSecret: integ.access_token_enc as string, mode
  });
  if (!tok.ok) return NextResponse.json({ error: 'paypal_auth_failed' }, { status: 500 });

  // Buscar physical_order por el tag notes="paypal:<orderId>"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (svc.from('physical_orders') as any)
    .select('id, status').eq('tenant_id', tenantId)
    .eq('notes', `paypal:${body.paypal_order_id}`).maybeSingle();
  if (!order) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });

  // Idempotencia: si ya se procesó, devolvemos ok sin hacer nada
  if ((order as { status: string }).status === 'paid') {
    return NextResponse.json({ ok: true, order_id: (order as { id: string }).id, reused: true });
  }

  // Capture PayPal order
  const capResp = await fetch(`${paypalApiBase(mode)}/v2/checkout/orders/${body.paypal_order_id}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tok.access_token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture-cart-${body.paypal_order_id}`
    }
  });
  const capText = await capResp.text();
  // 422 UNPROCESSABLE_ENTITY es común si ya fue capturado — lo tratamos ok
  if (!capResp.ok && capResp.status !== 422) {
    return NextResponse.json({ error: 'paypal_capture_failed', detail: capText.slice(0, 500) }, { status: 502 });
  }

  const orderId = (order as { id: string }).id;

  // Marcar orden pagada + resolver buyer_user_id si existe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRow } = await (svc.from('physical_orders') as any)
    .select('buyer_email').eq('id', orderId).maybeSingle();
  const buyerEmail = (orderRow as { buyer_email: string } | null)?.buyer_email ?? null;
  let buyerUserId: string | null = null;
  if (buyerEmail) {
    const { data: prof } = await svc.from('profiles').select('id')
      .eq('email', buyerEmail).maybeSingle<{ id: string }>();
    buyerUserId = prof?.id ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('physical_orders') as any).update({
    status: 'paid',
    payment_id: body.paypal_order_id,
    paid_at: new Date().toISOString(),
    buyer_user_id: buyerUserId,
    updated_at: new Date().toISOString()
  }).eq('id', orderId).eq('tenant_id', tenantId);

  // Decrementar stock por item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (svc.from('physical_order_items') as any)
    .select('product_id, variant_id, qty').eq('order_id', orderId);
  for (const it of ((items ?? []) as Array<{ product_id: string | null; variant_id: string | null; qty: number }>)) {
    if (!it.product_id) continue;
    if (it.variant_id) {
      const { data: v } = await svc.from('product_variants')
        .select('stock_qty').eq('id', it.variant_id).maybeSingle<{ stock_qty: number }>();
      if (v) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('product_variants') as any)
          .update({ stock_qty: Math.max(0, v.stock_qty - it.qty) }).eq('id', it.variant_id);
      }
    } else {
      const { data: p } = await svc.from('physical_products')
        .select('stock_qty').eq('id', it.product_id).maybeSingle<{ stock_qty: number }>();
      if (p) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('physical_products') as any)
          .update({ stock_qty: Math.max(0, p.stock_qty - it.qty) }).eq('id', it.product_id);
      }
    }
    // Log stock movement (best-effort)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('product_stock_movements') as any).insert({
        tenant_id: tenantId, product_id: it.product_id, variant_id: it.variant_id,
        delta: -it.qty, reason: 'sale', order_id: orderId,
        note: `PayPal cart order ${body.paypal_order_id}`
      });
    } catch { /* migration */ }
  }

  return NextResponse.json({ ok: true, order_id: orderId });
}
