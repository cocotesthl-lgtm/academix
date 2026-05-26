'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export async function disconnectIntegrationAction(formData: FormData): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const provider = String(formData.get('provider') ?? '');
  if (!['mercadopago', 'shopify', 'google_drive'].includes(provider)) return;

  const svc = getServiceClient();
  await svc.from('integrations').delete().eq('tenant_id', tenant.id).eq('provider', provider);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('audit_log') as any).insert({
    actor_user_id: userId,
    tenant_id: tenant.id,
    action: 'integration.disconnected',
    target_type: 'integration',
    after: { provider }
  });

  revalidatePath('/integrations');
}
