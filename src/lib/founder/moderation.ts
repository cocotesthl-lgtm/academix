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

export type BulkResult = {
  ok: boolean;
  processed: number;
  failed: number;
  failures?: Array<{ id: string; reason: string }>;
  message?: string;
};

/**
 * Bulk update de moderación sobre N usuarios. Sólo founder.
 * Actions:
 *   activate     → moderation_status = 'active'
 *   under_review → 'under_review'
 *   suspend      → 'suspended'
 *   delete       → borra auth.users + profile (cascade a memberships/etc)
 *                  IMPORTANTE: primero borramos los tenants del user, porque
 *                  tenants.owner_user_id NOT NULL sin ON DELETE CASCADE
 *                  bloquearía el delete del profile.
 *
 * Devuelve counts + failures para que el UI pueda mostrar toast/banner.
 */
export async function bulkUpdateUsersAction(formData: FormData): Promise<BulkResult> {
  const founderId = await requireFounder();
  const action = String(formData.get('action') ?? '') as UserBulkAction;
  const idsRaw = String(formData.get('ids') ?? '');
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return { ok: false, processed: 0, failed: 0, message: 'Sin IDs' };
  }
  if (!['activate', 'under_review', 'suspend', 'delete'].includes(action)) {
    return { ok: false, processed: 0, failed: 0, message: 'Acción inválida' };
  }

  // No permitir accionar sobre uno mismo (safety)
  const targets = ids.filter((id) => id !== founderId);
  if (targets.length === 0) {
    return { ok: false, processed: 0, failed: 0, message: 'No podés operar sobre tu propia cuenta' };
  }

  const svc = getServiceClient();

  if (action === 'delete') {
    let processed = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const id of targets) {
      try {
        // 1) Borrar los tenants owneados por este user PRIMERO. El FK
        //    tenants.owner_user_id → profiles.id no tiene ON DELETE CASCADE,
        //    así que si el user es owner de algún sitio, borrar el profile
        //    falla con FK violation. Borrar los tenants primero cascadea
        //    todo su contenido (cursos, ventas, memberships, etc).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: tenantsErr } = await (svc.from('tenants') as any)
          .delete().eq('owner_user_id', id);
        if (tenantsErr) throw new Error(`tenants: ${tenantsErr.message}`);

        // 2) Ahora sí borramos auth.users — el profile cascadea por el FK
        //    profiles.id → auth.users.id (con ON DELETE CASCADE en Supabase).
        const { error: authErr } = await svc.auth.admin.deleteUser(id);
        if (authErr) {
          // Este error genérico ("Database error deleting user") suele venir
          // de FKs a profiles.id que no tienen ON DELETE CASCADE / SET NULL.
          // Fix: correr migration 0088_fix_user_delete_cascades.sql
          const hint = /database error deleting/i.test(authErr.message)
            ? ' — falta correr migration 0088_fix_user_delete_cascades.sql en Supabase'
            : '';
          throw new Error(`auth: ${authErr.message}${hint}`);
        }

        processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[bulkUpdateUsers] delete failed for', id, msg);
        failures.push({ id, reason: msg });
      }
    }

    revalidatePath('/founder/users');
    return {
      ok: processed > 0,
      processed,
      failed: failures.length,
      failures: failures.length > 0 ? failures.slice(0, 5) : undefined,
      message: failures.length > 0
        ? `${processed} eliminados · ${failures.length} fallaron`
        : `${processed} eliminados`
    };
  }

  const status = action === 'activate' ? 'active'
    : action === 'under_review' ? 'under_review'
    : 'suspended';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('profiles') as any)
    .update({ moderation_status: status, updated_at: new Date().toISOString() })
    .in('id', targets);
  if (error) {
    if (/moderation_status/.test(error.message ?? '')) {
      return { ok: false, processed: 0, failed: targets.length,
        message: 'Migration 0086 pendiente — recargá el schema cache de PostgREST' };
    }
    return { ok: false, processed: 0, failed: targets.length, message: error.message };
  }

  revalidatePath('/founder/users');
  return { ok: true, processed: targets.length, failed: 0,
    message: `${targets.length} actualizados a ${status}` };
}

export async function bulkUpdateTenantsAction(formData: FormData): Promise<BulkResult> {
  await requireFounder();
  const action = String(formData.get('action') ?? '') as TenantBulkAction;
  const idsRaw = String(formData.get('ids') ?? '');
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return { ok: false, processed: 0, failed: 0, message: 'Sin IDs' };
  }
  if (!['activate', 'under_review', 'suspend', 'delete'].includes(action)) {
    return { ok: false, processed: 0, failed: 0, message: 'Acción inválida' };
  }

  const svc = getServiceClient();

  if (action === 'delete') {
    // FK cascade se encarga de cursos, ventas, forms, etc.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tenants') as any).delete().in('id', ids);
    if (error) {
      console.error('[bulkUpdateTenants] delete failed', error);
      return { ok: false, processed: 0, failed: ids.length, message: error.message };
    }
    revalidatePath('/founder/tenants');
    return { ok: true, processed: ids.length, failed: 0,
      message: `${ids.length} sitio${ids.length === 1 ? '' : 's'} eliminado${ids.length === 1 ? '' : 's'}` };
  }

  const status = action === 'activate' ? 'active'
    : action === 'under_review' ? 'under_review'
    : 'suspended';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('tenants') as any)
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) {
    return { ok: false, processed: 0, failed: ids.length, message: error.message };
  }

  revalidatePath('/founder/tenants');
  return { ok: true, processed: ids.length, failed: 0,
    message: `${ids.length} actualizado${ids.length === 1 ? '' : 's'} a ${status}` };
}
