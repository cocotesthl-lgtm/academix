import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { exchangeCode } from '@/lib/payments/mercadopago';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

function ownerDashboardUrl(): string {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === 'localhost' || appUrl.hostname.endsWith('.localhost');
  const ownerHost = isLocal ? `app.localhost${appUrl.port ? ':' + appUrl.port : ''}` : `app.${env.rootDomain}`;
  return `${appUrl.protocol}//${ownerHost}/integrations`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('mp_oauth_state')?.value;
  cookieStore.delete('mp_oauth_state');

  const back = ownerDashboardUrl();

  if (err) return NextResponse.redirect(`${back}?mp_error=${encodeURIComponent(err)}`);
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${back}?mp_error=invalid_state`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect('/login');

  const tenantId = state.split('.')[0];

  // Validate user owns this tenant
  const svc = getServiceClient();
  const { data: membership } = await svc
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) return NextResponse.redirect(`${back}?mp_error=not_owner`);

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'exchange_failed';
    return NextResponse.redirect(`${back}?mp_error=${encodeURIComponent(msg)}`);
  }

  const webhookSecret = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const payload = {
    tenant_id: tenantId,
    provider: 'mercadopago',
    status: 'connected',
    scope: tokens.scope,
    access_token_enc: tokens.access_token,         // TODO encrypt at rest
    refresh_token_enc: tokens.refresh_token,
    expires_at: expiresAt,
    external_account_id: String(tokens.user_id),
    webhook_secret: webhookSecret,
    metadata: { public_key: tokens.public_key, live_mode: tokens.live_mode }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('integrations') as any).upsert(payload, {
    onConflict: 'tenant_id,provider'
  });
  if (error) return NextResponse.redirect(`${back}?mp_error=${encodeURIComponent(error.message)}`);

  // Audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('audit_log') as any).insert({
    actor_user_id: user.id,
    tenant_id: tenantId,
    action: 'integration.connected',
    target_type: 'integration',
    after: { provider: 'mercadopago', external_account_id: String(tokens.user_id) }
  });

  return NextResponse.redirect(`${back}?mp_connected=1`);
}
