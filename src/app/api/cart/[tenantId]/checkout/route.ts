import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServiceClient } from '@/lib/supabase/service';
import { createPreference } from '@/lib/payments/mercadopago';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/cart/[tenantId]/checkout
 * Body: { items: [{ id: courseId, qty: 1 }], buyer_email?: string }
 *
 * Crea UNA SOLA preference MP con varios items y devuelve init_point.
 * Cuando MP confirma el pago, el webhook procesará el external_reference
 * (formato "cart:<cartId>"), lookup en cart_orders, y creará un enrollment
 * por cada item.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const body = await req.json().catch(() => null) as {
    items?: Array<{ id: string; qty: number }>;
    buyer_email?: string;
  } | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'cart_empty' }, { status: 400 });
  }

  const svc = getServiceClient();

  // Resolver tenant + slug + cart_enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (svc.from('tenants') as any)
    .select('slug, cart_enabled').eq('id', tenantId).maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  if (!tenant.cart_enabled) return NextResponse.json({ error: 'cart_disabled' }, { status: 403 });

  // Resolver MP del owner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integ } = await (svc.from('integrations') as any)
    .select('access_token_enc').eq('tenant_id', tenantId)
    .eq('provider', 'mercadopago').eq('status', 'connected').maybeSingle();
  if (!integ?.access_token_enc) {
    return NextResponse.json({ error: 'mp_not_connected' }, { status: 409 });
  }

  // Lookup productos
  const ids = body.items.map((i) => i.id).slice(0, 30);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: courses } = await (svc.from('courses') as any)
    .select('id, title, price_cents, currency, status')
    .eq('tenant_id', tenantId).in('id', ids);
  const courseMap = new Map(
    ((courses ?? []) as Array<{ id: string; title: string; price_cents: number; currency: string; status: string }>)
      .filter((c) => c.status === 'published')
      .map((c) => [c.id, c])
  );

  // Construir items + total
  const itemsForMp: Array<{ title: string; quantity: number; unit_price: number; currency_id: string }> = [];
  let totalCents = 0;
  const currency = 'ARS';
  for (const i of body.items) {
    const c = courseMap.get(i.id);
    if (!c) continue;
    const qty = Math.max(1, Math.min(20, Math.floor(i.qty)));
    itemsForMp.push({
      title: c.title,
      quantity: qty,
      unit_price: c.price_cents / 100,
      currency_id: c.currency || currency
    });
    totalCents += c.price_cents * qty;
  }
  if (itemsForMp.length === 0) return NextResponse.json({ error: 'no_valid_items' }, { status: 400 });

  // Guardar la orden (defensivo: si tabla cart_orders no existe, igual procesamos sin tracking)
  const cartId = randomUUID();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('cart_orders') as any).insert({
      id: cartId, tenant_id: tenantId,
      items: body.items.filter((i) => courseMap.has(i.id)),
      total_cents: totalCents,
      buyer_email: body.buyer_email ?? null,
      status: 'pending'
    });
  } catch { /* tabla puede no existir aún; ok */ }

  const h = await headers();
  const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0];
  const host = h.get('host') ?? `${tenant.slug}.localhost:3000`;
  const origin = `${proto}://${host}`;

  try {
    // createPreference acepta solo un item simple; le pasamos el total como single item
    // con el detalle de los productos en el title (más rico vendría con la API REST cruda).
    // Para mantener compat con MP simple, mandamos UN item con el total.
    const itemsTitle = itemsForMp.map((i) => `${i.quantity}× ${i.title}`).join(' + ');
    const pref = await createPreference({
      accessToken: integ.access_token_enc,
      title: itemsTitle.length > 200 ? itemsTitle.slice(0, 197) + '…' : itemsTitle,
      unitPriceCents: totalCents,
      currency,
      buyerEmail: body.buyer_email,
      externalReference: `cart:${cartId}`,
      notificationUrl: `${origin}/api/webhooks/mercadopago/${tenantId}`,
      successUrl: `${origin}/?cart=ok`,
      failureUrl: `${origin}/?cart=err`,
      pendingUrl: `${origin}/?cart=pending`,
      metadata: { cart_id: cartId, kind: 'cart', items: body.items }
    });
    return NextResponse.json({ init_point: pref.init_point, cart_id: cartId });
  } catch (e) {
    return NextResponse.json({ error: 'mp_failed', detail: String(e) }, { status: 502 });
  }
}
