'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { sendTemplate, listApprovedTemplates } from '@/lib/whatsapp/meta-api';
import { unifiedSendText, unifiedSendMedia, type UnifiedConfig } from '@/lib/whatsapp/sender';
import { createInstance, fetchQr, fetchConnectionState, logoutInstance } from '@/lib/whatsapp/evolution-api';
import { encryptSecret, decryptSecret } from '@/lib/crypto/secrets';
import { headers } from 'next/headers';

// ── Config ─────────────────────────────────────────────────────────

export async function connectWhatsAppBotAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const phone_number_id = String(formData.get('phone_number_id') ?? '').trim();
  const business_account_id = String(formData.get('business_account_id') ?? '').trim() || null;
  const access_token = String(formData.get('access_token') ?? '').trim();
  const display_phone = String(formData.get('display_phone') ?? '').trim() || null;
  const webhook_signature_secret = String(formData.get('webhook_signature_secret') ?? '').trim() || null;

  if (!phone_number_id || !access_token) {
    throw new Error('phone_number_id y access_token son requeridos');
  }

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('whatsapp_config') as any)
    .select('verify_token').eq('tenant_id', tenant.id).limit(1).maybeSingle();

  const verify_token = existing?.verify_token || randomBytes(24).toString('hex');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_config') as any).upsert({
    tenant_id: tenant.id,
    phone_number_id,
    business_account_id,
    // Encriptamos con AES-256-GCM antes de persistir. La clave viene de
    // SECRETS_ENCRYPTION_KEY (ver lib/crypto/secrets.ts). Reads posteriores
    // pasan por decryptSecret().
    access_token: encryptSecret(access_token),
    display_phone,
    webhook_signature_secret,
    verify_token,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'tenant_id' });

  revalidatePath('/owner/whatsapp');
  revalidatePath('/owner/whatsapp/config');
}

export async function updateBotSettingsAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const bot_enabled = formData.get('bot_enabled') === 'on';
  const greeting_enabled = formData.get('greeting_enabled') === 'on';
  const greeting_body = String(formData.get('greeting_body') ?? '').trim().slice(0, 1000);
  const away_enabled = formData.get('away_enabled') === 'on';
  const away_body = String(formData.get('away_body') ?? '').trim().slice(0, 1000);
  const away_start = String(formData.get('away_start') ?? '').trim() || null;
  const away_end = String(formData.get('away_end') ?? '').trim() || null;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_config') as any).update({
    bot_enabled, greeting_enabled, greeting_body,
    away_enabled, away_body, away_start, away_end,
    updated_at: new Date().toISOString()
  }).eq('tenant_id', tenant.id);

  revalidatePath('/owner/whatsapp');
}

export async function disconnectWhatsAppBotAction(): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_config') as any).delete().eq('tenant_id', tenant.id);
  revalidatePath('/owner/whatsapp');
}

// ── Bot rules ─────────────────────────────────────────────────────

export async function saveBotRuleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '').trim() || null;
  const name = String(formData.get('name') ?? '').trim().slice(0, 100);
  const trigger_type = (String(formData.get('trigger_type') ?? 'keyword') as 'keyword' | 'welcome' | 'fallback');
  const keywordsRaw = String(formData.get('keywords') ?? '').trim();
  const keywords = keywordsRaw
    ? keywordsRaw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 30)
    : [];
  const match_mode = (String(formData.get('match_mode') ?? 'contains') as 'contains' | 'exact' | 'starts_with');
  const reply_body = String(formData.get('reply_body') ?? '').trim().slice(0, 4000);
  const active = formData.get('active') !== 'off';
  const position = Number(formData.get('position') ?? 0) || 0;

  if (!name || !reply_body) throw new Error('Nombre y respuesta requeridos');
  if (trigger_type === 'keyword' && keywords.length === 0) {
    throw new Error('Agregá al menos una keyword');
  }

  const svc = getServiceClient();
  const payload = {
    tenant_id: tenant.id, name, trigger_type, keywords, match_mode,
    reply_body, active, position, updated_at: new Date().toISOString()
  };
  if (id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('whatsapp_bot_rules') as any).update(payload).eq('id', id).eq('tenant_id', tenant.id);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('whatsapp_bot_rules') as any).insert(payload);
  }
  revalidatePath('/owner/whatsapp/bot');
}

export async function deleteBotRuleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_bot_rules') as any).delete()
    .eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/whatsapp/bot');
}

// ── Inbox: enviar respuesta manual + toggle pause ─────────────────

// Helper: mapea un row de whatsapp_config a UnifiedConfig, desencriptando
// los tokens sensibles. Usado por todos los caminos de envío.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUnified(cfg: any): UnifiedConfig {
  return {
    provider: (cfg.provider as 'cloud_api' | 'qr') || 'cloud_api',
    phone_number_id: cfg.phone_number_id ?? null,
    access_token: cfg.access_token ? decryptSecret(cfg.access_token) : null,
    evolution_url: cfg.evolution_url ?? null,
    evolution_instance: cfg.evolution_instance ?? null,
    evolution_api_key: cfg.evolution_api_key ? decryptSecret(cfg.evolution_api_key) : null
  };
}

function ensureReady(cfg: { provider?: string; phone_number_id?: string | null; evolution_url?: string | null; evolution_instance?: string | null } | null): void {
  if (!cfg) throw new Error('WhatsApp no está conectado');
  if (cfg.provider === 'qr') {
    if (!cfg.evolution_url || !cfg.evolution_instance) throw new Error('QR: Evolution API no configurado');
  } else if (!cfg.phone_number_id) {
    throw new Error('Cloud API: número no configurado');
  }
}

const WA_CFG_FULL_COLS =
  'provider, phone_number_id, access_token, evolution_url, evolution_instance, evolution_api_key';

export async function sendManualReplyAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const conversationId = String(formData.get('conversation_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!conversationId || !body) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (svc.from('whatsapp_conversations') as any)
    .select('id, wa_customer_id, tenant_id').eq('id', conversationId).limit(1).maybeSingle();
  if (!conv || conv.tenant_id !== tenant.id) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfg } = await (svc.from('whatsapp_config') as any)
    .select(WA_CFG_FULL_COLS).eq('tenant_id', tenant.id).limit(1).maybeSingle();
  ensureReady(cfg);

  const unified = toUnified(cfg);
  const res = await unifiedSendText(unified, conv.wa_customer_id, body);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_messages') as any).insert({
    tenant_id: tenant.id,
    conversation_id: conv.id,
    wa_message_id: res.wa_message_id || null,
    direction: 'out',
    from_bot: false,
    msg_type: 'text',
    body,
    status: res.ok ? 'sent' : 'failed',
    error_message: res.ok ? null : res.error
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_conversations') as any).update({
    last_message_at: new Date().toISOString(),
    last_message_body: body.slice(0, 200),
    last_message_from_bot: false,
    // Cuando el humano responde, el bot queda pausado en esta conversación
    // para no pisar la respuesta manual con auto-replies.
    bot_paused: true,
    unread_count: 0,
    updated_at: new Date().toISOString()
  }).eq('id', conv.id);

  revalidatePath('/owner/whatsapp');
  revalidatePath(`/owner/whatsapp/${conversationId}`);
}

export async function toggleBotPausedAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const conversationId = String(formData.get('conversation_id') ?? '');
  const paused = formData.get('paused') === 'on';
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_conversations') as any)
    .update({ bot_paused: paused })
    .eq('id', conversationId).eq('tenant_id', tenant.id);
  revalidatePath('/owner/whatsapp');
  revalidatePath(`/owner/whatsapp/${conversationId}`);
}

export async function markConversationReadAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const conversationId = String(formData.get('conversation_id') ?? '');
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_conversations') as any)
    .update({ unread_count: 0 })
    .eq('id', conversationId).eq('tenant_id', tenant.id);
  revalidatePath('/owner/whatsapp');
}

// ── Media (imágenes / PDFs) ────────────────────────────────────────

export async function sendMediaReplyAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const conversationId = String(formData.get('conversation_id') ?? '');
  const file = formData.get('file') as File | null;
  const caption = String(formData.get('caption') ?? '').trim();
  if (!conversationId || !file || file.size === 0) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (svc.from('whatsapp_conversations') as any)
    .select('id, wa_customer_id, tenant_id').eq('id', conversationId).limit(1).maybeSingle();
  if (!conv || conv.tenant_id !== tenant.id) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfg } = await (svc.from('whatsapp_config') as any)
    .select(WA_CFG_FULL_COLS).eq('tenant_id', tenant.id).limit(1).maybeSingle();
  ensureReady(cfg);

  // Upload al bucket público whatsapp-media (path: {tenantId}/{yyyy-mm}/{ts}_{name})
  const now = new Date();
  const monthPart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const cleanName = file.name.replace(/[^\w.-]/g, '_').slice(0, 80);
  const path = `${tenant.id}/${monthPart}/${Date.now()}_${cleanName}`;
  const buf = Buffer.from(await file.arrayBuffer());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upErr } = await (svc.storage.from('whatsapp-media') as any)
    .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (upErr) throw new Error('Upload falló: ' + upErr.message);
  const { data: pub } = svc.storage.from('whatsapp-media').getPublicUrl(path);
  const mediaUrl = pub?.publicUrl as string | undefined;
  if (!mediaUrl) throw new Error('No se pudo obtener URL pública del archivo');

  // Inferir mediaType desde MIME
  const mime = file.type || '';
  const mediaType: 'image' | 'document' | 'audio' | 'video' =
    mime.startsWith('image/') ? 'image' :
    mime.startsWith('audio/') ? 'audio' :
    mime.startsWith('video/') ? 'video' :
    'document';

  const res = await unifiedSendMedia(
    toUnified(cfg),
    conv.wa_customer_id,
    mediaType,
    mediaUrl,
    caption || undefined,
    mediaType === 'document' ? file.name : undefined
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_messages') as any).insert({
    tenant_id: tenant.id,
    conversation_id: conv.id,
    wa_message_id: res.wa_message_id || null,
    direction: 'out',
    from_bot: false,
    msg_type: mediaType,
    body: caption || null,
    media_url: mediaUrl,
    status: res.ok ? 'sent' : 'failed',
    error_message: res.ok ? null : res.error
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_conversations') as any).update({
    last_message_at: new Date().toISOString(),
    last_message_body: caption || `[${mediaType}]`,
    last_message_from_bot: false,
    bot_paused: true,
    unread_count: 0,
    updated_at: new Date().toISOString()
  }).eq('id', conv.id);

  revalidatePath('/owner/whatsapp');
  revalidatePath(`/owner/whatsapp/${conversationId}`);
}

// ── Templates ──────────────────────────────────────────────────────

/**
 * Trae los templates aprobados de la Business Account del tenant y los
 * cachea en la tabla local whatsapp_templates. Se corre a demanda desde
 * la UI (botón "Sincronizar con Meta").
 */
export async function syncTemplatesAction(): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfg } = await (svc.from('whatsapp_config') as any)
    .select('business_account_id, access_token').eq('tenant_id', tenant.id).limit(1).maybeSingle();
  if (!cfg?.business_account_id || !cfg?.access_token) {
    throw new Error('Falta business_account_id o access_token — completá la configuración primero');
  }
  const remotes = await listApprovedTemplates(cfg.business_account_id, decryptSecret(cfg.access_token));
  const nowIso = new Date().toISOString();
  for (const t of remotes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('whatsapp_templates') as any).upsert({
      tenant_id: tenant.id,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      body: t.body,
      params_count: t.params_count,
      synced_at: nowIso
    }, { onConflict: 'tenant_id,name,language' });
  }
  revalidatePath('/owner/whatsapp/templates');
}

export async function sendTemplateAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const conversationId = String(formData.get('conversation_id') ?? '');
  const templateName = String(formData.get('template_name') ?? '');
  const language = String(formData.get('language') ?? '');
  const paramsRaw = String(formData.get('body_params') ?? '');
  const bodyParams = paramsRaw ? paramsRaw.split('|').map((s) => s.trim()) : [];
  if (!conversationId || !templateName || !language) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (svc.from('whatsapp_conversations') as any)
    .select('id, wa_customer_id, tenant_id').eq('id', conversationId).limit(1).maybeSingle();
  if (!conv || conv.tenant_id !== tenant.id) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfg } = await (svc.from('whatsapp_config') as any)
    .select('phone_number_id, access_token').eq('tenant_id', tenant.id).limit(1).maybeSingle();
  if (!cfg?.phone_number_id || !cfg?.access_token) throw new Error('WhatsApp no está conectado');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tpl } = await (svc.from('whatsapp_templates') as any)
    .select('body').eq('tenant_id', tenant.id).eq('name', templateName).eq('language', language)
    .limit(1).maybeSingle();
  // Renderizar body para guardar el texto que efectivamente le llega al cliente
  let rendered = tpl?.body || '';
  bodyParams.forEach((v, i) => { rendered = rendered.replaceAll(`{{${i + 1}}}`, v); });

  const res = await sendTemplate({
    phoneNumberId: cfg.phone_number_id,
    accessToken: decryptSecret(cfg.access_token),
    to: conv.wa_customer_id,
    templateName,
    languageCode: language,
    bodyParams
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_messages') as any).insert({
    tenant_id: tenant.id,
    conversation_id: conv.id,
    wa_message_id: res.wa_message_id || null,
    direction: 'out',
    from_bot: false,
    msg_type: 'text',
    body: rendered || `[template ${templateName}]`,
    status: res.ok ? 'sent' : 'failed',
    error_message: res.ok ? null : res.error
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_conversations') as any).update({
    last_message_at: new Date().toISOString(),
    last_message_body: (rendered || `template ${templateName}`).slice(0, 200),
    last_message_from_bot: false,
    bot_paused: true,
    unread_count: 0,
    updated_at: new Date().toISOString()
  }).eq('id', conv.id);
  // Bump last_used_at para ordenar en la UI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_templates') as any).update({ last_used_at: new Date().toISOString() })
    .eq('tenant_id', tenant.id).eq('name', templateName).eq('language', language);

  revalidatePath('/owner/whatsapp');
  revalidatePath(`/owner/whatsapp/${conversationId}`);
}

// ── IA config ──────────────────────────────────────────────────────

// ── Tags por conversación ──────────────────────────────────────────

export async function addConversationTagAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const conversationId = String(formData.get('conversation_id') ?? '');
  const tag = String(formData.get('tag') ?? '').trim().toLowerCase().slice(0, 40);
  if (!conversationId || !tag) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (svc.from('whatsapp_conversations') as any)
    .select('tags').eq('id', conversationId).eq('tenant_id', tenant.id).limit(1).maybeSingle();
  if (!conv) return;
  const current = Array.isArray(conv.tags) ? conv.tags : [];
  if (current.includes(tag)) return; // dedup
  const next = [...current, tag].slice(0, 20);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_conversations') as any).update({ tags: next })
    .eq('id', conversationId).eq('tenant_id', tenant.id);
  revalidatePath('/owner/whatsapp');
  revalidatePath(`/owner/whatsapp/${conversationId}`);
}

export async function removeConversationTagAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const conversationId = String(formData.get('conversation_id') ?? '');
  const tag = String(formData.get('tag') ?? '').trim().toLowerCase();
  if (!conversationId || !tag) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (svc.from('whatsapp_conversations') as any)
    .select('tags').eq('id', conversationId).eq('tenant_id', tenant.id).limit(1).maybeSingle();
  if (!conv) return;
  const next = (Array.isArray(conv.tags) ? conv.tags : []).filter((t: string) => t !== tag);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_conversations') as any).update({ tags: next })
    .eq('id', conversationId).eq('tenant_id', tenant.id);
  revalidatePath('/owner/whatsapp');
  revalidatePath(`/owner/whatsapp/${conversationId}`);
}

export async function toggleConversationStatusAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const conversationId = String(formData.get('conversation_id') ?? '');
  const status = String(formData.get('status') ?? 'open');
  const valid = ['open', 'closed', 'archived'].includes(status) ? status : 'open';
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_conversations') as any).update({ status: valid })
    .eq('id', conversationId).eq('tenant_id', tenant.id);
  revalidatePath('/owner/whatsapp');
}

// ── QR mode (Evolution API) ─────────────────────────────────────────

/**
 * Conecta el tenant en modo QR con una instancia Evolution API.
 * Recibe URL de la Evolution + api_key global + nombre de instancia
 * (o lo generamos desde el slug del tenant). Crea la instancia
 * remoto vía POST /instance/create con el webhook apuntando a
 * nuestro endpoint /api/whatsapp/evolution-webhook.
 */
export async function connectQrAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const evolution_url = String(formData.get('evolution_url') ?? '').trim().replace(/\/+$/, '');
  const evolution_api_key = String(formData.get('evolution_api_key') ?? '').trim();
  const requestedInstance = String(formData.get('evolution_instance') ?? '').trim();
  const evolution_instance = requestedInstance || `tenant_${tenant.id.replace(/-/g, '').slice(0, 12)}`;

  if (!evolution_url || !evolution_api_key) {
    throw new Error('URL de Evolution API y api key son requeridos');
  }

  // Armar webhook URL para que Evolution nos avise
  const h = await headers();
  const host = h.get('host') || 'bzseguridad.store';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const webhookUrl = `${proto}://${host}/api/whatsapp/evolution-webhook`;

  // Crear la instancia (idempotente: si ya existía Evolution devuelve 409)
  const created = await createInstance(
    { url: evolution_url, apiKey: evolution_api_key, instance: evolution_instance },
    webhookUrl
  );
  if (!created.ok) throw new Error(created.error || 'No se pudo crear la instancia');

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_config') as any).upsert({
    tenant_id: tenant.id,
    provider: 'qr',
    evolution_url,
    evolution_instance,
    evolution_api_key: encryptSecret(evolution_api_key),
    qr_status: 'pending_qr',
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'tenant_id' });

  revalidatePath('/owner/whatsapp/connect');
  revalidatePath('/owner/whatsapp/qr');
}

/**
 * Trae el QR actual (base64) para mostrarlo en la UI. Se llama desde
 * la página /owner/whatsapp/qr con auto-refresh cada N segundos hasta
 * que el estado sea 'open'.
 */
export async function fetchQrDataAction(): Promise<{ qrBase64?: string; state: string }> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfg } = await (svc.from('whatsapp_config') as any)
    .select('provider, evolution_url, evolution_instance, evolution_api_key')
    .eq('tenant_id', tenant.id).limit(1).maybeSingle();
  if (!cfg || cfg.provider !== 'qr' || !cfg.evolution_url || !cfg.evolution_instance) {
    return { state: 'disconnected' };
  }
  const evoOpts = {
    url: cfg.evolution_url,
    apiKey: decryptSecret(cfg.evolution_api_key),
    instance: cfg.evolution_instance
  };
  const state = await fetchConnectionState(evoOpts);
  // Sólo pedimos el QR si aún no está conectado (evita polls inútiles)
  if (state === 'open') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('whatsapp_config') as any)
      .update({ qr_status: 'connected' }).eq('tenant_id', tenant.id);
    return { state: 'open' };
  }
  const qr = await fetchQr(evoOpts);
  return { qrBase64: qr.base64, state: qr.status || state };
}

export async function disconnectQrAction(): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfg } = await (svc.from('whatsapp_config') as any)
    .select('evolution_url, evolution_instance, evolution_api_key')
    .eq('tenant_id', tenant.id).limit(1).maybeSingle();
  if (cfg?.evolution_url && cfg?.evolution_instance) {
    await logoutInstance({
      url: cfg.evolution_url,
      apiKey: decryptSecret(cfg.evolution_api_key),
      instance: cfg.evolution_instance
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_config') as any)
    .update({ qr_status: 'disconnected', connected_at: null })
    .eq('tenant_id', tenant.id);
  revalidatePath('/owner/whatsapp');
}

// ── Broadcasts (envío masivo) ──────────────────────────────────────

/**
 * Crea un broadcast + N jobs (uno por destinatario). Los jobs se
 * marcan con scheduled_at escalonado (throttling suave) para no
 * gatillar el detector de spam de Meta ni de Baileys.
 *
 * Selección de destinatarios: por tags (contains any) o por lista
 * explícita de conversation_ids. Si no se pasa nada, aborta.
 */
export async function createBroadcastAction(formData: FormData): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim().slice(0, 100);
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000);
  const tagsRaw = String(formData.get('tags') ?? '').trim();
  const targetTags = tagsRaw ? tagsRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
  const targetIdsRaw = String(formData.get('conversation_ids') ?? '').trim();
  const targetIds = targetIdsRaw ? targetIdsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const throttleSecs = Math.max(3, Math.min(60, Number(formData.get('throttle_secs') ?? 8)));

  if (!name || !body) throw new Error('Nombre y mensaje requeridos');
  if (targetTags.length === 0 && targetIds.length === 0) {
    throw new Error('Elegí destinatarios: por tag o seleccionando conversaciones');
  }

  const svc = getServiceClient();
  // Resolver destinatarios
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (svc.from('whatsapp_conversations') as any)
    .select('id, wa_customer_id').eq('tenant_id', tenant.id);
  if (targetTags.length > 0) q = q.overlaps('tags', targetTags);
  if (targetIds.length > 0) q = q.in('id', targetIds);
  const { data: convs } = await q;
  const targets = (convs as Array<{ id: string; wa_customer_id: string }> | null) || [];
  if (targets.length === 0) throw new Error('Ningún destinatario matchea el filtro');

  // Crear el broadcast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bcast } = await (svc.from('whatsapp_broadcasts') as any).insert({
    tenant_id: tenant.id,
    name, message_body: body,
    total_recipients: targets.length,
    status: 'sending',
    created_by: userId,
    started_at: new Date().toISOString()
  }).select('id').single();
  if (!bcast) throw new Error('No se pudo crear el broadcast');

  // Crear jobs escalonados con delay
  const now = Date.now();
  const jobs = targets.map((t, i) => ({
    broadcast_id: bcast.id,
    tenant_id: tenant.id,
    conversation_id: t.id,
    wa_customer_id: t.wa_customer_id,
    scheduled_at: new Date(now + i * throttleSecs * 1000).toISOString()
  }));
  // Insert en batches de 100 para evitar payloads gigantes
  for (let i = 0; i < jobs.length; i += 100) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('whatsapp_broadcast_jobs') as any).insert(jobs.slice(i, i + 100));
  }

  revalidatePath('/owner/whatsapp/broadcast');
}

export async function cancelBroadcastAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // Marcar el broadcast como cancelled + los jobs pending como cancelled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_broadcasts') as any)
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenant.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_broadcast_jobs') as any)
    .update({ status: 'failed', error_message: 'Broadcast cancelado' })
    .eq('broadcast_id', id).eq('status', 'pending');
  revalidatePath('/owner/whatsapp/broadcast');
}

// ── Scheduled messages ─────────────────────────────────────────────

export async function scheduleMessageAction(formData: FormData): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const conversationId = String(formData.get('conversation_id') ?? '');
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000);
  const sendAt = String(formData.get('send_at') ?? '');
  if (!conversationId || !body || !sendAt) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (svc.from('whatsapp_conversations') as any)
    .select('id, wa_customer_id, tenant_id').eq('id', conversationId).limit(1).maybeSingle();
  if (!conv || conv.tenant_id !== tenant.id) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_scheduled_messages') as any).insert({
    tenant_id: tenant.id,
    conversation_id: conv.id,
    wa_customer_id: conv.wa_customer_id,
    body,
    send_at: new Date(sendAt).toISOString(),
    created_by: userId
  });
  revalidatePath('/owner/whatsapp/scheduled');
  revalidatePath(`/owner/whatsapp/${conversationId}`);
}

export async function cancelScheduledMessageAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_scheduled_messages') as any)
    .update({ status: 'cancelled' })
    .eq('id', id).eq('tenant_id', tenant.id).eq('status', 'pending');
  revalidatePath('/owner/whatsapp/scheduled');
}

// ── AI ─────────────────────────────────────────────────────────────

export async function updateAiConfigAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const ai_enabled = formData.get('ai_enabled') === 'on';
  const ai_system_prompt = String(formData.get('ai_system_prompt') ?? '').trim().slice(0, 4000) || null;
  const ai_model = String(formData.get('ai_model') ?? '').trim() || 'claude-haiku-4-5-20251001';
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('whatsapp_config') as any).update({
    ai_enabled, ai_system_prompt, ai_model, updated_at: new Date().toISOString()
  }).eq('tenant_id', tenant.id);
  revalidatePath('/owner/whatsapp/config');
}
