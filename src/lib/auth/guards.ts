import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { IMPERSONATE_COOKIE } from '@/lib/founder/actions';

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
