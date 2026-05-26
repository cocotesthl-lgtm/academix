import { NextRequest, NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { createPreference } from '@/lib/payments/mercadopago';
import { verifyAffiliateCookie, cookieName } from '@/lib/affiliates/cookie';
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

  // Build URLs (use the storefront origin from the request)
  const h = await headers();
  const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0];
  const host = h.get('host') ?? `${tenant.slug}.localhost:3000`;
  const origin = `${proto}://${host}`;

  // Webhook URL must point to PLATFORM origin (where /api/webhooks lives), not tenant subdomain
  const platformOrigin = env.appUrl;

  try {
    const pref = await createPreference({
      accessToken: integration.access_token_enc,
      title: course.title,
      unitPriceCents: course.price_cents,
      currency: course.currency,
      buyerEmail: user?.email ?? undefined,
      externalReference: `${course.id}::${user?.id ?? 'anon'}::${affLinkId ?? ''}`,
      notificationUrl: `${platformOrigin}/api/webhooks/mercadopago/${course.tenant_id}`,
      successUrl: `${origin}/learn`,
      failureUrl: `${origin}/c/${course.slug}?checkout=failed`,
      pendingUrl: `${origin}/c/${course.slug}?checkout=pending`,
      metadata: {
        course_id: course.id,
        tenant_id: course.tenant_id,
        buyer_user_id: user?.id ?? null,
        affiliate_link_id: affLinkId
      }
    });

    return NextResponse.redirect(pref.init_point, { status: 303 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'checkout_failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
