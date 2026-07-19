import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { decryptSecret } from '@/lib/crypto/secrets';
import { unifiedSendText } from '@/lib/whatsapp/sender';
import { resolveReply, isWithinAwayWindow, type BotRule } from '@/lib/whatsapp/bot-engine';
import { resolveAiReply } from '@/lib/whatsapp/ai';
import { maybeCreateCrmLead } from '@/lib/whatsapp/crm-integration';

/**
 * Webhook para Evolution API (modo QR). Formato de payload es distinto
 * al de Meta — Evolution emite eventos discretos:
 *
 *   { event: 'messages.upsert', instance: 'nombre', data: { key: {...}, message: {...}, pushName: '...' } }
 *   { event: 'messages.update', instance: 'nombre', data: { key: {...}, update: { status } } }
 *   { event: 'connection.update', instance: 'nombre', data: { state } }
 *
 * Resolvemos tenant por (evolution_url del origin + instance name).
 *
 * NOTA de seguridad: Evolution NO firma los webhooks con HMAC por
 * default. La única defensa razonable es que la URL del webhook sea
 * secreta (path largo aleatorio) o filtrar por IP del servidor
 * Evolution. Por ahora aceptamos requests y validamos que la
 * combinación instance+url matchee un tenant real — si no, dropeamos.
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let payload: {
    event?: string;
    instance?: string;
    data?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = payload.event || '';
  const instance = payload.instance || '';
  if (!instance) return NextResponse.json({ ok: true });

  const svc = getServiceClient();
  // Resolver tenant por instance (asumimos único a nivel plataforma)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfgRow } = await (svc.from('whatsapp_config') as any)
    .select('*').eq('provider', 'qr').eq('evolution_instance', instance).limit(1).maybeSingle();
  if (!cfgRow) return NextResponse.json({ ok: true });

  const tenantId = cfgRow.tenant_id as string;

  // ── Connection state updates ─────────────────────────────────
  if (event === 'connection.update') {
    const state = ((payload.data as { state?: string })?.state) || 'unknown';
    const qrStatus = state === 'open' ? 'connected' : state === 'connecting' ? 'pending_qr' : 'disconnected';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('whatsapp_config') as any)
      .update({ qr_status: qrStatus, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);
    return NextResponse.json({ ok: true });
  }

  // ── Message status updates ───────────────────────────────────
  if (event === 'messages.update') {
    const d = payload.data as { key?: { id?: string }; update?: { status?: number | string } };
    const waId = d.key?.id;
    if (waId) {
      const rawStatus = String(d.update?.status ?? '').toLowerCase();
      const mapped = rawStatus.includes('read') ? 'read'
        : rawStatus.includes('deliv') ? 'delivered'
        : rawStatus.includes('error') || rawStatus.includes('fail') ? 'failed'
        : null;
      if (mapped) {
        const patch: Record<string, string> = { status: mapped };
        if (mapped === 'delivered') patch.delivered_at = new Date().toISOString();
        if (mapped === 'read') patch.read_at = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('whatsapp_messages') as any).update(patch).eq('wa_message_id', waId);
      }
    }
    return NextResponse.json({ ok: true });
  }

  // ── Inbound messages ─────────────────────────────────────────
  if (event === 'messages.upsert') {
    const d = payload.data as {
      key?: { id?: string; fromMe?: boolean; remoteJid?: string };
      message?: { conversation?: string; extendedTextMessage?: { text?: string }; imageMessage?: { caption?: string; url?: string }; documentMessage?: { caption?: string; url?: string; fileName?: string }; audioMessage?: { url?: string }; videoMessage?: { url?: string; caption?: string } };
      messageType?: string;
      pushName?: string;
      messageTimestamp?: number;
    };
    // Ignorar los mensajes propios que la sesión también recibe como upsert
    if (d.key?.fromMe) return NextResponse.json({ ok: true });
    const waId = d.key?.id || '';
    const fromJid = d.key?.remoteJid || '';
    // Formato: 5491123...@s.whatsapp.net → extraemos solo el número
    const from = fromJid.split('@')[0];
    if (!waId || !from) return NextResponse.json({ ok: true });

    // Dedupe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (svc.from('whatsapp_messages') as any)
      .select('id').eq('wa_message_id', waId).limit(1).maybeSingle();
    if (existing) return NextResponse.json({ ok: true });

    // Extraer contenido
    const body =
      d.message?.conversation ||
      d.message?.extendedTextMessage?.text ||
      d.message?.imageMessage?.caption ||
      d.message?.videoMessage?.caption ||
      d.message?.documentMessage?.caption ||
      null;
    const mediaUrl =
      d.message?.imageMessage?.url ||
      d.message?.documentMessage?.url ||
      d.message?.audioMessage?.url ||
      d.message?.videoMessage?.url ||
      null;
    const msgType =
      d.message?.imageMessage ? 'image' :
      d.message?.documentMessage ? 'document' :
      d.message?.audioMessage ? 'audio' :
      d.message?.videoMessage ? 'video' :
      'text';
    const contactName = d.pushName || null;

    // Upsert conversación
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conv } = await (svc.from('whatsapp_conversations') as any)
      .upsert({
        tenant_id: tenantId,
        wa_customer_id: from,
        customer_name: contactName,
        last_message_at: new Date().toISOString(),
        last_message_body: (body || `[${msgType}]`).slice(0, 200),
        last_message_from_bot: false,
        status: 'open',
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id,wa_customer_id' })
      .select('id, bot_paused, unread_count, crm_lead_id')
      .single();
    if (!conv) return NextResponse.json({ ok: true });

    const isFirstMessage = !conv.unread_count || conv.unread_count === 0;

    // Auto-crear lead CRM si es nuevo contacto
    if (!conv.crm_lead_id) {
      await maybeCreateCrmLead(svc, tenantId, {
        id: conv.id,
        wa_customer_id: from,
        customer_name: contactName,
        crm_lead_id: conv.crm_lead_id
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('whatsapp_messages') as any).insert({
      tenant_id: tenantId,
      conversation_id: conv.id,
      wa_message_id: waId,
      direction: 'in',
      msg_type: msgType,
      body,
      media_url: mediaUrl,
      status: 'delivered'
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('whatsapp_conversations') as any)
      .update({ unread_count: (conv.unread_count || 0) + 1 })
      .eq('id', conv.id);

    // ── Bot ──
    if (!cfgRow.bot_enabled || conv.bot_paused) return NextResponse.json({ ok: true });

    const unifiedCfg = {
      provider: 'qr' as const,
      evolution_url: cfgRow.evolution_url,
      evolution_instance: cfgRow.evolution_instance,
      evolution_api_key: decryptSecret(cfgRow.evolution_api_key)
    };

    async function sendBotReply(text: string) {
      const res = await unifiedSendText(unifiedCfg, from, text);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('whatsapp_messages') as any).insert({
        tenant_id: tenantId,
        conversation_id: conv!.id,
        wa_message_id: res.wa_message_id || null,
        direction: 'out',
        from_bot: true,
        msg_type: 'text',
        body: text,
        status: res.ok ? 'sent' : 'failed',
        error_message: res.ok ? null : res.error
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('whatsapp_conversations') as any).update({
        last_message_at: new Date().toISOString(),
        last_message_body: text.slice(0, 200),
        last_message_from_bot: true,
        updated_at: new Date().toISOString()
      }).eq('id', conv!.id);
    }

    if (cfgRow.away_enabled && isWithinAwayWindow(cfgRow.away_start, cfgRow.away_end)) {
      if (cfgRow.away_body) await sendBotReply(cfgRow.away_body);
      return NextResponse.json({ ok: true });
    }

    if (isFirstMessage && cfgRow.greeting_enabled && cfgRow.greeting_body) {
      await sendBotReply(cfgRow.greeting_body);
    }

    if (body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rulesRaw } = await (svc.from('whatsapp_bot_rules') as any)
        .select('id, trigger_type, keywords, match_mode, reply_body, active, position')
        .eq('tenant_id', tenantId).eq('active', true)
        .order('position', { ascending: true });
      const rules = (rulesRaw as BotRule[] | null) || [];
      const reply = resolveReply(body, rules, { customerName: contactName });
      if (reply) {
        await sendBotReply(reply.body);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: cur } = await (svc.from('whatsapp_bot_rules') as any)
          .select('hit_count').eq('id', reply.rule.id).limit(1).maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('whatsapp_bot_rules') as any)
          .update({ hit_count: (cur?.hit_count ?? 0) + 1 }).eq('id', reply.rule.id);
      } else if (cfgRow.ai_enabled) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: histRaw } = await (svc.from('whatsapp_messages') as any)
          .select('direction, body')
          .eq('conversation_id', conv.id)
          .not('body', 'is', null)
          .order('created_at', { ascending: true })
          .limit(20);
        const history = ((histRaw as Array<{ direction: string; body: string }> | null) || [])
          .slice(0, -1)
          .map((h) => ({ role: (h.direction === 'in' ? 'user' : 'assistant') as 'user' | 'assistant', content: h.body }));
        const aiReply = await resolveAiReply(
          { enabled: true, system_prompt: cfgRow.ai_system_prompt, model: cfgRow.ai_model },
          body, history, { customerName: contactName }
        );
        if (aiReply) await sendBotReply(aiReply);
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

/** Evolution también hace GET para health-check en algunos setups. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
