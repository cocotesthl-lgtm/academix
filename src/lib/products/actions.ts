'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export type PhysicalProduct = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  gallery: string[];
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: string;
  sku: string | null;
  stock_qty: number;
  track_stock: boolean;
  weight_g: number | null;
  requires_shipping: boolean;
  status: 'draft' | 'published';
  category_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  options: Record<string, string>;
  sku: string | null;
  price_cents: number | null;
  stock_qty: number;
  image_url: string | null;
  sort_order: number;
};

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function uniqueSlug(tenantId: string, base: string, excludeId?: string): Promise<string> {
  const svc = getServiceClient();
  let candidate = base;
  let i = 2;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('physical_products') as any)
      .select('id').eq('tenant_id', tenantId).eq('slug', candidate).maybeSingle();
    const row = data as { id: string } | null;
    if (!row || row.id === excludeId) return candidate;
    candidate = `${base}-${i}`;
    i++;
  }
}

/** Solo URLs http(s). */
function safeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.length > 2048) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Productos
// ═══════════════════════════════════════════════════════════════

export async function createProductAction(): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const slug = await uniqueSlug(tenant.id, 'nuevo-producto');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('physical_products') as any).insert({
    tenant_id: tenant.id,
    slug,
    title: 'Nuevo producto',
    price_cents: 0,
    stock_qty: 0,
    status: 'draft'
  }).select('id').single();
  if (error || !data) throw new Error(error?.message || 'no se pudo crear');
  revalidatePath('/products');
  redirect(`/products/${data.id}`);
}

export async function updateProductAction(id: string, formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const title = String(formData.get('title') ?? '').trim().slice(0, 200) || 'Sin título';
  const rawSlug = String(formData.get('slug') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const priceCents = Math.max(0, Math.round(Number(formData.get('price_cents') ?? 0)));
  const compareAtRaw = Number(formData.get('compare_at_price_cents') ?? 0);
  const compareAt = compareAtRaw > 0 ? Math.round(compareAtRaw) : null;
  const sku = String(formData.get('sku') ?? '').trim().slice(0, 60) || null;
  const stockQty = Math.max(0, Math.round(Number(formData.get('stock_qty') ?? 0)));
  const trackStock = formData.get('track_stock') === 'on';
  const requiresShipping = formData.get('requires_shipping') !== 'off';
  const weight = Number(formData.get('weight_g') ?? 0);
  const weightG = weight > 0 ? Math.round(weight) : null;
  const coverUrl = safeUrl(String(formData.get('cover_url') ?? ''));
  const galleryRaw = String(formData.get('gallery') ?? '').trim();
  const gallery = galleryRaw
    ? galleryRaw.split(/\r?\n/).map((s) => safeUrl(s)).filter((s): s is string => !!s).slice(0, 12)
    : [];
  const categoryId = String(formData.get('category_id') ?? '').trim() || null;
  const seoTitle = String(formData.get('seo_title') ?? '').trim().slice(0, 60) || null;
  const seoDescription = String(formData.get('seo_description') ?? '').trim().slice(0, 160) || null;

  const desired = rawSlug ? slugify(rawSlug) : slugify(title);
  const finalSlug = await uniqueSlug(tenant.id, desired || 'producto', id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('physical_products') as any).update({
    title, slug: finalSlug, description, price_cents: priceCents,
    compare_at_price_cents: compareAt, sku, stock_qty: stockQty,
    track_stock: trackStock, requires_shipping: requiresShipping,
    weight_g: weightG, cover_url: coverUrl, gallery,
    category_id: categoryId, seo_title: seoTitle, seo_description: seoDescription,
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);
  if (error) throw new Error(error.message);
  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
}

export async function setProductStatusAction(id: string, status: 'draft' | 'published'): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('physical_products') as any).update({
    status, updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);
  if (error) throw new Error(error.message);
  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
}

export async function deleteProductAction(id: string): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  await svc.from('physical_products').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/products');
  redirect('/products');
}

// ═══════════════════════════════════════════════════════════════
// Variantes
// ═══════════════════════════════════════════════════════════════

export async function addVariantAction(productId: string, formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Verificamos ownership del producto
  const { data: prod } = await svc.from('physical_products')
    .select('id').eq('id', productId).eq('tenant_id', tenant.id).maybeSingle<{ id: string }>();
  if (!prod) throw new Error('producto no encontrado');

  const name = String(formData.get('name') ?? '').trim().slice(0, 80) || 'Variante';
  const sku = String(formData.get('sku') ?? '').trim().slice(0, 60) || null;
  const priceRaw = Number(formData.get('price_cents') ?? 0);
  const price = priceRaw > 0 ? Math.round(priceRaw) : null;
  const stock = Math.max(0, Math.round(Number(formData.get('stock_qty') ?? 0)));
  const image = safeUrl(String(formData.get('image_url') ?? ''));

  // Contamos existentes para sort_order
  const { count } = await svc.from('product_variants')
    .select('id', { count: 'exact', head: true }).eq('product_id', productId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('product_variants') as any).insert({
    product_id: productId, name, sku, price_cents: price,
    stock_qty: stock, image_url: image, sort_order: count ?? 0
  });
  revalidatePath(`/products/${productId}`);
}

export async function updateVariantAction(variantId: string, formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Verificamos ownership vía join
  const { data: v } = await svc.from('product_variants')
    .select('product_id, physical_products!inner(tenant_id)')
    .eq('id', variantId).maybeSingle<{
      product_id: string;
      physical_products: { tenant_id: string };
    }>();
  if (!v || v.physical_products.tenant_id !== tenant.id) throw new Error('sin acceso');

  const name = String(formData.get('name') ?? '').trim().slice(0, 80) || 'Variante';
  const sku = String(formData.get('sku') ?? '').trim().slice(0, 60) || null;
  const priceRaw = Number(formData.get('price_cents') ?? 0);
  const price = priceRaw > 0 ? Math.round(priceRaw) : null;
  const stock = Math.max(0, Math.round(Number(formData.get('stock_qty') ?? 0)));
  const image = safeUrl(String(formData.get('image_url') ?? ''));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('product_variants') as any).update({
    name, sku, price_cents: price, stock_qty: stock, image_url: image
  }).eq('id', variantId);
  revalidatePath(`/products/${v.product_id}`);
}

export async function deleteVariantAction(variantId: string): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data: v } = await svc.from('product_variants')
    .select('product_id, physical_products!inner(tenant_id)')
    .eq('id', variantId).maybeSingle<{
      product_id: string;
      physical_products: { tenant_id: string };
    }>();
  if (!v || v.physical_products.tenant_id !== tenant.id) return;
  await svc.from('product_variants').delete().eq('id', variantId);
  revalidatePath(`/products/${v.product_id}`);
}

// ═══════════════════════════════════════════════════════════════
// Stock — ajuste manual con historial
// ═══════════════════════════════════════════════════════════════

export async function adjustStockAction(
  productId: string,
  variantId: string | null,
  delta: number,
  reason: 'restock' | 'adjustment' | 'return' | 'damage',
  note?: string
): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const svc = getServiceClient();

  const { data: prod } = await svc.from('physical_products')
    .select('id, stock_qty').eq('id', productId).eq('tenant_id', tenant.id)
    .maybeSingle<{ id: string; stock_qty: number }>();
  if (!prod) throw new Error('producto no encontrado');

  const d = Math.round(delta);
  if (variantId) {
    const { data: v } = await svc.from('product_variants')
      .select('id, stock_qty, product_id').eq('id', variantId)
      .maybeSingle<{ id: string; stock_qty: number; product_id: string }>();
    if (!v || v.product_id !== productId) throw new Error('variante no encontrada');
    const newQty = Math.max(0, v.stock_qty + d);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('product_variants') as any).update({ stock_qty: newQty }).eq('id', variantId);
  } else {
    const newQty = Math.max(0, prod.stock_qty + d);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('physical_products') as any).update({
      stock_qty: newQty, updated_at: new Date().toISOString()
    }).eq('id', productId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('product_stock_movements') as any).insert({
    tenant_id: tenant.id, product_id: productId, variant_id: variantId,
    delta: d, reason, actor_user_id: userId, note: note?.slice(0, 200) || null
  });
  revalidatePath(`/products/${productId}`);
}
