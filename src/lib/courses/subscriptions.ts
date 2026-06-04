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
