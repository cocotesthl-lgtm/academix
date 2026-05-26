import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

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
};

export async function requireOwner(): Promise<OwnerContext> {
  const user = await requireUser();
  const svc = getServiceClient();
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
