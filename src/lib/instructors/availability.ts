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
