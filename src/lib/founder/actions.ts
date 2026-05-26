'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

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

export async function setTenantStatusAction(formData: FormData): Promise<void> {
  const founderId = await requireFounder();
  const tenantId = String(formData.get('tenant_id') ?? '');
  const newStatus = String(formData.get('status') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;

  if (!['active', 'suspended', 'closed'].includes(newStatus)) return;

  const svc = getServiceClient();

  const { data: before } = await svc
    .from('tenants')
    .select('status')
    .eq('id', tenantId)
    .single<{ status: string }>();

  const updatePayload = { status: newStatus, updated_at: new Date().toISOString() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update(updatePayload).eq('id', tenantId);

  const auditPayload = {
    actor_user_id: founderId,
    tenant_id: tenantId,
    action: 'tenant.status_changed',
    target_type: 'tenant',
    target_id: tenantId,
    before: { status: before?.status },
    after: { status: newStatus },
    reason
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await svc.from('audit_log').insert(auditPayload as any);

  revalidatePath('/tenants');
  revalidatePath('/dashboard');
}
