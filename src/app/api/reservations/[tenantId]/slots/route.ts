/**
 * GET /api/reservations/[tenantId]/slots?venue_id=X&course_id=Y&date=YYYY-MM-DD
 * Devuelve los horarios disponibles ("19:00", "20:00", ...) para la sede + fecha.
 * Excluye blackouts + slots ya reservados (status pending/confirmed).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { generateVenueSlots, type VenueHours } from '@/lib/venues/slots';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await ctx.params;
  const url = new URL(req.url);
  const venueId = url.searchParams.get('venue_id');
  const courseId = url.searchParams.get('course_id');
  const date = url.searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: 'invalid_date' }, { status: 400 });
  }

  const svc = getServiceClient();
  let hours: VenueHours = {};
  let blackouts: string[] = [];
  let slotMinutes = 60;

  if (venueId) {
    const { data } = await svc.from('venues')
      .select('hours, blackout_dates, slot_minutes')
      .eq('id', venueId).eq('tenant_id', tenantId)
      .maybeSingle<{ hours: VenueHours | null; blackout_dates: string[] | null; slot_minutes: number | null }>();
    if (data) {
      hours = data.hours ?? {};
      blackouts = Array.isArray(data.blackout_dates) ? data.blackout_dates : [];
      slotMinutes = data.slot_minutes ?? 60;
    }
  }

  // Slots ya tomados ese día (status pending/confirmed) para esta sede + producto
  let taken: string[] = [];
  if (courseId) {
    const q = svc.from('reservations')
      .select('reservation_time, status')
      .eq('tenant_id', tenantId)
      .eq('course_id', courseId)
      .eq('reservation_date', date)
      .in('status', ['pending', 'confirmed']);
    const { data } = venueId ? await q.eq('venue_id', venueId) : await q;
    taken = ((data ?? []) as Array<{ reservation_time: string | null }>)
      .map((r) => r.reservation_time)
      .filter((t): t is string => !!t);
  }

  const slots = generateVenueSlots({ date, hours, blackoutDates: blackouts, slotMinutes, takenStartTimes: taken });
  return NextResponse.json({ ok: true, slots });
}
