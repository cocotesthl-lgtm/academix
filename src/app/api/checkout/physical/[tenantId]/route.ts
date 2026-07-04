import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServiceClient } from '@/lib/supabase/service';
import { createPreference } from '@/lib/payments/mercadopago';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PhysicalItemInput = {
  product_id: string;
  variant_id?: string | null;
  qty: number;
};

type BuyerAddress = {
  street?: string;
  number?: string;
  apt?: string;
  city?: string;
  province?: string;  // código ISO ej. "AR-C"
  postal_code?: string;
  country?: string;
  notes?: string;
};

type Body = {
  items: PhysicalItemInput[];
  buyer_email: string;
  buyer_name?: string;
  buyer_phone?: string;
  shipping_rate_id?: string;   // null cuando ningún producto requiere envío
  shipping_address?: BuyerAddress;
  buyer_notes?: string;
};

/**
 * POST /api/checkout/physical/[tenantId]
 * Crea una physical_order + items snapshot + preferencia MP.
 * NO decrementa stock — eso pasa en el webhook cuando MP confirma el pago.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const body = await req.json().catch(() => null) as Body | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'cart_empty' }, { status: 400 });
  }
  if (!body.buyer_email || !body.buyer_email.includes('@')) {
    return NextResponse.json({ error: 'buyer_email_required' }, { status: 400 });
  }

  const svc = getServiceClient();

  // Tenant + MP
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (svc.from('tenants') as any)
    .select('slug').eq('id', tenantId).maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integ } = await (svc.from('integrations') as any)
    .select('access_token_enc').eq('tenant_id', tenantId)
    .eq('provider', 'mercadopago').eq('status', 'connected').maybeSingle();
  if (!integ?.access_token_enc) {
    return NextResponse.json({ error: 'mp_not_connected' }, { status: 409 });
  }

  // Load products + variants
  const productIds = Array.from(new Set(body.items.map((i) => i.product_id))).slice(0, 30);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: productsRaw } = await (svc.from('physical_products') as any)
    .select('id, title, price_cents, currency, stock_qty, track_stock, requires_shipping, status')
    .eq('tenant_id', tenantId).in('id', productIds);
  const products = ((productsRaw ?? []) as Array<{
    id: string; title: string; price_cents: number; currency: string;
    stock_qty: number; track_stock: boolean; requires_shipping: boolean; status: string;
  }>).filter((p) => p.status === 'published');
  const productById = new Map(products.map((p) => [p.id, p]));

  const variantIds = body.items.map((i) => i.variant_id).filter((v): v is string => !!v);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: variantsRaw } = variantIds.length > 0
    ? await (svc.from('product_variants') as any)
      .select('id, product_id, name, price_cents, stock_qty, sku')
      .in('id', variantIds)
    : { data: [] };
  const variantById = new Map(
    ((variantsRaw ?? []) as Array<{
      id: string; product_id: string; name: string;
      price_cents: number | null; stock_qty: number; sku: string | null;
    }>).map((v) => [v.id, v])
  );

  // Build order items + validate stock + total
  const orderItems: Array<{
    product_id: string; variant_id: string | null; qty: number;
    unit_price_cents: number; product_title: string;
    variant_label: string | null; sku: string | null;
  }> = [];
  let itemsTotal = 0;
  let anyRequiresShipping = false;
  for (const i of body.items) {
    const p = productById.get(i.product_id);
    if (!p) continue;
    const qty = Math.max(1, Math.min(50, Math.floor(i.qty)));
    let unitPrice = p.price_cents;
    let variantLabel: string | null = null;
    let sku: string | null = null;
    if (i.variant_id) {
      const v = variantById.get(i.variant_id);
      if (!v || v.product_id !== p.id) return NextResponse.json({ error: 'variant_invalid' }, { status: 400 });
      if (v.price_cents != null) unitPrice = v.price_cents;
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
    orderItems.push({
      product_id: p.id, variant_id: i.variant_id ?? null, qty,
      unit_price_cents: unitPrice, product_title: p.title,
      variant_label: variantLabel, sku
    });
    itemsTotal += unitPrice * qty;
  }
  if (orderItems.length === 0) return NextResponse.json({ error: 'no_valid_items' }, { status: 400 });

  // Shipping
  let shippingCost = 0;
  let shippingLabel: string | null = null;
  let shippingZoneId: string | null = null;
  if (anyRequiresShipping) {
    if (!body.shipping_rate_id) {
      return NextResponse.json({ error: 'shipping_required' }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rate } = await (svc.from('shipping_rates') as any)
      .select('id, name, price_cents, free_from_cents, zone_id, delivery_days_min, delivery_days_max')
      .eq('id', body.shipping_rate_id).eq('tenant_id', tenantId).maybeSingle();
    if (!rate) return NextResponse.json({ error: 'shipping_rate_invalid' }, { status: 400 });
    const isFree = rate.free_from_cents != null && itemsTotal >= rate.free_from_cents;
    shippingCost = isFree ? 0 : rate.price_cents;
    shippingLabel = rate.name;
    shippingZoneId = rate.zone_id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: zone } = await (svc.from('shipping_zones') as any)
      .select('name, is_pickup, provinces').eq('id', rate.zone_id).maybeSingle();
    if (zone) {
      shippingLabel = `${zone.name} · ${rate.name}`;
      if (!zone.is_pickup) {
        // Validar dirección si NO es retiro
        const a = body.shipping_address;
        if (!a?.street || !a.city || !a.province || !a.postal_code) {
          return NextResponse.json({ error: 'address_required' }, { status: 400 });
        }
        // Validar que la provincia esté cubierta por la zona
        const covers = zone.provinces.includes('*') || zone.provinces.includes(a.province);
        if (!covers) {
          return NextResponse.json({ error: 'province_not_covered' }, { status: 400 });
        }
      }
    }
  }

  const total = itemsTotal + shippingCost;
  const currency = products[0]?.currency || 'ARS';

  // Create order
  const orderId = randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: ordErr } = await (svc.from('physical_orders') as any).insert({
    id: orderId, tenant_id: tenantId,
    buyer_email: body.buyer_email,
    buyer_name: body.buyer_name ?? null,
    buyer_phone: body.buyer_phone ?? null,
    shipping_address: anyRequiresShipping ? body.shipping_address ?? null : null,
    shipping_zone_id: shippingZoneId,
    shipping_rate_id: body.shipping_rate_id ?? null,
    shipping_method_label: shippingLabel,
    items_total_cents: itemsTotal,
    shipping_cost_cents: shippingCost,
    total_cents: total,
    currency,
    status: 'pending',
    buyer_notes: body.buyer_notes?.slice(0, 500) ?? null
  });
  if (ordErr) return NextResponse.json({ error: 'order_create_failed', detail: ordErr.message }, { status: 500 });

  // Insert order items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('physical_order_items') as any).insert(
    orderItems.map((oi) => ({ order_id: orderId, ...oi }))
  );

  // MP preference
  const h = await headers();
  const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0];
  const host = h.get('host') ?? `${tenant.slug}.localhost:3000`;
  const origin = `${proto}://${host}`;

  const itemsTitle = orderItems.map((i) => `${i.qty}× ${i.product_title}`).join(' + ');
  const fullTitle = shippingCost > 0
    ? `${itemsTitle} + envío`
    : itemsTitle;

  try {
    const pref = await createPreference({
      accessToken: integ.access_token_enc,
      title: fullTitle.length > 200 ? fullTitle.slice(0, 197) + '…' : fullTitle,
      unitPriceCents: total,
      currency,
      buyerEmail: body.buyer_email,
      externalReference: `phys:${orderId}`,
      notificationUrl: `${origin}/api/webhooks/mercadopago/${tenantId}`,
      successUrl: `${origin}/gracias?order=${orderId}`,
      failureUrl: `${origin}/tienda?err=payment`,
      pendingUrl: `${origin}/gracias?order=${orderId}&status=pending`,
      metadata: { order_id: orderId, kind: 'physical' }
    });
    return NextResponse.json({ init_point: pref.init_point, order_id: orderId });
  } catch (e) {
    return NextResponse.json({ error: 'mp_failed', detail: String(e) }, { status: 502 });
  }
}
