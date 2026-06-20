import { NextRequest, NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { createPreference, createPreapproval } from '@/lib/payments/mercadopago';
import { verifyAffiliateCookie, cookieName } from '@/lib/affiliates/cookie';
import { validateCoupon } from '@/lib/coupons/actions';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Course = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  price_cents: number;
  currency: string;
  status: string;
  pricing_mode: 'one_time' | 'subscription' | null;
  subscription_frequency: 'monthly' | 'yearly' | null;
  subscription_trial_days: number | null;
  payment_mode?: 'none' | 'deposit' | 'full' | 'choice' | null;
  deposit_percent?: number | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const svc = getServiceClient();

  // Resolve course (base — sin columnas nuevas para sobrevivir migrations pendientes)
  const { data: courseBase } = await svc
    .from('courses')
    .select('id, tenant_id, slug, title, price_cents, currency, status, payment_mode, deposit_percent')
    .eq('id', courseId)
    .maybeSingle<Omit<Course, 'pricing_mode' | 'subscription_frequency' | 'subscription_trial_days'>>();
  if (!courseBase || courseBase.status !== 'published') {
    return NextResponse.json({ error: 'course_not_available' }, { status: 404 });
  }
  // Para event_tickets gratis se permite igual (se crean tickets sin pasar
  // por MP). El check de "free_course_no_checkout" se aplica más abajo
  // SOLO si NO es event_tickets.
  // Subscription columns (opcional — migration 0013)
  type SubCfg = {
    pricing_mode: 'one_time' | 'subscription' | null;
    subscription_frequency: 'monthly' | 'yearly' | null;
    subscription_trial_days: number | null;
  };
  let subscriptionCfg: SubCfg | null = null;
  try {
    const { data, error } = await svc
      .from('courses')
      .select('pricing_mode, subscription_frequency, subscription_trial_days')
      .eq('id', courseId).maybeSingle<SubCfg>();
    if (!error && data) subscriptionCfg = data;
  } catch { /* migration no corrida — asume one_time */ }
  const course: Course = {
    ...courseBase,
    pricing_mode: subscriptionCfg?.pricing_mode ?? 'one_time',
    subscription_frequency: subscriptionCfg?.subscription_frequency ?? null,
    subscription_trial_days: subscriptionCfg?.subscription_trial_days ?? 0
  };

  // Resolve tenant slug for redirect URLs
  const { data: tenant } = await svc
    .from('tenants')
    .select('slug')
    .eq('id', course.tenant_id)
    .maybeSingle<{ slug: string }>();
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

  // Resolve MP integration
  const { data: integration } = await svc
    .from('integrations')
    .select('access_token_enc')
    .eq('tenant_id', course.tenant_id)
    .eq('provider', 'mercadopago')
    .eq('status', 'connected')
    .maybeSingle<{ access_token_enc: string }>();
  if (!integration) {
    return NextResponse.json({ error: 'mercadopago_not_connected' }, { status: 409 });
  }

  // Build URLs (use the storefront origin from the request). Esto se hace
  // primero porque el flujo de creación de cuenta del buyer puede necesitar
  // redirigir con errores al course page del storefront.
  const h = await headers();
  const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0];
  const host = h.get('host') ?? `${tenant.slug}.localhost:3000`;
  const origin = `${proto}://${host}`;

  // Buyer (optional — anon allowed)
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Affiliate cookie (set on click via trackClick); HMAC-verified
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(cookieName(course.tenant_id))?.value ?? null;
  const affPayload = rawCookie ? verifyAffiliateCookie(rawCookie) : null;
  // Only honour attribution if the cookie was set for THIS course
  const affLinkId = affPayload && affPayload.courseId === course.id ? affPayload.linkId : null;

  // Coupon (from form field or query param)
  const form = await req.formData().catch(() => null);
  const couponCode = (form?.get('coupon') as string | null)
    ?? (new URL(req.url).searchParams.get('coupon'))
    ?? '';

  // Buyer info pegada en el form de checkout (nombre/DNI/ubicación/email/celular)
  // Es opcional para cursos gratis (ya tenemos el user_id). Para cursos pagos
  // el front lo exige; el back es tolerante (no rechaza si falta).
  const buyerNameRaw     = String(form?.get('buyer_name')     ?? '').trim().slice(0, 120);
  const buyerDniRaw      = String(form?.get('buyer_dni')      ?? '').trim().slice(0, 20);
  const buyerLocationRaw = String(form?.get('buyer_location') ?? '').trim().slice(0, 120);
  const buyerEmailRaw    = String(form?.get('buyer_email')    ?? '').trim().slice(0, 200);
  const buyerPhoneRaw    = String(form?.get('buyer_phone')    ?? '').trim().slice(0, 30);
  const buyerPasswordRaw = String(form?.get('buyer_password') ?? '').slice(0, 120);
  const buyerInfo = {
    name:     buyerNameRaw     || null,
    dni:      buyerDniRaw      || null,
    location: buyerLocationRaw || null,
    email:    buyerEmailRaw    || null,
    phone:    buyerPhoneRaw    || null
  };

  // Campos extra custom (definidos por el owner en /owner/checkout o en el
  // override del curso). Llegan al form como `extra_${key}`. Los juntamos
  // todos en un solo jsonb que se guarda en sales.buyer_extra y
  // enrollments.buyer_extra, así el owner los puede consultar después.
  const buyerExtra: Record<string, string | boolean> = {};
  if (form) {
    for (const [k, v] of form.entries()) {
      if (!k.startsWith('extra_')) continue;
      const key = k.slice(6).slice(0, 40);
      if (!key) continue;
      const value = typeof v === 'string' ? v.slice(0, 1000) : '';
      buyerExtra[key] = value === 'on' ? true : value;
    }
  }

  // Calendario (modo start_date o mentorship_slot).
  // - booking_date: yyyy-mm-dd para start_date.
  // - booking_slot_start: ISO datetime para mentorship_slot.
  const bookingDateRaw = String(form?.get('booking_date') ?? '').trim();
  const bookingSlotStartRaw = String(form?.get('booking_slot_start') ?? '').trim();
  const bookingDate = /^\d{4}-\d{2}-\d{2}$/.test(bookingDateRaw) ? bookingDateRaw : null;
  const bookingSlotStart = (() => {
    if (!bookingSlotStartRaw) return null;
    const d = new Date(bookingSlotStartRaw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  })();

  // Si el comprador NO está logueado pero mandó email + password, creamos
  // (o logueamos) su cuenta acá antes de redirigir a MP. Así cuando vuelve
  // post-pago aterriza ya logueado en /learn — sin pasar por la pantalla
  // de "Iniciar sesión" pidiendo credenciales que no tendría.
  let buyerUserId: string | null = user?.id ?? null;
  if (!user && buyerInfo.email && buyerPasswordRaw.length >= 6) {
    const { data: existingProfile } = await svc
      .from('profiles')
      .select('id')
      .eq('email', buyerInfo.email)
      .maybeSingle<{ id: string }>();

    if (!existingProfile) {
      // Crear usuario con email auto-confirmado (no requerimos verificar mail
      // para que el flujo de compra no se trabe).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created, error: createErr } = await (svc.auth.admin as any).createUser({
        email: buyerInfo.email,
        password: buyerPasswordRaw,
        email_confirm: true,
        user_metadata: {
          display_name: buyerInfo.name,
          dni: buyerInfo.dni,
          phone: buyerInfo.phone
        }
      });
      if (createErr) {
        return NextResponse.redirect(
          `${origin}/c/${course.slug}?error=signup_failed&detail=${encodeURIComponent(createErr.message)}`,
          { status: 303 }
        );
      }
      buyerUserId = (created as { user?: { id: string } } | null)?.user?.id ?? null;
    } else {
      buyerUserId = existingProfile.id;
    }

    // Loguear al buyer con esa password (signInWithPassword setea las cookies
    // de sesión cross-subdomain).
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: buyerInfo.email,
      password: buyerPasswordRaw
    });
    if (signInErr) {
      // Probablemente el email ya existía con otra password. Le decimos.
      return NextResponse.redirect(
        `${origin}/c/${course.slug}?error=wrong_password&detail=${encodeURIComponent(signInErr.message)}`,
        { status: 303 }
      );
    }
  }
  // ─── Event tickets (calendar_mode='event_tickets') ───
  // Si el form incluye event_date_id, vamos por este flow: validamos
  // capacidad, insertamos tickets pending, y el precio total = price × qty.
  const eventDateId = String(form?.get('event_date_id') ?? '').trim() || null;
  const ticketQtyRaw = parseInt(String(form?.get('ticket_qty') ?? '0'), 10);
  const ticketSeatsRaw = String(form?.get('ticket_seats') ?? '').trim();
  const ticketSeats = ticketSeatsRaw ? ticketSeatsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const ticketQty = ticketSeats.length > 0 ? ticketSeats.length : Math.max(0, ticketQtyRaw);

  let isEventTickets = false;
  let eventTicketIds: string[] = [];
  let eventTicketsTotalCents = 0;
  if (eventDateId && ticketQty > 0) {
    isEventTickets = true;
    // Validar evento existe
    const { data: ev } = await svc.from('calendar_dates')
      .select('id, capacity, seat_mode, course_id, seat_zones')
      .eq('id', eventDateId).eq('tenant_id', course.tenant_id)
      .maybeSingle<{ id: string; capacity: number; seat_mode: string; course_id: string | null; seat_zones: unknown }>();
    if (!ev || (ev.course_id && ev.course_id !== course.id)) {
      return NextResponse.redirect(`${origin}/c/${course.slug}?error=event_not_found`, { status: 303 });
    }
    // Cleanup lazy: cancelar pendings abandonados (>15 min) ANTES de
    // chequear capacidad o intentar insertar. Esto evita que el UNIQUE
    // index (calendar_date_id, seat_label) rechace un nuevo comprador por
    // un ticket pending de alguien que nunca pagó.
    const { cleanupStalePendingTicketsForDate } = await import('@/lib/calendar/seat-cleanup');
    await cleanupStalePendingTicketsForDate(svc, eventDateId);

    // Check capacity
    const { count } = await svc.from('event_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('calendar_date_id', eventDateId)
      .not('status', 'in', '(cancelled,refunded)');
    const sold = count ?? 0;
    if (sold + ticketQty > ev.capacity) {
      return NextResponse.redirect(`${origin}/c/${course.slug}?error=sold_out`, { status: 303 });
    }
    // Insertar tickets pending. Si es seat_mode='grid'/'zones', uno por seat label.
    const common = {
      tenant_id: course.tenant_id,
      course_id: course.id,
      calendar_date_id: eventDateId,
      user_id: buyerUserId,
      status: 'pending',
      buyer_email: buyerInfo.email ?? user?.email ?? null,
      buyer_name: buyerInfo.name
    };
    const hasSeats = (ev.seat_mode === 'grid' || ev.seat_mode === 'zones') && ticketSeats.length > 0;
    // Generamos qr_token + order_number aca para que el ticket lleve
    // codigo desde el insert original (no requerir update posterior).
    const { generateQrToken, generateOrderNumber } = await import('@/lib/tickets/codes');
    const withCodes = (extra: Record<string, unknown>) => ({
      ...common, ...extra,
      qr_token: generateQrToken(),
      order_number: generateOrderNumber()
    });
    const ticketRows = hasSeats
      ? ticketSeats.map((label) => withCodes({ seat_label: label }))
      : Array.from({ length: ticketQty }, () => withCodes({ seat_label: null }));

    // Recalculamos eventTicketsTotalCents SERVER-SIDE (anti-tampering).
    // En modo zones: precio = sum(priceCents × zone.multiplier por cada seat).
    if (ev.seat_mode === 'zones' && hasSeats) {
      type Zone = { id: string; price_multiplier: number };
      const zones = (Array.isArray(ev.seat_zones) ? ev.seat_zones : []) as Zone[];
      const zoneMap = new Map(zones.map((z) => [z.id, z.price_multiplier]));
      eventTicketsTotalCents = ticketSeats.reduce((sum, label) => {
        const zoneId = label.split(':')[0];
        const mult = zoneMap.get(zoneId) ?? 1;
        return sum + Math.round(course.price_cents * mult);
      }, 0);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: tkErr } = await (svc.from('event_tickets') as any)
      .insert(ticketRows).select('id');
    if (tkErr) {
      const msg = tkErr.message.toLowerCase().includes('duplicate') ? 'seat_taken' : 'ticket_failed';
      return NextResponse.redirect(`${origin}/c/${course.slug}?error=${msg}`, { status: 303 });
    }
    eventTicketIds = (inserted as Array<{ id: string }>).map((r) => r.id);
  } else if (course.price_cents <= 0) {
    // Curso gratis SIN event tickets → no procesamos checkout (legacy behavior)
    return NextResponse.json({ error: 'free_course_no_checkout' }, { status: 400 });
  }

  let couponValid: Awaited<ReturnType<typeof validateCoupon>> | null = null;
  // Si era event_tickets, el total ya está calculado (con zones si aplica)
  let finalPrice = isEventTickets
    ? (eventTicketsTotalCents > 0 ? eventTicketsTotalCents : course.price_cents * ticketQty)
    : course.price_cents;
  if (couponCode && !isEventTickets) {
    couponValid = await validateCoupon(course.tenant_id, couponCode, course.id, course.price_cents);
    if (couponValid) finalPrice = couponValid.final_cents;
  }

  // ── Modo de pago (none/deposit/full/choice) — si el owner habilitó seña ──
  // Mode 'full' o 'none' usa finalPrice tal cual (precio total).
  // Mode 'deposit' o 'choice' (con elección 'deposit') → finalPrice * pct / 100.
  // Sólo aplica si NO es event_tickets (esos manejan precio aparte).
  let paidChargeKind: 'full' | 'deposit' = 'full';
  if (!isEventTickets) {
    const pm = course.payment_mode ?? 'none';
    const pct = Math.max(1, Math.min(99, course.deposit_percent ?? 30));
    const chosenRaw = String(form?.get('payment_choice') ?? '');
    const chosen: 'full' | 'deposit' | null = chosenRaw === 'full' || chosenRaw === 'deposit' ? chosenRaw : null;
    const shouldChargeDeposit =
      pm === 'deposit' ||
      (pm === 'choice' && chosen === 'deposit');
    if (shouldChargeDeposit && finalPrice > 0) {
      finalPrice = Math.round((finalPrice * pct) / 100);
      paidChargeKind = 'deposit';
    }
  }

  // ─── Reservar booking si el comprador picó slot (mentorship_slot) ───
  // Lo hacemos PRE-MP así el UNIQUE index del DB previene double-booking.
  // El webhook después lo marca confirmed + linkea al enrollment_id.
  // Si MP falla / no vuelve, el booking queda 'pending' (limpiable luego).
  let createdBookingId: string | null = null;
  if (bookingSlotStart) {
    // Computar slot_end + asignar instructor (si el curso tiene asignados).
    // Si dos instructores tienen el mismo slot, asignamos al PRIMERO que
    // tenga la rule + el slot todavía libre (anti double-booking por DB).
    const slotDate = new Date(bookingSlotStart);
    const { data: rulesRaw } = await svc
      .from('availability_rules')
      .select('weekday, start_min, end_min, slot_duration_min, timezone, instructor_user_id')
      .eq('tenant_id', course.tenant_id);
    const rules = (rulesRaw ?? []) as Array<{
      weekday: number; start_min: number; end_min: number;
      slot_duration_min: number; timezone: string; instructor_user_id: string | null;
    }>;
    // Limitamos a rules de instructores asignados al curso (o tenant-wide)
    const { data: assignedRaw } = await svc
      .from('course_instructors')
      .select('user_id')
      .eq('tenant_id', course.tenant_id)
      .eq('course_id', course.id);
    const assignedSet = new Set(((assignedRaw ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
    const eligibleRules = rules.filter((r) => {
      if (assignedSet.size === 0) return r.instructor_user_id === null;
      return r.instructor_user_id !== null && assignedSet.has(r.instructor_user_id);
    });

    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const matchedRule = eligibleRules.find((r) => {
      try {
        const fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: r.timezone, hour: '2-digit', minute: '2-digit',
          weekday: 'short', hour12: false
        });
        const parts = fmt.formatToParts(slotDate);
        const wd = weekdayMap[parts.find((p) => p.type === 'weekday')?.value ?? ''] ?? -1;
        const hh = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
        const mm = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
        const startMin = hh * 60 + mm;
        return r.weekday === wd && startMin >= r.start_min && startMin < r.end_min;
      } catch { return false; }
    });
    const slotDurMin = matchedRule?.slot_duration_min ?? 60;
    const assignedInstructorId = matchedRule?.instructor_user_id ?? null;
    const slotEnd = new Date(slotDate.getTime() + slotDurMin * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking, error: bkErr } = await (svc.from('bookings') as any)
      .insert({
        tenant_id: course.tenant_id,
        course_id: course.id,
        user_id: buyerUserId,
        instructor_user_id: assignedInstructorId,
        slot_start: bookingSlotStart,
        slot_end: slotEnd,
        status: 'pending',
        buyer_email: buyerInfo.email ?? user?.email ?? null,
        buyer_name: buyerInfo.name
      })
      .select('id')
      .single();
    if (bkErr) {
      // Probablemente UNIQUE violation: otro comprador acaba de tomar
      // ese slot. Mostramos error claro.
      const msg = bkErr.message.toLowerCase().includes('duplicate')
        ? 'slot_taken'
        : 'booking_failed';
      return NextResponse.redirect(
        `${origin}/c/${course.slug}?error=${msg}`,
        { status: 303 }
      );
    }
    createdBookingId = (booking as { id: string }).id;
  }

  // Webhook URL DEBE apuntar al subdominio app.<rootDomain> (donde corren
  // las API routes), NO al apex que podría estar configurado en appUrl
  // para la landing marketing. Por eso usamos platformApiOrigin que
  // siempre devuelve app.<rootDomain> en producción.
  const platformOrigin = env.platformApiOrigin;

  // If coupon makes it free, auto-enroll on the spot and skip MP entirely
  // Event tickets gratis: confirmamos los tickets ya creados + redirect
  if (isEventTickets && finalPrice <= 0) {
    if (eventTicketIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('event_tickets') as any)
        .update({ status: 'confirmed' }).in('id', eventTicketIds);
    }
    return NextResponse.redirect(`${origin}/learn?tickets=${eventTicketIds.length}`, { status: 303 });
  }
  if (finalPrice <= 0 && couponValid && buyerUserId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: enrollFree } = await (svc.from('enrollments') as any).insert({
      tenant_id: course.tenant_id,
      course_id: course.id,
      user_id: buyerUserId,
      source: 'direct',
      status: 'active',
      buyer_name: buyerInfo.name,
      buyer_dni: buyerInfo.dni,
      buyer_location: buyerInfo.location,
      buyer_email: buyerInfo.email ?? user?.email ?? null,
      buyer_phone: buyerInfo.phone,
      buyer_extra: buyerExtra,
      booking_date: bookingDate,
      booking_id: createdBookingId
    }).select('id').single();
    // Si había booking pending, confirmamos + linkeamos al enrollment.
    if (createdBookingId && enrollFree) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('bookings') as any)
        .update({ status: 'confirmed', enrollment_id: (enrollFree as { id: string }).id })
        .eq('id', createdBookingId);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('coupon_redemptions') as any).insert({
      coupon_id: couponValid.id,
      tenant_id: course.tenant_id,
      user_id: buyerUserId,
      course_id: course.id,
      sale_id: null,
      amount_discounted_cents: couponValid.discount_cents
    });
    // Bump redemption_count
    const { data: c } = await svc.from('coupons').select('redemption_count').eq('id', couponValid.id).single<{ redemption_count: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('coupons') as any).update({ redemption_count: (c?.redemption_count ?? 0) + 1 }).eq('id', couponValid.id);
    return NextResponse.redirect(`${origin}/learn`, { status: 303 });
  }

  // ─── Suscripción recurrente (MP Preapproval) ───
  // Si el curso es pricing_mode='subscription', creamos un preapproval
  // en vez de una preference. MP cobra recurrente y notifica via
  // /api/webhooks/mercadopago-preapproval/[tenantId].
  if (course.pricing_mode === 'subscription' && course.subscription_frequency) {
    const subWebhookUrl = `${env.platformApiOrigin}/api/webhooks/mercadopago-preapproval/${course.tenant_id}`;
    const payerEmail = buyerInfo.email ?? user?.email;
    if (!payerEmail) {
      return NextResponse.redirect(
        `${origin}/c/${course.slug}?error=email_required_for_subscription`,
        { status: 303 }
      );
    }
    try {
      const pre = await createPreapproval({
        accessToken: integration.access_token_enc,
        reason: `Suscripción ${course.subscription_frequency === 'monthly' ? 'mensual' : 'anual'} a ${course.title}`,
        amountCents: course.price_cents,
        currency: course.currency,
        frequency: course.subscription_frequency,
        payerEmail,
        backUrl: `${origin}/learn`,
        externalReference: `${course.id}::${buyerUserId ?? 'anon'}::${affLinkId ?? ''}`,
        notificationUrl: subWebhookUrl,
        trialDays: course.subscription_trial_days ?? 0
      });
      // Guardar subscription pending para que el webhook después la
      // matchee por preapproval_id y la confirme.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('subscriptions') as any).insert({
        tenant_id: course.tenant_id,
        course_id: course.id,
        user_id: buyerUserId,
        external_provider: 'mercadopago',
        preapproval_id: pre.id,
        status: 'pending',
        frequency: course.subscription_frequency,
        amount_cents: course.price_cents,
        currency: course.currency
      });
      return NextResponse.redirect(pre.init_point, { status: 303 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'preapproval_failed';
      console.error('[checkout] createPreapproval failed', msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // Log para diagnosticar problemas de webhook: vemos la URL exacta que
  // mandamos a MP. Si MP nunca llama, podemos verificar acá si la URL
  // es válida y accesible públicamente.
  const notificationUrl = `${platformOrigin}/api/webhooks/mercadopago/${course.tenant_id}`;
  console.log('[checkout] creating MP preference', {
    course_id: course.id,
    tenant_id: course.tenant_id,
    notification_url: notificationUrl,
    success_url: `${origin}/learn`,
    final_price_cents: finalPrice
  });

  try {
    const pref = await createPreference({
      accessToken: integration.access_token_enc,
      title: course.title,
      unitPriceCents: finalPrice,
      currency: course.currency,
      // Mandamos el email del buyer (si lo escribió en el form) para que MP
      // lo pre-llene en el checkout. Fallback al email del user logueado.
      buyerEmail: buyerInfo.email ?? user?.email ?? undefined,
      externalReference: `${course.id}::${buyerUserId ?? 'anon'}::${affLinkId ?? ''}`,
      notificationUrl,
      successUrl: `${origin}/learn`,
      failureUrl: `${origin}/c/${course.slug}?checkout=failed`,
      pendingUrl: `${origin}/c/${course.slug}?checkout=pending`,
      metadata: {
        course_id: course.id,
        tenant_id: course.tenant_id,
        buyer_user_id: buyerUserId,
        affiliate_link_id: affLinkId,
        coupon_id: couponValid?.id ?? null,
        coupon_code: couponValid?.code ?? null,
        coupon_discount_cents: couponValid?.discount_cents ?? 0,
        // Datos del comprador: el webhook los lee y los guarda en
        // sales + enrollments para que el owner pueda contactarlo.
        buyer_name:     buyerInfo.name,
        buyer_dni:      buyerInfo.dni,
        buyer_location: buyerInfo.location,
        buyer_email:    buyerInfo.email,
        buyer_phone:    buyerInfo.phone,
        // Extras custom (talle, talla, comentario, etc.) → jsonb opaco
        // que el webhook copia tal cual a sales/enrollments.
        buyer_extra:    buyerExtra,
        // Calendario: el webhook usa booking_id para confirmar la reserva
        // y linkearla al enrollment. booking_date va directo a enrollment.
        booking_id:     createdBookingId,
        booking_date:   bookingDate,
        // Event tickets: ids creados pending → webhook los marca confirmed
        event_ticket_ids: eventTicketIds.length > 0 ? eventTicketIds : null
      }
    });

    return NextResponse.redirect(pref.init_point, { status: 303 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'checkout_failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
