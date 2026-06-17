'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Interacciones públicas en items de packs VIP: comentar y likear.
 * Requiere user logueado + enrolled en el curso. Si no, falla silencioso.
 */

async function isEnrolled(userId: string, courseId: string): Promise<{ ok: boolean; tenantId?: string }> {
  const svc = getServiceClient();
  // Validar enrollment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: enr } = await (svc.from('enrollments') as any)
    .select('id').eq('user_id', userId).eq('course_id', courseId).maybeSingle();
  if (!enr) return { ok: false };
  // Sacar tenant_id del course
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: c } = await (svc.from('courses') as any)
    .select('tenant_id').eq('id', courseId).maybeSingle();
  if (!c?.tenant_id) return { ok: false };
  return { ok: true, tenantId: c.tenant_id as string };
}

/* ===== Comments ===== */

export async function addVipCommentAction(formData: FormData): Promise<void> {
  const courseId = String(formData.get('course_id') ?? '');
  const itemId = String(formData.get('item_id') ?? '');
  const comment = String(formData.get('comment') ?? '').trim().slice(0, 1000);
  const slug = String(formData.get('slug') ?? '');
  if (!courseId || !itemId || !comment) return;

  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return;

  const enr = await isEnrolled(user.id, courseId);
  if (!enr.ok) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('vip_comments') as any).insert({
    tenant_id: enr.tenantId, course_id: courseId, item_id: itemId,
    user_id: user.id, comment
  });
  if (slug) revalidatePath(`/c/${slug}`);
}

export async function deleteVipCommentAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!id) return;
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return;
  const svc = getServiceClient();
  // Solo el autor o el owner del tenant pueden borrar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: comment } = await (svc.from('vip_comments') as any)
    .select('user_id, tenant_id').eq('id', id).maybeSingle();
  if (!comment) return;
  if (comment.user_id !== user.id) {
    // ¿Es owner del tenant?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mem } = await (svc.from('memberships') as any)
      .select('id').eq('tenant_id', comment.tenant_id).eq('user_id', user.id)
      .in('role', ['owner','admin']).maybeSingle();
    if (!mem) return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('vip_comments') as any).delete().eq('id', id);
  if (slug) revalidatePath(`/c/${slug}`);
}

/* ===== Likes ===== */

export async function toggleVipLikeAction(formData: FormData): Promise<void> {
  const courseId = String(formData.get('course_id') ?? '');
  const itemId = String(formData.get('item_id') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!courseId || !itemId) return;

  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return;

  const enr = await isEnrolled(user.id, courseId);
  if (!enr.ok) return;

  const svc = getServiceClient();
  // ¿Ya likeó?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('vip_likes') as any)
    .select('id').eq('course_id', courseId).eq('item_id', itemId).eq('user_id', user.id)
    .maybeSingle();
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('vip_likes') as any).delete().eq('id', existing.id);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('vip_likes') as any).insert({
      tenant_id: enr.tenantId, course_id: courseId, item_id: itemId, user_id: user.id
    });
  }
  if (slug) revalidatePath(`/c/${slug}`);
}
