'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';

export const IMPERSONATE_COOKIE = 'cp_as_tenant';

async function requireFounder(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle<{ is_super_admin: boolean }>();
  if (!profile?.is_super_admin) throw new Error('forbidden');
  return user.id;
}

export async function setTenantStatusAction(formData: FormData): Promise<void> {
  const founderId = await requireFounder();
  const tenantId = String(formData.get('tenant_id') ?? '');
  const newStatus = String(formData.get('status') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;

  if (!['active', 'suspended', 'closed'].includes(newStatus)) return;

  const svc = getServiceClient();

  const { data: before } = await svc
    .from('tenants')
    .select('status')
    .eq('id', tenantId)
    .single<{ status: string }>();

  const updatePayload = { status: newStatus, updated_at: new Date().toISOString() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update(updatePayload).eq('id', tenantId);

  const auditPayload = {
    actor_user_id: founderId,
    tenant_id: tenantId,
    action: 'tenant.status_changed',
    target_type: 'tenant',
    target_id: tenantId,
    before: { status: before?.status },
    after: { status: newStatus },
    reason
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await svc.from('audit_log').insert(auditPayload as any);

  revalidatePath('/tenants');
  revalidatePath('/dashboard');
}

/**
 * Founder impersona owner de un tenant. Setea cookie cp_as_tenant=<slug>
 * en domain .<rootDomain> (compartida con todos los subdominios) y redirige
 * al owner dashboard. requireOwner respeta esta cookie si el user es
 * super_admin (en /lib/auth/guards.ts).
 */
export async function impersonateTenantAction(formData: FormData): Promise<void> {
  await requireFounder();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  if (!slug) return;

  const cookieStore = await cookies();
  const opts: { httpOnly: boolean; sameSite: 'lax'; secure: boolean; maxAge: number; path: string; domain?: string } = {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
    path: '/'
  };
  if (env.cookieDomain) opts.domain = env.cookieDomain;
  cookieStore.set(IMPERSONATE_COOKIE, slug, opts);

  // Redirect to owner dashboard on the app subdomain
  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const ownerHost = isLocal
    ? `app.localhost${u.port ? ':' + u.port : ''}`
    : `app.${env.rootDomain}`;
  redirect(`${u.protocol}//${ownerHost}/dashboard`);
}

export async function stopImpersonatingAction(): Promise<void> {
  const cookieStore = await cookies();
  // Clear in all path/domain variants
  cookieStore.delete(IMPERSONATE_COOKIE);
  if (env.cookieDomain) {
    cookieStore.set(IMPERSONATE_COOKIE, '', {
      domain: env.cookieDomain,
      path: '/',
      maxAge: 0
    });
  }
  // Redirect back to founder tenants
  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const adminHost = isLocal
    ? `admin.localhost${u.port ? ':' + u.port : ''}`
    : `admin.${env.rootDomain}`;
  redirect(`${u.protocol}//${adminHost}/tenants`);
}

/**
 * Toggle is_super_admin de un profile. Solo super_admin puede hacerlo.
 * Hay un check de seguridad: el founder no puede quitarse el propio flag
 * (para evitar quedarse sin ningún super_admin).
 */
export async function toggleSuperAdminAction(formData: FormData): Promise<void> {
  const founderId = await requireFounder();
  const profileId = String(formData.get('profile_id') ?? '');
  if (!profileId) return;
  if (profileId === founderId) return; // no auto-degradación

  const svc = getServiceClient();
  const { data: before } = await svc
    .from('profiles')
    .select('is_super_admin, email')
    .eq('id', profileId)
    .single<{ is_super_admin: boolean; email: string }>();
  if (!before) return;

  const newValue = !before.is_super_admin;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('profiles') as any)
    .update({ is_super_admin: newValue, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await svc.from('audit_log').insert({
    actor_user_id: founderId,
    action: 'profile.super_admin_toggled',
    target_type: 'profile',
    target_id: profileId,
    before: { is_super_admin: before.is_super_admin },
    after: { is_super_admin: newValue },
    reason: `Founder toggled super_admin for ${before.email}`
  } as never);

  revalidatePath('/users');
}

/**
 * Borrado total de una academia. Cascade elimina:
 * - memberships, courses (y sus modules, lessons, enrollments, sales,
 *   commission ledger entries, debt payments, integrations, tickets,
 *   affiliate_links/clicks/attributions/commissions)
 * - El audit_log conserva la entrada anterior con tenant_id=null.
 * Requiere confirmación: el form debe enviar 'confirm=<slug>' que tiene
 * que coincidir con el slug actual del tenant. Si no coincide, no se
 * borra nada (seguridad anti-clicks accidentales).
 */
export async function deleteTenantAction(formData: FormData): Promise<void> {
  const founderId = await requireFounder();
  const tenantId = String(formData.get('tenant_id') ?? '');
  const confirm = String(formData.get('confirm') ?? '').trim();
  if (!tenantId) return;

  const svc = getServiceClient();
  const { data: before } = await svc
    .from('tenants')
    .select('slug, name')
    .eq('id', tenantId)
    .single<{ slug: string; name: string }>();
  if (!before) return;

  // Safety: confirm string must equal the slug
  if (confirm !== before.slug) {
    return;
  }

  // Audit BEFORE delete so we keep a trace (tenant_id will be set to null by FK)
  const auditPayload = {
    actor_user_id: founderId,
    tenant_id: tenantId,
    action: 'tenant.deleted',
    target_type: 'tenant',
    target_id: tenantId,
    before: { slug: before.slug, name: before.name },
    after: null,
    reason: `Founder deleted academy ${before.slug}`
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await svc.from('audit_log').insert(auditPayload as any);

  await svc.from('tenants').delete().eq('id', tenantId);

  revalidatePath('/tenants');
  revalidatePath('/dashboard');
}
