'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { extractDriveFileId, buildEmbedUrl } from '@/lib/drive/embed';

export type Result<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$/;

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

  const payload = {
    tenant_id: tenant.id,
    slug,
    title,
    description,
    price_cents: priceCents,
    currency,
    status: 'draft',
    affiliate_enabled: true,
    created_by: userId
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('courses') as any)
    .insert(payload)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/courses');
  return { ok: true, data: { id: (data as { id: string }).id } };
}

const COVER_MAX_BYTES = 4 * 1024 * 1024; // 4MB
const COVER_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

function extFromMime(mime: string) {
  return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
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
  const cover = formData.get('cover') as File | null;

  if (!title) return { ok: false, error: 'El título es obligatorio.' };

  // Optional cover upload
  let coverUrl: string | undefined;
  if (cover && cover.size > 0) {
    if (cover.size > COVER_MAX_BYTES) {
      return { ok: false, error: 'La portada no puede pesar más de 4 MB.' };
    }
    if (!COVER_MIME.has(cover.type)) {
      return { ok: false, error: 'Formato no soportado. PNG, JPG o WebP.' };
    }
    const ext = extFromMime(cover.type);
    const path = `${tenant.id}/courses/${id}-${Date.now()}.${ext}`;
    const buf = new Uint8Array(await cover.arrayBuffer());
    const { error: upErr } = await svc.storage.from('branding').upload(path, buf, {
      contentType: cover.type,
      upsert: true
    });
    if (upErr) return { ok: false, error: `Upload portada falló: ${upErr.message}` };
    coverUrl = svc.storage.from('branding').getPublicUrl(path).data.publicUrl;
  }

  const payload: Record<string, unknown> = {
    title,
    description,
    price_cents: priceCents,
    affiliate_enabled: affiliateEnabled,
    is_featured: isFeatured,
    category_id: categoryId,
    updated_at: new Date().toISOString()
  };
  if (coverUrl) payload.cover_url = coverUrl;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('courses') as any)
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', tenant.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${id}`);
  revalidatePath('/courses');
  return { ok: true };
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
