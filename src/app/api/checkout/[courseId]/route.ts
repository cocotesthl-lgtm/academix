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
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const svc = getServiceClient();

  // Resolve course
  const { data: course } = await svc
    .from('courses')
    .select('id, tenant_id, slug, title, price_cents, currency, status, pricing_mode, subscription_frequency, subscription_trial_days')
    .eq('id', courseId)
    .maybeSingle<Course>();
  if (!course || course.status !== 'published') {
    return NextResponse.json({ error: 'course_not_available' }, { status: 404 });
  }
  if (course.price_cents <= 0) {
    return NextResponse.json({ error: 'free_course_no_checkout' }, { status: 400 });
  }

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
  let couponValid: Awaited<ReturnType<typeof validateCoupon>> | null = null;
  let finalPrice = course.price_cents;
  if (couponCode) {
    couponValid = await validateCoupon(course.tenant_id, couponCode, course.id, course.price_cents);
    if (couponValid) finalPrice = couponValid.final_cents;
  }

  // ─── Reservar booking si el comprador picó slot (mentorship_slot) ───
  // Lo hacemos PRE-MP así el UNIQUE index del DB previene double-booking.
  // El webhook después lo marca confirmed + linkea al enrollment_id.
  // Si MP falla / no vuelve, el booking queda 'pending' (limpiable luego).
  let createdBookingId: string | null = null;
  if (bookingSlotStart) {
    // Computar slot_end a partir de la rule matching del tenant
    const slotDate = new Date(bookingSlotStart);
    const wd = slotDate.getDay();
    const startMin = slotDate.getHours() * 60 + slotDate.getMinutes();
    const { data: rules } = await svc
      .from('availability_rules')
      .select('start_min, end_min, slot_duration_min')
      .eq('tenant_id', course.tenant_id)
      .eq('weekday', wd);
    const rule = ((rules ?? []) as Array<{ start_min: number; end_min: number; slot_duration_min: number }>)
      .find((r) => startMin >= r.start_min && startMin < r.end_min);
    const slotDurMin = rule?.slot_duration_min ?? 60;
    const slotEnd = new Date(slotDate.getTime() + slotDurMin * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking, error: bkErr } = await (svc.from('bookings') as any)
      .insert({
        tenant_id: course.tenant_id,
        course_id: course.id,
        user_id: buyerUserId,
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
        booking_date:   bookingDate
      }
    });

    return NextResponse.redirect(pref.init_point, { status: 303 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'checkout_failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
