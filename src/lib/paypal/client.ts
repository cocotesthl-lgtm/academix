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
