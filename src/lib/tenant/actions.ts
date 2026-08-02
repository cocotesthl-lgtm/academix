'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { env, RESERVED_SLUGS } from '@/lib/env';
import { DEFAULT_SITE_CONFIG } from '@/lib/site/types';
import { SITE_TEMPLATES } from '@/lib/site/templates/catalog';
import { loadSiteTemplates } from '@/lib/site/templates/loader';
import { seedEcommerceDemoData } from '@/lib/site/templates/seed-ecommerce';
import { defaultsForTemplate } from '@/lib/courses/landing';
import { MODULE_PRESETS, ALL_MODULES_ON, type Modules } from '@/lib/modules/types';

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
  const primaryGradient = String(formData.get('primary_gradient') ?? '').trim();
  const templateId = String(formData.get('template_id') ?? '').trim() || null;

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
  // Si el owner eligió un template, aplicamos su config; si no, DEFAULT_SITE_CONFIG.
  // Priorizamos DB (permite al founder editar templates sin deploy). Fallback al hardcoded.
  const dbTemplates = await loadSiteTemplates();
  const templatePool = dbTemplates.length > 0 ? dbTemplates : SITE_TEMPLATES;
  const chosenTemplate = templateId ? templatePool.find((t) => t.id === templateId) : null;
  const siteConfig = chosenTemplate ? chosenTemplate.config : DEFAULT_SITE_CONFIG;
  // Si el template sugiere un color y el owner no cambió el default, usamos el del template.
  const effectivePrimary = (primaryColor === '#0a0a0a' && chosenTemplate?.suggestedPrimary)
    ? chosenTemplate.suggestedPrimary
    : primaryColor;
  const isEcommerce = chosenTemplate?.id === 'ecommerce';
  const isDropshipping = chosenTemplate?.id === 'dropshipping';
  const isProductStore = isEcommerce || isDropshipping;
  // Módulos iniciales del tenant según template elegido.
  // Ecommerce template → preset ecommerce (solo tienda + crm + sales + site).
  // Academia y otros → todos prendidos (retrocompat / owner puede apagar
  // desde /owner/modulos después). Un tenant con TODO prendido no molesta,
  // apagarlos es fácil; empezar sin nada es frustrante.
  const initialModules: Modules = isProductStore
    ? { ...MODULE_PRESETS.ecommerce.modules, dropshipping: isDropshipping }
    : { ...ALL_MODULES_ON };
  const tenantPayload: Record<string, unknown> = {
    slug,
    name,
    owner_user_id: user.id,
    brand: { primary_color: effectivePrimary },
    status: 'active',
    site_config: siteConfig,
    modules: initialModules
  };
  // primary_gradient viaja en columna dedicada. Si el owner eligió un
  // gradient preset, lo guardamos; sino queda null y el sitio usa el
  // hex sólido de brand.primary_color.
  if (primaryGradient) tenantPayload.primary_gradient = primaryGradient;
  // Ecommerce → habilitar carrito automáticamente en el registro también
  // (no solo desde /owner/templates). Sin carrito no hay tienda.
  if (isProductStore) {
    tenantPayload.cart_enabled = true;
    tenantPayload.cart_position = 'header';
    tenantPayload.cart_display = 'dropdown';
  }
  let { data: tenant, error: insertErr } = await svc
    .from('tenants')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(tenantPayload as any)
    .select('id, slug')
    .single<{ id: string; slug: string }>();
  if (insertErr) {
    // Reintento defensivo por migrations pendientes: primero sin
    // primary_gradient (0083), después sin cart_* (0034), después
    // sin modules (0045).
    delete tenantPayload.primary_gradient;
    delete tenantPayload.cart_enabled;
    delete tenantPayload.cart_position;
    delete tenantPayload.cart_display;
    let retry = await svc
      .from('tenants')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(tenantPayload as any)
      .select('id, slug')
      .single<{ id: string; slug: string }>();
    if (retry.error) {
      delete tenantPayload.modules;
      retry = await svc
        .from('tenants')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(tenantPayload as any)
        .select('id, slug')
        .single<{ id: string; slug: string }>();
    }
    tenant = retry.data;
    insertErr = retry.error;
  }

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

  // Ecommerce → sembrar 6 categorías + 12 productos físicos reales en la DB
  // así el owner ve el catálogo cargado en /owner/products y /owner/categories
  // (solo tiene que editar título/precio/foto de cada uno).
  // Wrapped en try/catch para no romper el onboarding si algo falla.
  if (isProductStore) {
    try {
      await seedEcommerceDemoData(tenant.id);
    } catch (e) {
      console.error('[createTenant] seed productos fallo (no critico):', e);
    }
  }

  // Redirect target: owner subdomain. In dev (localhost) use app.localhost; in prod use app.{rootDomain}.
  // Pasamos por /api/workspace/switch para que la cookie 'owner_tenant_id'
  // apunte al tenant recién creado. Sin esto, requireOwner() podría
  // devolver el tenant VIEJO (el primero encontrado) y el user aterrizaría
  // en el dashboard equivocado.
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === 'localhost' || appUrl.hostname.endsWith('.localhost');
  const ownerHost = isLocal ? `app.localhost${appUrl.port ? ':' + appUrl.port : ''}` : `app.${env.rootDomain}`;
  const ownerProto = appUrl.protocol;
  const redirectTo = `${ownerProto}//${ownerHost}/api/workspace/switch?tenant=${tenant.id}&to=/dashboard`;

  return { ok: true, tenantId: tenant.id, slug: tenant.slug, redirectTo };
}

/**
 * Renombra el tenant (sólo el owner). Actualiza tenants.name — el slug
 * NO se toca porque cambiarlo rompe todos los links compartidos, SEO,
 * webhooks configurados en MP, etc.
 */
export async function renameTenantAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const tenantId = String(formData.get('tenant_id') ?? '');
  const newName = String(formData.get('name') ?? '').trim().slice(0, 100);
  if (!tenantId || !newName) return { ok: false, error: 'Nombre requerido' };

  const svc = getServiceClient();
  // Verificar que el user es owner de este tenant
  const { data: mem } = await svc
    .from('memberships').select('id')
    .eq('tenant_id', tenantId).eq('user_id', user.id).eq('role', 'owner').eq('status', 'active')
    .maybeSingle<{ id: string }>();
  if (!mem) return { ok: false, error: 'No sos owner de este sitio' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('tenants') as any)
    .update({ name: newName, updated_at: new Date().toISOString() }).eq('id', tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Elimina completamente un tenant y toda su data (cursos, ventas,
 * suscripciones, links de pago, todo). Requiere:
 *  - user es owner del tenant
 *  - el user tipeó el slug exacto para confirmar (safeguard anti-click)
 *
 * ON DELETE CASCADE en las FK se encarga del resto. La cookie
 * `owner_tenant_id` se limpia si apuntaba al tenant borrado.
 */
export async function deleteTenantAction(formData: FormData): Promise<{ ok: boolean; error?: string; redirectTo?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const tenantId = String(formData.get('tenant_id') ?? '');
  const confirmSlug = String(formData.get('confirm_slug') ?? '').trim().toLowerCase();
  if (!tenantId || !confirmSlug) return { ok: false, error: 'Datos incompletos' };

  const svc = getServiceClient();
  // Cargar tenant + verificar ownership + confirmar slug tipeado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: t } = await (svc.from('tenants') as any)
    .select('id, slug').eq('id', tenantId).maybeSingle();
  if (!t) return { ok: false, error: 'Sitio no encontrado' };
  if (t.slug !== confirmSlug) return { ok: false, error: 'El slug tipeado no coincide' };

  const { data: mem } = await svc
    .from('memberships').select('id')
    .eq('tenant_id', tenantId).eq('user_id', user.id).eq('role', 'owner').eq('status', 'active')
    .maybeSingle<{ id: string }>();
  if (!mem) return { ok: false, error: 'No sos owner de este sitio' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('tenants') as any).delete().eq('id', tenantId);
  if (error) return { ok: false, error: error.message };

  // Limpiar cookie de workspace activo si apuntaba al tenant borrado
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  if (cookieStore.get('owner_tenant_id')?.value === tenantId) {
    cookieStore.delete('owner_tenant_id');
  }

  // Redirect al primer tenant restante o a onboarding
  const { data: remaining } = await svc
    .from('memberships').select('tenant_id')
    .eq('user_id', user.id).eq('role', 'owner').eq('status', 'active').limit(1)
    .maybeSingle<{ tenant_id: string }>();
  const redirectTo = remaining ? '/owner/mis-sitios' : '/onboarding';
  return { ok: true, redirectTo };
}

export async function redirectToOwnerDashboard(): Promise<never> {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === 'localhost' || appUrl.hostname.endsWith('.localhost');
  const ownerHost = isLocal ? `app.localhost${appUrl.port ? ':' + appUrl.port : ''}` : `app.${env.rootDomain}`;
  redirect(`${appUrl.protocol}//${ownerHost}/dashboard`);
}
