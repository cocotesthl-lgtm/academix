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

export type SendMediaOpts = {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  mediaType: 'image' | 'document' | 'audio' | 'video';
  mediaUrl: string;           // URL pública accesible por Meta (no data: URIs)
  caption?: string;           // solo para image/video/document
  filename?: string;          // solo para document
};

/**
 * Envía media (imagen/documento/audio/video) por URL. Meta descarga el
 * asset desde la URL provista, así que tiene que ser públicamente
 * accesible. Nuestro upload va a Supabase Storage bucket público.
 *
 * Restricciones típicas: imágenes hasta 5MB, docs hasta 100MB, audio
 * hasta 16MB, video hasta 16MB. Formatos: JPG/PNG (img), PDF/DOC/XLS
 * (doc), AAC/MP3/OGG (audio), MP4/3GP (video).
 */
export async function sendMedia(opts: SendMediaOpts): Promise<SendResult> {
  const url = `${GRAPH_BASE}/${opts.phoneNumberId}/messages`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mediaPayload: Record<string, any> = { link: opts.mediaUrl };
  if (opts.caption && (opts.mediaType === 'image' || opts.mediaType === 'video' || opts.mediaType === 'document')) {
    mediaPayload.caption = opts.caption.slice(0, 1024);
  }
  if (opts.filename && opts.mediaType === 'document') {
    mediaPayload.filename = opts.filename.slice(0, 240);
  }

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
        type: opts.mediaType,
        [opts.mediaType]: mediaPayload
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, wa_message_id: json?.messages?.[0]?.id as string | undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type SendTemplateOpts = {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  languageCode: string;      // "es_AR", "es", "en_US"
  bodyParams?: string[];     // variables {{1}}, {{2}}... en orden
};

/**
 * Envía un mensaje usando un template PRE-APROBADO por Meta. Esta es la
 * única forma de escribir a un cliente FUERA de la ventana de 24hs desde
 * su último mensaje. El template tiene que estar approved (status
 * APPROVED) en la Business Suite antes de usarse.
 */
export async function sendTemplate(opts: SendTemplateOpts): Promise<SendResult> {
  const url = `${GRAPH_BASE}/${opts.phoneNumberId}/messages`;
  const components = opts.bodyParams && opts.bodyParams.length > 0 ? [{
    type: 'body',
    parameters: opts.bodyParams.map((v) => ({ type: 'text', text: String(v).slice(0, 200) }))
  }] : [];

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
        type: 'template',
        template: {
          name: opts.templateName,
          language: { code: opts.languageCode },
          components
        }
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, wa_message_id: json?.messages?.[0]?.id as string | undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Lista los templates aprobados en la Business Account del tenant.
 * Se usa para poblar el selector de templates en la UI del owner.
 */
export async function listApprovedTemplates(
  businessAccountId: string,
  accessToken: string
): Promise<Array<{ name: string; language: string; status: string; category: string; body: string; params_count: number }>> {
  const url = `${GRAPH_BASE}/${businessAccountId}/message_templates?limit=100&fields=name,language,status,category,components`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: Array<{ name: string; language: string; status: string; category: string; components?: Array<{ type?: string; text?: string }> }> };
    return (json.data || [])
      .filter((t) => t.status === 'APPROVED')
      .map((t) => {
        const body = t.components?.find((c) => c.type === 'BODY')?.text || '';
        const params_count = (body.match(/{{(\d+)}}/g) || []).length;
        return {
          name: t.name,
          language: t.language,
          status: t.status,
          category: t.category,
          body,
          params_count
        };
      });
  } catch {
    return [];
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
