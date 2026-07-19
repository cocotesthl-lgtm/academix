/**
 * Cliente para Evolution API — wrapper HTTP open-source encima de
 * Baileys que expone WhatsApp Web (modo QR) como REST + webhooks.
 *
 * https://doc.evolution-api.com
 *
 * Cada tenant tiene:
 *   - evolution_url: la URL de la instancia Evolution (que corre
 *     en un VPS del owner o de la plataforma)
 *   - evolution_instance: nombre único de la instancia dentro de
 *     esa Evolution (típicamente = tenant slug)
 *   - evolution_api_key: apikey global de esa Evolution
 *
 * Endpoints usados:
 *   POST /instance/create               → crear instancia (con webhook config)
 *   GET  /instance/connect/{instance}   → QR base64 para escanear
 *   GET  /instance/connectionState/{instance} → estado (open|connecting|close)
 *   DELETE /instance/logout/{instance}  → cerrar sesión
 *   POST /message/sendText/{instance}   → enviar texto
 *   POST /message/sendMedia/{instance}  → enviar media
 */

type EvoOpts = { url: string; apiKey: string; instance: string };

function headers(apiKey: string): HeadersInit {
  return { 'apikey': apiKey, 'Content-Type': 'application/json' };
}

/**
 * Crea la instancia + configura webhook apuntando a nuestro endpoint.
 * Idempotente: si la instancia ya existe Evolution devuelve 409, lo
 * catcheamos y seguimos.
 */
export async function createInstance(
  opts: EvoOpts,
  webhookUrl: string,
  webhookByEvents = false
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${opts.url}/instance/create`, {
      method: 'POST',
      headers: headers(opts.apiKey),
      body: JSON.stringify({
        instanceName: opts.instance,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: webhookUrl,
          byEvents: webhookByEvents,
          base64: false,
          events: [
            'MESSAGES_UPSERT',    // mensajes entrantes
            'MESSAGES_UPDATE',    // status updates
            'CONNECTION_UPDATE'   // conectado / desconectado
          ]
        }
      })
    });
    if (res.ok || res.status === 409 || res.status === 403) return { ok: true };
    const err = await res.text();
    return { ok: false, error: err.slice(0, 300) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Devuelve el QR (base64 data URL). Sólo válido si status ≠ 'open'. */
export async function fetchQr(opts: EvoOpts): Promise<{ base64?: string; status?: string }> {
  try {
    const res = await fetch(`${opts.url}/instance/connect/${opts.instance}`, {
      headers: headers(opts.apiKey)
    });
    if (!res.ok) return {};
    const j = await res.json() as { base64?: string; code?: string; instance?: { state?: string } };
    return { base64: j.base64 || j.code, status: j.instance?.state };
  } catch { return {}; }
}

/** Estado: 'open' (conectado, listo para enviar) | 'connecting' | 'close'. */
export async function fetchConnectionState(opts: EvoOpts): Promise<string> {
  try {
    const res = await fetch(`${opts.url}/instance/connectionState/${opts.instance}`, {
      headers: headers(opts.apiKey)
    });
    if (!res.ok) return 'unknown';
    const j = await res.json() as { instance?: { state?: string } };
    return j.instance?.state || 'unknown';
  } catch { return 'unknown'; }
}

export async function logoutInstance(opts: EvoOpts): Promise<void> {
  try {
    await fetch(`${opts.url}/instance/logout/${opts.instance}`, {
      method: 'DELETE',
      headers: headers(opts.apiKey)
    });
  } catch { /* silent */ }
}

// ── Envíos ─────────────────────────────────────────────────────────

export type EvoSendResult = { ok: boolean; wa_message_id?: string; error?: string };

/**
 * Envía texto plano. Evolution normaliza el destino: acepta "5491123..."
 * o "5491123...@s.whatsapp.net". Nosotros pasamos siempre el número
 * limpio (sin @).
 */
export async function evolutionSendText(
  opts: EvoOpts,
  to: string,
  text: string
): Promise<EvoSendResult> {
  try {
    const res = await fetch(`${opts.url}/message/sendText/${opts.instance}`, {
      method: 'POST',
      headers: headers(opts.apiKey),
      body: JSON.stringify({
        number: to,
        text: text.slice(0, 4000)
      })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (j as { message?: string })?.message || `HTTP ${res.status}` };
    const id = ((j as { key?: { id?: string } }).key?.id) as string | undefined;
    return { ok: true, wa_message_id: id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Envía media por URL pública (Evolution también acepta base64, pero
 * usamos URL para reutilizar el mismo bucket whatsapp-media).
 */
export async function evolutionSendMedia(
  opts: EvoOpts,
  to: string,
  mediaType: 'image' | 'document' | 'audio' | 'video',
  mediaUrl: string,
  caption?: string,
  filename?: string
): Promise<EvoSendResult> {
  try {
    // Evolution v2 tiene endpoints separados sendMedia y sendWhatsAppAudio.
    // Para audio usamos el endpoint especializado; el resto va por sendMedia.
    if (mediaType === 'audio') {
      const res = await fetch(`${opts.url}/message/sendWhatsAppAudio/${opts.instance}`, {
        method: 'POST',
        headers: headers(opts.apiKey),
        body: JSON.stringify({ number: to, audio: mediaUrl })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: (j as { message?: string })?.message || `HTTP ${res.status}` };
      return { ok: true, wa_message_id: (j as { key?: { id?: string } }).key?.id };
    }

    const res = await fetch(`${opts.url}/message/sendMedia/${opts.instance}`, {
      method: 'POST',
      headers: headers(opts.apiKey),
      body: JSON.stringify({
        number: to,
        mediatype: mediaType,     // image | document | video
        media: mediaUrl,
        caption: caption || undefined,
        fileName: filename || undefined
      })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (j as { message?: string })?.message || `HTTP ${res.status}` };
    return { ok: true, wa_message_id: (j as { key?: { id?: string } }).key?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
