'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { notifyVipNewContent } from '@/lib/emails/dispatch';

/**
 * VIP Packs — paquetes multimedia que se desbloquean con la compra.
 * Reusan la tabla `courses` con product_type='vip_pack'.
 *
 * El media se guarda como URL (imágenes/videos/audio externos: Drive, Imgur,
 * Cloudinary, Unsplash, YouTube, etc). Cuando un user "compra" (enrollment
 * creado vía MP webhook), puede ver la galería completa.
 */

export type VipMediaItem = {
  id: string;
  type: 'image' | 'video' | 'audio' | 'embed';
  url: string;
  title?: string;
  description?: string;
};

function slugify(input: string): string {
  return input
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `pack-${Date.now()}`;
}

function safeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol === 'http:' || u.protocol === 'https:') return v.slice(0, 2048);
    return null;
  } catch {
    return null;
  }
}

/* ===== Pack CRUD ===== */

export async function createVipPackAction(formData: FormData): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;
  const priceRaw = String(formData.get('price') ?? '0').replace(/[^0-9.]/g, '');
  const priceCents = Math.max(0, Math.round(parseFloat(priceRaw || '0') * 100));

  const svc = getServiceClient();
  let slug = slugify(title);
  // Slug único en el tenant
  for (let attempt = 0; attempt < 5; attempt++) {
    const tryslug = attempt === 0 ? slug : `${slug}-${Math.floor(Math.random() * 9999)}`;
    const { data: existing } = await svc
      .from('courses')
      .select('id').eq('tenant_id', tenant.id).eq('slug', tryslug).maybeSingle();
    if (!existing) { slug = tryslug; break; }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('courses') as any).insert({
    tenant_id: tenant.id,
    slug, title,
    description: String(formData.get('description') ?? '').trim() || null,
    price_cents: priceCents,
    currency: 'ARS',
    status: 'draft',
    affiliate_enabled: false,
    created_by: userId,
    product_type: 'vip_pack',
    media_items: [],
    pack_description: String(formData.get('pack_description') ?? '').trim() || null
  }).select('id').single();

  revalidatePath('/owner/vip');
  if (data?.id) redirect(`/vip/${data.id}`);
}

export async function updateVipPackMetaAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const priceRaw = String(formData.get('price') ?? '0').replace(/[^0-9.]/g, '');
  const priceCents = Math.max(0, Math.round(parseFloat(priceRaw || '0') * 100));

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('courses') as any).update({
    title: String(formData.get('title') ?? '').trim() || 'Pack VIP',
    description: String(formData.get('description') ?? '').trim() || null,
    pack_description: String(formData.get('pack_description') ?? '').trim() || null,
    price_cents: priceCents,
    cover_url: safeUrl(String(formData.get('cover_url') ?? '')),
    preview_url: safeUrl(String(formData.get('preview_url') ?? '')),
    status: String(formData.get('status') ?? 'draft') === 'published' ? 'published' : 'draft',
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath(`/owner/vip/${id}`);
}

export async function deleteVipPackAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('courses') as any).delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/vip');
}

/* ===== Media items CRUD ===== */

async function loadItems(svc: ReturnType<typeof getServiceClient>, packId: string, tenantId: string): Promise<VipMediaItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('courses') as any)
    .select('media_items').eq('id', packId).eq('tenant_id', tenantId).maybeSingle();
  const items = data?.media_items;
  return Array.isArray(items) ? (items as VipMediaItem[]) : [];
}

async function saveItems(
  svc: ReturnType<typeof getServiceClient>,
  packId: string,
  tenantId: string,
  items: VipMediaItem[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('courses') as any).update({
    media_items: items, updated_at: new Date().toISOString()
  }).eq('id', packId).eq('tenant_id', tenantId);
}

const VALID_TYPES = new Set(['image', 'video', 'audio', 'embed']);

export async function addMediaItemAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const packId = String(formData.get('pack_id') ?? '');
  const url = safeUrl(String(formData.get('url') ?? ''));
  const typeRaw = String(formData.get('type') ?? 'image');
  const type = (VALID_TYPES.has(typeRaw) ? typeRaw : 'image') as VipMediaItem['type'];
  if (!packId || !url) return;

  const svc = getServiceClient();
  const items = await loadItems(svc, packId, tenant.id);
  const newItem: VipMediaItem = {
    id: randomUUID(),
    type,
    url,
    title: String(formData.get('title') ?? '').trim() || undefined,
    description: String(formData.get('description') ?? '').trim() || undefined
  };
  items.push(newItem);
  await saveItems(svc, packId, tenant.id, items);
  revalidatePath(`/owner/vip/${packId}`);

  // Notificar a los enrolled del pack (no bloquea — fire and forget)
  const notify = String(formData.get('notify') ?? '');
  if (notify === 'on') {
    void notifyVipNewContent({
      tenantId: tenant.id,
      courseId: packId,
      itemTitle: newItem.title,
      itemType: type,
      itemCount: 1
    });
  }
}

export async function deleteMediaItemAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const packId = String(formData.get('pack_id') ?? '');
  const id = String(formData.get('id') ?? '');
  if (!packId || !id) return;
  const svc = getServiceClient();
  const items = await loadItems(svc, packId, tenant.id);
  const next = items.filter((i) => i.id !== id);
  await saveItems(svc, packId, tenant.id, next);
  revalidatePath(`/owner/vip/${packId}`);
}

export async function moveMediaItemAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const packId = String(formData.get('pack_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const dir = String(formData.get('dir') ?? '');
  if (!packId || !id || (dir !== 'up' && dir !== 'down')) return;
  const svc = getServiceClient();
  const items = await loadItems(svc, packId, tenant.id);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const newIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= items.length) return;
  [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
  await saveItems(svc, packId, tenant.id, items);
  revalidatePath(`/owner/vip/${packId}`);
}

export async function updateMediaItemAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const packId = String(formData.get('pack_id') ?? '');
  const id = String(formData.get('id') ?? '');
  if (!packId || !id) return;
  const svc = getServiceClient();
  const items = await loadItems(svc, packId, tenant.id);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const newUrl = safeUrl(String(formData.get('url') ?? '')) ?? items[idx].url;
  const typeRaw = String(formData.get('type') ?? items[idx].type);
  const type = (VALID_TYPES.has(typeRaw) ? typeRaw : items[idx].type) as VipMediaItem['type'];
  items[idx] = {
    ...items[idx], url: newUrl, type,
    title: String(formData.get('title') ?? '').trim() || undefined,
    description: String(formData.get('description') ?? '').trim() || undefined
  };
  await saveItems(svc, packId, tenant.id, items);
  revalidatePath(`/owner/vip/${packId}`);
}
