'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { hhmmToMin } from './types';

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

/** Crear regla de disponibilidad semanal */
export async function addAvailabilityRuleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const weekday = parseInt(String(formData.get('weekday') ?? ''), 10);
  const startHHMM = String(formData.get('start_time') ?? '').trim();
  const endHHMM = String(formData.get('end_time') ?? '').trim();
  const duration = parseInt(String(formData.get('slot_duration_min') ?? '60'), 10);
  const tz = String(formData.get('timezone') ?? 'America/Argentina/Buenos_Aires');

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return;
  const start = hhmmToMin(startHHMM);
  const end = hhmmToMin(endHHMM);
  if (end <= start) return;
  const slotDur = Math.min(480, Math.max(5, Number.isFinite(duration) ? duration : 60));
  const safeTz = VALID_TZS.has(tz) ? tz : 'America/Argentina/Buenos_Aires';

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('availability_rules') as any).insert({
    tenant_id: tenant.id,
    weekday,
    start_min: start,
    end_min: end,
    slot_duration_min: slotDur,
    timezone: safeTz
  });
  revalidatePath('/availability');
}

export async function deleteAvailabilityRuleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('availability_rules').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/availability');
}

/** Toggle calendar mode + label desde el editor de curso. */
export async function setCourseCalendarAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  if (!courseId) return;
  const modeRaw = String(formData.get('mode') ?? 'none');
  const mode = (['none', 'start_date', 'mentorship_slot'] as const)
    .find((m) => m === modeRaw) ?? 'none';
  const label = String(formData.get('label') ?? '').trim().slice(0, 120) || null;
  const required = formData.get('required') === 'true' || formData.get('required') === 'on';
  const horizonRaw = parseInt(String(formData.get('horizon_days') ?? '30'), 10);
  const horizon = Math.min(180, Math.max(1, Number.isFinite(horizonRaw) ? horizonRaw : 30));

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('courses') as any)
    .update({
      calendar_mode: mode,
      calendar_label: label,
      calendar_required: required,
      calendar_horizon_days: horizon,
      updated_at: new Date().toISOString()
    })
    .eq('id', courseId).eq('tenant_id', tenant.id);
  revalidatePath(`/courses/${courseId}`);
}
