'use server';

import { revalidatePath } from 'next/cache';
import { requireInstructor } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { hhmmToMin } from '@/lib/calendar/types';

const VALID_TZS = new Set([
  'America/Argentina/Buenos_Aires',
  'America/Argentina/Cordoba',
  'America/Argentina/Mendoza',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Montevideo',
  'UTC'
]);

/** Instructor crea un bloque de su propia disponibilidad. */
export async function addInstructorAvailabilityAction(formData: FormData): Promise<void> {
  const { userId, tenant } = await requireInstructor();
  const weekday = parseInt(String(formData.get('weekday') ?? ''), 10);
  const start = hhmmToMin(String(formData.get('start_time') ?? '').trim());
  const end = hhmmToMin(String(formData.get('end_time') ?? '').trim());
  const duration = parseInt(String(formData.get('slot_duration_min') ?? '60'), 10);
  const tz = String(formData.get('timezone') ?? 'America/Argentina/Buenos_Aires');
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return;
  if (end <= start) return;
  const slotDur = Math.min(480, Math.max(5, Number.isFinite(duration) ? duration : 60));
  const safeTz = VALID_TZS.has(tz) ? tz : 'America/Argentina/Buenos_Aires';

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('availability_rules') as any).insert({
    tenant_id: tenant.id,
    instructor_user_id: userId,
    weekday,
    start_min: start,
    end_min: end,
    slot_duration_min: slotDur,
    timezone: safeTz
  });
  revalidatePath('/instructor/availability');
}

export async function deleteInstructorAvailabilityAction(formData: FormData): Promise<void> {
  const { userId, tenant } = await requireInstructor();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('availability_rules').delete()
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .eq('instructor_user_id', userId);
  revalidatePath('/instructor/availability');
}

/* ─── Fechas puntuales (one-off) del instructor ─── */

export async function addInstructorCalendarDateAction(formData: FormData): Promise<void> {
  const { userId, tenant } = await requireInstructor();
  const date = String(formData.get('date') ?? '').trim();
  const start = hhmmToMin(String(formData.get('start_time') ?? '').trim());
  const end = hhmmToMin(String(formData.get('end_time') ?? '').trim());
  const duration = parseInt(String(formData.get('slot_duration_min') ?? '60'), 10);
  const tz = String(formData.get('timezone') ?? 'America/Argentina/Buenos_Aires');
  const notes = String(formData.get('notes') ?? '').slice(0, 200) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  if (end <= start) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('calendar_dates') as any).insert({
    tenant_id: tenant.id,
    instructor_user_id: userId,
    date,
    start_min: start,
    end_min: end,
    slot_duration_min: Math.min(480, Math.max(5, Number.isFinite(duration) ? duration : 60)),
    timezone: VALID_TZS.has(tz) ? tz : 'America/Argentina/Buenos_Aires',
    notes
  });
  revalidatePath('/instructor/availability');
}

export async function deleteInstructorCalendarDateAction(formData: FormData): Promise<void> {
  const { userId, tenant } = await requireInstructor();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('calendar_dates').delete()
    .eq('id', id).eq('tenant_id', tenant.id)
    .eq('instructor_user_id', userId);
  revalidatePath('/instructor/availability');
}

/* ─── Pausas / cancelaciones del instructor ─── */

export async function addInstructorOverrideAction(formData: FormData): Promise<void> {
  const { userId, tenant } = await requireInstructor();
  const startAt = String(formData.get('start_at') ?? '').trim();
  const endAt = String(formData.get('end_at') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').slice(0, 200) || null;
  if (!startAt || !endAt) return;
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
  if (end.getTime() <= start.getTime()) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('availability_overrides') as any).insert({
    tenant_id: tenant.id,
    instructor_user_id: userId,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    reason
  });
  revalidatePath('/instructor/availability');
}

export async function deleteInstructorOverrideAction(formData: FormData): Promise<void> {
  const { userId, tenant } = await requireInstructor();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('availability_overrides').delete()
    .eq('id', id).eq('tenant_id', tenant.id)
    .eq('instructor_user_id', userId);
  revalidatePath('/instructor/availability');
}
