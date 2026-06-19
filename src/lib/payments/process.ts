import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';
import { getPayment } from '@/lib/payments/mercadopago';
import { accrueCommissionForSale } from '@/lib/debt/accrue';
import { accrueAffiliateCommissionsForSale } from '@/lib/affiliates/commission';
import {
  notifyPurchaseConfirmed,
  notifyEventTicketsConfirmed,
  notifyBookingConfirmed
} from '@/lib/emails/dispatch';

type CourseLookup = {
  id: string;
  tenant_id: string;
  price_cents: number;
  currency: string;
};

export type ProcessResult =
  | { ok: true; saleId: string | null; reused: boolean }
  | { ok: false; error: string };

/**
 * Procesa una notificación de pago de MP: crea sale + enrollment +
 * commission accrual + affiliate commissions, todo idempotente.
 * Lo usa tanto el webhook automático como el botón de re-importar del
 * founder cuando un webhook se perdió (firma mal, retry expirado, etc).
 *
 * `payment` puede venir ya cargado (del webhook) o lo fetcheamos por id.
 */
export async function processMpPayment(opts: {
  tenantId: string;
  paymentId: string | number;
  accessToken: string;
}): Promise<ProcessResult> {
  const svc = getServiceClient();

  // Fetch payment desde MP
  let payment;
  try {
    payment = await getPayment(opts.paymentId, opts.accessToken);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch_failed' };
  }

  const buyerEmail = payment.payer?.email ?? null;
  const courseIdFromMeta = (payment.metadata?.course_id as string | undefined) ?? null;

  // ─── Branch: si external_reference es "res:<id>", procesar como seña de reserva.
  if (payment.external_reference && String(payment.external_reference).startsWith('res:')) {
    const resId = String(payment.external_reference).slice(4);
    const status = payment.status === 'approved' ? 'paid'
      : payment.status === 'refunded' ? 'refunded'
      : 'pending';
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('reservations') as any).update({
        deposit_paid: status === 'paid',
        deposit_external_id: String(payment.id),
        status: status === 'paid' ? 'confirmed' : 'pending'
      }).eq('id', resId).eq('tenant_id', opts.tenantId);

      // Email "confirmada" cuando se paga la seña
      if (status === 'paid') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: r } = await (svc.from('reservations') as any)
            .select('customer_name, customer_email, reservation_date, reservation_time, party_size, courses(title), venues(name)')
            .eq('id', resId).maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: t } = await (svc.from('tenants') as any).select('name').eq('id', opts.tenantId).maybeSingle();
          if (r) {
            const { sendReservationStatusEmail } = await import('@/lib/venues/emails');
            await sendReservationStatusEmail({
              to: r.customer_email, customerName: r.customer_name,
              productTitle: r.courses?.title ?? '—',
              venueName: r.venues?.name ?? null,
              date: r.reservation_date, time: r.reservation_time,
              partySize: r.party_size,
              tenantName: t?.name ?? 'Curplat',
              status: 'confirmed'
            });
          }
        } catch { /* email best-effort */ }
      }
    } catch { /* ignore */ }
    return { ok: true, saleId: null, reused: false };
  }

  // ─── Branch: si external_reference es "cart:<id>", procesar como carrito multi-item.
  if (payment.external_reference && String(payment.external_reference).startsWith('cart:')) {
    const cartId = String(payment.external_reference).slice(5);
    const status = payment.status === 'approved' ? 'paid'
      : payment.status === 'refunded' ? 'refunded'
      : payment.status === 'pending' ? 'pending'
      : 'failed';
    try {
      // Resolver buyer_user_id desde email
      let cartBuyerId: string | null = null;
      if (buyerEmail) {
        const { data: prof } = await svc.from('profiles').select('id').eq('email', buyerEmail).maybeSingle<{ id: string }>();
        cartBuyerId = prof?.id ?? null;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('cart_orders') as any).update({
        status, external_id: String(payment.id),
        paid_at: status === 'paid' ? new Date().toISOString() : null,
        buyer_user_id: cartBuyerId, buyer_email: buyerEmail
      }).eq('id', cartId).eq('tenant_id', opts.tenantId);

      // Si está pagado, crear enrollments por cada item
      if (status === 'paid' && cartBuyerId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: order } = await (svc.from('cart_orders') as any)
          .select('items').eq('id', cartId).maybeSingle();
        const cartItems = (order?.items ?? []) as Array<{ id: string; qty: number }>;
        for (const ci of cartItems) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (svc.from('enrollments') as any).upsert({
            tenant_id: opts.tenantId,
            course_id: ci.id,
            user_id: cartBuyerId,
            status: 'active'
          }, { onConflict: 'tenant_id,course_id,user_id', ignoreDuplicates: true });
        }
      }
    } catch { /* ignore */ }
    return { ok: true, saleId: null, reused: false };
  }

  // ─── Branch: si external_reference es "tip:<id>", procesar como tip y salir.
  if (payment.external_reference && String(payment.external_reference).startsWith('tip:')) {
    const tipId = String(payment.external_reference).slice(4);
    const status = payment.status === 'approved' ? 'paid'
      : payment.status === 'refunded' ? 'refunded'
      : payment.status === 'pending' ? 'pending'
      : 'failed';
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('tips') as any).update({
        status,
        external_id: String(payment.id),
        paid_at: status === 'paid' ? new Date().toISOString() : null
      }).eq('id', tipId).eq('tenant_id', opts.tenantId);
    } catch { /* ignore */ }
    return { ok: true, saleId: null, reused: false };
  }

  // Resolver curso del metadata o del external_reference (formato courseId::userId::affLinkId)
  let courseId: string | null = courseIdFromMeta;
  if (!courseId && payment.external_reference) {
    const parts = String(payment.external_reference).split('::');
    if (parts[0]) courseId = parts[0];
  }

  let resolvedCourse: CourseLookup | null = null;
  if (courseId) {
    const { data: c } = await svc
      .from('courses')
      .select('id, tenant_id, price_cents, currency')
      .eq('id', courseId)
      .eq('tenant_id', opts.tenantId)
      .maybeSingle<CourseLookup>();
    if (c) resolvedCourse = c;
  }

  // Resolver buyer_user_id desde metadata, external_reference o email
  let buyerUserId: string | null = (payment.metadata?.buyer_user_id as string | undefined) ?? null;
  if (!buyerUserId && payment.external_reference) {
    const parts = String(payment.external_reference).split('::');
    if (parts[1] && parts[1] !== 'anon') buyerUserId = parts[1];
  }
  if (!buyerUserId && buyerEmail) {
    const { data: prof } = await svc
      .from('profiles')
      .select('id')
      .eq('email', buyerEmail)
      .maybeSingle<{ id: string }>();
    buyerUserId = prof?.id ?? null;
  }

  const status = payment.status === 'approved' ? 'paid'
    : payment.status === 'refunded' ? 'refunded'
    : payment.status === 'pending' ? 'pending'
    : payment.status;

  // Buyer info del metadata (puede no estar en webhooks viejos o pagos antiguos)
  const meta = (payment.metadata ?? {}) as Record<string, unknown>;
  const buyerName     = (meta.buyer_name     as string | null | undefined) ?? null;
  const buyerDni      = (meta.buyer_dni      as string | null | undefined) ?? null;
  const buyerLocation = (meta.buyer_location as string | null | undefined) ?? null;
  const buyerPhone    = (meta.buyer_phone    as string | null | undefined) ?? null;
  const buyerEmailForRow =
    (meta.buyer_email as string | null | undefined) ?? buyerEmail;
  // Campos extra custom (definidos por el owner en checkout_config) — el
  // checkout endpoint los manda como meta.buyer_extra (jsonb opaco).
  const buyerExtra =
    (meta.buyer_extra && typeof meta.buyer_extra === 'object')
      ? meta.buyer_extra as Record<string, unknown>
      : {};
  // Calendario:
  // - booking_id: id de un booking 'pending' que el checkout endpoint creó
  //   pre-MP (mentorship_slot). Lo confirmamos + linkeamos al enrollment.
  // - booking_date: fecha simple de inicio (modo start_date). Va directo
  //   al enrollment.
  const bookingId = (meta.booking_id as string | null | undefined) ?? null;
  const bookingDate = (meta.booking_date as string | null | undefined) ?? null;
  // Event tickets: ids creados pending por el checkout endpoint → los
  // confirmamos al recibir payment.approved.
  const eventTicketIds = Array.isArray(meta.event_ticket_ids) ? meta.event_ticket_ids as string[] : [];

  // Insert sale (idempotente: UNIQUE en external_provider+external_id)
  const salePayload = {
    tenant_id: opts.tenantId,
    course_id: resolvedCourse?.id ?? null,
    buyer_user_id: buyerUserId,
    external_provider: 'mercadopago',
    external_id: String(payment.id),
    amount_gross_cents: Math.round(payment.transaction_amount * 100),
    amount_net_cents: Math.round(payment.transaction_amount * 100),
    currency: payment.currency_id,
    status,
    raw_payload: payment,
    occurred_at: payment.date_approved ?? payment.date_created,
    buyer_name:     buyerName,
    buyer_dni:      buyerDni,
    buyer_location: buyerLocation,
    buyer_email:    buyerEmailForRow,
    buyer_phone:    buyerPhone,
    buyer_extra:    buyerExtra
  };

  let saleId: string | null = null;
  let reused = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: saleRow, error: saleErr } = await (svc.from('sales') as any)
    .insert(salePayload)
    .select('id')
    .single();

  if (saleErr) {
    if (saleErr.message.toLowerCase().includes('duplicate')) {
      // Ya existía. Buscamos el id para devolverlo (idempotencia)
      const { data: existing } = await svc
        .from('sales')
        .select('id')
        .eq('external_provider', 'mercadopago')
        .eq('external_id', String(payment.id))
        .maybeSingle<{ id: string }>();
      saleId = existing?.id ?? null;
      reused = true;
    } else {
      return { ok: false, error: saleErr.message };
    }
  } else {
    saleId = (saleRow as { id: string }).id;
  }

  // Auto-enroll on approved payment (idempotente: ignoramos si ya existe)
  if (payment.status === 'approved' && resolvedCourse && buyerUserId) {
    const { data: existingEnroll } = await svc
      .from('enrollments')
      .select('id')
      .eq('tenant_id', opts.tenantId)
      .eq('course_id', resolvedCourse.id)
      .eq('user_id', buyerUserId)
      .maybeSingle<{ id: string }>();

    if (!existingEnroll) {
      const enrollPayload = {
        tenant_id: opts.tenantId,
        course_id: resolvedCourse.id,
        user_id: buyerUserId,
        source: 'direct',
        sale_id: saleId,
        status: 'active',
        buyer_name:     buyerName,
        buyer_dni:      buyerDni,
        buyer_location: buyerLocation,
        buyer_email:    buyerEmailForRow,
        buyer_phone:    buyerPhone,
        buyer_extra:    buyerExtra,
        booking_date:   bookingDate,
        booking_id:     bookingId
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: createdEnroll } = await (svc.from('enrollments') as any)
        .insert(enrollPayload).select('id').single();
      // Si había una reserva pending de mentorship_slot, la confirmamos
      // y la linkeamos al enrollment recién creado.
      if (bookingId && createdEnroll) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('bookings') as any)
          .update({
            status: 'confirmed',
            enrollment_id: (createdEnroll as { id: string }).id
          })
          .eq('id', bookingId);
      }
      // Event tickets: confirmar todos los ids creados
      if (eventTicketIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('event_tickets') as any)
          .update({
            status: 'confirmed',
            enrollment_id: (createdEnroll as { id: string }).id
          })
          .in('id', eventTicketIds);
      }
    }
  }

  // Accrue commission + affiliate commissions (idempotentes internamente)
  if (payment.status === 'approved' && saleId) {
    await accrueCommissionForSale(saleId);
    const affLinkId = (meta.affiliate_link_id as string | null | undefined) ?? null;
    await accrueAffiliateCommissionsForSale({ saleId, linkId: affLinkId });
  }

  // Emails transactional — solo en sale NUEVA (no en webhook retry duplicado)
  // y solo si tenemos email + curso. Los dispatchers ya contienen errores
  // internamente, no rompen el flujo si Resend falla.
  if (payment.status === 'approved' && !reused && resolvedCourse && buyerEmailForRow) {
    const baseArgs = {
      tenantId: opts.tenantId,
      courseId: resolvedCourse.id,
      buyerEmail: buyerEmailForRow,
      buyerName,
      amountCents: Math.round(payment.transaction_amount * 100),
      currency: payment.currency_id
    };
    if (eventTicketIds.length > 0) {
      // Fetch seat labels + calendar_date para mostrar en email
      const { data: tickets } = await svc
        .from('event_tickets')
        .select('seat_label, calendar_date_id')
        .in('id', eventTicketIds);
      const ticketsArr = (tickets ?? []) as Array<{ seat_label: string | null; calendar_date_id: string | null }>;
      const seats = ticketsArr
        .map((t) => t.seat_label)
        .filter((s): s is string => !!s);
      const dateId = ticketsArr.find((t) => !!t.calendar_date_id)?.calendar_date_id ?? null;
      let eventDate: string | null = null;
      if (dateId) {
        const { data: dateRow } = await svc
          .from('calendar_dates')
          .select('date')
          .eq('id', dateId)
          .maybeSingle<{ date: string }>();
        eventDate = dateRow?.date ?? null;
      }
      await notifyEventTicketsConfirmed({
        ...baseArgs,
        ticketsCount: eventTicketIds.length,
        seats: seats.length > 0 ? seats : undefined,
        eventDate,
        ticketIds: eventTicketIds
      });
    } else if (bookingDate || bookingId) {
      await notifyBookingConfirmed({
        tenantId: opts.tenantId,
        courseId: resolvedCourse.id,
        buyerEmail: buyerEmailForRow,
        buyerName,
        bookingDate: bookingDate ?? new Date().toISOString()
      });
    } else {
      await notifyPurchaseConfirmed(baseArgs);
    }
  }

  return { ok: true, saleId, reused };
}
