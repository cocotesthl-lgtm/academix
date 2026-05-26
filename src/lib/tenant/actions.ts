'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { env, RESERVED_SLUGS } from '@/lib/env';

export type OnboardingResult =
  | { ok: true; tenantId: string; slug: string; redirectTo: string }
  | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export async function createTenantAction(
  _prev: OnboardingResult | null,
  formData: FormData
): Promise<OnboardingResult> {
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const primaryColor = String(formData.get('primary_color') ?? '#0a0a0a').trim();

  // Validate
  if (!name) return { ok: false, error: 'El nombre de la academia es obligatorio.' };
  if (!slug) return { ok: false, error: 'El subdominio es obligatorio.' };
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: 'Subdominio inválido. Usá 3-32 caracteres: letras minúsculas, números y guiones.' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: 'Ese subdominio está reservado. Elegí otro.' };
  }

  // Require auth
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Tenés que iniciar sesión primero.' };

  const svc = getServiceClient();

  // Uniqueness check
  const { data: existing } = await svc.from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (existing) return { ok: false, error: 'Ese subdominio ya está tomado. Elegí otro.' };

  // Insert tenant via service-role (RLS would otherwise require a custom INSERT policy)
  const tenantPayload = {
    slug,
    name,
    owner_user_id: user.id,
    brand: { primary_color: primaryColor },
    status: 'active'
  };
  const { data: tenant, error: insertErr } = await svc
    .from('tenants')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(tenantPayload as any)
    .select('id, slug')
    .single<{ id: string; slug: string }>();

  if (insertErr || !tenant) {
    return { ok: false, error: insertErr?.message ?? 'No pudimos crear la academia.' };
  }

  // Create owner membership
  const membershipPayload = {
    user_id: user.id,
    tenant_id: tenant.id,
    role: 'owner',
    status: 'active'
  };
  const { error: membershipErr } = await svc
    .from('memberships')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(membershipPayload as any);

  if (membershipErr) {
    // Roll back tenant if membership fails
    await svc.from('tenants').delete().eq('id', tenant.id);
    return { ok: false, error: membershipErr.message };
  }

  // Audit
  const auditPayload = {
    actor_user_id: user.id,
    tenant_id: tenant.id,
    action: 'tenant.created',
    target_type: 'tenant',
    target_id: tenant.id,
    after: { slug: tenant.slug, name }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await svc.from('audit_log').insert(auditPayload as any);

  // Redirect target: owner subdomain. In dev (localhost) use app.localhost; in prod use app.{rootDomain}.
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === 'localhost' || appUrl.hostname.endsWith('.localhost');
  const ownerHost = isLocal ? `app.localhost${appUrl.port ? ':' + appUrl.port : ''}` : `app.${env.rootDomain}`;
  const ownerProto = appUrl.protocol;
  const redirectTo = `${ownerProto}//${ownerHost}/dashboard`;

  return { ok: true, tenantId: tenant.id, slug: tenant.slug, redirectTo };
}

export async function redirectToOwnerDashboard(): Promise<never> {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === 'localhost' || appUrl.hostname.endsWith('.localhost');
  const ownerHost = isLocal ? `app.localhost${appUrl.port ? ':' + appUrl.port : ''}` : `app.${env.rootDomain}`;
  redirect(`${appUrl.protocol}//${ownerHost}/dashboard`);
}
