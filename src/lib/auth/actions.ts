'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';

export type ActionResult =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; error: string };

function callbackUrl(next: string = '/onboarding') {
  return `${env.appUrl}/api/auth/callback?next=${encodeURIComponent(next)}`;
}

function subdomainUrl(sub: 'admin' | 'app', path: string): string {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === 'localhost' || appUrl.hostname.endsWith('.localhost');
  const host = isLocal
    ? `${sub}.localhost${appUrl.port ? ':' + appUrl.port : ''}`
    : `${sub}.${env.rootDomain}`;
  return `${appUrl.protocol}//${host}${path}`;
}

/**
 * Decide where to land a user post-auth based on their roles:
 *  - super_admin → admin.<root>/dashboard
 *  - owner of a tenant → app.<root>/dashboard
 *  - neither → /onboarding (apex) to create their first academia
 */
async function postAuthRedirect(userId: string): Promise<string> {
  const svc = getServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .maybeSingle<{ is_super_admin: boolean }>();
  if (profile?.is_super_admin) {
    return subdomainUrl('admin', '/dashboard');
  }
  const { data: ownership } = await svc
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (ownership) {
    return subdomainUrl('app', '/dashboard');
  }
  return '/onboarding';
}

export async function signupAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('display_name') ?? '').trim();

  if (!email || !password) {
    return { ok: false, error: 'Email y contraseña son obligatorios.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split('@')[0] },
      emailRedirectTo: callbackUrl('/onboarding')
    }
  });

  if (error) return { ok: false, error: error.message };

  if (data.session && data.user) {
    return { ok: true, redirectTo: await postAuthRedirect(data.user.id) };
  }

  return { ok: true, message: 'check_email' };
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { ok: false, error: 'Email y contraseña son obligatorios.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  const userId = data.user?.id;
  if (!userId) return { ok: true, redirectTo: '/onboarding' };

  return { ok: true, redirectTo: await postAuthRedirect(userId) };
}

export async function signoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
