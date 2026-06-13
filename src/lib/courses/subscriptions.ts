'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export async function setCoursePricingModeAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  if (!courseId) return;
  const modeRaw = String(formData.get('pricing_mode') ?? 'one_time');
  const mode = (['one_time', 'subscription'] as const).find((m) => m === modeRaw) ?? 'one_time';
  const freqRaw = String(formData.get('subscription_frequency') ?? 'monthly');
  const freq = (['monthly', 'yearly'] as const).find((f) => f === freqRaw) ?? 'monthly';
  const trialRaw = parseInt(String(formData.get('subscription_trial_days') ?? '0'), 10);
  const trial = Math.min(365, Math.max(0, Number.isFinite(trialRaw) ? trialRaw : 0));

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('courses') as any)
    .update({
      pricing_mode: mode,
      subscription_frequency: mode === 'subscription' ? freq : null,
      subscription_trial_days: mode === 'subscription' ? trial : 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', courseId).eq('tenant_id', tenant.id);
  revalidatePath(`/courses/${courseId}`);
}

/**
 * Cancelar una suscripción de un cliente del owner.
 * Llama al MP API con el access_token DEL OWNER (no el de la plataforma)
 * porque la suscripción está creada con el MP del owner.
 *
 * Si MP rechaza, igual marcamos como cancelled en nuestra DB para que el
 * owner no la siga viendo activa.
 */
export async function cancelClientSubscriptionAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const subId = String(formData.get('subscription_id') ?? '');
  if (!subId) return;

  const svc = getServiceClient();
  const { data: sub } = await svc
    .from('subscriptions')
    .select('preapproval_id, status, external_provider')
    .eq('id', subId).eq('tenant_id', tenant.id)
    .maybeSingle<{ preapproval_id: string; status: string; external_provider: string }>();
  if (!sub) return;
  if (sub.status === 'cancelled') return;

  // Obtener el access_token del owner (su integración MP)
  const { data: integration } = await svc
    .from('integrations').select('access_token')
    .eq('tenant_id', tenant.id).eq('provider', 'mercadopago').eq('status', 'connected')
    .maybeSingle<{ access_token: string }>();

  if (integration?.access_token && sub.external_provider === 'mercadopago') {
    try {
      await fetch(`https://api.mercadopago.com/preapproval/${sub.preapproval_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'cancelled' })
      });
    } catch (e) {
      console.error('[cancelClientSubscription] MP fail, cancelando local:', e);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('subscriptions') as any).update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString()
  }).eq('id', subId).eq('tenant_id', tenant.id);

  revalidatePath('/suscripciones');
}
