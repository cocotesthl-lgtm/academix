/**
 * POST /api/reservations/[tenantId]
 * Crea una reserva. Si el producto exige seña, devuelve mp_init_point
 * para redirigir al pago. El webhook MP marca deposit_paid=true al confirmar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServiceClient } from '@/lib/supabase/service';
import { createPreference } from '@/lib/payments/mercadopago';
import { sendReservationCreatedEmail } from '@/lib/venues/emails';

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
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: 'invalid_date' }, { status: 400 });
  }

  const svc = getServiceClient();

  // Producto + datos para email/seña
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: course } = await (svc.from('courses') as any)
    .select('id, title, currency, deposit_cents, deposit_required')
    .eq('id', courseId).eq('tenant_id', tenantId).maybeSingle();
  if (!course) return NextResponse.json({ ok: false, error: 'course_not_found' }, { status: 404 });

  if (venueId) {
    const { data: cv } = await svc.from('course_venues').select('venue_id').eq('course_id', courseId).eq('venue_id', venueId).maybeSingle();
    if (!cv) return NextResponse.json({ ok: false, error: 'venue_not_linked' }, { status: 400 });
  }

  // Insertar reserva
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (svc.from('reservations') as any).insert({
    tenant_id: tenantId, course_id: courseId, venue_id: venueId,
    customer_name: name, customer_email: email, customer_phone: phone,
    reservation_date: date, reservation_time: time,
    party_size: party, notes, status: 'pending'
  }).select('id').single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const reservationId = (inserted as { id: string }).id;

  // Datos para email
  const [{ data: tenant }, { data: venue }] = await Promise.all([
    svc.from('tenants').select('name, slug').eq('id', tenantId).maybeSingle<{ name: string; slug: string }>(),
    venueId
      ? svc.from('venues').select('name').eq('id', venueId).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null }) as Promise<{ data: { name: string } | null }>
  ]);

  // Email "recibimos tu reserva" (no bloquea si falla)
  sendReservationCreatedEmail({
    to: email, customerName: name,
    productTitle: course.title,
    venueName: venue?.name ?? null,
    date, time, partySize: party,
    tenantName: tenant?.name ?? 'Curplat'
  }).catch(() => { /* email best-effort */ });

  // ── Seña con MP (opcional) ──────────────────────────
  const depositCents = Number(course.deposit_cents ?? 0);
  const requiresDeposit = !!course.deposit_required && depositCents > 0;
  if (requiresDeposit) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: integ } = await (svc.from('integrations') as any)
      .select('access_token_enc').eq('tenant_id', tenantId)
      .eq('provider', 'mercadopago').eq('status', 'connected').maybeSingle();
    if (integ?.access_token_enc) {
      try {
        const h = await headers();
        const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0];
        const host = h.get('host') ?? `${tenant?.slug ?? 'app'}.localhost:3000`;
        const origin = `${proto}://${host}`;
        const pref = await createPreference({
          accessToken: integ.access_token_enc,
          title: `Seña — ${course.title}`,
          unitPriceCents: depositCents,
          currency: course.currency || 'ARS',
          buyerEmail: email,
          externalReference: `res:${reservationId}`,
          notificationUrl: `${origin}/api/webhooks/mercadopago/${tenantId}`,
          successUrl: `${origin}/?reservation=ok`,
          failureUrl: `${origin}/?reservation=err`,
          pendingUrl: `${origin}/?reservation=pending`,
          metadata: { reservation_id: reservationId, kind: 'reservation_deposit' }
        });
        return NextResponse.json({ ok: true, id: reservationId, mp_init_point: pref.init_point, requires_deposit: true });
      } catch {
        // Si MP falla, la reserva queda creada pero sin seña. Ok.
        return NextResponse.json({ ok: true, id: reservationId, mp_init_point: null, requires_deposit: true, deposit_failed: true });
      }
    }
  }

  return NextResponse.json({ ok: true, id: reservationId });
}
