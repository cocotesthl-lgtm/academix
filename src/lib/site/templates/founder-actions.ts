'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { DEFAULT_SITE_CONFIG } from '@/lib/site/types';
import { IMPERSONATE_COOKIE } from '@/lib/founder/constants';
import { env } from '@/lib/env';
import { TEMPLATE_EDIT_COOKIE } from './template-edit-context';

function slugify(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 48);
}

/** Actualizar metadata del template (name, category, emoji, descripciones, primary, sort, active). */
export async function updateSiteTemplateAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const svc = getServiceClient();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (formData.has('name')) payload.name = String(formData.get('name') ?? '').trim().slice(0, 120);
  if (formData.has('category')) payload.category = String(formData.get('category') ?? '').trim().slice(0, 60);
  if (formData.has('emoji')) payload.emoji = String(formData.get('emoji') ?? '').trim().slice(0, 8) || null;
  if (formData.has('short_desc')) payload.short_desc = String(formData.get('short_desc') ?? '').trim().slice(0, 200) || null;
  if (formData.has('long_desc')) payload.long_desc = String(formData.get('long_desc') ?? '').trim().slice(0, 1000) || null;
  if (formData.has('suggested_primary')) {
    payload.suggested_primary = String(formData.get('suggested_primary') ?? '').trim().match(/^#[0-9a-fA-F]{6}$/)?.[0] ?? null;
  }
  if (formData.has('sort_order')) {
    const n = Number(formData.get('sort_order') ?? 0);
    payload.sort_order = Number.isFinite(n) ? Math.round(n) : 0;
  }
  if (formData.has('is_active')) {
    payload.is_active = formData.get('is_active') === 'on' || formData.get('is_active') === 'true';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('site_templates') as any).update(payload).eq('id', id);
  revalidatePath('/founder/templates');
  revalidatePath('/owner/templates');
  revalidatePath('/onboarding');
}

/** Toggle rápido de is_active. */
export async function toggleSiteTemplateActiveAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (svc.from('site_templates') as any)
    .select('is_active').eq('id', id).maybeSingle();
  const next = !(row as { is_active?: boolean } | null)?.is_active;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('site_templates') as any)
    .update({ is_active: next, updated_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/founder/templates');
  revalidatePath('/owner/templates');
  revalidatePath('/onboarding');
}

/** Crear template nuevo en blanco (starts con DEFAULT_SITE_CONFIG). */
export async function createSiteTemplateAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const svc = getServiceClient();
  const name = String(formData.get('name') ?? '').trim().slice(0, 120) || 'Nuevo template';
  const category = String(formData.get('category') ?? '').trim().slice(0, 60) || 'Otros';
  const baseSlug = slugify(name) || `template-${Date.now().toString(36)}`;

  let slug = baseSlug;
  let i = 2;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dup } = await (svc.from('site_templates') as any)
      .select('id').eq('slug', slug).maybeSingle();
    if (!dup) break;
    slug = `${baseSlug}-${i++}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('site_templates') as any).insert({
    slug, name, category, emoji: '✨',
    short_desc: 'Template custom del founder',
    suggested_primary: '#f97316',
    config: DEFAULT_SITE_CONFIG,
    modules: [],
    is_active: false,
    is_system: false,
    sort_order: 9999
  });
  revalidatePath('/founder/templates');
}

/** Borrar template. */
export async function deleteSiteTemplateAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('site_templates') as any).delete().eq('id', id);
  revalidatePath('/founder/templates');
  revalidatePath('/owner/templates');
  revalidatePath('/onboarding');
}

/**
 * Preview tenant por-founder: crea uno lazy con slug `_tpl-${founderId8}`,
 * owner_user_id = founder, para usar como sandbox editable del template.
 * Idempotente — si ya existe lo devuelve.
 */
async function getOrCreatePreviewTenant(founderId: string): Promise<{ id: string; slug: string; name: string }> {
  const svc = getServiceClient();
  const slug = `_tpl-${founderId.slice(0, 8)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('tenants') as any)
    .select('id, slug, name').eq('slug', slug).maybeSingle();
  if (existing) return existing as { id: string; slug: string; name: string };

  // Crear nuevo. status='active' para que el resolver de tenants lo levante.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (svc.from('tenants') as any)
    .insert({
      slug, name: 'Template preview',
      owner_user_id: founderId,
      status: 'active',
      brand: { primary_color: '#f97316' },
      site_config: DEFAULT_SITE_CONFIG
    })
    .select('id, slug, name').single();
  if (error) throw new Error(`No pude crear preview tenant: ${error.message}`);

  // Membership del founder como owner (necesario para requireOwner)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('memberships') as any).upsert({
    user_id: founderId, tenant_id: (created as { id: string }).id,
    role: 'owner', status: 'active'
  }, { onConflict: 'user_id,tenant_id,role', ignoreDuplicates: true });

  return created as { id: string; slug: string; name: string };
}

/**
 * Entrar al modo "editar template con el builder":
 *   1) Get/create preview tenant del founder
 *   2) Copia template.config → preview.site_config
 *   3) Setea IMPERSONATE_COOKIE al slug del preview + cookie del template edit
 *   4) Redirige al owner panel (app.<root>/site) donde el builder ya trabaja
 *      sobre el preview tenant. El owner layout detecta la cookie extra y
 *      muestra el banner "Editando template: NAME".
 */
export async function enterTemplateEditModeAction(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const templateId = String(formData.get('id') ?? '').trim();
  if (!templateId) return;

  const svc = getServiceClient();
  // Traer template
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tpl } = await (svc.from('site_templates') as any)
    .select('id, slug, name, config').eq('id', templateId).maybeSingle();
  if (!tpl) throw new Error('Template no encontrado');
  const t = tpl as { id: string; slug: string; name: string; config: unknown };

  // Preview tenant
  const preview = await getOrCreatePreviewTenant(user.id);

  // Aplicar config del template al preview tenant (pisa cualquier edit previo).
  // También limpiamos site_config_published para que "publicar" no meta ruido.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    site_config: t.config,
    site_config_published: null,
    name: `Template: ${t.name}`,
    updated_at: new Date().toISOString()
  }).eq('id', preview.id);

  // Cookies: impersonate + marca de template edit
  const cookieStore = await cookies();
  const rootDomain = env.rootDomain;
  const isLocal = rootDomain === 'localhost' || rootDomain.endsWith('.localhost');
  const cookieDomain = isLocal ? undefined : `.${rootDomain}`;

  cookieStore.set(IMPERSONATE_COOKIE, preview.slug, {
    httpOnly: false, secure: !isLocal, sameSite: 'lax',
    maxAge: 60 * 60 * 4, path: '/', domain: cookieDomain
  });
  cookieStore.set(TEMPLATE_EDIT_COOKIE, JSON.stringify({ id: t.id, slug: t.slug, name: t.name }), {
    httpOnly: false, secure: !isLocal, sameSite: 'lax',
    maxAge: 60 * 60 * 4, path: '/', domain: cookieDomain
  });
  // También cookie de owner_tenant_id que usa requireOwner de fallback
  cookieStore.set('owner_tenant_id', preview.id, {
    httpOnly: false, secure: !isLocal, sameSite: 'lax',
    maxAge: 60 * 60 * 4, path: '/', domain: cookieDomain
  });

  // Redirigir al panel owner del subdominio 'app'
  const appUrl = new URL(env.appUrl);
  const host = isLocal
    ? `app.localhost${appUrl.port ? ':' + appUrl.port : ''}`
    : `app.${rootDomain}`;
  redirect(`${appUrl.protocol}//${host}/site`);
}

/**
 * Guardar el config del preview tenant de vuelta al site_template.
 * Se llama desde el banner "Guardar como template" en el owner layout.
 */
export async function saveTemplateFromPreviewAction(): Promise<void> {
  const user = await requireSuperAdmin();
  const cookieStore = await cookies();
  const raw = cookieStore.get(TEMPLATE_EDIT_COOKIE)?.value;
  if (!raw) return;
  let templateId: string;
  try {
    templateId = (JSON.parse(raw) as { id: string }).id;
  } catch { return; }
  if (!templateId) return;

  const svc = getServiceClient();
  // Preview tenant del founder
  const previewSlug = `_tpl-${user.id.slice(0, 8)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: preview } = await (svc.from('tenants') as any)
    .select('site_config').eq('slug', previewSlug).maybeSingle();
  const cfg = (preview as { site_config?: unknown } | null)?.site_config;
  if (!cfg) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('site_templates') as any).update({
    config: cfg, updated_at: new Date().toISOString()
  }).eq('id', templateId);

  revalidatePath('/founder/templates');
  revalidatePath('/owner/templates');
  revalidatePath('/onboarding');
}

/**
 * Salir del modo template edit: limpia las 3 cookies y redirige a
 * /founder/templates. NO borra el preview tenant (queda para reutilizar).
 */
export async function exitTemplateEditModeAction(): Promise<void> {
  await requireSuperAdmin();
  const cookieStore = await cookies();
  const rootDomain = env.rootDomain;
  const isLocal = rootDomain === 'localhost' || rootDomain.endsWith('.localhost');
  const cookieDomain = isLocal ? undefined : `.${rootDomain}`;

  for (const name of [IMPERSONATE_COOKIE, TEMPLATE_EDIT_COOKIE, 'owner_tenant_id']) {
    cookieStore.set(name, '', {
      httpOnly: false, secure: !isLocal, sameSite: 'lax',
      maxAge: 0, path: '/', domain: cookieDomain
    });
  }

  // Redirigir al panel founder del subdominio 'admin'
  const appUrl = new URL(env.appUrl);
  const host = isLocal
    ? `admin.localhost${appUrl.port ? ':' + appUrl.port : ''}`
    : `admin.${rootDomain}`;
  redirect(`${appUrl.protocol}//${host}/templates`);
}

/** Reset — reinserta los hardcoded como is_system=true, upsert por slug. */
export async function resetSystemTemplatesAction(): Promise<void> {
  await requireSuperAdmin();
  const svc = getServiceClient();
  const { SITE_TEMPLATES } = await import('./catalog');
  for (const t of SITE_TEMPLATES) {
    const payload = {
      slug: t.id, name: t.name, category: t.category,
      emoji: t.emoji || null, short_desc: t.shortDesc || null,
      long_desc: t.longDesc ?? null,
      suggested_primary: t.suggestedPrimary || null,
      config: t.config, modules: (t.modules ?? []) as string[],
      is_active: true, is_system: true,
      updated_at: new Date().toISOString()
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('site_templates') as any)
      .upsert(payload, { onConflict: 'slug' });
  }
  revalidatePath('/founder/templates');
}
