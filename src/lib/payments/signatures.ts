import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify MercadoPago webhook signature.
 *
 * MP sends:
 *   x-signature: ts=<ts>,v1=<hex_hmac>
 *   x-request-id: <uuid>
 *
 * The signed string is: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * HMAC-SHA256(signed_string, webhook_secret) hex should equal v1.
 *
 * docs: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 */
export function verifyMercadoPagoSignature(
  headers: Headers,
  webhookSecret: string,
  dataId: string | number
): boolean {
  const sig = headers.get('x-signature') ?? '';
  const reqId = headers.get('x-request-id') ?? '';
  if (!sig || !reqId) return false;

  const parts = Object.fromEntries(
    sig.split(',').map((p) => {
      const [k, ...rest] = p.split('=');
      return [k.trim(), rest.join('=').trim()];
    })
  ) as { ts?: string; v1?: string };

  if (!parts.ts || !parts.v1) return false;

  const signed = `id:${dataId};request-id:${reqId};ts:${parts.ts};`;
  const expected = createHmac('sha256', webhookSecret).update(signed).digest('hex');

  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(parts.v1, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verify Shopify webhook signature.
 *
 * Shopify sends:
 *   x-shopify-hmac-sha256: <base64_hmac>
 *
 * HMAC-SHA256(raw_body, webhook_secret) base64 should match.
 */
export function verifyShopifySignature(
  headers: Headers,
  webhookSecret: string,
  rawBody: string
): boolean {
  const sig = headers.get('x-shopify-hmac-sha256') ?? '';
  if (!sig) return false;
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('base64');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
