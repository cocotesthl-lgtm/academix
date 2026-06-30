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
 *  - student con enrollments → /learn (sus cursos en el tenant donde se logueó)
 *  - sin nada → /onboarding (apex) para crear su primera academia
 *
 * Para students el redirect es relativo (/learn) en vez de absoluto al
 * subdominio, así se queda en el storefront donde se logueó.
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
  // Instructor → portal de instructor (también en subdominio app.<root>)
  const { data: instr } = await svc
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('role', 'instructor')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (instr) {
    return subdomainUrl('app', '/instructor');
  }
  // Si el user tiene enrollments es un alumno → mandarlo a /learn (relativo,
  // así se queda en el storefront donde se está logueando)
  const { data: enroll } = await svc
    .from('enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (enroll) {
    return '/learn';
  }
  // User sin ningún rol → asumimos que quiere crear academia
  return '/onboarding';
}

/**
 * Sanitiza el `next` recibido del cliente. Solo aceptamos paths internos
 * (empiezan con /) que NO sean protocol-relative (//evil.com).
 */
function sanitizeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith('/') || v.startsWith('//')) return null;
  if (v.length > 500) return null;
  return v;
}

export async function signupAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('display_name') ?? '').trim();
  const next = sanitizeNext(String(formData.get('next') ?? ''));

  if (!email || !password) {
    return { ok: false, error: 'Email y contraseña son obligatorios.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  // Si viene del flow de afiliado, lo mandamos a /affiliate?activate=1 para
  // auto-flippear el flag sin pasarle por el onboarding de academia.
  const isAffiliate = !!next && next.startsWith('/affiliate');
  const postAuthPath = isAffiliate ? '/affiliate?activate=1' : (next ?? '/onboarding');

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split('@')[0] },
      emailRedirectTo: callbackUrl(postAuthPath)
    }
  });

  if (error) return { ok: false, error: error.message };

  if (data.session && data.user) {
    // Si hay next explícito (ej: viene del flow afiliado), respetarlo —
    // no pasar por postAuthRedirect que lo mandaría a /onboarding.
    if (next) return { ok: true, redirectTo: postAuthPath };
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

/**
 * Sanitiza un redirect absoluto post-signout: solo permitimos URLs que
 * vivan bajo el rootDomain configurado (apex, subdominios de tenants,
 * app/admin). Cualquier cosa fuera de eso → cae al '/' default.
 */
function sanitizePostSignoutRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  // Path interno relativo
  if (v.startsWith('/') && !v.startsWith('//')) return v.length <= 500 ? v : null;
  // URL absoluta: validar que hostname caiga bajo rootDomain
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const root = env.rootDomain.toLowerCase();
    const host = u.hostname.toLowerCase();
    const isLocal = host === 'localhost' || host.endsWith('.localhost');
    const isSameRoot = host === root || host.endsWith(`.${root}`);
    if (!isLocal && !isSameRoot) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function signoutAction(redirectTo?: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  const target = sanitizePostSignoutRedirect(redirectTo) ?? '/';
  redirect(target);
}

/**
 * Inicia el flujo OAuth con Google. Server-side: pedimos a Supabase la URL
 * de Google (con state firmado) y redirigimos al usuario allá. Cuando
 * Google vuelve, Supabase intercepta en /auth/v1/callback y devuelve al
 * `redirectTo` que pasamos — nuestro /api/auth/callback intercambia el code
 * por session y redirige al destino final.
 */
export async function googleOAuthAction(formData: FormData): Promise<void> {
  const next = String(formData.get('next') ?? '').trim() || '/onboarding';
  // Usamos el host del request actual (lo pasa el form como hidden 'origin').
  // Esto soporta dominios temporales mientras no esté curplat.com listo.
  // El owner debe whitelistar el dominio en Supabase → Auth → URL Config.
  const origin = String(formData.get('origin') ?? '').trim();
  if (!origin) {
    redirect('/login?error=missing_origin');
  }
  const supabase = await createSupabaseServerClient();
  const callback = `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback }
  });
  if (error || !data?.url) {
    const msg = error?.message?.toLowerCase().includes('provider is not enabled')
      ? 'Google auth no está configurado todavía.'
      : (error?.message ?? 'Error al iniciar Google OAuth');
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }
  // data.url es la URL de Google (accounts.google.com/...). Redirect.
  redirect(data.url);
}
