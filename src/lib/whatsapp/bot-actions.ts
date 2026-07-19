'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { sendText, sendMedia, sendTemplate, listApprovedTemplates } from '@/lib/whatsapp/meta-api';
import { encryptSecret, decryptSecret } from '@/lib/crypto/secrets';

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
    .select('phone_number_id, access_token').eq('tenant_id', tenant.id).limit(1).maybeSingle();
  if (!cfg?.phone_number_id || !cfg?.access_token) throw new Error('WhatsApp no está conectado');

  const res = await sendText({
    phoneNumberId: cfg.phone_number_id,
    accessToken: decryptSecret(cfg.access_token),
    to: conv.wa_customer_id,
    body
  });
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
    .select('phone_number_id, access_token').eq('tenant_id', tenant.id).limit(1).maybeSingle();
  if (!cfg?.phone_number_id || !cfg?.access_token) throw new Error('WhatsApp no está conectado');

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

  const res = await sendMedia({
    phoneNumberId: cfg.phone_number_id,
    accessToken: decryptSecret(cfg.access_token),
    to: conv.wa_customer_id,
    mediaType,
    mediaUrl,
    caption: caption || undefined,
    filename: mediaType === 'document' ? file.name : undefined
  });
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
