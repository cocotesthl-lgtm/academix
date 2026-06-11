import 'server-only';
import { Resend } from 'resend';
import { env } from '@/lib/env';

/**
 * Wrapper provider-agnostic alrededor de Resend. Toda llamada de email pasa
 * por acá — si en el futuro migramos a Brevo/SES, cambia solo este archivo.
 *
 * Defensivo: si RESEND_API_KEY no está seteada (dev, env mal config), no
 * tira excepción — loguea y devuelve { ok: false }. Esto es CRÍTICO porque
 * el envío de email NUNCA debe romper el flujo de compra/webhook.
 */
export type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Headers custom (List-Unsubscribe, etc) */
  headers?: Record<string, string>;
};

export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

let cached: Resend | null = null;
function getClient(): Resend | null {
  if (cached) return cached;
  const key = env.resend.apiKey();
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const client = getClient();
  if (!client) {
    console.warn('[emails] RESEND_API_KEY no seteada — skip envío:', payload.subject);
    return { ok: false, error: 'no_api_key' };
  }
  try {
    const fromName = env.resend.fromName();
    const fromEmail = env.resend.fromEmail();
    const from = `${fromName} <${fromEmail}>`;
    const res = await client.emails.send({
      from,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo,
      headers: payload.headers
    });
    if (res.error) {
      console.error('[emails] Resend error:', res.error);
      return { ok: false, error: res.error.message ?? 'resend_error' };
    }
    return { ok: true, id: res.data?.id ?? '' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[emails] envío falló:', msg);
    return { ok: false, error: msg };
  }
}
