import { getServiceClient } from '@/lib/supabase/service';
import {
  PERMISSION_PRESETS,
  normalizePermissions,
  type Permissions
} from './types';

/**
 * Devuelve los permisos efectivos del user dentro de un tenant.
 *
 * - Si la migration 0046 corrió y la row tiene `permissions`, se usa.
 * - Si `permissions` es null pero hay `role`, se cae al preset del role.
 * - Si no hay membership activo, devuelve null (sin acceso al panel).
 *
 * Defensivo contra pending migration: si la columna no existe,
 * devuelve el preset del role igual.
 */
export async function getUserPermissionsInTenant(
  userId: string,
  tenantId: string
): Promise<Permissions | null> {
  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('memberships') as any)
      .select('role, permissions, status')
      .eq('user_id', userId).eq('tenant_id', tenantId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { role: string; permissions?: unknown; status: string };
    if (row.status !== 'active') return null;

    const stored = normalizePermissions(row.permissions);
    if (stored) return stored;

    // Fallback al preset del role
    if (row.role === 'owner') return PERMISSION_PRESETS.owner;
    if (row.role === 'instructor') return PERMISSION_PRESETS.instructor;
    if (row.role === 'affiliate') return PERMISSION_PRESETS.affiliate;
    // 'student' u otros: sin permisos de panel
    return null;
  } catch {
    return null;
  }
}
