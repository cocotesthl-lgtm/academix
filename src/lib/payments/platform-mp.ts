import 'server-only';
import crypto from 'crypto';

/**
 * Wrapper de la API de MercadoPago para la cuenta de la plataforma
 * (founder), separada del MP de cada owner.
 *
 * Usa el ACCESS_TOKEN platform-level + webhook secret platform-level.
 * Defensivo: si las env vars no están seteadas, todas las funciones
 * tiran error con mensaje claro (no rompe el build).
 */

const MP_API = 'https://api.mercadopago.com';

function getAccessToken(): string {
  const t = process.env.PLATFORM_MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new Error('PLATFORM_MERCADOPAGO_ACCESS_TOKEN not configured');
  return t;
}

function getWebhookSecret(): string | null {
  return process.env.PLATFORM_MP_WEBHOOK_SECRET ?? null;
}

/**
 * Crea una preapproval (suscripción) en MP.
 * Devuelve init_point (URL para que el owner confirme el pago en MP).
 */
export type CreatePreapprovalOpts = {
  amountCents: number;
  currency: string;          // 'ARS'
  frequency: 'monthly' | 'annual';
  reason: string;            // ej. "OfferNow Plan Medium (mensual)"
  externalReference: string; // tenant_id (para identificarlo después)
  payerEmail: string;
  backUrl: string;           // URL de retorno post-pago
  /** Días de trial gratis. MP captura tarjeta pero no cobra hasta el día N+1. */
  freeTrialDays?: number;
};

export type Preapproval = {
  id: string;
  status: string;            // 'pending' | 'authorized' | 'paused' | 'cancelled'
  init_point: string;
  external_reference?: string;
  auto_recurring?: {
    frequency: number;
    frequency_type: 'days' | 'months';
    transaction_amount: number;
    currency_id: string;
  };
  payer_email?: string;
  date_created?: string;
};

export async function createPreapproval(opts: CreatePreapprovalOpts): Promise<Preapproval> {
  const accessToken = getAccessToken();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoRecurring: any = {
    frequency: opts.frequency === 'annual' ? 12 : 1,
    frequency_type: 'months',
    transaction_amount: opts.amountCents / 100,
    currency_id: opts.currency
  };
  // Free trial: MP capta tarjeta pero no cobra durante N días.
  // Soportamos 1-90 días. El primer cobro real ocurre al día N+1.
  if (opts.freeTrialDays && opts.freeTrialDays > 0) {
    autoRecurring.free_trial = {
      frequency: Math.min(90, Math.max(1, opts.freeTrialDays)),
      frequency_type: 'days'
    };
  }
  const body = {
    reason: opts.reason,
    auto_recurring: autoRecurring,
    back_url: opts.backUrl,
    external_reference: opts.externalReference,
    payer_email: opts.payerEmail,
    status: 'pending'
  };

  const res = await fetch(`${MP_API}/preapproval`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MP preapproval failed: ${res.status} ${text}`);
  }
  return await res.json() as Preapproval;
}

/** Fetch del estado actual de una preapproval. */
export async function getPreapproval(preapprovalId: string): Promise<Preapproval> {
  const accessToken = getAccessToken();
  const res = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MP preapproval fetch failed: ${res.status} ${text}`);
  }
  return await res.json() as Preapproval;
}

/** Cancelar una preapproval (suscripción). */
export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  const accessToken = getAccessToken();
  await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'cancelled' })
  });
}

/** Fetch de un payment individual de MP. */
export type MpPayment = {
  id: number | string;
  status: 'approved' | 'pending' | 'rejected' | 'refunded' | string;
  transaction_amount: number;
  currency_id: string;
  date_approved?: string;
  date_created?: string;
  external_reference?: string;
  metadata?: Record<string, unknown>;
};

export async function getPayment(paymentId: string | number): Promise<MpPayment> {
  const accessToken = getAccessToken();
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`MP payment fetch failed: ${res.status}`);
  return await res.json() as MpPayment;
}

/**
 * Verifica la firma HMAC del webhook de MP (header x-signature).
 * Schema documentado: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 *
 * El template es: id:[data.id];request-id:[x-request-id];ts:[ts];
 * y se firma con el webhook secret. Comparación timing-safe.
 *
 * Si no hay secret configurado, devuelve true (modo permisivo, para
 * testear sin firma).
 */
export function verifyMpWebhookSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = getWebhookSecret();
  if (!secret) return true; // modo permisivo en dev/test
  if (!opts.signatureHeader || !opts.dataId) return false;

  // Parse header: "ts=12345,v1=abc123..."
  const parts = opts.signatureHeader.split(',').map((p) => p.trim());
  const tsPart = parts.find((p) => p.startsWith('ts='))?.slice(3);
  const v1Part = parts.find((p) => p.startsWith('v1='))?.slice(3);
  if (!tsPart || !v1Part) return false;

  const template = `id:${opts.dataId};request-id:${opts.requestId ?? ''};ts:${tsPart};`;
  const computed = crypto.createHmac('sha256', secret).update(template).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(v1Part, 'hex'));
  } catch { return false; }
}
