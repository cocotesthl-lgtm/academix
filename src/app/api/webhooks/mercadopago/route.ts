import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { verifyMercadoPagoSignature } from '@/lib/payments/signatures';
import { getPayment } from '@/lib/payments/mercadopago';
import { processMpPayment } from '@/lib/payments/process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Endpoint GLOBAL de webhooks de MercadoPago.
 * Esta URL se configura UNA sola vez en MP Dev → Webhooks → URL de
 * producción, con la clave secreta en MERCADOPAGO_WEBHOOK_SECRET.
 *
 * MP manda acá TODAS las notificaciones de pago (de cualquier owner
 * conectado a Curplat). Resolvemos el tenant haciendo:
 *   1. Fetch del payment desde MP usando el access_token del platform
 *      (NO funciona porque cada pago pertenece al owner, no a la plataforma)
 *   2. Mejor: leer external_reference que tiene 'courseId::userId::affId'
 *   3. Lookup de la publicación → obtener tenant_id → obtener access_token del owner
 *   4. Re-fetchear el payment con el access_token del owner
 *   5. Procesar
 *
 * Es más complejo que el per-tenant, pero es lo que MP recomienda.
 */
export async function GET() {
  // Health check para que MP valide la URL al guardarla
  return NextResponse.json({ ok: true, route: 'mercadopago_webhook_global' });
}

export async function POST(req: NextRequest) {
  const svc = getServiceClient();

  // Read raw body once
  const raw = await req.text();
  let body: { type?: string; data?: { id?: string | number }; action?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const dataId = body?.data?.id;
  if (!dataId) {
    return NextResponse.json({ ok: true, note: 'no data.id' });
  }

  console.log('[mp-webhook-global] incoming', { type: body.type, dataId });

  // Solo nos interesan pagos
  if (body.type && body.type !== 'payment') {
    return NextResponse.json({ ok: true, note: `ignored type ${body.type}` });
  }

  // Verificación de firma con el secret app-level
  const platformSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (platformSecret) {
    const valid = verifyMercadoPagoSignature(req.headers, platformSecret, dataId);
    if (!valid && process.env.MP_SKIP_SIG_CHECK !== '1') {
      console.warn('[mp-webhook-global] bad signature, rejecting');
      return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
    }
  }

  // Idempotencia
  const eventPayload = {
    provider: 'mercadopago',
    external_id: String(dataId),
    tenant_id: null,
    payload: body
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dupErr } = await (svc.from('webhook_events') as any).insert(eventPayload);
  if (dupErr && dupErr.message.toLowerCase().includes('duplicate')) {
    return NextResponse.json({ ok: true, note: 'duplicate' });
  }

  // Para resolver el tenant necesitamos el access_token. Probamos en orden:
  // 1) Fetch el payment usando CUALQUIER access_token de la plataforma para
  //    al menos sacar el external_reference (formato courseId::userId::affId).
  //    Como cada access_token pertenece a un owner, el primer fetch podría
  //    fallar con 401 si el payment no es de ese owner.
  // 2) Mejor: traer todos los integrations activos y probar hasta encontrar
  //    el correcto. Para pocos owners es OK; para muchos vamos a necesitar
  //    leer external_reference de otra forma.

  // Estrategia: traemos todos los access_tokens conectados, probamos cada
  // uno hasta que MP nos devuelva 200. Ese es el owner.
  const { data: integrationsRaw } = await svc
    .from('integrations')
    .select('tenant_id, access_token_enc')
    .eq('provider', 'mercadopago')
    .eq('status', 'connected');

  const integrations = (integrationsRaw ?? []) as Array<{ tenant_id: string; access_token_enc: string }>;
  if (integrations.length === 0) {
    return NextResponse.json({ error: 'no_integrations' }, { status: 404 });
  }

  let resolvedTenantId: string | null = null;
  let resolvedToken: string | null = null;
  for (const int of integrations) {
    try {
      await getPayment(dataId, int.access_token_enc);
      resolvedTenantId = int.tenant_id;
      resolvedToken = int.access_token_enc;
      break;
    } catch {
      // ese token no es dueño de este pago, probamos el siguiente
    }
  }

  if (!resolvedTenantId || !resolvedToken) {
    console.warn('[mp-webhook-global] could not resolve owner for payment', dataId);
    return NextResponse.json({ error: 'owner_not_found' }, { status: 404 });
  }

  const result = await processMpPayment({
    tenantId: resolvedTenantId,
    paymentId: dataId,
    accessToken: resolvedToken
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  console.log('[mp-webhook-global] processed', {
    tenant_id: resolvedTenantId,
    sale_id: result.saleId,
    reused: result.reused
  });

  return NextResponse.json({ ok: true, saleId: result.saleId, reused: result.reused });
}
