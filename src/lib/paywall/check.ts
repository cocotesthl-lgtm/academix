import { getServiceClient } from '@/lib/supabase/service';

/**
 * True si el user tiene una suscripción activa (status='authorized')
 * en el tenant. También cuenta como "suscripto" si el user es el
 * owner del tenant (para que al testear la home no vea el paywall
 * en su propio sitio).
 *
 * Silencioso ante error: si la tabla no existe (migration pendiente)
 * o la query falla, devuelve false — el paywall se aplica igual.
 */
export async function isUserSubscribedToTenant(
  userId: string | null,
  tenantId: string
): Promise<boolean> {
  if (!userId) return false;
  const svc = getServiceClient();

  // Owner: siempre "adentro"
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (svc.from('tenants') as any)
      .select('owner_user_id').eq('id', tenantId).limit(1).maybeSingle();
    if (t?.owner_user_id === userId) return true;
  } catch { /* fallthrough */ }

  // Suscripción activa
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sub } = await (svc.from('subscriptions') as any)
      .select('id').eq('tenant_id', tenantId).eq('user_id', userId).eq('status', 'authorized')
      .limit(1).maybeSingle();
    return !!sub;
  } catch { return false; }
}
