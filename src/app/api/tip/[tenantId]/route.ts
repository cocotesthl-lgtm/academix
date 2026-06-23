import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { createPreference } from '@/lib/payments/mercadopago';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/tip/[tenantId]
 * Body: { course_id?, amount_cents, message?, buyer_email }
 * → Crea row en tips (status='pending') + MP preference. Devuelve init_point.
 *
 * El webhook MP del owner ya conoce qué hacer cuando recibe el callback
 * (external_reference="tip:<tip_id>"): marca la tip como paid.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const body = await req.json().catch(() => null) as {
    course_id?: string; amount_cents?: number; message?: string; buyer_email?: string;
  } | null;
  if (!body || typeof body.amount_cents !== 'number' || body.amount_cents < 10000) {
    return NextResponse.json({ error: 'amount_invalid' }, { status: 400 });
  }

  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'login_required' }, { status: 401 });
  }

  const svc = getServiceClient();
  // Tenant slug para back_urls
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (svc.from('tenants') as any)
    .select('slug').eq('id', tenantId).maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

  // MP del owner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integ } = await (svc.from('integrations') as any)
    .select('access_token_enc').eq('tenant_id', tenantId)
    .eq('provider', 'mercadopago').eq('status', 'connected').maybeSingle();
  if (!integ?.access_token_enc) {
    return NextResponse.json({ error: 'mp_not_connected' }, { status: 409 });
  }

  const tipId = randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (svc.from('tips') as any).insert({
    id: tipId,
    tenant_id: tenantId,
    course_id: body.course_id || null,
    fan_user_id: user.id,
    amount_cents: body.amount_cents,
    currency: 'ARS',
    message: (body.message ?? '').slice(0, 500) || null,
    status: 'pending'
  });
  if (insErr) {
    return NextResponse.json({ error: 'db_error', detail: insErr.message }, { status: 500 });
  }

  const h = await headers();
  const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0];
  const host = h.get('host') ?? `${tenant.slug}.localhost:3000`;
  const origin = `${proto}://${host}`;

  // Slug del publicación para volver a la página correcta
  let backUrl = `${origin}/`;
  if (body.course_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: c } = await (svc.from('courses') as any)
      .select('slug').eq('id', body.course_id).maybeSingle();
    if (c?.slug) backUrl = `${origin}/c/${c.slug}`;
  }

  try {
    const pref = await createPreference({
      accessToken: integ.access_token_enc,
      title: `Propina · ${(body.amount_cents / 100).toLocaleString('es-AR')} ARS`,
      unitPriceCents: body.amount_cents,
      currency: 'ARS',
      buyerEmail: body.buyer_email || user.email,
      externalReference: `tip:${tipId}`,
      notificationUrl: `${origin}/api/webhooks/mercadopago/${tenantId}`,
      successUrl: `${backUrl}?tip=ok`,
      failureUrl: `${backUrl}?tip=err`,
      pendingUrl: `${backUrl}?tip=pending`,
      metadata: { tip_id: tipId, kind: 'tip' }
    });
    return NextResponse.json({ init_point: pref.init_point, tip_id: tipId });
  } catch (e) {
    return NextResponse.json({ error: 'mp_failed', detail: String(e) }, { status: 502 });
  }
}
