import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';
import { getPayment } from '@/lib/payments/mercadopago';
import { accrueCommissionForSale } from '@/lib/debt/accrue';
import { accrueAffiliateCommissionsForSale } from '@/lib/affiliates/commission';

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
        buyer_extra:    buyerExtra
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('enrollments') as any).insert(enrollPayload);
    }
  }

  // Accrue commission + affiliate commissions (idempotentes internamente)
  if (payment.status === 'approved' && saleId) {
    await accrueCommissionForSale(saleId);
    const affLinkId = (meta.affiliate_link_id as string | null | undefined) ?? null;
    await accrueAffiliateCommissionsForSale({ saleId, linkId: affLinkId });
  }

  return { ok: true, saleId, reused };
}
