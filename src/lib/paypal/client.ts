import 'server-only';

/**
 * Cliente mínimo para PayPal Orders v2 API.
 *
 * Docs: https://developer.paypal.com/api/rest/authentication/
 *       https://developer.paypal.com/docs/api/orders/v2/
 *
 * Cada owner conecta su propia app de PayPal Developer (Client ID +
 * Secret). Nosotros no somos Partner — cada tenant es "self-hosted"
 * en su propia cuenta.
 */

export type PayPalMode = 'live' | 'sandbox';

export function paypalApiBase(mode: PayPalMode): string {
  return mode === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

/**
 * Obtiene un access_token OAuth2 usando client_credentials.
 * PayPal devuelve un JWT válido ~9hs. Lo pedimos on-demand por request;
 * no hace falta cache porque son pocas ventas y evita bugs de invalidación.
 */
export async function getPayPalAccessToken(opts: {
  clientId: string;
  clientSecret: string;
  mode: PayPalMode;
}): Promise<{ ok: true; access_token: string; expires_in: number } | { ok: false; error: string; status: number }> {
  const auth = Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString('base64');
  const resp = await fetch(`${paypalApiBase(opts.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store'
  });
  const text = await resp.text();
  if (!resp.ok) {
    return { ok: false, error: text || resp.statusText, status: resp.status };
  }
  try {
    const json = JSON.parse(text) as { access_token: string; expires_in: number };
    if (!json.access_token) return { ok: false, error: 'no_access_token_in_response', status: 500 };
    return { ok: true, access_token: json.access_token, expires_in: json.expires_in };
  } catch {
    return { ok: false, error: 'invalid_json', status: 500 };
  }
}

/**
 * Valida que las credentials funcionen intentando obtener un access token.
 * Se usa en el connect action antes de persistir — así el owner sabe al
 * instante si pegó mal el Client ID/Secret.
 */
export async function validatePayPalCredentials(opts: {
  clientId: string;
  clientSecret: string;
  mode: PayPalMode;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await getPayPalAccessToken(opts);
  if (r.ok) return { ok: true };
  // Mensaje amigable según el status
  if (r.status === 401) return { ok: false, error: 'Client ID o Secret inválido — revisá que hayas copiado bien del PayPal Developer Dashboard.' };
  if (r.status === 403) return { ok: false, error: 'Tus credentials no tienen permisos para Orders v2. Verificá que la app tenga "Accept Payments" activado.' };
  return { ok: false, error: `PayPal respondió ${r.status}: ${r.error.slice(0, 200)}` };
}

/**
 * Verifica la firma de un webhook usando la API oficial de PayPal.
 *
 * PayPal firma cada webhook con headers PAYPAL-TRANSMISSION-* y los
 * verificás llamando a /v1/notifications/verify-webhook-signature con
 * el webhook_id que el owner configuró en developer.paypal.com.
 *
 * Docs: https://developer.paypal.com/api/rest/webhooks/rest/#link-verifywebhooksignature
 *
 * Devuelve true si PayPal confirma SUCCESS. Cualquier otro caso → false,
 * y el caller decide si loguea + descarta o registra igual.
 */
export async function verifyPayPalWebhookSignature(opts: {
  clientId: string;
  clientSecret: string;
  mode: PayPalMode;
  webhookId: string;
  headers: {
    transmission_id: string;
    transmission_time: string;
    cert_url: string;
    auth_algo: string;
    transmission_sig: string;
  };
  eventBody: unknown;
}): Promise<boolean> {
  const tok = await getPayPalAccessToken({
    clientId: opts.clientId, clientSecret: opts.clientSecret, mode: opts.mode
  });
  if (!tok.ok) return false;

  const resp = await fetch(`${paypalApiBase(opts.mode)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tok.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transmission_id: opts.headers.transmission_id,
      transmission_time: opts.headers.transmission_time,
      cert_url: opts.headers.cert_url,
      auth_algo: opts.headers.auth_algo,
      transmission_sig: opts.headers.transmission_sig,
      webhook_id: opts.webhookId,
      webhook_event: opts.eventBody
    }),
    cache: 'no-store'
  });
  if (!resp.ok) return false;
  try {
    const json = await resp.json() as { verification_status?: string };
    return json.verification_status === 'SUCCESS';
  } catch { return false; }
}
