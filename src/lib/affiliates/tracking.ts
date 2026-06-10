import 'server-only';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { getServiceClient } from '@/lib/supabase/service';
import { signAffiliateCookie, cookieName, COOKIE_MAX_AGE_SECONDS, type AffiliatePayload } from '@/lib/affiliates/cookie';

export type AffiliateLink = {
  id: string;
  tenant_id: string;
  course_id: string;
  affiliate_user_id: string;
};

export async function resolveAffiliateLink(code: string): Promise<AffiliateLink | null> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('affiliate_links')
    .select('id, tenant_id, course_id, affiliate_user_id')
    .eq('code', code)
    .maybeSingle<AffiliateLink>();
  return data;
}

export async function resolveAffiliateLinkById(linkId: string): Promise<AffiliateLink | null> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('affiliate_links')
    .select('id, tenant_id, course_id, affiliate_user_id')
    .eq('id', linkId)
    .maybeSingle<AffiliateLink>();
  return data;
}

/**
 * Walk profiles.referred_by_user_id up to 2 levels to get L2 and L3.
 */
export async function resolveTree(l1UserId: string): Promise<{ l2: string | null; l3: string | null }> {
  const svc = getServiceClient();
  const { data: l1prof } = await svc
    .from('profiles')
    .select('referred_by_user_id')
    .eq('id', l1UserId)
    .maybeSingle<{ referred_by_user_id: string | null }>();
  const l2 = l1prof?.referred_by_user_id ?? null;
  if (!l2) return { l2: null, l3: null };
  const { data: l2prof } = await svc
    .from('profiles')
    .select('referred_by_user_id')
    .eq('id', l2)
    .maybeSingle<{ referred_by_user_id: string | null }>();
  const l3 = l2prof?.referred_by_user_id ?? null;
  return { l2, l3 };
}

function visitorHash(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex');
}

export type TrackResult = { ok: true; payload: AffiliatePayload } | { ok: false; error: string };

/**
 * Track a click + set the signed affiliate cookie. Skips writes silently on:
 *  - missing/invalid code
 *  - self-referral (current logged user IS the affiliate)
 *  - dedupe (same visitor_hash for the same link today)
 */
export async function trackClick(opts: {
  code: string;
  tenantId: string;
  ip: string;
  userAgent: string;
  referer: string;
  currentUserId: string | null;
}): Promise<TrackResult> {
  const link = await resolveAffiliateLink(opts.code);
  if (!link) return { ok: false, error: 'invalid_code' };
  if (link.tenant_id !== opts.tenantId) return { ok: false, error: 'tenant_mismatch' };

  // Anti-fraud: self-referral
  if (opts.currentUserId && opts.currentUserId === link.affiliate_user_id) {
    return { ok: false, error: 'self_referral' };
  }

  const svc = getServiceClient();
  const hash = visitorHash(opts.ip, opts.userAgent);

  // Dedupe click insert (unique on (affiliate_link_id, visitor_hash))
  const clickPayload = {
    affiliate_link_id: link.id,
    tenant_id: link.tenant_id,
    visitor_hash: hash,
    ip: opts.ip,
    user_agent: opts.userAgent.slice(0, 500),
    referer: opts.referer.slice(0, 500)
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('affiliate_clicks') as any).insert(clickPayload);
  // ignore duplicate errors silently

  const { l2, l3 } = await resolveTree(link.affiliate_user_id);

  const payload: AffiliatePayload = {
    linkId: link.id,
    l1: link.affiliate_user_id,
    l2,
    l3,
    courseId: link.course_id,
    ts: Date.now()
  };

  // Next.js 16 a veces bloquea cookies.set() desde Server Components puros
  // (depende de cómo Next interpreta el RSC stream). Lo envolvemos para que
  // un fallo de cookies no rompa la PAGE entera con 500 — peor caso queda
  // sin atribución cross-page pero la venta inmediata con ?ref= en URL
  // igual entra al checkout (que sí puede parsear el ref).
  try {
    const cookieStore = await cookies();
    cookieStore.set(cookieName(link.tenant_id), signAffiliateCookie(payload), {
      httpOnly: false,                 // accessible to client for transparency; HMAC-signed so untamperable
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: '/'
    });
  } catch (e) {
    console.warn('[trackClick] cookies.set failed (RSC context?)', e);
  }

  return { ok: true, payload };
}
