import { getServiceClient } from '@/lib/supabase/service';
import { ALL_MODULES_ON, normalizeModules, type Modules } from './types';

/**
 * Devuelve los módulos activos del tenant. Defensivo si la migration
 * 0045 aún no corrió: devuelve todos prendidos (no rompe nada).
 */
export async function getTenantModules(tenantId: string): Promise<Modules> {
  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tenants') as any)
      .select('modules').eq('id', tenantId).maybeSingle();
    if (error || !data) return ALL_MODULES_ON;
    return normalizeModules((data as { modules?: unknown }).modules);
  } catch {
    return ALL_MODULES_ON;
  }
}
