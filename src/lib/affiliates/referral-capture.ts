import 'server-only';
import { cookies } from 'next/headers';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Sistema de referrer platform-wide para el árbol multinivel L1/L2/L3.
 *
 * Cuando alguien visita una URL con ?ref=X, `trackClickForRef` setea DOS
 * cookies:
 *   - `cp_aff_{tenantId}` — payload firmado con l1/l2/l3/courseId/linkId
 *     que se usa en checkout para atribuir la venta.
 *   - `cp_platform_ref` (esta) — sólo el user_id del afiliado L1, con
 *     scope al apex del root domain para que sobreviva cross-subdomain.
 *     Se lee al signup para setear profiles.referred_by_user_id — ese
 *     campo es lo que el motor de comisiones camina para resolver L2/L3.
 *
 * Sin esta cookie el multinivel nunca acredita niveles superiores: el
 * motor lee referred_by_user_id, pero antes de este archivo nadie lo
 * escribía → todos los profiles tenían null → L2 y L3 nunca cobraban.
 */

const COOKIE_NAME = 'cp_platform_ref';
const TTL_DAYS = 30;
const MAX_AGE_S = TTL_DAYS * 24 * 60 * 60;

/**
 * Setea la cookie platform-wide con el user_id del afiliado que trajo
 * al visitor. Se llama desde trackClickForRef (donde ya se resuelve el
 * link → l1).
 *
 * Domain=".{rootDomain}" para que se comparta entre subdominios (marketing,
 * app, tenants). En dev sin dominio, cae al default (host actual).
 */
export async function setPlatformRefCookie(l1UserId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(l1UserId)) return;
  try {
    const cookieStore = await cookies();
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    const isProd = process.env.NODE_ENV === 'production';
    cookieStore.set(COOKIE_NAME, l1UserId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: MAX_AGE_S,
      path: '/',
      // Sólo en prod scope cross-subdomain (dev usa localhost sin dominio)
      ...(isProd && rootDomain ? { domain: `.${rootDomain}` } : {})
    });
  } catch { /* RSC context puede bloquear set(); silencio */ }
}

/**
 * Se llama después de un signup exitoso (session confirmada). Lee la
 * cookie platform ref y persiste el referrer al profile — SOLO si el
 * user no tiene ya un referrer (idempotente) y anti-fraud básico.
 *
 * Silent: no throw, no lock — el bug del multinivel es mejor comerlo que
 * romper un signup.
 */
export async function capturePendingReferral(newUserId: string): Promise<void> {
  if (!newUserId) return;
  try {
    const cookieStore = await cookies();
    const refId = cookieStore.get(COOKIE_NAME)?.value;
    if (!refId) return;
    if (!/^[0-9a-f-]{36}$/i.test(refId)) return;

    // Anti-fraud: no puede referirse a sí mismo
    if (refId === newUserId) {
      cookieStore.delete(COOKIE_NAME);
      return;
    }

    const svc = getServiceClient();

    // Verificar que el referrer existe (evita persistir garbage)
    const { data: refProfile } = await svc
      .from('profiles').select('id').eq('id', refId)
      .maybeSingle<{ id: string }>();
    if (!refProfile) {
      cookieStore.delete(COOKIE_NAME);
      return;
    }

    // Idempotente: sólo escribe si el nuevo user no tiene referrer todavía.
    // Esto también evita re-atribución si el user borra la cookie y hace
    // login/signup con otro link.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (svc.from('profiles') as any)
      .select('referred_by_user_id')
      .eq('id', newUserId).maybeSingle();
    const already = existing?.referred_by_user_id as string | null | undefined;
    if (already) {
      cookieStore.delete(COOKIE_NAME);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('profiles') as any)
      .update({ referred_by_user_id: refId })
      .eq('id', newUserId);

    // Consumida — evita que el mismo user siga escribiendo referrers si
    // pasa por otro link luego. Ya quedó su árbol fijado.
    cookieStore.delete(COOKIE_NAME);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[capturePendingReferral] failed:', e);
  }
}
