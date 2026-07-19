import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { sendText, verifyWebhookSignature } from '@/lib/whatsapp/meta-api';
import { resolveReply, isWithinAwayWindow, type BotRule } from '@/lib/whatsapp/bot-engine';
import { decryptSecret } from '@/lib/crypto/secrets';
import { maybeCreateCrmLead } from '@/lib/whatsapp/crm-integration';
import { resolveAiReply } from '@/lib/whatsapp/ai';

/**
 * Webhook único de WhatsApp Cloud API. Meta llama con:
 *   GET  ?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y
 *        → devolver challenge si verify_token matchea el del tenant
 *   POST { entry: [{ changes: [{ value: { messages, contacts, metadata } }] }] }
 *        → guardar en whatsapp_messages + disparar bot si corresponde
 *
 * Multi-tenant: cada tenant tiene su propio phone_number_id. Meta manda
 * el phone_number_id en value.metadata → resolvemos qué tenant es y
 * cargamos su config para responder con las credenciales correctas.
 */

export const runtime = 'nodejs';

// ── GET: handshake de verificación ──────────────────────────────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode !== 'subscribe' || !token || !challenge) {
    return new NextResponse('bad request', { status: 400 });
  }
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('whatsapp_config') as any)
    .select('tenant_id').eq('verify_token', token).limit(1).maybeSingle();
  if (!data) return new NextResponse('forbidden', { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

// ── POST: inbound + status updates ──────────────────────────────────
export async function POST(req: NextRequest) {
  // Leemos el body como texto RAW para poder validar la firma HMAC.
  // Meta manda X-Hub-Signature-256 firmando exactamente estos bytes.
  const raw = await req.text();
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const signature = req.headers.get('x-hub-signature-256');

  const svc = getServiceClient();
  const entries = (payload as { entry?: unknown[] })?.entry || [];

  for (const entry of entries) {
    const changes = ((entry as { changes?: unknown[] })?.changes) || [];
    for (const ch of changes) {
      const value = (ch as { value?: Record<string, unknown> })?.value || {};
      const phoneNumberId = ((value.metadata as { phone_number_id?: string })?.phone_number_id) || '';
      if (!phoneNumberId) continue;

      // Resolver tenant por phone_number_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cfgRow } = await (svc.from('whatsapp_config') as any)
        .select('*').eq('phone_number_id', phoneNumberId).limit(1).maybeSingle();
      if (!cfgRow) continue;

      // Validar firma con el app_secret del tenant (si tiene seteado)
      if (cfgRow.webhook_signature_secret) {
        const valid = await verifyWebhookSignature(raw, signature, cfgRow.webhook_signature_secret);
        if (!valid) continue; // firma inválida — descartamos sin error para no filtrar info
      }

      const tenantId = cfgRow.tenant_id as string;

      // ── Inbound messages ───────────────────────────────────────
      const messages = (value.messages as unknown[]) || [];
      const contacts = (value.contacts as unknown[]) || [];
      const contactName = ((contacts[0] as { profile?: { name?: string } })?.profile?.name) || null;

      for (const msg of messages) {
        const m = msg as {
          id?: string; from?: string; type?: string; timestamp?: string;
          text?: { body?: string };
          image?: { link?: string; caption?: string };
          document?: { link?: string; caption?: string };
        };
        if (!m.id || !m.from) continue;

        // Dedupe por wa_message_id (Meta reintenta si no responde 200)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (svc.from('whatsapp_messages') as any)
          .select('id').eq('wa_message_id', m.id).limit(1).maybeSingle();
        if (existing) continue;

        // Upsert conversación
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: conv } = await (svc.from('whatsapp_conversations') as any)
          .upsert({
            tenant_id: tenantId,
            wa_customer_id: m.from,
            customer_name: contactName,
            last_message_at: new Date().toISOString(),
            last_message_body: (m.text?.body || m.image?.caption || `[${m.type}]`).slice(0, 200),
            last_message_from_bot: false,
            status: 'open',
            updated_at: new Date().toISOString()
          }, { onConflict: 'tenant_id,wa_customer_id' })
          .select('id, bot_paused, unread_count, crm_lead_id, created_at')
          .single();
        if (!conv) continue;

        const isFirstMessage = !conv.unread_count || conv.unread_count === 0;

        // Auto-crear lead en el CRM la PRIMERA vez que llega esta persona.
        // El puente es silencioso ante error para no bloquear el webhook.
        if (!conv.crm_lead_id) {
          await maybeCreateCrmLead(svc, tenantId, {
            id: conv.id,
            wa_customer_id: m.from,
            customer_name: contactName,
            crm_lead_id: conv.crm_lead_id
          });
        }

        const body = m.text?.body || m.image?.caption || m.document?.caption || null;
        const mediaUrl = m.image?.link || m.document?.link || null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('whatsapp_messages') as any).insert({
          tenant_id: tenantId,
          conversation_id: conv.id,
          wa_message_id: m.id,
          direction: 'in',
          msg_type: m.type || 'text',
          body,
          media_url: mediaUrl,
          status: 'delivered'
        });

        // Bump unread
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('whatsapp_conversations') as any)
          .update({ unread_count: (conv.unread_count || 0) + 1 })
          .eq('id', conv.id);

        // ── Bot: sólo si está enabled + conversación no pausada por humano
        if (!cfgRow.bot_enabled || conv.bot_paused) continue;

        // Ventana away: si estamos fuera de horario, respondemos con away_body
        // y no corremos las reglas (para no dar respuestas incoherentes de noche).
        if (cfgRow.away_enabled && isWithinAwayWindow(cfgRow.away_start, cfgRow.away_end)) {
          if (cfgRow.away_body) {
            await sendAndLog(svc, tenantId, conv.id, cfgRow, m.from, cfgRow.away_body, true);
          }
          continue;
        }

        // Primer mensaje de la conversación: mandar greeting antes del bot
        if (isFirstMessage && cfgRow.greeting_enabled && cfgRow.greeting_body) {
          await sendAndLog(svc, tenantId, conv.id, cfgRow, m.from, cfgRow.greeting_body, true);
        }

        // Correr reglas contra el body si hay texto
        if (body) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: rulesRaw } = await (svc.from('whatsapp_bot_rules') as any)
            .select('id, trigger_type, keywords, match_mode, reply_body, active, position')
            .eq('tenant_id', tenantId).eq('active', true)
            .order('position', { ascending: true });
          const rules = (rulesRaw as BotRule[] | null) || [];
          const reply = resolveReply(body, rules, { customerName: contactName });
          if (reply) {
            await sendAndLog(svc, tenantId, conv.id, cfgRow, m.from, reply.body, true);
            // Increment hit_count del rule (fetch current + 1 atómico via SQL
            // sería ideal, pero un select+update alcanza para analytics
            // aproximadas — la concurrencia real es baja).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: cur } = await (svc.from('whatsapp_bot_rules') as any)
              .select('hit_count').eq('id', reply.rule.id).limit(1).maybeSingle();
            const next = (cur?.hit_count ?? 0) + 1;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (svc.from('whatsapp_bot_rules') as any)
              .update({ hit_count: next }).eq('id', reply.rule.id);
          } else if (cfgRow.ai_enabled) {
            // Fallback IA: si no matcheó ninguna regla y el owner activó
            // IA, mandamos el mensaje a Claude con el historial de la
            // conversación como contexto. Silencioso ante error.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: histRaw } = await (svc.from('whatsapp_messages') as any)
              .select('direction, body')
              .eq('conversation_id', conv.id)
              .not('body', 'is', null)
              .order('created_at', { ascending: true })
              .limit(20);
            // El último mensaje (el actual) ya lo insertamos arriba — lo
            // excluimos del historial porque va como turno "user" final.
            const history = ((histRaw as Array<{ direction: string; body: string }> | null) || [])
              .slice(0, -1)
              .map((h) => ({
                role: (h.direction === 'in' ? 'user' : 'assistant') as 'user' | 'assistant',
                content: h.body
              }));
            const aiReply = await resolveAiReply(
              { enabled: true, system_prompt: cfgRow.ai_system_prompt, model: cfgRow.ai_model },
              body,
              history,
              { customerName: contactName }
            );
            if (aiReply) {
              await sendAndLog(svc, tenantId, conv.id, cfgRow, m.from, aiReply, true);
            }
          }
        }
      }

      // ── Status updates (delivered/read/failed) ────────────────
      const statuses = (value.statuses as unknown[]) || [];
      for (const st of statuses) {
        const s = st as { id?: string; status?: string; timestamp?: string; errors?: unknown[] };
        if (!s.id || !s.status) continue;
        const patch: Record<string, string> = { status: s.status };
        if (s.status === 'delivered') patch.delivered_at = new Date().toISOString();
        if (s.status === 'read') patch.read_at = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('whatsapp_messages') as any).update(patch).eq('wa_message_id', s.id);
      }
    }
  }

  // Meta requiere 200 rápido — cualquier otro código dispara reintentos.
  return NextResponse.json({ ok: true });
}

// Helper: envía por API + graba en whatsapp_messages + actualiza conv
async function sendAndLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  tenantId: string,
  conversationId: string,
  cfg: { phone_number_id: string; access_token: string },
  to: string,
  body: string,
  fromBot: boolean
): Promise<void> {
  const res = await sendText({
    phoneNumberId: cfg.phone_number_id,
    accessToken: decryptSecret(cfg.access_token),
    to,
    body
  });
  await svc.from('whatsapp_messages').insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    wa_message_id: res.wa_message_id || null,
    direction: 'out',
    from_bot: fromBot,
    msg_type: 'text',
    body,
    status: res.ok ? 'sent' : 'failed',
    error_message: res.ok ? null : res.error
  });
  await svc.from('whatsapp_conversations').update({
    last_message_at: new Date().toISOString(),
    last_message_body: body.slice(0, 200),
    last_message_from_bot: fromBot,
    updated_at: new Date().toISOString()
  }).eq('id', conversationId);
}
