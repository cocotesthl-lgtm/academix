/**
 * Wrapper de envío vía Meta Cloud API. La config viene ya desencriptada
 * — el caller se encarga de decryptSecret() sobre access_token.
 */

import { sendText as metaSendText, sendMedia as metaSendMedia } from './meta-api';

export type UnifiedConfig = {
  phone_number_id?: string | null;
  access_token?: string | null;
};

export type SendResult = { ok: boolean; wa_message_id?: string; error?: string };

export async function unifiedSendText(cfg: UnifiedConfig, to: string, body: string): Promise<SendResult> {
  if (!cfg.phone_number_id || !cfg.access_token) {
    return { ok: false, error: 'Cloud API no está configurado' };
  }
  return metaSendText({
    phoneNumberId: cfg.phone_number_id,
    accessToken: cfg.access_token,
    to, body
  });
}

export async function unifiedSendMedia(
  cfg: UnifiedConfig,
  to: string,
  mediaType: 'image' | 'document' | 'audio' | 'video',
  mediaUrl: string,
  caption?: string,
  filename?: string
): Promise<SendResult> {
  if (!cfg.phone_number_id || !cfg.access_token) {
    return { ok: false, error: 'Cloud API no está configurado' };
  }
  return metaSendMedia({
    phoneNumberId: cfg.phone_number_id,
    accessToken: cfg.access_token,
    to, mediaType, mediaUrl, caption, filename
  });
}
