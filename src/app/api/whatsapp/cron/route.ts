import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { decryptSecret } from '@/lib/crypto/secrets';
import { unifiedSendText, type UnifiedConfig } from '@/lib/whatsapp/sender';

/**
 * Cron endpoint: procesa jobs vencidos de broadcast + scheduled_messages.
 * Se llama cada minuto desde vercel.json crons (o cualquier scheduler).
 *
 * Protección: header X-Cron-Secret debe matchear CRON_SECRET.
 * Sin secret → 401. Esto evita que un tercero dispare envíos masivos.
 *
 * Idempotencia: cada job se transiciona pending → sending antes de
 * intentar el envío (aunque no hay lock real, la ventana entre reads es
 * muy corta y el peor caso es un mensaje duplicado — Meta/Baileys los
 * deduplican en la mayoría de los casos).
 *
 * Cap: máximo 100 jobs por corrida para no colgar la request en cron.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAP = 100;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel cron manda "Authorization: Bearer <secret>"
  const auth = req.headers.get('authorization') || '';
  if (auth === `Bearer ${secret}`) return true;
  // Legacy header + query param para curl / testing local
  if (req.headers.get('x-cron-secret') === secret) return true;
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return runCron();
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return runCron();
}

async function runCron() {
  const svc = getServiceClient();
  const now = new Date().toISOString();
  let processedBroadcast = 0;
  let processedScheduled = 0;

  // ── Broadcast jobs ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bcastJobs } = await (svc.from('whatsapp_broadcast_jobs') as any)
    .select('id, tenant_id, broadcast_id, conversation_id, wa_customer_id')
    .eq('status', 'pending').lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true }).limit(CAP);

  for (const job of ((bcastJobs as Array<{ id: string; tenant_id: string; broadcast_id: string; conversation_id: string | null; wa_customer_id: string }> | null) || [])) {
    // Marcar sending para evitar reentrancia
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('whatsapp_broadcast_jobs') as any).update({ status: 'sending' }).eq('id', job.id);

    const cfg = await loadCfg(svc, job.tenant_id);
    if (!cfg) {
      await failJob(svc, job.id, job.broadcast_id, 'WhatsApp no está conectado');
      continue;
    }

    // Body del broadcast (leer del parent — evita duplicar en cada job)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bcast } = await (svc.from('whatsapp_broadcasts') as any)
      .select('message_body').eq('id', job.broadcast_id).single();
    const body = (bcast?.message_body as string) || '';

    const res = await unifiedSendText(cfg, job.wa_customer_id, body);

    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('whatsapp_broadcast_jobs') as any).update({
        status: 'sent', wa_message_id: res.wa_message_id || null, sent_at: new Date().toISOString()
      }).eq('id', job.id);
      // Log del mensaje en la conversación
      if (job.conversation_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('whatsapp_messages') as any).insert({
          tenant_id: job.tenant_id,
          conversation_id: job.conversation_id,
          wa_message_id: res.wa_message_id || null,
          direction: 'out', from_bot: false,
          msg_type: 'text', body,
          status: 'sent'
        });
      }
      await bumpBroadcastCounter(svc, job.broadcast_id, 'sent_count');
    } else {
      await failJob(svc, job.id, job.broadcast_id, res.error || 'send failed');
    }
    processedBroadcast++;
  }

  // Marcar broadcasts terminados: los que ya no tienen jobs pending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeBcasts } = await (svc.from('whatsapp_broadcasts') as any)
    .select('id, sent_count, failed_count, total_recipients').eq('status', 'sending');
  for (const b of ((activeBcasts as Array<{ id: string; sent_count: number; failed_count: number; total_recipients: number }> | null) || [])) {
    if ((b.sent_count + b.failed_count) >= b.total_recipients) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('whatsapp_broadcasts') as any)
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', b.id);
    }
  }

  // ── Scheduled messages ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schedMsgs } = await (svc.from('whatsapp_scheduled_messages') as any)
    .select('id, tenant_id, conversation_id, wa_customer_id, body')
    .eq('status', 'pending').lte('send_at', now)
    .order('send_at', { ascending: true }).limit(CAP);

  for (const msg of ((schedMsgs as Array<{ id: string; tenant_id: string; conversation_id: string; wa_customer_id: string; body: string }> | null) || [])) {
    const cfg = await loadCfg(svc, msg.tenant_id);
    if (!cfg) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('whatsapp_scheduled_messages') as any).update({
        status: 'failed', error_message: 'WhatsApp no está conectado'
      }).eq('id', msg.id);
      continue;
    }
    const res = await unifiedSendText(cfg, msg.wa_customer_id, msg.body);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('whatsapp_scheduled_messages') as any).update({
      status: res.ok ? 'sent' : 'failed',
      wa_message_id: res.wa_message_id || null,
      error_message: res.ok ? null : res.error,
      sent_at: new Date().toISOString()
    }).eq('id', msg.id);
    // Log en conversación
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('whatsapp_messages') as any).insert({
        tenant_id: msg.tenant_id,
        conversation_id: msg.conversation_id,
        wa_message_id: res.wa_message_id || null,
        direction: 'out', from_bot: false,
        msg_type: 'text', body: msg.body, status: 'sent'
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('whatsapp_conversations') as any).update({
        last_message_at: new Date().toISOString(),
        last_message_body: msg.body.slice(0, 200),
        last_message_from_bot: false,
        updated_at: new Date().toISOString()
      }).eq('id', msg.conversation_id);
    }
    processedScheduled++;
  }

  return NextResponse.json({ ok: true, processedBroadcast, processedScheduled });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadCfg(svc: any, tenantId: string): Promise<UnifiedConfig | null> {
  const { data: cfg } = await svc.from('whatsapp_config')
    .select('phone_number_id, access_token')
    .eq('tenant_id', tenantId).limit(1).maybeSingle();
  if (!cfg) return null;
  return {
    phone_number_id: cfg.phone_number_id ?? null,
    access_token: cfg.access_token ? decryptSecret(cfg.access_token) : null
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function failJob(svc: any, jobId: string, bcastId: string, err: string): Promise<void> {
  await svc.from('whatsapp_broadcast_jobs').update({
    status: 'failed', error_message: err
  }).eq('id', jobId);
  await bumpBroadcastCounter(svc, bcastId, 'failed_count');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bumpBroadcastCounter(svc: any, bcastId: string, field: 'sent_count' | 'failed_count'): Promise<void> {
  const { data: cur } = await svc.from('whatsapp_broadcasts')
    .select(field).eq('id', bcastId).single();
  const next = ((cur?.[field] as number) ?? 0) + 1;
  await svc.from('whatsapp_broadcasts').update({ [field]: next }).eq('id', bcastId);
}
