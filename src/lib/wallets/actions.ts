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
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null;
  const cents = Math.round(amountPesos * 100);

  await creditWallet({
    tenantId: tenant.id,
    userId: targetUserId,
    amountCents: cents,
    kind: 'admin_adjust',
    note,
    actorUserId: actor
  });
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

