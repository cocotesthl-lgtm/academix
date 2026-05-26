'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export type ActionResult =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; error: string };

function callbackUrl(next: string = '/onboarding') {
  return `${env.appUrl}/api/auth/callback?next=${encodeURIComponent(next)}`;
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

  // If email confirmation is OFF in Supabase, signUp returns a session immediately.
  if (data.session) {
    return { ok: true, redirectTo: '/onboarding' };
  }

  // Email confirmation required — user must click the link in their inbox.
  return { ok: true, message: 'check_email' };
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { ok: false, error: 'Email y contraseña son obligatorios.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  return { ok: true, redirectTo: '/onboarding' };
}

export async function signoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
