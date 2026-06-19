/**
 * POST /api/reservations/[tenantId]
 * Endpoint público: el storefront submitea una reserva (sin pago).
 * Body JSON: { course_id, venue_id, customer_name, customer_email, customer_phone?,
 *              reservation_date, reservation_time?, party_size, notes? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
  course_id?: string;
  venue_id?: string | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  reservation_date?: string;
  reservation_time?: string;
  party_size?: number;
  notes?: string;
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await ctx.params;
  const body: Body = await req.json().catch(() => ({} as Body));

  const courseId = (body.course_id ?? '').trim();
  const venueId = body.venue_id ? String(body.venue_id) : null;
  const name = (body.customer_name ?? '').trim().slice(0, 120);
  const email = (body.customer_email ?? '').trim().toLowerCase().slice(0, 200);
  const phone = (body.customer_phone ?? '').trim().slice(0, 40) || null;
  const date = (body.reservation_date ?? '').trim();
  const time = (body.reservation_time ?? '').trim().slice(0, 40) || null;
  const party = Math.max(1, Math.min(200, Math.round(Number(body.party_size ?? 1))));
  const notes = (body.notes ?? '').trim().slice(0, 1000) || null;

  if (!courseId || !name || !email || !date) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }
  // Email simple sanity check
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  // Validar fecha YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: 'invalid_date' }, { status: 400 });
  }

  const svc = getServiceClient();

  // Verificar que el course pertenece al tenant
  const { data: course } = await svc.from('courses').select('id').eq('id', courseId).eq('tenant_id', tenantId).maybeSingle();
  if (!course) return NextResponse.json({ ok: false, error: 'course_not_found' }, { status: 404 });

  // Si vino venue_id, verificar que pertenece al tenant y al course
  if (venueId) {
    const { data: cv } = await svc.from('course_venues').select('venue_id').eq('course_id', courseId).eq('venue_id', venueId).maybeSingle();
    if (!cv) return NextResponse.json({ ok: false, error: 'venue_not_linked' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('reservations') as any).insert({
    tenant_id: tenantId,
    course_id: courseId,
    venue_id: venueId,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    reservation_date: date,
    reservation_time: time,
    party_size: party,
    notes,
    status: 'pending'
  }).select('id').single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}
