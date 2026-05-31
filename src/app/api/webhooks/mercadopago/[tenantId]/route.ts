import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { verifyMercadoPagoSignature } from '@/lib/payments/signatures';
import { processMpPayment } from '@/lib/payments/process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Integration = {
  access_token_enc: string;
  webhook_secret: string;
};

/**
 * MP hace una validación GET de la URL antes de enviar el POST con la
 * notificación. Si no respondemos 200 OK, MP marca la URL como inválida
 * y nunca envía el POST. Por eso devolvemos un health check liviano.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  return NextResponse.json({ ok: true, route: 'mercadopago_webhook', tenant_id: tenantId });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const svc = getServiceClient();

  // Read raw body once (cannot re-read after json())
  const raw = await req.text();
  let body: { type?: string; data?: { id?: string | number }; action?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const dataId = body?.data?.id;
  if (!dataId) {
    // MP also sends test pings — ack and ignore
    return NextResponse.json({ ok: true, note: 'no data.id' });
  }

  // Lookup integration
  const { data: integration } = await svc
    .from('integrations')
    .select('access_token_enc, webhook_secret')
    .eq('tenant_id', tenantId)
    .eq('provider', 'mercadopago')
    .eq('status', 'connected')
    .maybeSingle<Integration>();
  if (!integration) {
    return NextResponse.json({ error: 'no_integration' }, { status: 404 });
  }

  // Verify signature
  // MP firma con el webhook secret app-level (configurable en MP Dev → Webhooks).
  // Usamos MERCADOPAGO_WEBHOOK_SECRET (env var del founder) como fuente primaria;
  // si no está, caemos al integration.webhook_secret (legacy/per-tenant).
  const platformSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const secretToUse = platformSecret || integration.webhook_secret;
  const valid = verifyMercadoPagoSignature(req.headers, secretToUse, dataId);
  if (!valid) {
    // En dev/setup MP a veces no firma o el secret todavía no fue configurado.
    // Bypass explícito con MP_SKIP_SIG_CHECK=1.
    if (process.env.MP_SKIP_SIG_CHECK !== '1') {
      return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
    }
  }

  // Idempotency
  const eventKey = `mp:${dataId}`;
  const eventPayload = { provider: 'mercadopago', external_id: String(dataId), tenant_id: tenantId, payload: body };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dupErr } = await (svc.from('webhook_events') as any)
    .insert(eventPayload);
  if (dupErr) {
    // Duplicate => already processed
    if (dupErr.message.includes('duplicate')) {
      return NextResponse.json({ ok: true, note: 'duplicate' });
    }
    return NextResponse.json({ error: dupErr.message }, { status: 500 });
  }
  void eventKey;

  // We only care about payment notifications
  if (body.type && body.type !== 'payment') {
    return NextResponse.json({ ok: true, note: `ignored type ${body.type}` });
  }

  const result = await processMpPayment({
    tenantId,
    paymentId: dataId,
    accessToken: integration.access_token_enc
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, saleId: result.saleId, reused: result.reused });
}
