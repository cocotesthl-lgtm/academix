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
  const mode = (['none', 'start_date', 'mentorship_slot', 'event_tickets'] as const)
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
  capacity?: number;
  seatMode?: 'none' | 'grid' | 'zones';
  seatRows?: number;
  seatCols?: number;
  seatZones?: Array<{ id: string; name: string; rows: number; cols: number; price_multiplier: number; color?: string }>;
}): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) return;
  if (opts.endMin <= opts.startMin) return;
  const seatMode = opts.seatMode === 'grid' || opts.seatMode === 'zones' ? opts.seatMode : 'none';
  // Sanear zonas
  const zones = (opts.seatZones ?? [])
    .filter((z) => z && z.id && z.name && z.rows > 0 && z.cols > 0)
    .map((z) => ({
      id: String(z.id).slice(0, 40).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'zone',
      name: String(z.name).slice(0, 60),
      rows: Math.max(1, Math.min(100, z.rows)),
      cols: Math.max(1, Math.min(100, z.cols)),
      price_multiplier: Math.max(0, Math.min(100, z.price_multiplier ?? 1)),
      color: typeof z.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(z.color) ? z.color : undefined
    }))
    .slice(0, 20);
  // Capacity en modo zones = suma de filas × cols
  const computedCapacity = seatMode === 'zones'
    ? zones.reduce((sum, z) => sum + z.rows * z.cols, 0)
    : Math.max(0, Math.min(10000, opts.capacity ?? 0));

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
    notes: opts.notes ?? null,
    capacity: computedCapacity,
    seat_mode: seatMode,
    seat_rows: Math.max(0, Math.min(100, opts.seatRows ?? 0)),
    seat_cols: Math.max(0, Math.min(100, opts.seatCols ?? 0)),
    seat_zones: zones
  });
}

export async function addOwnerCalendarDateAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '') || null;
  const seatModeRaw = String(formData.get('seat_mode') ?? 'none');
  const seatMode: 'none' | 'grid' | 'zones' =
    seatModeRaw === 'grid' ? 'grid' : seatModeRaw === 'zones' ? 'zones' : 'none';
  // Zones llega como JSON serializado en hidden input
  let seatZones: Array<{ id: string; name: string; rows: number; cols: number; price_multiplier: number; color?: string }> = [];
  try {
    const parsed = JSON.parse(String(formData.get('seat_zones') ?? '[]'));
    if (Array.isArray(parsed)) seatZones = parsed;
  } catch { /* json inválido — ignoramos */ }

  await addCalendarDate({
    tenantId: tenant.id,
    courseId,
    date: String(formData.get('date') ?? '').trim(),
    startMin: hhmmToMin(String(formData.get('start_time') ?? '').trim()),
    endMin: hhmmToMin(String(formData.get('end_time') ?? '').trim()),
    slotDur: parseInt(String(formData.get('slot_duration_min') ?? '60'), 10),
    timezone: String(formData.get('timezone') ?? 'America/Argentina/Buenos_Aires'),
    notes: String(formData.get('notes') ?? '').slice(0, 200) || null,
    capacity: parseInt(String(formData.get('capacity') ?? '0'), 10) || 0,
    seatMode,
    seatRows: parseInt(String(formData.get('seat_rows') ?? '0'), 10) || 0,
    seatCols: parseInt(String(formData.get('seat_cols') ?? '0'), 10) || 0,
    seatZones
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
