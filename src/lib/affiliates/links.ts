import 'server-only';
import { randomBytes } from 'node:crypto';
import { getServiceClient } from '@/lib/supabase/service';

/** Código corto (7 chars alphanum lowercase) generado con crypto strong RNG. */
export function generateCode(): string {
  return randomBytes(5).toString('base64url').slice(0, 7).toLowerCase();
}

export type AffiliateLinkResult =
  | { ok: true; code: string; created: boolean }
  | { ok: false; error: string };

/**
 * Devuelve el affiliate link del user para ese curso, creándolo si no existe.
 * Retry con backoff suave en caso de colisión del code.
 * No valida si el user es affiliate del tenant — eso lo hace el caller.
 */
export async function getOrCreateAffiliateLink(opts: {
  tenantId: string;
  courseId: string;
  affiliateUserId: string;
}): Promise<AffiliateLinkResult> {
  const svc = getServiceClient();

  const { data: existing } = await svc
    .from('affiliate_links')
    .select('code')
    .eq('course_id', opts.courseId)
    .eq('affiliate_user_id', opts.affiliateUserId)
    .maybeSingle<{ code: string }>();
  if (existing) return { ok: true, code: existing.code, created: false };

  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('affiliate_links') as any).insert({
      tenant_id: opts.tenantId,
      course_id: opts.courseId,
      affiliate_user_id: opts.affiliateUserId,
      code
    });
    if (!error) return { ok: true, code, created: true };
    if (!error.message.toLowerCase().includes('duplicate')) {
      return { ok: false, error: error.message };
    }
  }
  return { ok: false, error: 'code_collision_after_5_retries' };
}
