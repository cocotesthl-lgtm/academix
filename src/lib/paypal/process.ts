import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';
import { creditWallet } from '@/lib/wallets/credit';

export type ProcessPayPalResult =
  | { ok: true; saleId: string | null; reused: boolean }
  | { ok: false; error: string };

/**
 * Procesa una captura de PayPal exitosa: registra sale, resuelve/crea
 * buyer user, hace enroll y aplica wallet_bonus_cents si el curso tiene.
 *
 * Idempotente por (external_provider='paypal', external_id=orderId): si
 * ya se procesó, devuelve el sale existente.
 *
 * Scope Fase B: solo cursos (no físicos, tickets, invoices ni reservations —
 * esos siguen por MP hasta Fase C).
 */
export async function processPayPalCapture(opts: {
  tenantId: string;
  courseId: string;
  orderId: string;                // PayPal order id (idempotency key)
  captureId: string;              // PayPal capture id (para reference)
  amountCents: number;
  currency: string;
  buyerEmail: string;
  buyerName?: string | null;
  rawPayload: unknown;             // response completo de PayPal para auditoría
}): Promise<ProcessPayPalResult> {
  const svc = getServiceClient();

  // 1. Load course
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: course } = await (svc.from('courses') as any)
    .select('id, title, wallet_bonus_cents, currency')
    .eq('id', opts.courseId).eq('tenant_id', opts.tenantId).maybeSingle();
  if (!course) return { ok: false, error: 'course_not_found' };

  // 2. Resolve buyer user by email
  //    Si existe → usar su id. Si no → crear buyer en auth y profile.
  let buyerUserId: string | null = null;
  const { data: existingProfile } = await svc
    .from('profiles').select('id').eq('email', opts.buyerEmail).maybeSingle<{ id: string }>();
  if (existingProfile) {
    buyerUserId = existingProfile.id;
  } else {
    // Crear buyer minimalista via auth admin API (mismo patrón que MP)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (svc.auth as any).admin.createUser({
      email: opts.buyerEmail,
      email_confirm: true,
      user_metadata: { display_name: opts.buyerName || opts.buyerEmail.split('@')[0] }
    });
    if (created?.data?.user?.id) {
      buyerUserId = created.data.user.id;
      // Profile row se autocrea con trigger, pero por si acaso hacemos upsert
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('profiles') as any).upsert({
        id: buyerUserId, email: opts.buyerEmail, display_name: opts.buyerName || null
      }, { onConflict: 'id' });
    }
  }

  // 3. Insert sale (idempotente via UNIQUE external_provider+external_id)
  const salePayload = {
    tenant_id: opts.tenantId,
    course_id: opts.courseId,
    buyer_user_id: buyerUserId,
    external_provider: 'paypal',
    external_id: opts.orderId,
    amount_gross_cents: opts.amountCents,
    amount_net_cents: opts.amountCents,
    currency: opts.currency,
    status: 'approved',
    raw_payload: opts.rawPayload,
    occurred_at: new Date().toISOString(),
    buyer_email: opts.buyerEmail,
    buyer_name: opts.buyerName || null
  };

  let saleId: string | null = null;
  let reused = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: saleRow, error: saleErr } = await (svc.from('sales') as any)
    .insert(salePayload).select('id').single();

  if (saleErr) {
    if (saleErr.message?.toLowerCase().includes('duplicate')) {
      const { data: existing } = await svc.from('sales').select('id')
        .eq('external_provider', 'paypal').eq('external_id', opts.orderId)
        .maybeSingle<{ id: string }>();
      saleId = existing?.id ?? null;
      reused = true;
    } else {
      return { ok: false, error: saleErr.message };
    }
  } else {
    saleId = (saleRow as { id: string }).id;
  }

  // 4. Auto-enroll (idempotente)
  if (buyerUserId && !reused) {
    const { data: existingEnroll } = await svc
      .from('enrollments').select('id')
      .eq('tenant_id', opts.tenantId)
      .eq('course_id', opts.courseId)
      .eq('user_id', buyerUserId)
      .maybeSingle<{ id: string }>();

    if (!existingEnroll) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('enrollments') as any).insert({
        tenant_id: opts.tenantId,
        course_id: opts.courseId,
        user_id: buyerUserId,
        source: 'direct',
        sale_id: saleId,
        status: 'active',
        buyer_email: opts.buyerEmail,
        buyer_name: opts.buyerName || null
      });
    }
  }

  // 5. Wallet bonus (si el curso lo tiene configurado)
  const bonus = Number((course as { wallet_bonus_cents?: number })?.wallet_bonus_cents ?? 0);
  if (bonus > 0 && buyerUserId && saleId && !reused) {
    try {
      await creditWallet({
        tenantId: opts.tenantId,
        userId: buyerUserId,
        amountCents: bonus,
        kind: 'topup',
        courseId: opts.courseId,
        saleId,
        note: `Bonus por compra: ${(course as { title?: string }).title ?? ''}`,
        currency: (course as { currency?: string }).currency || 'ARS'
      });
    } catch { /* wallet migrations pendientes — no rompe la venta */ }
  }

  return { ok: true, saleId, reused };
}
