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
/**
 * Versión exportable de postAuthRedirect (usada por /api/auth/callback
 * después del intercambio de code OAuth).
 */
export async function resolvePostAuthRedirect(userId: string): Promise<string> {
  return postAuthRedirect(userId);
}

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

  // Workspaces: solo roles que dan acceso a un PANEL (owner/instructor/student).
  // 'affiliate' NO cuenta — esa membership se autocrea al visitar /affiliate
  // de cualquier tenant y no debe inflar la lista de workspaces del user.
  const { data: memberships } = await svc
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role', ['owner', 'instructor', 'student']);
  const all = (memberships ?? []) as Array<{ tenant_id: string; role: 'owner' | 'instructor' | 'student' }>;

  // Dedup por tenant — owner gana sobre instructor sobre student
  const priority = { owner: 3, instructor: 2, student: 1 } as const;
  const byTenant = new Map<string, typeof all[number]>();
  for (const m of all) {
    const ex = byTenant.get(m.tenant_id);
    if (!ex || priority[m.role] > priority[ex.role]) byTenant.set(m.tenant_id, m);
  }
  const workspaces = Array.from(byTenant.values());

  // 2+ workspaces → selector. Usamos path RELATIVO así funciona en cualquier
  // dominio (app.<root> si está configurado, sino el host actual). Sino
  // dependeríamos de que app.<root> resuelva DNS — frágil hasta tener
  // app.<rootDomain> listo en DNS.
  if (workspaces.length >= 2) {
    return '/workspaces';
  }

  // 1 workspace → directo a su panel según rol
  if (workspaces.length === 1) {
    const m = workspaces[0];
    if (m.role === 'owner') return subdomainUrl('app', '/dashboard');
    if (m.role === 'instructor') return subdomainUrl('app', '/instructor');
    if (m.role === 'student') return '/learn';
  }

  // 0 memberships pero tiene enrollments → alumno suelto en este tenant
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

  // Sin nada → onboarding para crear su primer sitio
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
    // Captura referrer platform-wide para el árbol multinivel (L1→L2→L3).
    // Idempotente y silent — no rompe el signup si falla.
    const { capturePendingReferral } = await import('@/lib/affiliates/referral-capture');
    await capturePendingReferral(data.user.id);

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
  // Esto soporta dominios temporales / staging sin hardcodear el root.
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
