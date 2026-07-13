import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getPayPalAccessToken, paypalApiBase, type PayPalMode } from '@/lib/paypal/client';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ItemInput = {
  product_id: string | null;
  variant_id: string | null;
  qty: number;
};

type Body = {
  items: ItemInput[];
  buyer_email: string;
  buyer_name?: string;
  buyer_phone?: string;
  shipping_address?: {
    street?: string; number?: string; city?: string;
    province?: string; postal_code?: string; country?: string;
  };
  buyer_notes?: string;
};

/**
 * POST /api/paypal/[tenantId]/create-cart-order
 *
 * Checkout PayPal-only para carrito multi-item. Scope reducido vs el
 * endpoint MP: no promos, no gift cards, no cálculo de shipping rate.
 * El owner arregla envío por fuera contactando al buyer.
 *
 * Flow:
 *   1. Valida items + stock
 *   2. Calcula total con paypal_price_cents (fallback price_cents)
 *   3. Crea physical_order (status='pending') + physical_order_items
 *   4. Crea orden PayPal, guarda su ID en order.notes para reconciliar
 *      en el capture
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const body = await req.json().catch(() => null) as Body | null;
  if (!body?.items || body.items.length === 0) {
    return NextResponse.json({ error: 'cart_empty' }, { status: 400 });
  }
  if (!body.buyer_email?.includes('@')) {
    return NextResponse.json({ error: 'buyer_email_required' }, { status: 400 });
  }

  const svc = getServiceClient();

  // PayPal integration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integ } = await (svc.from('integrations') as any)
    .select('access_token_enc, metadata')
    .eq('tenant_id', tenantId).eq('provider', 'paypal').eq('status', 'connected').maybeSingle();
  if (!integ?.access_token_enc) {
    return NextResponse.json({ error: 'paypal_not_connected' }, { status: 409 });
  }
  const clientId = (integ.metadata as { client_id?: string })?.client_id;
  const mode: PayPalMode = (integ.metadata as { sandbox?: boolean })?.sandbox ? 'sandbox' : 'live';
  const paypalCurrency = ((integ.metadata as { currency?: string })?.currency || 'USD').toUpperCase();
  if (!clientId) return NextResponse.json({ error: 'paypal_config_incomplete' }, { status: 500 });

  // Load products
  const productIds = Array.from(new Set(body.items.map((i) => i.product_id).filter((v): v is string => !!v))).slice(0, 30);
  if (productIds.length === 0) {
    return NextResponse.json({ error: 'no_valid_products' }, { status: 400 });
  }

  // Traer paypal_price_cents defensivamente (0065)
  let productsRaw: unknown[] | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (svc.from('physical_products') as any)
      .select('id, title, price_cents, currency, stock_qty, track_stock, requires_shipping, status, paypal_price_cents')
      .eq('tenant_id', tenantId).in('id', productIds);
    productsRaw = res.data;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (svc.from('physical_products') as any)
      .select('id, title, price_cents, currency, stock_qty, track_stock, requires_shipping, status')
      .eq('tenant_id', tenantId).in('id', productIds);
    productsRaw = res.data;
  }
  type Prod = {
    id: string; title: string; price_cents: number; currency: string;
    stock_qty: number; track_stock: boolean; requires_shipping: boolean; status: string;
    paypal_price_cents?: number | null;
  };
  const products = ((productsRaw ?? []) as Prod[]).filter((p) => p.status === 'published');
  const productById = new Map(products.map((p) => [p.id, p]));

  const variantIds = body.items.map((i) => i.variant_id).filter((v): v is string => !!v);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: variantsRaw } = variantIds.length > 0
    ? await (svc.from('product_variants') as any)
      .select('id, product_id, name, price_cents, stock_qty, sku').in('id', variantIds)
    : { data: [] };
  type Variant = { id: string; product_id: string; name: string; price_cents: number | null; stock_qty: number; sku: string | null };
  const variantById = new Map(((variantsRaw ?? []) as Variant[]).map((v) => [v.id, v]));

  // Build items + validate stock. Precio PayPal = paypal_price_cents del
  // producto si está seteado, sino price_cents interpretado 1:1 en la
  // moneda de PayPal.
  const orderItems: Array<{
    product_id: string; variant_id: string | null; qty: number;
    unit_price_cents: number;              // en la moneda LOCAL (para snapshot en physical_order_items)
    unit_price_paypal_cents: number;        // en la moneda de PayPal (para calcular total)
    product_title: string; variant_label: string | null; sku: string | null;
  }> = [];
  let itemsTotalLocal = 0;
  let itemsTotalPaypal = 0;
  let anyRequiresShipping = false;
  for (const i of body.items) {
    const p = productById.get(i.product_id ?? '');
    if (!p) continue;
    const qty = Math.max(1, Math.min(50, Math.floor(i.qty)));
    let localUnit = p.price_cents;
    let variantLabel: string | null = null;
    let sku: string | null = null;
    if (i.variant_id) {
      const v = variantById.get(i.variant_id);
      if (!v || v.product_id !== p.id) return NextResponse.json({ error: 'variant_invalid' }, { status: 400 });
      if (v.price_cents != null) localUnit = v.price_cents;
      variantLabel = v.name;
      sku = v.sku;
      if (p.track_stock && v.stock_qty < qty) {
        return NextResponse.json({ error: 'out_of_stock', product: p.title, variant: v.name }, { status: 409 });
      }
    } else {
      if (p.track_stock && p.stock_qty < qty) {
        return NextResponse.json({ error: 'out_of_stock', product: p.title }, { status: 409 });
      }
    }
    if (p.requires_shipping) anyRequiresShipping = true;
    const paypalUnit = p.paypal_price_cents && p.paypal_price_cents > 0
      ? p.paypal_price_cents
      : localUnit;

    orderItems.push({
      product_id: p.id, variant_id: i.variant_id ?? null, qty,
      unit_price_cents: localUnit, unit_price_paypal_cents: paypalUnit,
      product_title: p.title, variant_label: variantLabel, sku
    });
    itemsTotalLocal += localUnit * qty;
    itemsTotalPaypal += paypalUnit * qty;
  }
  if (orderItems.length === 0) return NextResponse.json({ error: 'no_valid_items' }, { status: 400 });

  // Validar shipping address si aplica
  if (anyRequiresShipping) {
    const a = body.shipping_address;
    if (!a?.street || !a.city || !a.province || !a.postal_code) {
      return NextResponse.json({ error: 'address_required' }, { status: 400 });
    }
  }

  // Create physical_order pending. No shipping_cost — el owner cobra por fuera.
  const orderId = randomUUID();
  const currency = products[0]?.currency || 'ARS';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: orderErr } = await (svc.from('physical_orders') as any).insert({
    id: orderId,
    tenant_id: tenantId,
    buyer_email: body.buyer_email,
    buyer_name: body.buyer_name ?? null,
    buyer_phone: body.buyer_phone ?? null,
    shipping_address: anyRequiresShipping ? body.shipping_address ?? null : null,
    shipping_cost_cents: 0,
    items_total_cents: itemsTotalLocal,
    discount_cents: 0,
    total_cents: itemsTotalLocal, // total local para reporting; el PayPal cobra en su moneda
    currency,
    status: 'pending',
    buyer_notes: body.buyer_notes?.slice(0, 500) ?? null,
    notes: `paypal:pending` // se completa al crear la orden PayPal más abajo
  });
  if (orderErr) {
    return NextResponse.json({ error: 'order_create_failed', detail: orderErr.message }, { status: 500 });
  }

  // Insert items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('physical_order_items') as any).insert(
    orderItems.map((oi) => ({
      order_id: orderId,
      product_id: oi.product_id,
      variant_id: oi.variant_id,
      product_title: oi.product_title,
      variant_label: oi.variant_label,
      sku: oi.sku,
      unit_price_cents: oi.unit_price_cents,
      qty: oi.qty
    }))
  );

  // Get PayPal access token
  const tok = await getPayPalAccessToken({
    clientId, clientSecret: integ.access_token_enc as string, mode
  });
  if (!tok.ok) {
    return NextResponse.json({ error: 'paypal_auth_failed' }, { status: 500 });
  }

  // Create PayPal order
  const amount = (itemsTotalPaypal / 100).toFixed(2);
  const orderResp = await fetch(`${paypalApiBase(mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tok.access_token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `cart-${orderId}-${Date.now()}`
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        description: `Compra en tienda (${orderItems.length} ${orderItems.length === 1 ? 'producto' : 'productos'})`,
        amount: { currency_code: paypalCurrency, value: amount },
        custom_id: `${tenantId}:cart:${orderId}`
      }],
      application_context: {
        shipping_preference: anyRequiresShipping ? 'GET_FROM_FILE' : 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: 'OfferNow'
      }
    })
  });
  const orderText = await orderResp.text();
  if (!orderResp.ok) {
    return NextResponse.json({ error: 'paypal_order_create_failed', detail: orderText.slice(0, 500) }, { status: 502 });
  }
  const paypalOrder = JSON.parse(orderText) as { id: string };

  // Guardar el paypal_order_id en notes para reconciliar en capture
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('physical_orders') as any).update({
    notes: `paypal:${paypalOrder.id}`
  }).eq('id', orderId);

  return NextResponse.json({ paypal_order_id: paypalOrder.id, order_id: orderId });
}
