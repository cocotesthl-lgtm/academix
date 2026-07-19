'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { sendText } from '@/lib/whatsapp/meta-api';

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
    access_token,
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
    accessToken: cfg.access_token,
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
