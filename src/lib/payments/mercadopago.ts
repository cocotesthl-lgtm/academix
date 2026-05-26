import 'server-only';

const MP_API = 'https://api.mercadopago.com';
const MP_AUTH = 'https://auth.mercadopago.com.ar/authorization';
const MP_OAUTH_TOKEN = `${MP_API}/oauth/token`;

function clientId() {
  const v = process.env.MERCADOPAGO_CLIENT_ID;
  if (!v) throw new Error('MERCADOPAGO_CLIENT_ID not set');
  return v;
}
function clientSecret() {
  const v = process.env.MERCADOPAGO_CLIENT_SECRET;
  if (!v) throw new Error('MERCADOPAGO_CLIENT_SECRET not set');
  return v;
}
function redirectUri() {
  return process.env.MERCADOPAGO_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/oauth/mercadopago/callback`;
}

export function getAuthUrl(state: string): string {
  const u = new URL(MP_AUTH);
  u.searchParams.set('client_id', clientId());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('platform_id', 'mp');
  u.searchParams.set('state', state);
  u.searchParams.set('redirect_uri', redirectUri());
  return u.toString();
}

export type MpTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
  live_mode: boolean;
};

export async function exchangeCode(code: string): Promise<MpTokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri()
  });
  const res = await fetch(MP_OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MP exchangeCode failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<MpTokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  const res = await fetch(MP_OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`MP refresh failed: ${res.status}`);
  return res.json();
}

export type CreatePreferenceInput = {
  accessToken: string;
  title: string;
  unitPriceCents: number;
  currency: string;
  quantity?: number;
  buyerEmail?: string;
  externalReference: string; // courseId|buyerUserId|refCode (we encode this)
  notificationUrl: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  metadata?: Record<string, unknown>;
};

export type Preference = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
};

export async function createPreference(input: CreatePreferenceInput): Promise<Preference> {
  const body = {
    items: [
      {
        title: input.title,
        quantity: input.quantity ?? 1,
        unit_price: input.unitPriceCents / 100,
        currency_id: input.currency
      }
    ],
    payer: input.buyerEmail ? { email: input.buyerEmail } : undefined,
    back_urls: {
      success: input.successUrl,
      failure: input.failureUrl,
      pending: input.pendingUrl
    },
    auto_return: 'approved',
    external_reference: input.externalReference,
    notification_url: input.notificationUrl,
    metadata: input.metadata ?? {}
  };
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MP createPreference failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export type Payment = {
  id: number;
  status: string;                  // approved | pending | rejected | refunded | ...
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  external_reference: string | null;
  metadata: Record<string, unknown>;
  payer: { email?: string } | null;
  date_approved: string | null;
  date_created: string;
};

export async function getPayment(paymentId: string | number, accessToken: string): Promise<Payment> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`MP getPayment ${paymentId} failed: ${res.status}`);
  return res.json();
}
