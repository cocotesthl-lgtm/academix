'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { extractDriveFileId, buildEmbedUrl } from '@/lib/drive/embed';
import { getProductTypeSpec, type ProductType } from '@/lib/courses/product-types';

export type Result<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$/;

/** Solo aceptamos URLs http(s) para evitar javascript:/data: u otros esquemas. */
function safeImageUrl(raw: string): string | null {
  const v = raw.trim();
  if (v === '') return null;
  if (v.length > 2048) return null;
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? v : null;
  } catch {
    return null;
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

/* =====================================================================
 * Courses
 * ===================================================================== */

export async function createCourseAction(
  _prev: Result<{ id: string }> | null,
  formData: FormData
): Promise<Result<{ id: string }>> {
  const { tenant, userId } = await requireOwner();
  const svc = getServiceClient();

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const priceRaw = String(formData.get('price') ?? '0').replace(/[^0-9.]/g, '');
  const currency = String(formData.get('currency') ?? 'ARS').toUpperCase();
  const productTypeRaw = String(formData.get('product_type') ?? 'course').trim() as ProductType;
  const coverUrlInput = safeImageUrl(String(formData.get('cover_url') ?? ''));
  const spec = getProductTypeSpec(productTypeRaw);

  if (!title) return { ok: false, error: 'El título es obligatorio.' };
  const priceCents = Math.round(parseFloat(priceRaw || '0') * 100);
  if (Number.isNaN(priceCents) || priceCents < 0) {
    return { ok: false, error: 'Precio inválido.' };
  }

  // Slug: derive from title, ensure uniqueness in this tenant
  let slug = slugify(title);
  if (!SLUG_RE.test(slug)) slug = `curso-${Date.now()}`;

  // Try original, then append random suffix on conflict
  const baseSlug = slug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const tryslug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.floor(Math.random() * 9999)}`;
    const { data: existing } = await svc
      .from('courses')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('slug', tryslug)
      .maybeSingle();
    if (!existing) {
      slug = tryslug;
      break;
    }
  }

  // Base payload (siempre se inserta)
  const basePayload: Record<string, unknown> = {
    tenant_id: tenant.id,
    slug,
    title,
    description,
    price_cents: priceCents,
    currency,
    status: 'draft',
    affiliate_enabled: true,
    created_by: userId,
    ...(coverUrlInput ? { cover_url: coverUrlInput } : {})
  };

  // Defaults inteligentes según tipo de producto (migration 0036 + 0035 + 0012)
  // Si la migración no corrió, retry sin esas cols para no romper.
  const richPayload: Record<string, unknown> = {
    ...basePayload,
    product_type: spec.id,
    landing_template: spec.landingTemplate,
    calendar_mode: spec.calendarMode,
    pricing_mode: spec.pricingMode,
    content_title: spec.contentTitle,
    module_label: spec.moduleLabel,
    lesson_label: spec.lessonLabel,
    show_content_section: spec.showContentSection
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = await (svc.from('courses') as any)
    .insert(richPayload).select('id').single();

  if (error) {
    // Retry con sólo base si alguna columna no existe (migration pendiente)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry = await (svc.from('courses') as any).insert(basePayload).select('id').single();
    data = retry.data; error = retry.error;
  }

  if (error) return { ok: false, error: error.message };
  revalidatePath('/courses');
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateCourseAction(
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'ID faltante.' };

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const priceRaw = String(formData.get('price') ?? '0').replace(/[^0-9.]/g, '');
  const priceCents = Math.round(parseFloat(priceRaw || '0') * 100);
  const affiliateEnabled = formData.get('affiliate_enabled') === 'on';
  const isFeatured = formData.get('is_featured') === 'on';
  const categoryRaw = String(formData.get('category_id') ?? '').trim();
  const categoryId = categoryRaw === '' ? null : categoryRaw;
  // URL-only: el owner pega un link público (Drive/Imgur/Unsplash/etc.)
  const coverUrlRaw = String(formData.get('cover_url') ?? '');

  if (!title) return { ok: false, error: 'El título es obligatorio.' };

  // Landing template + config (estructura de la landing del curso). Sólo
  // se actualiza si el form lo manda explícitamente, así otros saves
  // (Guardar info básica) no resetean la landing config.
  const landingTemplateRaw = String(formData.get('landing_template') ?? '').trim();
  const landingConfigRaw = String(formData.get('landing_config') ?? '').trim();
  const landingVariantsRaw = String(formData.get('landing_variants') ?? '').trim();

  const payload: Record<string, unknown> = {
    title,
    description,
    price_cents: priceCents,
    affiliate_enabled: affiliateEnabled,
    is_featured: isFeatured,
    category_id: categoryId,
    updated_at: new Date().toISOString()
  };
  // Solo actualizamos cover_url si llegó algo (string vacío también permite limpiar)
  if (formData.has('cover_url')) {
    payload.cover_url = safeImageUrl(coverUrlRaw);
  }
  if (formData.has('landing_template') && ['classic', 'hotmart', 'funnel', 'vsl'].includes(landingTemplateRaw)) {
    payload.landing_template = landingTemplateRaw;
  }
  if (formData.has('landing_config') && landingConfigRaw) {
    try {
      payload.landing_config = JSON.parse(landingConfigRaw);
    } catch {
      // si el JSON viene roto lo ignoramos en silencio
    }
  }
  if (formData.has('landing_variants')) {
    try {
      payload.landing_variants = landingVariantsRaw ? JSON.parse(landingVariantsRaw) : null;
    } catch {
      // JSON inválido → no tocamos
    }
  }

  // Wallet bonus: cuántos centavos de saldo se acreditan al buyer al
  // comprar este producto. Solo lo persistimos si el form lo mandó —
  // así saves parciales no lo pisan.
  if (formData.has('wallet_bonus')) {
    const bonusRaw = String(formData.get('wallet_bonus') ?? '0').replace(/[^0-9.]/g, '');
    const bonusCents = Math.max(0, Math.round(parseFloat(bonusRaw || '0') * 100));
    payload.wallet_bonus_cents = bonusCents;
  }

  // Precio específico para PayPal (patrón Hotmart — precio USD/EUR/etc
  // separado del ARS). Opt-in: si el owner deja el campo vacío, se
  // guarda null y PayPal cae al price_cents en su moneda.
  if (formData.has('paypal_price')) {
    const raw = String(formData.get('paypal_price') ?? '').replace(/[^0-9.]/g, '').trim();
    payload.paypal_price_cents = raw === '' || raw === '0'
      ? null
      : Math.max(0, Math.round(parseFloat(raw) * 100));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('courses') as any)
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', tenant.id);

  // Retry defensivo: si la migration 0061 (wallet_bonus_cents) o la
  // 0065 (paypal_price_cents) no corrió, sacamos el campo problemático
  // del payload y reintentamos.
  if (error && (
    error.message?.toLowerCase().includes('wallet_bonus_cents') ||
    error.message?.toLowerCase().includes('paypal_price_cents')
  )) {
    delete payload.wallet_bonus_cents;
    delete payload.paypal_price_cents;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: retryErr } = await (svc.from('courses') as any)
      .update(payload)
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    if (retryErr) return { ok: false, error: retryErr.message };
    revalidatePath(`/courses/${id}`);
    revalidatePath('/courses');
    return { ok: true };
  }

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${id}`);
  revalidatePath('/courses');
  return { ok: true };
}

/** Labels editables de la sección "Contenido del curso" en la página
 *  pública del producto (defensivo: ignora silenciosamente si migration
 *  0035 no corrió). */
export async function setCourseContentLabelsAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const payload: Record<string, unknown> = {
    content_title: String(formData.get('content_title') ?? '').trim().slice(0, 80) || null,
    module_label: String(formData.get('module_label') ?? '').trim().slice(0, 40) || null,
    lesson_label: String(formData.get('lesson_label') ?? '').trim().slice(0, 40) || null,
    show_content_section: formData.get('show_content_section') === 'on',
    updated_at: new Date().toISOString()
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('courses') as any).update(payload).eq('id', id).eq('tenant_id', tenant.id);
  } catch { /* migration pendiente */ }
  revalidatePath(`/courses/${id}`);
}

export async function setCourseStatusAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !['draft', 'published', 'archived'].includes(status)) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('courses') as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenant.id);
  revalidatePath('/courses');
  revalidatePath(`/courses/${id}`);
}

/** Cinta (ribbon) que aparece sobre la tarjeta del curso en el catálogo. */
export async function setCourseRibbonAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const text = String(formData.get('ribbon_text') ?? '').trim().slice(0, 30) || null;
  const toneRaw = String(formData.get('ribbon_tone') ?? 'featured');
  const tone = ['featured', 'sale', 'urgent', 'new', 'info'].includes(toneRaw) ? toneRaw : 'featured';
  const svc = getServiceClient();
  // Defensivo: si migration 0029 no corrió, retry sin las columnas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('courses') as any)
    .update({ ribbon_text: text, ribbon_tone: tone, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenant.id);
  if (error && error.message?.includes('ribbon')) {
    console.warn('[setCourseRibbon] migration 0029 falta');
  }
  revalidatePath(`/courses/${id}`);
  revalidatePath('/courses');
}

export async function deleteCourseAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await svc.from('courses').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/courses');
  redirect('/courses');
}

/* =====================================================================
 * Modules
 * ===================================================================== */

export async function addModuleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const courseId = String(formData.get('course_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!courseId || !title) return;

  const { count } = await svc
    .from('modules')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('modules') as any).insert({
    tenant_id: tenant.id,
    course_id: courseId,
    title,
    position: count ?? 0
  });
  revalidatePath(`/courses/${courseId}`);
}

export async function deleteModuleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const id = String(formData.get('id') ?? '');
  const courseId = String(formData.get('course_id') ?? '');
  if (!id) return;
  await svc.from('modules').delete().eq('id', id).eq('tenant_id', tenant.id);
  if (courseId) revalidatePath(`/courses/${courseId}`);
}

/* =====================================================================
 * Lessons
 * ===================================================================== */

export async function addLessonAction(
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const moduleId = String(formData.get('module_id') ?? '');
  const courseId = String(formData.get('course_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const driveLink = String(formData.get('drive_link') ?? '').trim();
  const isPreview = formData.get('is_preview') === 'on';

  if (!moduleId || !title) return { ok: false, error: 'Faltan datos.' };

  let driveFileId: string | null = null;
  let embedUrl: string | null = null;
  if (driveLink) {
    driveFileId = extractDriveFileId(driveLink);
    if (!driveFileId) {
      return { ok: false, error: 'No pudimos detectar un Drive file ID válido en ese link.' };
    }
    embedUrl = buildEmbedUrl(driveFileId);
  }

  const { count } = await svc
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('module_id', moduleId);

  const payload = {
    tenant_id: tenant.id,
    module_id: moduleId,
    title,
    drive_file_id: driveFileId,
    drive_embed_url: embedUrl,
    is_preview: isPreview,
    position: count ?? 0
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('lessons') as any).insert(payload);
  if (error) return { ok: false, error: error.message };

  if (courseId) revalidatePath(`/courses/${courseId}`);
  return { ok: true };
}

export async function deleteLessonAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const id = String(formData.get('id') ?? '');
  const courseId = String(formData.get('course_id') ?? '');
  if (!id) return;
  await svc.from('lessons').delete().eq('id', id).eq('tenant_id', tenant.id);
  if (courseId) revalidatePath(`/courses/${courseId}`);
}

export async function toggleLessonPreviewAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const id = String(formData.get('id') ?? '');
  const isPreview = formData.get('is_preview') === 'true';
  const courseId = String(formData.get('course_id') ?? '');
  if (!id) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('lessons') as any)
    .update({ is_preview: !isPreview })
    .eq('id', id)
    .eq('tenant_id', tenant.id);
  if (courseId) revalidatePath(`/courses/${courseId}`);
}
