import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Acredita amountCents al wallet de (tenantId, userId). Crea wallet si no
 * existe. Inserta wallet_transactions con kind y context. Devuelve nuevo balance.
 *
 * Idempotente NO — el caller debe asegurarse de no llamar 2 veces por el mismo
 * evento (ej. el webhook ya dedupe por sale.external_id).
 */
export async function creditWallet(opts: {
  tenantId: string;
  userId: string;
  amountCents: number;     // positivo = acredita, negativo = debita
  kind: 'topup' | 'spend' | 'refund' | 'admin_adjust' | 'transfer_out' | 'transfer_in' | 'withdrawal' | 'yield';
  courseId?: string | null;
  saleId?: string | null;
  note?: string | null;
  actorUserId?: string | null;
  currency?: string;
  /** Etiqueta libre visible en el historial (Depósito / Reembolso / Rendimiento…). */
  concept?: string | null;
}): Promise<{ ok: true; balance_cents: number } | { ok: false; error: string }> {
  const svc = getServiceClient();
  const currency = opts.currency || 'ARS';

  // 1. upsert wallet — scopeado por currency (multi-currency, 0063).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('wallets') as any)
    .select('id, balance_cents')
    .eq('tenant_id', opts.tenantId)
    .eq('user_id', opts.userId)
    .eq('currency', currency)
    .maybeSingle();
  let walletId: string;
  let currentBalance = 0;
  if (existing) {
    walletId = existing.id;
    currentBalance = existing.balance_cents ?? 0;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: cErr } = await (svc.from('wallets') as any).insert({
      tenant_id: opts.tenantId, user_id: opts.userId, balance_cents: 0, currency
    }).select('id').single();
    if (cErr || !created) return { ok: false, error: cErr?.message ?? 'wallet_create_failed' };
    walletId = created.id;
  }

  const newBalance = currentBalance + opts.amountCents;
  if (newBalance < 0) return { ok: false, error: 'insufficient_funds' };

  // 2. update wallet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: uErr } = await (svc.from('wallets') as any)
    .update({ balance_cents: newBalance, updated_at: new Date().toISOString() })
    .eq('id', walletId);
  if (uErr) return { ok: false, error: uErr.message };

  // 3. insert transaction (append-only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txPayload: Record<string, unknown> = {
    wallet_id: walletId,
    tenant_id: opts.tenantId,
    user_id: opts.userId,
    amount_cents: opts.amountCents,
    balance_after_cents: newBalance,
    kind: opts.kind,
    course_id: opts.courseId ?? null,
    sale_id: opts.saleId ?? null,
    note: opts.note ?? null,
    actor_user_id: opts.actorUserId ?? null
  };
  // Sólo incluir concept si vino — evita fallo si migration 0062 no corrió.
  if (opts.concept != null) txPayload.concept = opts.concept;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: tErr } = await (svc.from('wallet_transactions') as any).insert(txPayload);
  if (tErr) return { ok: false, error: tErr.message };

  return { ok: true, balance_cents: newBalance };
}
