'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/** Slug helper — lowercase, sin acentos, guiones únicos. */
function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 80) || `producto-${Date.now()}`;
}

/** Sanea URL simple (evita javascript:, data: y strings vacíos). */
function safeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^(https?:\/\/)/i.test(s)) return s.slice(0, 2000);
  return null;
}

/** Chequea que el tenant tenga is_supplier=true. Sino redirige al hub. */
async function requireSupplier(): Promise<{ tenantId: string }> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('tenants') as any)
      .select('is_supplier').eq('id', tenant.id).maybeSingle();
    if (!data?.is_supplier) redirect('/dropship');
  } catch {
    // Migration 0060 pendiente — no bloqueamos pero no vas a poder guardar.
  }
  return { tenantId: tenant.id };
}

/**
 * Activar / desactivar el rol supplier del tenant. Self-serve — cualquier
 * tenant activo puede prenderse el rol y empezar a publicar productos
 * mayoristas.
 */
export async function toggleSupplierRoleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const activate = String(formData.get('activate') ?? '') === 'true';

  // Defensivo: si migration 0060 pendiente, ignoramos silencioso — el owner
  // ve la página sin toggle porque no se pudo cargar el estado.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenants') as any)
      .update({ is_supplier: activate, updated_at: new Date().toISOString() })
      .eq('id', tenant.id);
    revalidatePath('/owner/dropship');
  } catch (e) {
    console.error('[toggleSupplierRole]', e);
  }
}

/**
 * Actualizar el perfil del supplier (display name + bio + lead time).
 * Se muestra a los resellers en el marketplace para que sepan a quién le
 * están comprando.
 */
export async function updateSupplierProfileAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const display_name = String(formData.get('display_name') ?? '').trim().slice(0, 80) || null;
  const bio = String(formData.get('bio') ?? '').trim().slice(0, 500) || null;
  const leadRaw = Number(formData.get('lead_time_days') ?? 0);
  const lead_time_days = Number.isFinite(leadRaw) && leadRaw > 0
    ? Math.min(60, Math.round(leadRaw))
    : null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenants') as any)
      .update({
        supplier_display_name: display_name,
        supplier_bio: bio,
        supplier_lead_time_days: lead_time_days,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenant.id);
    revalidatePath('/owner/dropship');
  } catch (e) {
    console.error('[updateSupplierProfile]', e);
  }
}

/* ─────────────────────────────────────────────────────────────
 * Supplier products — CRUD del catálogo mayorista.
 * ───────────────────────────────────────────────────────────── */

export async function createSupplierProductAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireSupplier();
  const title = String(formData.get('title') ?? '').trim().slice(0, 200) || 'Sin título';
  const svc = getServiceClient();
  const id = randomUUID();
  const slug = slugify(title);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('supplier_products') as any).insert({
      id, supplier_tenant_id: tenantId, slug, title,
      wholesale_price_cents: 0, currency: 'ARS', stock_qty: 0, status: 'draft'
    });
    revalidatePath('/owner/supplier/products');
    redirect(`/supplier/products/${id}`);
  } catch (e) {
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    console.error('[createSupplierProduct]', e);
    redirect('/dropship');
  }
}

export async function updateSupplierProductAction(id: string, formData: FormData): Promise<void> {
  const { tenantId } = await requireSupplier();
  const svc = getServiceClient();
  const title = String(formData.get('title') ?? '').trim().slice(0, 200) || 'Sin título';
  const description = String(formData.get('description') ?? '').trim().slice(0, 2000) || null;
  const wholesale = Math.max(0, Math.round(Number(formData.get('wholesale_price_cents') ?? 0)));
  const suggestedRaw = Number(formData.get('suggested_retail_cents') ?? 0);
  const suggested = suggestedRaw > 0 ? Math.round(suggestedRaw) : null;
  const minMarkupRaw = Number(formData.get('min_markup_percent') ?? 0);
  const minMarkup = minMarkupRaw > 0 ? Math.min(500, Math.round(minMarkupRaw)) : null;
  const sku = String(formData.get('sku') ?? '').trim().slice(0, 60) || null;
  const stockQty = Math.max(0, Math.round(Number(formData.get('stock_qty') ?? 0)));
  const trackStock = formData.get('track_stock') === 'on';
  const weightRaw = Number(formData.get('weight_g') ?? 0);
  const weightG = weightRaw > 0 ? Math.round(weightRaw) : null;
  const category = String(formData.get('category') ?? '').trim().slice(0, 80) || null;
  const originProvince = String(formData.get('origin_province') ?? '').trim().slice(0, 40) || null;
  const coverUrl = safeUrl(String(formData.get('cover_url') ?? ''));
  const galleryRaw = String(formData.get('gallery') ?? '').trim();
  const gallery = galleryRaw
    ? galleryRaw.split(/\r?\n/).map((s) => safeUrl(s)).filter((s): s is string => !!s).slice(0, 12)
    : [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('supplier_products') as any).update({
      title, description,
      wholesale_price_cents: wholesale,
      suggested_retail_cents: suggested,
      min_markup_percent: minMarkup,
      sku, stock_qty: stockQty, track_stock: trackStock,
      weight_g: weightG, category, origin_province: originProvince,
      cover_url: coverUrl, gallery,
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('supplier_tenant_id', tenantId);
    revalidatePath(`/owner/supplier/products/${id}`);
    revalidatePath('/owner/supplier/products');
  } catch (e) {
    console.error('[updateSupplierProduct]', e);
  }
}

export async function setSupplierProductStatusAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireSupplier();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') === 'published' ? 'published' : 'draft';
  if (!id) return;
  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('supplier_products') as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).eq('supplier_tenant_id', tenantId);
    revalidatePath(`/owner/supplier/products/${id}`);
    revalidatePath('/owner/supplier/products');
  } catch (e) {
    console.error('[setSupplierProductStatus]', e);
  }
}

export async function deleteSupplierProductAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireSupplier();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  try {
    // La FK en catalog_listings tiene ON DELETE CASCADE — se limpian los
    // listings de resellers automáticamente. El shadow physical_products
    // del reseller queda huérfano — el reseller lo verá como un producto
    // normal aunque el original desapareció. Ok para MVP.
    await svc.from('supplier_products').delete()
      .eq('id', id).eq('supplier_tenant_id', tenantId);
    revalidatePath('/owner/supplier/products');
    redirect('/supplier/products');
  } catch (e) {
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    console.error('[deleteSupplierProduct]', e);
  }
}

/* ─────────────────────────────────────────────────────────────
 * Reseller side: agregar producto mayorista a mi tienda.
 * Crea:
 *   1. Un row en catalog_listings con el markup
 *   2. Un shadow physical_products row en el catálogo del reseller,
 *      con el precio final (wholesale × markup) y snapshot de los
 *      datos del supplier product (título, cover, gallery, stock).
 * El buyer nunca ve la conexión — es white-label.
 * ───────────────────────────────────────────────────────────── */

export async function addListingAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const supplierProductId = String(formData.get('supplier_product_id') ?? '');
  const markupType = String(formData.get('markup_type') ?? 'percent') === 'fixed' ? 'fixed' : 'percent';
  const markupValueRaw = Number(formData.get('markup_value') ?? 40);
  const markupValue = Math.max(0, Math.min(1000000, markupValueRaw));
  if (!supplierProductId) return;

  try {
    // 1. Cargar supplier product para armar el shadow
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sp } = await (svc.from('supplier_products') as any)
      .select('*').eq('id', supplierProductId).eq('status', 'published').maybeSingle();
    if (!sp) return;

    // Enforce min_markup del supplier (si lo tiene y estamos en percent)
    let effectiveMarkup = markupValue;
    if (sp.min_markup_percent && markupType === 'percent' && effectiveMarkup < sp.min_markup_percent) {
      effectiveMarkup = sp.min_markup_percent;
    }

    // 2. Calcular precio final
    const finalPriceCents = markupType === 'percent'
      ? Math.round(sp.wholesale_price_cents * (1 + effectiveMarkup / 100))
      : sp.wholesale_price_cents + Math.round(effectiveMarkup);

    // 3. Slug único en physical_products del reseller (append suffix si colisiona)
    let slug = String(sp.slug || 'producto');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (svc.from('physical_products') as any)
      .select('slug').eq('tenant_id', tenant.id).ilike('slug', `${slug}%`);
    const existingSlugs = new Set(((existing ?? []) as Array<{ slug: string }>).map((r) => r.slug));
    if (existingSlugs.has(slug)) {
      let i = 2;
      while (existingSlugs.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }

    // 4. Crear shadow physical_products
    const physicalId = randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: pErr } = await (svc.from('physical_products') as any).insert({
      id: physicalId,
      tenant_id: tenant.id,
      slug,
      title: sp.title,
      description: sp.description,
      cover_url: sp.cover_url,
      gallery: sp.gallery ?? [],
      price_cents: finalPriceCents,
      currency: sp.currency ?? 'ARS',
      stock_qty: sp.stock_qty,
      track_stock: !!sp.track_stock,
      weight_g: sp.weight_g,
      requires_shipping: true,
      status: 'draft'   // reseller publica manualmente después
    });
    if (pErr) {
      console.error('[addListing] insert physical_products fallo:', pErr);
      return;
    }

    // 5. Crear catalog_listings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: lErr } = await (svc.from('catalog_listings') as any).insert({
      reseller_tenant_id: tenant.id,
      supplier_product_id: supplierProductId,
      physical_product_id: physicalId,
      markup_type: markupType,
      markup_value: effectiveMarkup
    });
    if (lErr) {
      // Rollback del shadow product
      await svc.from('physical_products').delete().eq('id', physicalId);
      console.error('[addListing] insert catalog_listings fallo:', lErr);
      return;
    }

    revalidatePath('/owner/dropship/browse');
    revalidatePath('/owner/dropship');
    revalidatePath('/owner/products');
    redirect(`/products/${physicalId}`);
  } catch (e) {
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    console.error('[addListing]', e);
  }
}

/* ─────────────────────────────────────────────────────────────
 * Supplier order fulfillment: marcar como enviada + tracking.
 * ───────────────────────────────────────────────────────────── */

export async function markSupplierOrderShippedAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireSupplier();
  const svc = getServiceClient();
  const orderId = String(formData.get('order_id') ?? '');
  const tracking = String(formData.get('tracking_number') ?? '').trim().slice(0, 60) || null;
  const carrier = String(formData.get('carrier') ?? '').trim().slice(0, 40) || null;
  const notes = String(formData.get('supplier_notes') ?? '').trim().slice(0, 500) || null;
  if (!orderId) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('supplier_orders') as any).update({
      status: 'shipped',
      shipped_at: new Date().toISOString(),
      tracking_number: tracking,
      carrier,
      supplier_notes: notes,
      updated_at: new Date().toISOString()
    }).eq('id', orderId).eq('supplier_tenant_id', tenantId);
    revalidatePath('/owner/supplier/orders');
    revalidatePath(`/owner/supplier/orders/${orderId}`);
  } catch (e) {
    console.error('[markSupplierOrderShipped]', e);
  }
}

export async function markSupplierOrderDeliveredAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireSupplier();
  const svc = getServiceClient();
  const orderId = String(formData.get('order_id') ?? '');
  if (!orderId) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('supplier_orders') as any).update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', orderId).eq('supplier_tenant_id', tenantId);
    revalidatePath('/owner/supplier/orders');
  } catch (e) {
    console.error('[markSupplierOrderDelivered]', e);
  }
}

export async function removeListingAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const listingId = String(formData.get('listing_id') ?? '');
  if (!listingId) return;
  const svc = getServiceClient();

  try {
    // Cargar el listing para conocer el shadow physical_product a borrar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: l } = await (svc.from('catalog_listings') as any)
      .select('id, physical_product_id')
      .eq('id', listingId).eq('reseller_tenant_id', tenant.id).maybeSingle();
    if (!l) return;

    await svc.from('catalog_listings').delete()
      .eq('id', listingId).eq('reseller_tenant_id', tenant.id);
    if (l.physical_product_id) {
      await svc.from('physical_products').delete()
        .eq('id', l.physical_product_id).eq('tenant_id', tenant.id);
    }
    revalidatePath('/owner/dropship/browse');
    revalidatePath('/owner/dropship');
    revalidatePath('/owner/products');
  } catch (e) {
    console.error('[removeListing]', e);
  }
}
