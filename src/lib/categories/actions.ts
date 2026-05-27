'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export type CategoryResult = { ok: true } | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,40}[a-z0-9]?$/;

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  let slug = slugify(name);
  if (!SLUG_RE.test(slug)) slug = `cat-${Date.now()}`;

  const svc = getServiceClient();
  const { count } = await svc
    .from('course_categories')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id);

  const payload = {
    tenant_id: tenant.id,
    slug,
    name,
    position: count ?? 0
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('course_categories') as any).insert(payload);
  revalidatePath('/categories');
  revalidatePath('/courses');
}

export async function renameCategoryAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!id || !name) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('course_categories') as any)
    .update({ name })
    .eq('id', id)
    .eq('tenant_id', tenant.id);
  revalidatePath('/categories');
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('course_categories').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/categories');
  revalidatePath('/courses');
}
