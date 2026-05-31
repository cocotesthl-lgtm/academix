import { NextRequest, NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { createPreference } from '@/lib/payments/mercadopago';
import { verifyAffiliateCookie, cookieName } from '@/lib/affiliates/cookie';
import { validateCoupon } from '@/lib/coupons/actions';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Course = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  price_cents: number;
  currency: string;
  status: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const svc = getServiceClient();

  // Resolve course
  const { data: course } = await svc
    .from('courses')
    .select('id, tenant_id, slug, title, price_cents, currency, status')
    .eq('id', courseId)
    .maybeSingle<Course>();
  if (!course || course.status !== 'published') {
    return NextResponse.json({ error: 'course_not_available' }, { status: 404 });
  }
  if (course.price_cents <= 0) {
    return NextResponse.json({ error: 'free_course_no_checkout' }, { status: 400 });
  }

  // Resolve tenant slug for redirect URLs
  const { data: tenant } = await svc
    .from('tenants')
    .select('slug')
    .eq('id', course.tenant_id)
    .maybeSingle<{ slug: string }>();
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

  // Resolve MP integration
  const { data: integration } = await svc
    .from('integrations')
    .select('access_token_enc')
    .eq('tenant_id', course.tenant_id)
    .eq('provider', 'mercadopago')
    .eq('status', 'connected')
    .maybeSingle<{ access_token_enc: string }>();
  if (!integration) {
    return NextResponse.json({ error: 'mercadopago_not_connected' }, { status: 409 });
  }

  // Buyer (optional — anon allowed)
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Affiliate cookie (set on click via trackClick); HMAC-verified
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(cookieName(course.tenant_id))?.value ?? null;
  const affPayload = rawCookie ? verifyAffiliateCookie(rawCookie) : null;
  // Only honour attribution if the cookie was set for THIS course
  const affLinkId = affPayload && affPayload.courseId === course.id ? affPayload.linkId : null;

  // Coupon (from form field or query param)
  const form = await req.formData().catch(() => null);
  const couponCode = (form?.get('coupon') as string | null)
    ?? (new URL(req.url).searchParams.get('coupon'))
    ?? '';

  // Buyer info pegada en el form de checkout (nombre/DNI/ubicación/email/celular)
  // Es opcional para cursos gratis (ya tenemos el user_id). Para cursos pagos
  // el front lo exige; el back es tolerante (no rechaza si falta).
  const buyerNameRaw     = String(form?.get('buyer_name')     ?? '').trim().slice(0, 120);
  const buyerDniRaw      = String(form?.get('buyer_dni')      ?? '').trim().slice(0, 20);
  const buyerLocationRaw = String(form?.get('buyer_location') ?? '').trim().slice(0, 120);
  const buyerEmailRaw    = String(form?.get('buyer_email')    ?? '').trim().slice(0, 200);
  const buyerPhoneRaw    = String(form?.get('buyer_phone')    ?? '').trim().slice(0, 30);
  const buyerInfo = {
    name:     buyerNameRaw     || null,
    dni:      buyerDniRaw      || null,
    location: buyerLocationRaw || null,
    email:    buyerEmailRaw    || null,
    phone:    buyerPhoneRaw    || null
  };
  let couponValid: Awaited<ReturnType<typeof validateCoupon>> | null = null;
  let finalPrice = course.price_cents;
  if (couponCode) {
    couponValid = await validateCoupon(course.tenant_id, couponCode, course.id, course.price_cents);
    if (couponValid) finalPrice = couponValid.final_cents;
  }

  // Build URLs (use the storefront origin from the request)
  const h = await headers();
  const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0];
  const host = h.get('host') ?? `${tenant.slug}.localhost:3000`;
  const origin = `${proto}://${host}`;

  // Webhook URL must point to PLATFORM origin (where /api/webhooks lives), not tenant subdomain
  const platformOrigin = env.appUrl;

  // If coupon makes it free, auto-enroll on the spot and skip MP entirely
  if (finalPrice <= 0 && couponValid && user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('enrollments') as any).insert({
      tenant_id: course.tenant_id,
      course_id: course.id,
      user_id: user.id,
      source: 'direct',
      status: 'active',
      buyer_name: buyerInfo.name,
      buyer_dni: buyerInfo.dni,
      buyer_location: buyerInfo.location,
      buyer_email: buyerInfo.email ?? user.email ?? null,
      buyer_phone: buyerInfo.phone
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('coupon_redemptions') as any).insert({
      coupon_id: couponValid.id,
      tenant_id: course.tenant_id,
      user_id: user.id,
      course_id: course.id,
      sale_id: null,
      amount_discounted_cents: couponValid.discount_cents
    });
    // Bump redemption_count
    const { data: c } = await svc.from('coupons').select('redemption_count').eq('id', couponValid.id).single<{ redemption_count: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('coupons') as any).update({ redemption_count: (c?.redemption_count ?? 0) + 1 }).eq('id', couponValid.id);
    return NextResponse.redirect(`${origin}/learn`, { status: 303 });
  }

  try {
    const pref = await createPreference({
      accessToken: integration.access_token_enc,
      title: course.title,
      unitPriceCents: finalPrice,
      currency: course.currency,
      // Mandamos el email del buyer (si lo escribió en el form) para que MP
      // lo pre-llene en el checkout. Fallback al email del user logueado.
      buyerEmail: buyerInfo.email ?? user?.email ?? undefined,
      externalReference: `${course.id}::${user?.id ?? 'anon'}::${affLinkId ?? ''}`,
      notificationUrl: `${platformOrigin}/api/webhooks/mercadopago/${course.tenant_id}`,
      successUrl: `${origin}/learn`,
      failureUrl: `${origin}/c/${course.slug}?checkout=failed`,
      pendingUrl: `${origin}/c/${course.slug}?checkout=pending`,
      metadata: {
        course_id: course.id,
        tenant_id: course.tenant_id,
        buyer_user_id: user?.id ?? null,
        affiliate_link_id: affLinkId,
        coupon_id: couponValid?.id ?? null,
        coupon_code: couponValid?.code ?? null,
        coupon_discount_cents: couponValid?.discount_cents ?? 0,
        // Datos del comprador: el webhook los lee y los guarda en
        // sales + enrollments para que el owner pueda contactarlo.
        buyer_name:     buyerInfo.name,
        buyer_dni:      buyerInfo.dni,
        buyer_location: buyerInfo.location,
        buyer_email:    buyerInfo.email,
        buyer_phone:    buyerInfo.phone
      }
    });

    return NextResponse.redirect(pref.init_point, { status: 303 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'checkout_failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
