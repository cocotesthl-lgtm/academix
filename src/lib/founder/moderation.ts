'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/** Guard local — igual patrón que requireFounder de ./actions.ts que no
 *  está exportado. Devuelve el user id del founder autenticado. */
async function requireFounder(): Promise<string> {
  const user = await requireSuperAdmin();
  return user.id;
}

type UserBulkAction = 'activate' | 'under_review' | 'suspend' | 'delete';
type TenantBulkAction = 'activate' | 'under_review' | 'suspend' | 'delete';

/**
 * Bulk update de moderación sobre N usuarios. Sólo founder.
 * Actions:
 *   activate     → moderation_status = 'active'
 *   under_review → 'under_review'
 *   suspend      → 'suspended'
 *   delete       → borra auth.users + profile (cascade a memberships/tenants
 *                  que le pertenecen)
 *
 * IDs vienen en CSV. Devuelve counts para banners de éxito.
 */
export async function bulkUpdateUsersAction(formData: FormData): Promise<void> {
  const founderId = await requireFounder();
  const action = String(formData.get('action') ?? '') as UserBulkAction;
  const idsRaw = String(formData.get('ids') ?? '');
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return;
  if (!['activate', 'under_review', 'suspend', 'delete'].includes(action)) return;

  // No permitir accionar sobre uno mismo (safety)
  const targets = ids.filter((id) => id !== founderId);
  if (targets.length === 0) return;

  const svc = getServiceClient();

  if (action === 'delete') {
    // Delete cada auth.users — cascade cae al profile via FK
    for (const id of targets) {
      try {
        await svc.auth.admin.deleteUser(id);
      } catch (e) {
        console.warn('[bulkUpdateUsers] delete failed for', id, e);
      }
    }
  } else {
    const status = action === 'activate' ? 'active'
      : action === 'under_review' ? 'under_review'
      : 'suspended';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('profiles') as any)
      .update({ moderation_status: status, updated_at: new Date().toISOString() })
      .in('id', targets);
    if (error?.message?.includes('moderation_status')) {
      // Migration 0086 pendiente — silencio, no rompemos.
      console.warn('[bulkUpdateUsers] migration 0086 missing');
    }
  }

  revalidatePath('/founder/users');
}

export async function bulkUpdateTenantsAction(formData: FormData): Promise<void> {
  await requireFounder();
  const action = String(formData.get('action') ?? '') as TenantBulkAction;
  const idsRaw = String(formData.get('ids') ?? '');
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return;
  if (!['activate', 'under_review', 'suspend', 'delete'].includes(action)) return;

  const svc = getServiceClient();

  if (action === 'delete') {
    // FK cascade se encarga de cursos, ventas, forms, etc.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenants') as any).delete().in('id', ids);
  } else {
    const status = action === 'activate' ? 'active'
      : action === 'under_review' ? 'under_review'
      : 'suspended';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenants') as any)
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids);
  }

  revalidatePath('/founder/tenants');
}
