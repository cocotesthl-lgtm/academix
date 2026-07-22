import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { createPreference } from '@/lib/payments/mercadopago';
import { tenantOrigin, env } from '@/lib/env';

/**
 * POST /api/pay-links/[code]/checkout
 *
 * Público — recibe el form submit desde /pay/[code], valida el link,
 * crea un pay_link_payment pending + una preference MP en el account
 * del tenant, y redirige al init_point (302).
 *
 * external_reference es "paylink:{payment_id}" — el webhook MP usa ese
 * prefijo para procesar y marcar el pago como paid + acreditar comisión
 * al afiliado si viene con affiliate_user_id.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await ctx.params;
  const form = await req.formData();

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: link } = await (svc.from('pay_links') as any)
    .select('id, tenant_id, code, title, amount_cents, currency, status, max_uses, uses_count, expires_at, require_email, require_name, require_phone, require_dni, affiliate_user_id, affiliate_commission_pct, parent_link_id, clicks_count')
    .eq('code', code).maybeSingle();

  const backUrl = link ? `${tenantOrigin(await tenantSlug(link.tenant_id))}/pay/${code}` : '/';

  if (!link) return redirectWithError(backUrl, 'Link no encontrado');
  if (link.status !== 'active') return redirectWithError(backUrl, 'Este link no está activo');
  if (link.expires_at && new Date(link.expires_at) < new Date()) return redirectWithError(backUrl, 'Este link venció');
  if (link.max_uses !== null && link.uses_count >= link.max_uses) return redirectWithError(backUrl, 'Cupo agotado');

  // Info del buyer según require_*
  const buyer_name = link.require_name ? String(form.get('buyer_name') ?? '').trim().slice(0, 120) : null;
  const buyer_email = link.require_email ? String(form.get('buyer_email') ?? '').trim().toLowerCase().slice(0, 200) : null;
  const buyer_phone = link.require_phone ? String(form.get('buyer_phone') ?? '').trim().slice(0, 40) : null;
  const buyer_dni = link.require_dni ? String(form.get('buyer_dni') ?? '').trim().slice(0, 40) : null;
  if (link.require_name && !buyer_name) return redirectWithError(backUrl, 'Falta el nombre');
  if (link.require_email && !buyer_email) return redirectWithError(backUrl, 'Falta el email');
  if (link.require_phone && !buyer_phone) return redirectWithError(backUrl, 'Falta el teléfono');
  if (link.require_dni && !buyer_dni) return redirectWithError(backUrl, 'Falta el DNI');

  // Traer access_token de MP del tenant
  const { data: mp } = await svc
    .from('integrations').select('access_token')
    .eq('tenant_id', link.tenant_id).eq('provider', 'mercadopago').eq('status', 'connected')
    .maybeSingle<{ access_token: string }>();
  if (!mp?.access_token) return redirectWithError(backUrl, 'Este vendedor todavía no conectó MercadoPago');

  // Resolver affiliate_user_id: si el link es una variante hija, usar el
  // affiliate_user_id del link. Sino, mirar cookie paylink_aff (variante
  // que ya nos setteó el /pay/[code] page).
  let affiliate_user_id: string | null = link.affiliate_user_id ?? null;
  if (!affiliate_user_id) {
    const cookieAff = req.cookies.get('paylink_aff')?.value;
    if (cookieAff) affiliate_user_id = cookieAff;
  }

  // Crear el pay_link_payment pending PRIMERO — así tenemos el id para
  // meter en external_reference. Idempotencia real después vía UNIQUE
  // (external_provider, external_id) cuando llegue el webhook.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pending, error: pendErr } = await (svc.from('pay_link_payments') as any).insert({
    tenant_id: link.tenant_id,
    pay_link_id: link.id,
    buyer_name, buyer_email, buyer_phone, buyer_dni,
    amount_cents: link.amount_cents,
    currency: link.currency,
    external_provider: 'mercadopago',
    status: 'pending',
    affiliate_user_id
  }).select('id').single();
  if (pendErr || !pending) return redirectWithError(backUrl, 'No se pudo iniciar el cobro');
  const paymentId = (pending as { id: string }).id;

  // Bumpear clicks (best-effort)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('pay_links') as any).update({ clicks_count: (link.clicks_count ?? 0) + 1 }).eq('id', link.id);

  // Notification URL: reutilizamos el webhook existente por tenant. Vive
  // siempre en app.<root>, no en el subdomain del tenant (MP necesita una
  // URL estable). process.ts branchea según prefijo del external_reference.
  const notificationUrl = `${env.platformApiOrigin}/api/webhooks/mercadopago/${link.tenant_id}`;

  try {
    const pref = await createPreference({
      accessToken: mp.access_token,
      title: link.title,
      unitPriceCents: link.amount_cents,
      currency: link.currency,
      buyerEmail: buyer_email ?? undefined,
      externalReference: `paylink:${paymentId}`,
      notificationUrl,
      successUrl: `${backUrl}?status=success`,
      failureUrl: `${backUrl}?status=failure`,
      pendingUrl: `${backUrl}?status=pending`,
      metadata: {
        pay_link_id: link.id,
        pay_link_payment_id: paymentId,
        buyer_name, buyer_email, buyer_phone, buyer_dni,
        affiliate_user_id,
        commission_pct: link.affiliate_commission_pct
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('pay_link_payments') as any).update({ preference_id: pref.id }).eq('id', paymentId);
    return NextResponse.redirect(pref.init_point, { status: 303 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'MP error';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('pay_link_payments') as any).update({ status: 'failed' }).eq('id', paymentId);
    return redirectWithError(backUrl, msg.slice(0, 120));
  }
}

async function tenantSlug(tenantId: string): Promise<string> {
  const svc = getServiceClient();
  const { data } = await svc.from('tenants').select('slug').eq('id', tenantId).maybeSingle<{ slug: string }>();
  return data?.slug ?? '';
}

function redirectWithError(backUrl: string, msg: string): NextResponse {
  const u = new URL(backUrl);
  u.searchParams.set('error', msg);
  return NextResponse.redirect(u.toString(), { status: 303 });
}
