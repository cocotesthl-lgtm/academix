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
  const parentId = String(formData.get('parent_id') ?? '').trim() || null;

  let slug = slugify(name);
  if (!SLUG_RE.test(slug)) slug = `cat-${Date.now()}`;

  const svc = getServiceClient();
  const { count } = await svc
    .from('course_categories')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id);

  const payload: Record<string, unknown> = {
    tenant_id: tenant.id,
    slug,
    name,
    position: count ?? 0,
    parent_id: parentId
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('course_categories') as any).insert(payload);
    // Defensivo: si migration 0054 no corrió, parent_id no existe → reintentamos sin.
    if (error && error.message.includes('parent_id')) {
      delete payload.parent_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('course_categories') as any).insert(payload);
    }
  } catch (e) {
    if (String(e).includes('parent_id')) {
      delete payload.parent_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('course_categories') as any).insert(payload);
    } else {
      throw e;
    }
  }
  revalidatePath('/categories');
  revalidatePath('/courses');
}

export async function setCategoryParentAction(id: string, parentId: string | null): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // Guardra contra ciclos: si el parent propuesto es descendiente de la categoría, rechazar.
  // Como el tree es chico (max 2-3 niveles), un walk O(N) alcanza.
  if (parentId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allRaw } = await (svc.from('course_categories') as any)
      .select('id, parent_id').eq('tenant_id', tenant.id);
    const all = (allRaw ?? []) as Array<{ id: string; parent_id: string | null }>;
    const childrenOf = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      childrenOf.add(cur);
      for (const c of all) if (c.parent_id === cur) queue.push(c.id);
    }
    if (childrenOf.has(parentId)) throw new Error('No se puede mover una categoría dentro de sí misma.');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('course_categories') as any)
    .update({ parent_id: parentId }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/categories');
}

export async function toggleCategoryFeaturedAction(id: string, featured: boolean): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('course_categories') as any)
    .update({ is_featured: featured }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/categories');
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
