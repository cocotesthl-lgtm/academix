import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
    .single();
  if (!data?.is_super_admin) redirect('/');
  return user;
}

export async function requireOwner() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1);
  if (!data || data.length === 0) redirect('/onboarding');
  return { user, tenantId: data[0].tenant_id as string };
}
