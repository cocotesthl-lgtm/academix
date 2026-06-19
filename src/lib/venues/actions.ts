'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/** Crear nueva sede del tenant */
export async function createVenueAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  if (!name) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('venues') as any).insert({
    tenant_id: tenant.id,
    name,
    address: String(formData.get('address') ?? '').trim().slice(0, 280) || null,
    phone: String(formData.get('phone') ?? '').trim().slice(0, 40) || null,
    notes: String(formData.get('notes') ?? '').trim().slice(0, 500) || null
  });
  revalidatePath('/owner/venues');
}

export async function updateVenueAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  if (!name) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('venues') as any).update({
    name,
    address: String(formData.get('address') ?? '').trim().slice(0, 280) || null,
    phone: String(formData.get('phone') ?? '').trim().slice(0, 40) || null,
    notes: String(formData.get('notes') ?? '').trim().slice(0, 500) || null,
    active: formData.get('active') === 'on',
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/venues');
}

export async function deleteVenueAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('venues').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/venues');
}

/** Toggle vinculación sede ↔ producto */
export async function toggleCourseVenueAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  const venueId = String(formData.get('venue_id') ?? '');
  if (!courseId || !venueId) return;
  const svc = getServiceClient();

  // Verificar que tanto course como venue son del tenant
  const { data: c } = await svc.from('courses').select('id').eq('id', courseId).eq('tenant_id', tenant.id).maybeSingle();
  const { data: v } = await svc.from('venues').select('id').eq('id', venueId).eq('tenant_id', tenant.id).maybeSingle();
  if (!c || !v) return;

  const { data: existing } = await svc.from('course_venues').select('course_id').eq('course_id', courseId).eq('venue_id', venueId).maybeSingle();
  if (existing) {
    await svc.from('course_venues').delete().eq('course_id', courseId).eq('venue_id', venueId);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('course_venues') as any).insert({ course_id: courseId, venue_id: venueId });
  }
  revalidatePath(`/owner/courses/${courseId}`);
}

/** Cambiar estado de una reserva (confirmar / cancelar / completada / no_show) */
export async function setReservationStatusAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !['pending','confirmed','cancelled','completed','no_show'].includes(status)) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('reservations') as any).update({ status }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/reservas');
}
