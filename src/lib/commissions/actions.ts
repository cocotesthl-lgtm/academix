'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export type CommissionResult = { ok: true } | { ok: false; error: string };

async function requireFounder(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');
  const { data: prof } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle<{ is_super_admin: boolean }>();
  if (!prof?.is_super_admin) throw new Error('forbidden');
  return user.id;
}

function parseRate(input: string): number | null {
  const n = parseFloat(input);
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return n / 100;
}

/**
 * Set the global commission rate. Append-only: closes the previous active
 * rule and inserts a new one effective from now().
 */
export async function setGlobalRateAction(
  _prev: CommissionResult | null,
  formData: FormData
): Promise<CommissionResult> {
  const founderId = await requireFounder();
  const ratePct = String(formData.get('rate_pct') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const rate = parseRate(ratePct);
  if (rate === null) return { ok: false, error: 'Tasa inválida. Ingresá entre 0 y 100.' };
  if (!reason) return { ok: false, error: 'Indicá un motivo para el cambio.' };

  const svc = getServiceClient();
  const now = new Date().toISOString();

  // Close previous open global rule
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('commission_rules') as any)
    .update({ effective_to: now })
    .eq('scope', 'global')
    .is('effective_to', null);

  // Insert new
  const payload = {
    scope: 'global',
    tenant_id: null,
    rate,
    effective_from: now,
    set_by: founderId,
    reason
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('commission_rules') as any).insert(payload);
  if (error) return { ok: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('audit_log') as any).insert({
    actor_user_id: founderId,
    action: 'commission_rate.global_changed',
    after: { rate },
    reason
  });

  revalidatePath('/commissions');
  return { ok: true };
}

/**
 * Set per-tenant override. Null clears the override (uses global).
 */
export async function setTenantOverrideAction(formData: FormData): Promise<CommissionResult> {
  const founderId = await requireFounder();
  const tenantId = String(formData.get('tenant_id') ?? '');
  const ratePctRaw = String(formData.get('rate_pct') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!tenantId) return { ok: false, error: 'Tenant faltante.' };
  if (!reason) return { ok: false, error: 'Indicá un motivo.' };

  let newOverride: number | null;
  if (ratePctRaw === '' || ratePctRaw.toLowerCase() === 'null') {
    newOverride = null;
  } else {
    const r = parseRate(ratePctRaw);
    if (r === null) return { ok: false, error: 'Tasa inválida.' };
    newOverride = r;
  }

  const svc = getServiceClient();

  const { data: before } = await svc
    .from('tenants')
    .select('commission_rate_override')
    .eq('id', tenantId)
    .single<{ commission_rate_override: number | null }>();

  const updatePayload = {
    commission_rate_override: newOverride,
    updated_at: new Date().toISOString()
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('tenants') as any)
    .update(updatePayload)
    .eq('id', tenantId);
  if (error) return { ok: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('audit_log') as any).insert({
    actor_user_id: founderId,
    tenant_id: tenantId,
    action: 'commission_rate.override_changed',
    target_type: 'tenant',
    target_id: tenantId,
    before: { commission_rate_override: before?.commission_rate_override ?? null },
    after: { commission_rate_override: newOverride },
    reason
  });

  revalidatePath('/commissions');
  revalidatePath('/tenants');
  return { ok: true };
}
