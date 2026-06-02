'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { env, RESERVED_SLUGS } from '@/lib/env';
import { DEFAULT_SITE_CONFIG } from '@/lib/site/types';
import { defaultsForTemplate } from '@/lib/courses/landing';

export type OnboardingResult =
  | { ok: true; tenantId: string; slug: string; redirectTo: string }
  | { ok: false; error: string };

// 3-32 chars: una letra/digit, 1-30 medio (letras/digits/guión), última letra/digit
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
  // site_config se popula con DEFAULT_SITE_CONFIG (rich sample content) para que el
  // storefront se vea armado desde el día 1.
  const tenantPayload = {
    slug,
    name,
    owner_user_id: user.id,
    brand: { primary_color: primaryColor },
    status: 'active',
    site_config: DEFAULT_SITE_CONFIG
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

  // Sample courses para que el catálogo del storefront no se vea vacío.
  // Cada uno viene con landing_template='hotmart' y landing_config con
  // contenido de muestra realista pre-cargado, así el owner ve algo bonito
  // de entrada (sin tener que clickear "Cargar muestra"). Para variar,
  // el segundo course usa template 'funnel' para que el owner vea ambos
  // estilos disponibles.
  const sampleCourses = [
    {
      tenant_id: tenant.id,
      slug: 'bienvenida',
      title: 'Curso de bienvenida (gratis)',
      description: 'Una introducción rápida para conocer la metodología y el estilo de la academia. Ideal para empezar.',
      price_cents: 0,
      currency: 'ARS',
      status: 'published',
      is_featured: true,
      featured_position: 0,
      affiliate_enabled: true,
      created_by: user.id,
      landing_template: 'hotmart',
      landing_config: defaultsForTemplate('hotmart', 'Curso de bienvenida (gratis)')
    },
    {
      tenant_id: tenant.id,
      slug: 'curso-completo',
      title: 'Curso completo',
      description: 'El programa completo paso a paso, con casos prácticos y ejercicios para llevar la teoría a la acción.',
      price_cents: 14900 * 100,
      currency: 'ARS',
      status: 'published',
      is_featured: true,
      featured_position: 1,
      affiliate_enabled: true,
      created_by: user.id,
      landing_template: 'funnel',
      landing_config: defaultsForTemplate('funnel', 'Curso completo')
    },
    {
      tenant_id: tenant.id,
      slug: 'masterclass',
      title: 'Masterclass intensiva',
      description: 'Workshop avanzado para profundizar en los temas más complejos. Acceso a sesiones en vivo y comunidad privada.',
      price_cents: 29900 * 100,
      currency: 'ARS',
      status: 'published',
      is_featured: false,
      featured_position: 2,
      affiliate_enabled: true,
      created_by: user.id,
      landing_template: 'hotmart',
      landing_config: defaultsForTemplate('hotmart', 'Masterclass intensiva')
    },
    {
      // VSL demo: landing tipo VSL con video real (5:48), todo gated hasta
      // que termine el video. Look negro + dorado. El owner edita el video
      // y los textos para hacerlo suyo.
      tenant_id: tenant.id,
      slug: 'domina-ia',
      title: 'Domina la IA antes que la IA te domine',
      description: 'Programa intensivo para profesionales que quieren usar IA en su trabajo y multiplicar su productividad — sin saber programar.',
      price_cents: 49900 * 100,
      currency: 'ARS',
      status: 'published',
      is_featured: true,
      featured_position: 3,
      affiliate_enabled: true,
      created_by: user.id,
      landing_template: 'vsl',
      landing_config: defaultsForTemplate('vsl', 'Domina la IA antes que la IA te domine')
    }
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('courses') as any).insert(sampleCourses);

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
