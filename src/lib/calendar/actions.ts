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

/** Source del calendario del curso: 'instructor' (slots de los instructores
 *  asignados) o 'owner' (slots tenant-wide + fechas puntuales del owner). */
export async function setCourseCalendarSourceAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  const sourceRaw = String(formData.get('source') ?? 'instructor');
  const source = sourceRaw === 'owner' ? 'owner' : 'instructor';
  if (!courseId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('courses') as any)
    .update({ calendar_source: source, updated_at: new Date().toISOString() })
    .eq('id', courseId).eq('tenant_id', tenant.id);
  revalidatePath(`/courses/${courseId}`);
}

/* ─── Fechas puntuales (one-off) ─── */

const VALID_TZS_ALL = new Set([
  'America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba',
  'America/Argentina/Mendoza', 'America/Sao_Paulo', 'America/Mexico_City',
  'America/Bogota', 'America/Lima', 'America/Santiago',
  'America/Montevideo', 'UTC'
]);

async function addCalendarDate(opts: {
  tenantId: string;
  courseId?: string | null;
  instructorUserId?: string | null;
  date: string;
  startMin: number;
  endMin: number;
  slotDur: number;
  timezone: string;
  notes?: string | null;
}): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) return;
  if (opts.endMin <= opts.startMin) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('calendar_dates') as any).insert({
    tenant_id: opts.tenantId,
    course_id: opts.courseId ?? null,
    instructor_user_id: opts.instructorUserId ?? null,
    date: opts.date,
    start_min: opts.startMin,
    end_min: opts.endMin,
    slot_duration_min: opts.slotDur,
    timezone: VALID_TZS_ALL.has(opts.timezone) ? opts.timezone : 'America/Argentina/Buenos_Aires',
    notes: opts.notes ?? null
  });
}

export async function addOwnerCalendarDateAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '') || null;
  await addCalendarDate({
    tenantId: tenant.id,
    courseId,
    date: String(formData.get('date') ?? '').trim(),
    startMin: hhmmToMin(String(formData.get('start_time') ?? '').trim()),
    endMin: hhmmToMin(String(formData.get('end_time') ?? '').trim()),
    slotDur: parseInt(String(formData.get('slot_duration_min') ?? '60'), 10),
    timezone: String(formData.get('timezone') ?? 'America/Argentina/Buenos_Aires'),
    notes: String(formData.get('notes') ?? '').slice(0, 200) || null
  });
  revalidatePath('/availability');
}

export async function deleteOwnerCalendarDateAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('calendar_dates').delete()
    .eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/availability');
}

/* ─── Pausas / cancelaciones ─── */

async function addOverride(opts: {
  tenantId: string;
  instructorUserId?: string | null;
  courseId?: string | null;
  startAt: string;
  endAt: string;
  reason?: string | null;
}): Promise<void> {
  if (!opts.startAt || !opts.endAt) return;
  const start = new Date(opts.startAt);
  const end = new Date(opts.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
  if (end.getTime() <= start.getTime()) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('availability_overrides') as any).insert({
    tenant_id: opts.tenantId,
    instructor_user_id: opts.instructorUserId ?? null,
    course_id: opts.courseId ?? null,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    reason: opts.reason?.slice(0, 200) ?? null
  });
}

export async function addOwnerOverrideAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '') || null;
  await addOverride({
    tenantId: tenant.id,
    courseId,
    startAt: String(formData.get('start_at') ?? '').trim(),
    endAt: String(formData.get('end_at') ?? '').trim(),
    reason: String(formData.get('reason') ?? '').slice(0, 200) || null
  });
  revalidatePath('/availability');
}

export async function deleteOwnerOverrideAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('availability_overrides').delete()
    .eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/availability');
}
