import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { IMPERSONATE_COOKIE } from '@/lib/founder/constants';

/**
 * Devuelve los roles activos de un user en un tenant.
 * Reemplaza el patrón duplicado de queries puntuales por rol.
 * Llamadores típicos: storefront layout (¿es affiliate?), endpoints de aff.
 */
export type MembershipInfo = {
  roles: Set<'owner' | 'instructor' | 'student' | 'affiliate'>;
  isOwner: boolean;
  isAffiliate: boolean;
  isStudent: boolean;
  isInstructor: boolean;
};

export async function getMembership(tenantId: string, userId: string): Promise<MembershipInfo> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('status', 'active');
  const roles = new Set(((data ?? []) as Array<{ role: string }>).map((m) => m.role) as Array<'owner' | 'instructor' | 'student' | 'affiliate'>);
  return {
    roles,
    isOwner: roles.has('owner'),
    isAffiliate: roles.has('affiliate'),
    isStudent: roles.has('student'),
    isInstructor: roles.has('instructor')
  };
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle<{ is_super_admin: boolean }>();
  if (!data?.is_super_admin) redirect('/');
  return user;
}

export type OwnerContext = {
  userId: string;
  tenant: { id: string; slug: string; name: string };
  impersonating?: boolean;   // founder está actuando como owner
};

export async function requireOwner(): Promise<OwnerContext> {
  const user = await requireUser();
  const svc = getServiceClient();

  // Si user es super_admin Y tiene cookie de impersonación, abrir ese tenant
  const { data: profile } = await svc
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle<{ is_super_admin: boolean }>();

  if (profile?.is_super_admin) {
    const cookieStore = await cookies();
    const impersonateSlug = cookieStore.get(IMPERSONATE_COOKIE)?.value;
    if (impersonateSlug) {
      const { data: tenant } = await svc
        .from('tenants')
        .select('id, slug, name')
        .eq('slug', impersonateSlug)
        .maybeSingle<{ id: string; slug: string; name: string }>();
      if (tenant) {
        return { userId: user.id, tenant, impersonating: true };
      }
    }
  }

  // Cookie 'owner_tenant_id' setea el workspace activo cuando el user
  // clickea otro sitio en el WorkspaceSwitcher. Sin esta cookie, siempre
  // usábamos el primer tenant que devolvía la query — ignorando el switch.
  const cookieStore = await cookies();
  const preferredTenantId = cookieStore.get('owner_tenant_id')?.value;

  if (preferredTenantId) {
    const { data: preferred } = await svc
      .from('memberships')
      .select('tenant_id, tenants ( id, slug, name )')
      .eq('user_id', user.id)
      .eq('tenant_id', preferredTenantId)
      .eq('role', 'owner')
      .eq('status', 'active')
      .maybeSingle<{ tenant_id: string; tenants: { id: string; slug: string; name: string } | null }>();
    if (preferred?.tenants) {
      return { userId: user.id, tenant: preferred.tenants };
    }
    // Cookie apuntaba a un tenant sin membership válida — la ignoramos y
    // caemos al primer tenant "de default" abajo.
  }

  const { data } = await svc
    .from('memberships')
    .select('tenant_id, tenants ( id, slug, name )')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle<{ tenant_id: string; tenants: { id: string; slug: string; name: string } | null }>();
  if (!data?.tenants) redirect('/onboarding');
  return { userId: user.id, tenant: data.tenants };
}

export type InstructorContext = {
  userId: string;
  tenant: { id: string; slug: string; name: string };
};

/**
 * Para el portal /instructor. Toma el primer tenant donde el user tiene
 * membership(role='instructor', status='active'). Si no tiene ninguno,
 * redirige al login.
 */
export async function requireInstructor(): Promise<InstructorContext> {
  const user = await requireUser();
  const svc = getServiceClient();
  const { data } = await svc
    .from('memberships')
    .select('tenant_id, tenants ( id, slug, name )')
    .eq('user_id', user.id)
    .eq('role', 'instructor')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle<{ tenant_id: string; tenants: { id: string; slug: string; name: string } | null }>();
  if (!data?.tenants) redirect('/login?error=not_instructor');
  return { userId: user.id, tenant: data.tenants };
}
