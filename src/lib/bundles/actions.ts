'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

function slugify(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `bundle-${Date.now()}`;
}

export async function createBundleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;
  const priceRaw = String(formData.get('price') ?? '0').replace(/[^0-9.]/g, '');
  const listPriceRaw = String(formData.get('list_price') ?? '0').replace(/[^0-9.]/g, '');
  const id = randomUUID();
  const slug = slugify(title);
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('bundles') as any).insert({
    id, tenant_id: tenant.id, slug, title,
    description: String(formData.get('description') ?? '').trim() || null,
    price_cents: Math.round(parseFloat(priceRaw || '0') * 100),
    list_price_cents: Math.round(parseFloat(listPriceRaw || '0') * 100)
  });
  revalidatePath('/owner/bundles');
  redirect(`/bundles/${id}`);
}

export async function deleteBundleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('bundles') as any).delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/bundles');
}

export async function updateBundleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const priceRaw = String(formData.get('price') ?? '0').replace(/[^0-9.]/g, '');
  const listPriceRaw = String(formData.get('list_price') ?? '0').replace(/[^0-9.]/g, '');
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('bundles') as any).update({
    title: String(formData.get('title') ?? '').trim() || 'Bundle',
    description: String(formData.get('description') ?? '').trim() || null,
    price_cents: Math.round(parseFloat(priceRaw || '0') * 100),
    list_price_cents: Math.round(parseFloat(listPriceRaw || '0') * 100),
    cover_url: String(formData.get('cover_url') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'draft') === 'published' ? 'published' : 'draft',
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath(`/owner/bundles/${id}`);
}

export async function addBundleItemAction(formData: FormData): Promise<void> {
  await requireOwner();
  const bundleId = String(formData.get('bundle_id') ?? '');
  const courseId = String(formData.get('course_id') ?? '');
  if (!bundleId || !courseId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('bundle_items') as any)
    .select('position').eq('bundle_id', bundleId).order('position', { ascending: false }).limit(1);
  const nextPos = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('bundle_items') as any).insert({
    bundle_id: bundleId, course_id: courseId, position: nextPos
  });
  revalidatePath(`/owner/bundles/${bundleId}`);
}

export async function removeBundleItemAction(formData: FormData): Promise<void> {
  await requireOwner();
  const bundleId = String(formData.get('bundle_id') ?? '');
  const courseId = String(formData.get('course_id') ?? '');
  if (!bundleId || !courseId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('bundle_items') as any).delete()
    .eq('bundle_id', bundleId).eq('course_id', courseId);
  revalidatePath(`/owner/bundles/${bundleId}`);
}

/**
 * Agregar un producto físico al bundle. Distinto de addBundleItemAction:
 * ese usa course_id (cursos), este usa physical_product_id (ecommerce).
 * Un bundle puede mezclar los dos tipos ("Kit skincare" = 3 productos
 * físicos + curso "Rutina diaria"). Requiere migration 0056.
 */
export async function addBundleItemPhysicalAction(formData: FormData): Promise<void> {
  await requireOwner();
  const bundleId = String(formData.get('bundle_id') ?? '');
  const productId = String(formData.get('product_id') ?? '');
  if (!bundleId || !productId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('bundle_items') as any)
    .select('position').eq('bundle_id', bundleId).order('position', { ascending: false }).limit(1);
  const nextPos = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('bundle_items') as any).insert({
    bundle_id: bundleId, physical_product_id: productId, position: nextPos
  });
  revalidatePath(`/owner/bundles/${bundleId}`);
}

export async function removeBundleItemPhysicalAction(formData: FormData): Promise<void> {
  await requireOwner();
  const bundleId = String(formData.get('bundle_id') ?? '');
  const productId = String(formData.get('product_id') ?? '');
  if (!bundleId || !productId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('bundle_items') as any).delete()
    .eq('bundle_id', bundleId).eq('physical_product_id', productId);
  revalidatePath(`/owner/bundles/${bundleId}`);
}
