'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireOwner } from '@/lib/auth/guards';

export type EnrollResult = { ok: true } | { ok: false; error: string };

export async function grantEnrollmentAction(formData: FormData): Promise<EnrollResult> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const courseId = String(formData.get('course_id') ?? '');
  const userEmail = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!courseId || !userEmail) return { ok: false, error: 'Faltan datos.' };

  // Validate course belongs to tenant
  const { data: course } = await svc
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .eq('tenant_id', tenant.id)
    .maybeSingle();
  if (!course) return { ok: false, error: 'Curso no encontrado.' };

  // Find user by email
  const { data: profile } = await svc
    .from('profiles')
    .select('id')
    .eq('email', userEmail)
    .maybeSingle<{ id: string }>();
  if (!profile) return { ok: false, error: 'No existe ningún usuario con ese email.' };

  // Idempotent enrollment
  const payload = {
    tenant_id: tenant.id,
    course_id: courseId,
    user_id: profile.id,
    source: 'founder_grant',
    status: 'active'
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('enrollments') as any).insert(payload);
  if (error && !error.message.includes('duplicate')) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/courses/${courseId}`);
  return { ok: true };
}

export async function markLessonCompleteAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const svc = getServiceClient();
  const enrollmentId = String(formData.get('enrollment_id') ?? '');
  const lessonId = String(formData.get('lesson_id') ?? '');
  const tenantId = String(formData.get('tenant_id') ?? '');
  const completed = formData.get('completed') === 'true';
  if (!enrollmentId || !lessonId) return;

  // Upsert progress
  const payload = {
    tenant_id: tenantId,
    enrollment_id: enrollmentId,
    lesson_id: lessonId,
    user_id: user.id,
    completed_at: completed ? null : new Date().toISOString(),
    last_position_seconds: 0
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('lesson_progress') as any).upsert(payload, {
    onConflict: 'enrollment_id,lesson_id'
  });

  revalidatePath(`/learn`);
}

/**
 * Cambia el estado de una inscripción: active | suspended | cancelled.
 * Solo el owner del tenant puede ejecutarla.
 */
export async function setEnrollmentStatusAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const enrollmentId = String(formData.get('enrollment_id') ?? '');
  const status = String(formData.get('status') ?? '');

  if (!enrollmentId) return;
  if (!['active', 'suspended', 'cancelled'].includes(status)) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('enrollments') as any)
    .update({ status })
    .eq('id', enrollmentId)
    .eq('tenant_id', tenant.id);

  revalidatePath('/students');
}

/**
 * Edita los datos de contacto de un alumno inscripto: name/dni/phone/location.
 * No edita el email porque eso podría romper el login del alumno.
 */
export async function updateEnrollmentBuyerInfoAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const enrollmentId = String(formData.get('enrollment_id') ?? '');
  if (!enrollmentId) return;

  const buyerName     = String(formData.get('buyer_name')     ?? '').trim().slice(0, 120) || null;
  const buyerDni      = String(formData.get('buyer_dni')      ?? '').trim().slice(0, 20)  || null;
  const buyerLocation = String(formData.get('buyer_location') ?? '').trim().slice(0, 120) || null;
  const buyerPhone    = String(formData.get('buyer_phone')    ?? '').trim().slice(0, 30)  || null;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('enrollments') as any)
    .update({
      buyer_name: buyerName,
      buyer_dni: buyerDni,
      buyer_location: buyerLocation,
      buyer_phone: buyerPhone
    })
    .eq('id', enrollmentId)
    .eq('tenant_id', tenant.id);

  revalidatePath('/students');
}

/**
 * Elimina una inscripción. NO devuelve la plata — el owner debe gestionar
 * el reembolso desde MercadoPago aparte. Solo borra el registro y revoca
 * el acceso al curso.
 */
export async function deleteEnrollmentAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const enrollmentId = String(formData.get('enrollment_id') ?? '');
  if (!enrollmentId) return;

  const svc = getServiceClient();
  await svc.from('enrollments').delete().eq('id', enrollmentId).eq('tenant_id', tenant.id);

  revalidatePath('/students');
}

export async function isEnrolled(userId: string, courseId: string): Promise<{ enrolled: boolean; enrollmentId?: string }> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('status', 'active')
    .maybeSingle<{ id: string }>();
  return data ? { enrolled: true, enrollmentId: data.id } : { enrolled: false };
}
