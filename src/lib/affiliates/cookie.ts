import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

export type AffiliatePayload = {
  linkId: string;
  l1: string;
  l2: string | null;
  l3: string | null;
  courseId: string;
  ts: number;
};

const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signAffiliateCookie(payload: AffiliatePayload): string {
  const secret = env.cookies.affiliateSecret();
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, 'utf-8').toString('base64url');
  const mac = sign(body, secret);
  return `${body}.${mac}`;
}

export function verifyAffiliateCookie(value: string): AffiliatePayload | null {
  try {
    const secret = env.cookies.affiliateSecret();
    const [body, mac] = value.split('.');
    if (!body || !mac) return null;
    const expected = sign(body, secret);
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const json = Buffer.from(body, 'base64url').toString('utf-8');
    const payload = JSON.parse(json) as AffiliatePayload;
    if (Date.now() - payload.ts > TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function cookieName(tenantId: string): string {
  return `cp_aff_${tenantId}`;
}

export const COOKIE_MAX_AGE_SECONDS = TTL_DAYS * 24 * 60 * 60;
