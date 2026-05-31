'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { processMpPayment } from '@/lib/payments/process';

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

export type ReprocessResult =
  | { ok: true; saleId: string | null; reused: boolean; tenantId: string; paymentId: string }
  | { ok: false; error: string };

/**
 * Founder-only: reimporta un pago de MP por payment_id cuando el webhook
 * automático no llegó (firma mal, retry expirado, network glitch, etc).
 * Usa el access_token del owner conectado al tenant para fetchear el
 * payment desde la API de MP y replay la misma lógica del webhook.
 *
 * Idempotente: si ya existe la sale, no duplica.
 */
export async function reprocessMpPaymentAction(
  _prev: ReprocessResult | null,
  formData: FormData
): Promise<ReprocessResult> {
  try {
    await requireFounder();
  } catch {
    return { ok: false, error: 'No autorizado.' };
  }

  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const paymentId = String(formData.get('payment_id') ?? '').trim();

  if (!tenantId || !paymentId) {
    return { ok: false, error: 'Faltan tenant_id o payment_id.' };
  }

  const svc = getServiceClient();
  const { data: integration } = await svc
    .from('integrations')
    .select('access_token_enc')
    .eq('tenant_id', tenantId)
    .eq('provider', 'mercadopago')
    .eq('status', 'connected')
    .maybeSingle<{ access_token_enc: string }>();

  if (!integration) {
    return { ok: false, error: 'Este tenant no tiene MercadoPago conectado.' };
  }

  const result = await processMpPayment({
    tenantId,
    paymentId,
    accessToken: integration.access_token_enc
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await svc.from('audit_log').insert({
    actor_user_id: null,
    tenant_id: tenantId,
    action: 'sale.reprocessed_manually',
    target_type: 'sale',
    target_id: result.saleId,
    after: { payment_id: paymentId, reused: result.reused }
  } as never);

  revalidatePath('/tenants');
  revalidatePath('/finance');
  revalidatePath('/students');

  return {
    ok: true,
    saleId: result.saleId,
    reused: result.reused,
    tenantId,
    paymentId
  };
}
