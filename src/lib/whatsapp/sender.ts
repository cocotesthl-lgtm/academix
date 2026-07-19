/**
 * Wrapper unificado de envío que ramifica por provider ('cloud_api'
 * de Meta o 'qr' vía Evolution API). Los callers (webhook handler,
 * bot-actions) no necesitan saber cuál está usando el tenant.
 *
 * La config viene ya desencriptada — el caller se encarga de
 * decryptSecret() sobre access_token / evolution_api_key.
 */

import { sendText as metaSendText, sendMedia as metaSendMedia } from './meta-api';
import { evolutionSendText, evolutionSendMedia } from './evolution-api';

export type UnifiedConfig = {
  provider: 'cloud_api' | 'qr';
  // Cloud API
  phone_number_id?: string | null;
  access_token?: string | null;         // ya desencriptado
  // Evolution API
  evolution_url?: string | null;
  evolution_instance?: string | null;
  evolution_api_key?: string | null;    // ya desencriptado
};

export type SendResult = { ok: boolean; wa_message_id?: string; error?: string };

export async function unifiedSendText(cfg: UnifiedConfig, to: string, body: string): Promise<SendResult> {
  if (cfg.provider === 'qr') {
    if (!cfg.evolution_url || !cfg.evolution_instance || !cfg.evolution_api_key) {
      return { ok: false, error: 'Evolution API no está configurado (falta URL/instance/api_key)' };
    }
    return evolutionSendText(
      { url: cfg.evolution_url, apiKey: cfg.evolution_api_key, instance: cfg.evolution_instance },
      to, body
    );
  }
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
  if (cfg.provider === 'qr') {
    if (!cfg.evolution_url || !cfg.evolution_instance || !cfg.evolution_api_key) {
      return { ok: false, error: 'Evolution API no está configurado' };
    }
    return evolutionSendMedia(
      { url: cfg.evolution_url, apiKey: cfg.evolution_api_key, instance: cfg.evolution_instance },
      to, mediaType, mediaUrl, caption, filename
    );
  }
  if (!cfg.phone_number_id || !cfg.access_token) {
    return { ok: false, error: 'Cloud API no está configurado' };
  }
  return metaSendMedia({
    phoneNumberId: cfg.phone_number_id,
    accessToken: cfg.access_token,
    to, mediaType, mediaUrl, caption, filename
  });
}
