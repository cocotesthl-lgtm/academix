'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { DEFAULT_SITE_CONFIG } from '@/lib/site/types';

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
