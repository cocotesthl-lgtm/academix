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

/** Cambiar estado de una reserva (confirmar / cancelar / completada / no_show) + email */
export async function setReservationStatusAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !['pending','confirmed','cancelled','completed','no_show'].includes(status)) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('reservations') as any).update({ status }).eq('id', id).eq('tenant_id', tenant.id);

  // Email al cliente cuando cambia a confirmed o cancelled
  if (status === 'confirmed' || status === 'cancelled') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: r } = await (svc.from('reservations') as any)
        .select('customer_name, customer_email, reservation_date, reservation_time, party_size, courses(title), venues(name)')
        .eq('id', id).maybeSingle();
      if (r) {
        const { sendReservationStatusEmail } = await import('@/lib/venues/emails');
        await sendReservationStatusEmail({
          to: r.customer_email, customerName: r.customer_name,
          productTitle: r.courses?.title ?? '—',
          venueName: r.venues?.name ?? null,
          date: r.reservation_date, time: r.reservation_time,
          partySize: r.party_size,
          tenantName: tenant.name,
          status
        });
      }
    } catch { /* email best-effort */ }
  }
  revalidatePath('/owner/reservas');
}

/** Editar horarios + blackouts + slot_minutes de una sede */
export async function setVenueScheduleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const hoursRaw = String(formData.get('hours_json') ?? '{}');
  const blackoutsRaw = String(formData.get('blackouts_json') ?? '[]');
  const slotMinutesRaw = parseInt(String(formData.get('slot_minutes') ?? '60'), 10);
  let hours: unknown = {};
  let blackouts: unknown = [];
  try { hours = JSON.parse(hoursRaw); } catch {}
  try { blackouts = JSON.parse(blackoutsRaw); } catch {}
  const slotMinutes = [30, 60, 90, 120, 180].includes(slotMinutesRaw) ? slotMinutesRaw : 60;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('venues') as any).update({
    hours, blackout_dates: blackouts, slot_minutes: slotMinutes,
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/venues');
}

/** Setear modo de pago de reservas + % de seña */
export async function setCoursePaymentModeAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  if (!courseId) return;
  const modeRaw = String(formData.get('payment_mode') ?? 'none');
  const mode = ['none', 'deposit', 'full', 'choice'].includes(modeRaw) ? modeRaw : 'none';
  const pctRaw = parseInt(String(formData.get('deposit_percent') ?? '30'), 10);
  const pct = Math.max(1, Math.min(99, Number.isNaN(pctRaw) ? 30 : pctRaw));
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('courses') as any).update({
    payment_mode: mode,
    deposit_percent: pct,
    // Mantenemos deposit_required sincronizado para back-compat con UI/queries viejas
    deposit_required: mode !== 'none',
    updated_at: new Date().toISOString()
  }).eq('id', courseId).eq('tenant_id', tenant.id);
  revalidatePath(`/owner/courses/${courseId}`);
}
