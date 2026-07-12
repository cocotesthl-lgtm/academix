'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { creditWallet } from './credit';

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Ajuste manual de saldo desde el panel del owner. Acredita o debita N pesos
 * con una nota explicativa.
 */
export async function adminAdjustWalletAction(formData: FormData): Promise<void> {
  const { tenant, userId: actor } = await requireOwner();
  const targetUserId = String(formData.get('user_id') ?? '');
  if (!targetUserId) return;
  const amountPesos = parseFloat(String(formData.get('amount') ?? '0').replace(/[^0-9.-]/g, '') || '0');
  if (!Number.isFinite(amountPesos) || amountPesos === 0) return;
  const concept = String(formData.get('concept') ?? '').trim().slice(0, 60) || null;
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null;
  // Currency: viene del select o del row (currency de la wallet existente).
  const currency = String(formData.get('currency') ?? '').trim() || 'ARS';
  const cents = Math.round(amountPesos * 100);

  await creditWallet({
    tenantId: tenant.id,
    userId: targetUserId,
    amountCents: cents,
    kind: 'admin_adjust',
    concept,
    note,
    actorUserId: actor,
    currency
  });
  revalidatePath('/owner/wallets');
}

/* ───── Owner: gestión de monedas (multi-currency) ───── */

/**
 * Crea una nueva moneda para el tenant. El `code` se autogenera del label
 * si no vino. Si el tenant no tenía ninguna, esta queda como default.
 */
export async function createWalletCurrencyAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const label = String(formData.get('label') ?? '').trim().slice(0, 40);
  if (!label) return;
  const symbol = String(formData.get('symbol') ?? '').trim().slice(0, 6) || '$';
  const logoUrl = String(formData.get('logo_url') ?? '').trim().slice(0, 500) || null;
  const rawCode = String(formData.get('code') ?? '').trim().toLowerCase();
  const code = (rawCode || label.toLowerCase().replace(/[^a-z0-9]+/g, '')).slice(0, 20);

  const svc = getServiceClient();
  // ¿Es la primera moneda? → default automático
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (svc.from('wallet_currencies') as any)
    .select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
  const isDefault = !count || count === 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('wallet_currencies') as any).insert({
    tenant_id: tenant.id,
    code, label, symbol, logo_url: logoUrl,
    is_default: isDefault,
    position: count ?? 0
  });
  revalidatePath('/owner/wallets');
}

export async function updateWalletCurrencyAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const label = String(formData.get('label') ?? '').trim().slice(0, 40);
  const symbol = String(formData.get('symbol') ?? '').trim().slice(0, 6);
  const logoUrl = String(formData.get('logo_url') ?? '').trim().slice(0, 500);

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (label) payload.label = label;
  if (symbol) payload.symbol = symbol;
  payload.logo_url = logoUrl || null; // permite limpiar el logo con vacío

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('wallet_currencies') as any).update(payload).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/wallets');
}

export async function setDefaultWalletCurrencyAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // Bajamos default a todas y subimos solo a esta. Dos updates en vez de
  // uno para evitar conflicto si hay unique parcial (no lo hay pero
  // defensivo por si sumamos uno después).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('wallet_currencies') as any)
    .update({ is_default: false }).eq('tenant_id', tenant.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('wallet_currencies') as any)
    .update({ is_default: true }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/wallets');
}

export async function deleteWalletCurrencyAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // No permitimos borrar si es la única moneda del tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (svc.from('wallet_currencies') as any)
    .select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
  if (!count || count <= 1) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('wallet_currencies') as any).delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/wallets');
}

/* ───── Owner: config de currency ───── */

/**
 * Guarda el nombre + símbolo de la moneda de la wallet del tenant.
 * Ej: label='BTC' symbol='₿'. Se muestra en la UI de saldos y en la
 * página pública /saldo del cliente.
 */
export async function setWalletCurrencyAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const rawLabel = String(formData.get('label') ?? '').trim();
  const rawSymbol = String(formData.get('symbol') ?? '').trim();
  // Sanitize: label max 12 chars, symbol max 4 chars (₿, US$, etc.)
  const label = rawLabel.slice(0, 12) || 'ARS';
  const symbol = rawSymbol.slice(0, 4) || '$';
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any)
    .update({
      wallet_currency_label: label,
      wallet_currency_symbol: symbol,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenant.id);
  revalidatePath('/owner/wallets');
}

/* ───── Owner: toggles de features wallet ───── */

export async function setWalletTransfersEnabledAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const enabled = formData.get('enabled') === 'true' || formData.get('enabled') === 'on';
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any)
    .update({ wallet_transfers_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', tenant.id);
  revalidatePath('/owner/wallets');
}

export async function setWalletWithdrawalsEnabledAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const enabled = formData.get('enabled') === 'true' || formData.get('enabled') === 'on';
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any)
    .update({ wallet_withdrawals_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', tenant.id);
  revalidatePath('/owner/wallets');
}

/* ───── Owner: aprobar / rechazar solicitud de retiro ───── */

export async function approveWithdrawalAction(formData: FormData): Promise<void> {
  const { tenant, userId: actor } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('wallet_withdrawal_requests') as any).update({
    status: 'paid',
    processed_at: new Date().toISOString(),
    processed_by: actor
  }).eq('id', id).eq('tenant_id', tenant.id).eq('status', 'pending');
  revalidatePath('/owner/wallets');
}

export async function rejectWithdrawalAction(formData: FormData): Promise<void> {
  const { tenant, userId: actor } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 300) || 'Rechazado por el owner';
  if (!id) return;
  const svc = getServiceClient();
  // Buscar la solicitud para devolverle el saldo al user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req } = await (svc.from('wallet_withdrawal_requests') as any)
    .select('user_id, amount_cents, status').eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  if (!req || req.status !== 'pending') return;

  // Refund al wallet
  await creditWallet({
    tenantId: tenant.id,
    userId: req.user_id,
    amountCents: req.amount_cents, // positivo = re-acreditamos
    kind: 'refund',
    note: `Retiro rechazado: ${reason}`,
    actorUserId: actor
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('wallet_withdrawal_requests') as any).update({
    status: 'rejected',
    reject_reason: reason,
    processed_at: new Date().toISOString(),
    processed_by: actor
  }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/wallets');
}

/* ───── Usuario: transferir saldo a otro usuario ───── */

export async function transferWalletAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No estás logueado.' };

  const tenantId = String(formData.get('tenant_id') ?? '');
  const recipientEmail = String(formData.get('recipient_email') ?? '').trim().toLowerCase();
  const amountPesos = parseFloat(String(formData.get('amount') ?? '0').replace(/[^0-9.]/g, '') || '0');
  const note = String(formData.get('note') ?? '').trim().slice(0, 300) || null;
  if (!tenantId || !recipientEmail) return { ok: false, error: 'Faltan datos.' };
  if (!Number.isFinite(amountPesos) || amountPesos <= 0) return { ok: false, error: 'Monto inválido.' };
  const cents = Math.round(amountPesos * 100);

  const svc = getServiceClient();

  // Validar que el tenant tiene transfers habilitados
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (svc.from('tenants') as any)
    .select('wallet_transfers_enabled').eq('id', tenantId).maybeSingle();
  if (!tenant?.wallet_transfers_enabled) return { ok: false, error: 'El sitio no tiene transferencias habilitadas.' };

  // Buscar destinatario
  const { data: rec } = await svc.from('profiles')
    .select('id, email').eq('email', recipientEmail).maybeSingle<{ id: string; email: string }>();
  if (!rec) return { ok: false, error: 'No encontramos un usuario con ese email.' };
  if (rec.id === user.id) return { ok: false, error: 'No podés transferirte saldo a vos mismo.' };

  // Validar balance suficiente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: w } = await (svc.from('wallets') as any)
    .select('balance_cents').eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
  if (!w || w.balance_cents < cents) return { ok: false, error: 'Saldo insuficiente.' };

  // Atómico (lógico — no es transacción DB pero compensable):
  // 1. debit sender
  const r1 = await creditWallet({
    tenantId, userId: user.id, amountCents: -cents,
    kind: 'transfer_out',
    note: `Transferencia a ${recipientEmail}${note ? ` — ${note}` : ''}`,
    actorUserId: user.id
  });
  if (!r1.ok) return { ok: false, error: r1.error };

  // 2. credit recipient
  const r2 = await creditWallet({
    tenantId, userId: rec.id, amountCents: cents,
    kind: 'transfer_in',
    note: `Recibido de ${user.email ?? 'usuario'}${note ? ` — ${note}` : ''}`,
    actorUserId: user.id
  });
  if (!r2.ok) {
    // Compensar: re-acreditamos al sender
    await creditWallet({
      tenantId, userId: user.id, amountCents: cents,
      kind: 'refund', note: 'Reversión transferencia fallida', actorUserId: user.id
    });
    return { ok: false, error: 'No pudimos completar la transferencia. Tu saldo fue restaurado.' };
  }

  revalidatePath(`/saldo`);
  return { ok: true, message: `Transferido $ ${(cents / 100).toLocaleString('es-AR')} a ${recipientEmail}.` };
}

/* ───── Usuario: solicitar retiro ───── */

export async function requestWithdrawalAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No estás logueado.' };

  const tenantId = String(formData.get('tenant_id') ?? '');
  const amountPesos = parseFloat(String(formData.get('amount') ?? '0').replace(/[^0-9.]/g, '') || '0');
  const method = String(formData.get('method') ?? '').trim().slice(0, 50) || null;
  const destination = String(formData.get('destination') ?? '').trim().slice(0, 300) || null;
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null;
  if (!tenantId) return { ok: false, error: 'Faltan datos.' };
  if (!Number.isFinite(amountPesos) || amountPesos <= 0) return { ok: false, error: 'Monto inválido.' };
  const cents = Math.round(amountPesos * 100);

  const svc = getServiceClient();

  // Validar feature flag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (svc.from('tenants') as any)
    .select('wallet_withdrawals_enabled').eq('id', tenantId).maybeSingle();
  if (!tenant?.wallet_withdrawals_enabled) return { ok: false, error: 'El sitio no tiene retiros habilitados.' };

  // Validar balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: w } = await (svc.from('wallets') as any)
    .select('balance_cents, currency').eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
  if (!w || w.balance_cents < cents) return { ok: false, error: 'Saldo insuficiente.' };

  // Debitar saldo (queda "bloqueado" hasta que el owner apruebe/rechace)
  const debit = await creditWallet({
    tenantId, userId: user.id, amountCents: -cents,
    kind: 'withdrawal',
    note: `Solicitud de retiro${method ? ` (${method})` : ''}${destination ? ` → ${destination}` : ''}`,
    actorUserId: user.id
  });
  if (!debit.ok) return { ok: false, error: debit.error };

  // Buscar la tx recién creada para linkearla
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tx } = await (svc.from('wallet_transactions') as any)
    .select('id').eq('user_id', user.id).eq('tenant_id', tenantId).eq('kind', 'withdrawal')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  // Crear solicitud
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('wallet_withdrawal_requests') as any).insert({
    tenant_id: tenantId,
    user_id: user.id,
    amount_cents: cents,
    currency: w.currency || 'ARS',
    method, destination, note,
    status: 'pending',
    withdrawal_tx_id: tx?.id ?? null
  });

  revalidatePath('/saldo');
  return { ok: true, message: `Solicitud de retiro por $ ${(cents / 100).toLocaleString('es-AR')} enviada. El sitio la procesará pronto.` };
}

/* ───── Owner: Modo Inversiones + rendimientos ───── */

/**
 * Prende/apaga el "Modo Inversiones" del tenant. Cuando está prendido,
 * el owner ve el bloque "Otorgar rendimientos" en /owner/wallets.
 * Además guarda una tasa default sugerida (basis points) para pre-cargar
 * el formulario.
 */
export async function setWalletInvestmentEnabledAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const enabled = formData.get('enabled') === 'true' || formData.get('enabled') === 'on';
  const rawRate = String(formData.get('default_rate_pct') ?? '').trim();
  const rateBps = rawRate ? Math.max(0, Math.round(parseFloat(rawRate) * 100)) : null;
  const svc = getServiceClient();
  const payload: Record<string, unknown> = {
    wallet_investment_enabled: enabled,
    updated_at: new Date().toISOString()
  };
  if (rateBps != null && Number.isFinite(rateBps)) payload.wallet_default_yield_rate_bps = rateBps;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update(payload).eq('id', tenant.id);
  revalidatePath('/owner/wallets');
}

/**
 * Aplica rendimiento (yield %) al saldo actual de un cliente puntual
 * o a TODOS los clientes con saldo > 0. La suma se calcula como
 * `balance_actual * rate_pct/100`.
 *
 * FormData:
 *   - rate_pct: number (ej: 5 = 5%)
 *   - target: 'all' | user_id
 *   - concept: label libre (default "Rendimiento")
 *   - note: nota opcional
 */
export async function applyWalletYieldAction(formData: FormData): Promise<void> {
  const { tenant, userId: actor } = await requireOwner();
  const ratePct = parseFloat(String(formData.get('rate_pct') ?? '0').replace(',', '.'));
  if (!Number.isFinite(ratePct) || ratePct === 0) return;
  const target = String(formData.get('target') ?? 'all');
  const currency = String(formData.get('currency') ?? '').trim() || 'ARS';
  const concept = String(formData.get('concept') ?? '').trim().slice(0, 60) || 'Rendimiento';
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null;

  const svc = getServiceClient();

  // Confirmar que Modo Inversiones esté prendido (defensivo)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: t } = await (svc.from('tenants') as any)
    .select('wallet_investment_enabled').eq('id', tenant.id).maybeSingle();
  if (!t?.wallet_investment_enabled) return;

  // Cargar wallets afectados — SOLO de la moneda seleccionada
  let query = svc.from('wallets')
    .select('user_id, balance_cents, currency')
    .eq('tenant_id', tenant.id)
    .eq('currency', currency)
    .gt('balance_cents', 0);
  if (target !== 'all') query = query.eq('user_id', target);
  const { data: wallets } = await query;
  const rows = (wallets ?? []) as Array<{ user_id: string; balance_cents: number; currency: string }>;

  for (const w of rows) {
    const yieldCents = Math.floor((w.balance_cents * ratePct) / 100);
    if (yieldCents <= 0) continue;
    await creditWallet({
      tenantId: tenant.id,
      userId: w.user_id,
      amountCents: yieldCents,
      kind: 'yield',
      concept,
      note: note ?? `${ratePct}% sobre saldo`,
      actorUserId: actor,
      currency: w.currency
    });
  }
  revalidatePath('/owner/wallets');
}

