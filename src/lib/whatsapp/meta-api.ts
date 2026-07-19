/**
 * Cliente mínimo de WhatsApp Cloud API (Meta Graph API).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Cada tenant tiene su propio phone_number_id + access_token que el
 * owner configura en /owner/whatsapp/config. Este módulo NO conoce
 * multi-tenant — recibe las credenciales por parámetro y hace la
 * llamada HTTP.
 */

const GRAPH_BASE = 'https://graph.facebook.com/v20.0';

export type SendTextOpts = {
  phoneNumberId: string;      // ID del número del bot
  accessToken: string;        // token permanente del sistema
  to: string;                 // E.164 sin + (ej "5491123456789")
  body: string;               // texto (max ~4096 chars)
  previewUrl?: boolean;
};

export type SendResult = {
  ok: boolean;
  wa_message_id?: string;
  error?: string;
};

/**
 * Envía un mensaje de texto usando la Cloud API oficial.
 * Sólo funciona dentro de la ventana de 24hs desde el último inbound;
 * fuera de esa ventana Meta requiere usar un template pre-aprobado.
 */
export async function sendText(opts: SendTextOpts): Promise<SendResult> {
  const url = `${GRAPH_BASE}/${opts.phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.accessToken}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: opts.to,
        type: 'text',
        text: {
          body: opts.body.slice(0, 4000),
          preview_url: !!opts.previewUrl
        }
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json?.error?.message || `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }
    const id = json?.messages?.[0]?.id as string | undefined;
    return { ok: true, wa_message_id: id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Valida la firma HMAC-SHA256 que Meta envía en cada webhook.
 * Header: X-Hub-Signature-256 con formato "sha256=<hex>".
 * El secret es el "App Secret" de la app de Meta (no el access_token).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !appSecret) return false;
  const expected = signatureHeader.replace(/^sha256=/, '').trim();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const actual = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  // Comparación en tiempo constante para evitar timing attacks
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
}
