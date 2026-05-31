import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getAuthUrl } from '@/lib/payments/mercadopago';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Owner must be authenticated
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const svc = getServiceClient();
  const { data: membership } = await svc
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  if (!membership) return NextResponse.redirect(new URL('/onboarding', req.url));

  // Pre-check: si faltan las env vars, no crasheamos en 500. Redirigimos a
  // /integrations con un mensaje claro para que el owner sepa qué pasa.
  if (!process.env.MERCADOPAGO_CLIENT_ID || !process.env.MERCADOPAGO_CLIENT_SECRET) {
    const u = new URL('/integrations', req.url);
    u.searchParams.set('error', 'mp_not_configured');
    return NextResponse.redirect(u);
  }

  // CSRF state cookie
  const nonce = randomBytes(16).toString('hex');
  const state = `${membership.tenant_id}.${nonce}`;
  const cookieStore = await cookies();
  cookieStore.set('mp_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/'
  });

  try {
    return NextResponse.redirect(getAuthUrl(state));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth_failed';
    const u = new URL('/integrations', req.url);
    u.searchParams.set('error', 'mp_oauth_failed');
    u.searchParams.set('detail', msg.slice(0, 200));
    return NextResponse.redirect(u);
  }
}
