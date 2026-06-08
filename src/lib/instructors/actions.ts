'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner, requireInstructor } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/* ─────────── OWNER: alta de instructor + asignación de cursos ─────────── */

/**
 * Agrega un user existente como instructor del tenant via su email.
 * Si el email no existe en profiles, falla con error_no_user (el user
 * tiene que registrarse antes, vía signup público).
 */
export async function addInstructorAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return;
  const svc = getServiceClient();
  const { data: profile } = await svc
    .from('profiles').select('id, email').eq('email', email)
    .maybeSingle<{ id: string; email: string }>();
  if (!profile) {
    revalidatePath('/instructors');
    return; // silencioso por ahora — UI muestra error según query string si querés
  }
  // Verificar si ya tiene membership en este tenant
  const { data: existing } = await svc
    .from('memberships')
    .select('id, role, status')
    .eq('tenant_id', tenant.id)
    .eq('user_id', profile.id)
    .maybeSingle<{ id: string; role: string; status: string }>();

  if (existing) {
    if (existing.role !== 'instructor' || existing.status !== 'active') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('memberships') as any)
        .update({ role: 'instructor', status: 'active' })
        .eq('id', existing.id);
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('memberships') as any).insert({
      tenant_id: tenant.id, user_id: profile.id,
      role: 'instructor', status: 'active'
    });
  }
  revalidatePath('/instructors');
}

export async function removeInstructorAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const userId = String(formData.get('user_id') ?? '');
  if (!userId) return;
  const svc = getServiceClient();
  // Desactivamos la membership en vez de borrar (audit-friendly)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('memberships') as any)
    .update({ status: 'inactive' })
    .eq('tenant_id', tenant.id).eq('user_id', userId).eq('role', 'instructor');
  // Limpiamos sus asignaciones
  await svc.from('course_instructors').delete()
    .eq('tenant_id', tenant.id).eq('user_id', userId);
  revalidatePath('/instructors');
}

export async function assignCourseToInstructorAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const userId = String(formData.get('user_id') ?? '');
  const courseId = String(formData.get('course_id') ?? '');
  if (!userId || !courseId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('course_instructors') as any).upsert(
    { tenant_id: tenant.id, course_id: courseId, user_id: userId },
    { onConflict: 'course_id,user_id' }
  );
  revalidatePath('/instructors');
}

export async function unassignCourseFromInstructorAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const userId = String(formData.get('user_id') ?? '');
  const courseId = String(formData.get('course_id') ?? '');
  if (!userId || !courseId) return;
  const svc = getServiceClient();
  await svc.from('course_instructors').delete()
    .eq('tenant_id', tenant.id).eq('course_id', courseId).eq('user_id', userId);
  revalidatePath('/instructors');
}

export async function setInstructorPermissionAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const userId = String(formData.get('user_id') ?? '');
  const courseId = String(formData.get('course_id') ?? '');
  const field = String(formData.get('field') ?? '');
  const value = formData.get('value') === 'true';
  if (!userId || !courseId) return;
  if (!['can_edit_calendar', 'can_reschedule', 'can_view_students'].includes(field)) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('course_instructors') as any)
    .update({ [field]: value })
    .eq('tenant_id', tenant.id).eq('course_id', courseId).eq('user_id', userId);
  revalidatePath('/instructors');
}

/* ─────────── INSTRUCTOR: reagendar reserva ─────────── */

/**
 * Mueve un booking a un nuevo slot. Solo permitido si el instructor tiene
 * can_reschedule=true en el curso del booking. Anti-double-booking via
 * UNIQUE de la DB.
 */
export async function rescheduleBookingAction(formData: FormData): Promise<void> {
  const { tenant, userId } = await requireInstructor();
  const bookingId = String(formData.get('booking_id') ?? '');
  const newSlotStartRaw = String(formData.get('new_slot_start') ?? '').trim();
  if (!bookingId || !newSlotStartRaw) return;
  const newStart = new Date(newSlotStartRaw);
  if (Number.isNaN(newStart.getTime())) return;

  const svc = getServiceClient();
  // Cargar booking + verificar curso pertenece al tenant + permisos del instructor
  const { data: booking } = await svc
    .from('bookings')
    .select('id, tenant_id, course_id, slot_start, slot_end')
    .eq('id', bookingId).eq('tenant_id', tenant.id)
    .maybeSingle<{ id: string; tenant_id: string; course_id: string; slot_start: string; slot_end: string }>();
  if (!booking) return;

  const { data: perm } = await svc
    .from('course_instructors')
    .select('can_reschedule')
    .eq('course_id', booking.course_id).eq('user_id', userId)
    .maybeSingle<{ can_reschedule: boolean }>();
  if (!perm?.can_reschedule) return;

  // Mantener la duración original del slot
  const durMs = new Date(booking.slot_end).getTime() - new Date(booking.slot_start).getTime();
  const newEnd = new Date(newStart.getTime() + durMs);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('bookings') as any)
    .update({ slot_start: newStart.toISOString(), slot_end: newEnd.toISOString() })
    .eq('id', bookingId).eq('tenant_id', tenant.id);
  if (error) return; // probablemente UNIQUE violation (slot ocupado) — UI muestra
  revalidatePath('/instructor/courses');
  revalidatePath(`/instructor/courses/${booking.course_id}`);
}

export async function cancelBookingAction(formData: FormData): Promise<void> {
  const { tenant, userId } = await requireInstructor();
  const bookingId = String(formData.get('booking_id') ?? '');
  if (!bookingId) return;
  const svc = getServiceClient();
  const { data: booking } = await svc
    .from('bookings').select('course_id').eq('id', bookingId).eq('tenant_id', tenant.id)
    .maybeSingle<{ course_id: string }>();
  if (!booking) return;
  const { data: perm } = await svc
    .from('course_instructors').select('can_reschedule')
    .eq('course_id', booking.course_id).eq('user_id', userId)
    .maybeSingle<{ can_reschedule: boolean }>();
  if (!perm?.can_reschedule) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('bookings') as any)
    .update({ status: 'cancelled' })
    .eq('id', bookingId).eq('tenant_id', tenant.id);
  revalidatePath(`/instructor/courses/${booking.course_id}`);
}
