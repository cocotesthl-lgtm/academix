import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { getPlanById } from '@/lib/plans/queries';
import { applyDiscount, type BillingPeriod } from '@/lib/plans/types';
import { createPreapproval } from '@/lib/payments/platform-mp';
import { env } from '@/lib/env';
import { findPromoCode } from '@/lib/plans/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Owner clickea "Activar plan" → llamamos a MP para crear la
 * preapproval (suscripción) y le devolvemos el init_point (URL donde
 * confirma el pago en MP).
 *
 * POST body: { plan_id, billing_period, promo_code? }
 * Response: { ok: true, init_point: "https://..." } | { ok: false, error }
 */
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: { plan_id?: string; billing_period?: BillingPeriod; promo_code?: string; use_trial?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const planId = body.plan_id;
  const period: BillingPeriod = body.billing_period === 'annual' ? 'annual' : 'monthly';
  if (!planId) return NextResponse.json({ ok: false, error: 'plan_required' }, { status: 400 });

  const plan = await getPlanById(planId);
  if (!plan || !plan.is_active) {
    return NextResponse.json({ ok: false, error: 'plan_not_found' }, { status: 404 });
  }

  // Calcular monto base + descuento si promo aplica
  let amountCents = period === 'annual' ? plan.price_cents_annual : plan.price_cents_monthly;
  let appliedPromoCode: string | null = null;
  if (body.promo_code) {
    const promo = await findPromoCode(body.promo_code);
    if (promo && promo.is_active &&
        (promo.expires_at === null || new Date(promo.expires_at).getTime() > Date.now()) &&
        (promo.max_uses === null || promo.used_count < promo.max_uses) &&
        (promo.plan_ids.length === 0 || promo.plan_ids.includes(planId)) &&
        (promo.applies_to === 'both' || promo.applies_to === period)) {
      amountCents = applyDiscount(amountCents, promo);
      appliedPromoCode = promo.code;
    }
  }

  // Verificar config MP
  if (!process.env.PLATFORM_MERCADOPAGO_ACCESS_TOKEN) {
    return NextResponse.json({
      ok: false,
      error: 'platform_mp_not_configured',
      message: 'El admin debe configurar PLATFORM_MERCADOPAGO_ACCESS_TOKEN'
    }, { status: 503 });
  }

  // Obtener email del owner para el payer_email
  const svc = getServiceClient();
  const { data: profile } = await svc
    .from('profiles').select('email').eq('id', ctx.userId).maybeSingle<{ email: string | null }>();
  const payerEmail = profile?.email;
  if (!payerEmail) {
    return NextResponse.json({ ok: false, error: 'no_email' }, { status: 400 });
  }

  // Trial: si el plan tiene trial_days configurado Y el owner pidió trial
  // (default = sí cuando trial_days > 0), pasamos free_trial a MP.
  const useTrial = body.use_trial !== false;  // default true
  const freeTrialDays = useTrial && plan.trial_days > 0 ? plan.trial_days : 0;

  // Crear preapproval en MP
  try {
    const reasonSuffix = period === 'annual' ? 'anual' : 'mensual';
    const trialSuffix = freeTrialDays > 0 ? ` + ${freeTrialDays}d trial` : '';
    const preapproval = await createPreapproval({
      amountCents,
      currency: plan.currency,
      frequency: period,
      reason: `Curplat Plan ${plan.name} (${reasonSuffix})${trialSuffix}`,
      externalReference: `${ctx.tenant.id}::${plan.id}::${period}${appliedPromoCode ? '::' + appliedPromoCode : ''}`,
      payerEmail,
      backUrl: `${env.platformApiOrigin}/mi-plan?status=success`,
      freeTrialDays
    });

    // Guardar preapproval pending en nuestra DB (para tracking)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('platform_subscriptions') as any).upsert({
      tenant_id: ctx.tenant.id,
      plan_id: plan.id,
      billing_period: period,
      mp_preapproval_id: preapproval.id,
      status: 'pending',
      amount_cents: amountCents,
      currency: plan.currency,
      promo_code: appliedPromoCode,
      created_at: new Date().toISOString()
    }, { onConflict: 'mp_preapproval_id' });

    return NextResponse.json({
      ok: true,
      init_point: preapproval.init_point,
      preapproval_id: preapproval.id
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[subscriptions/create]', msg);
    return NextResponse.json({ ok: false, error: 'mp_create_failed', message: msg }, { status: 502 });
  }
}
