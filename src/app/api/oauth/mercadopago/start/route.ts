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

  // Resolver el tenant activo respetando el workspace switcher.
  // Antes tomábamos el "primer tenant" que devolvía la query — resultado:
  // si el owner tenía varios sitios, MP se conectaba al equivocado y en
  // el checkout del sitio activo salía "Checkout no disponible" aunque
  // el panel dijera "conectado correctamente".
  const cookieStore = await cookies();
  const preferredTenantId = cookieStore.get('owner_tenant_id')?.value;
  let tenantId: string | null = null;

  if (preferredTenantId) {
    const { data: preferred } = await svc
      .from('memberships').select('tenant_id')
      .eq('user_id', user.id).eq('tenant_id', preferredTenantId)
      .eq('role', 'owner').eq('status', 'active')
      .maybeSingle<{ tenant_id: string }>();
    if (preferred?.tenant_id) tenantId = preferred.tenant_id;
  }

  if (!tenantId) {
    // Fallback al primer tenant del user (comportamiento viejo — sólo
    // aplica si no hay cookie de workspace activo).
    const { data: first } = await svc
      .from('memberships').select('tenant_id')
      .eq('user_id', user.id).eq('role', 'owner').eq('status', 'active')
      .limit(1).maybeSingle<{ tenant_id: string }>();
    tenantId = first?.tenant_id ?? null;
  }

  if (!tenantId) return NextResponse.redirect(new URL('/onboarding', req.url));
  const membership = { tenant_id: tenantId };

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
