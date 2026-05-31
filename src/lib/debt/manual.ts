'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getOwnerBalance } from '@/lib/debt/accrue';

async function requireFounder(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle<{ is_super_admin: boolean }>();
  if (!profile?.is_super_admin) throw new Error('forbidden');
  return user.id;
}

/**
 * Marca la deuda actual de un tenant como saldada cuando el owner pagó
 * por fuera del sistema automático (transferencia cripto, transferencia
 * bancaria, lo que sea). Solo el founder puede ejecutarla.
 *
 * Mecánica:
 * 1. Lee el balance actual del tenant.
 * 2. Inserta una fila debt_payment en owner_debt_ledger con monto negativo
 *    igual al balance (lo lleva a 0).
 * 3. Inserta una fila en debt_payments con method='manual_crypto' (o el
 *    method que el founder elija) para tener trazabilidad.
 * 4. Audit log.
 *
 * Requiere confirmación: el form debe enviar 'confirm=<slug>' que tiene que
 * coincidir con el slug del tenant, para evitar clicks accidentales.
 */
export async function settleDebtManuallyAction(formData: FormData): Promise<void> {
  const founderId = await requireFounder();
  const tenantId = String(formData.get('tenant_id') ?? '');
  const confirm = String(formData.get('confirm') ?? '').trim();
  const methodRaw = String(formData.get('method') ?? 'crypto').trim().toLowerCase();
  const reference = String(formData.get('reference') ?? '').trim().slice(0, 200);
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);

  if (!tenantId) return;

  const svc = getServiceClient();
  const { data: tenant } = await svc
    .from('tenants')
    .select('slug, name')
    .eq('id', tenantId)
    .maybeSingle<{ slug: string; name: string }>();
  if (!tenant) return;
  if (confirm !== tenant.slug) return; // safety

  const balance = await getOwnerBalance(tenantId);
  if (balance <= 0) {
    // No hay nada que saldar
    revalidatePath('/tenants');
    revalidatePath('/finance');
    return;
  }

  const method = ['crypto', 'bank_transfer', 'cash', 'other'].includes(methodRaw)
    ? methodRaw
    : 'other';

  // 1. Insertar fila en debt_payments para trazabilidad
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: paymentRow } = await (svc.from('debt_payments') as any)
    .insert({
      tenant_id: tenantId,
      amount_cents: balance,
      currency: 'ARS',
      method,
      external_id: reference || null,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      metadata: { manual: true, by_founder: founderId, note: note || null }
    })
    .select('id')
    .single();

  const paymentId = (paymentRow as { id?: string } | null)?.id ?? null;

  // 2. Insertar entrada negativa en el ledger que reduzca el balance a 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('owner_debt_ledger') as any).insert({
    tenant_id: tenantId,
    type: 'debt_payment',
    amount_cents: -balance,
    balance_after_cents: 0,
    debt_payment_id: paymentId,
    status: 'settled'
  });

  // 3. Si el tenant estaba suspendido por deuda, reactivarlo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any)
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', tenantId)
    .eq('status', 'suspended');

  // 4. Audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await svc.from('audit_log').insert({
    actor_user_id: founderId,
    tenant_id: tenantId,
    action: 'debt.settled_manually',
    target_type: 'tenant',
    target_id: tenantId,
    after: { method, reference, balance_cleared_cents: balance, payment_id: paymentId },
    reason: note || `Founder marked debt as settled (${method})`
  } as never);

  revalidatePath('/tenants');
  revalidatePath('/finance');
  revalidatePath('/dashboard');
}
