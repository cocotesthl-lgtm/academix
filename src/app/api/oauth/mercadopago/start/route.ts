import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getAuthUrl } from '@/lib/payments/mercadopago';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  // Owner must be authenticated
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', _req.url));
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
  if (!membership) return NextResponse.redirect(new URL('/onboarding', _req.url));

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

  return NextResponse.redirect(getAuthUrl(state));
}
