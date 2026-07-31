import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type EventInput = {
  event_type: string;
  product_id?: string;
  order_id?: string;
  path?: string;
  session_id?: string;
  amount_cents?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  label?: string;
  content_kind?: string;
};

const ALLOWED_TYPES = new Set([
  'page_view', 'product_view', 'add_to_cart', 'checkout_start', 'purchase',
  'click', 'course_view', 'event_view', 'vip_view', 'article_view', 'paylink_view'
]);
const ALLOWED_KINDS = new Set(['physical', 'course', 'event', 'vip', 'article', 'paylink']);

/**
 * POST /api/track/[tenantId]
 * Body: { event_type, product_id?, order_id?, path?, session_id?, amount_cents?, utm_* }
 * Insert best-effort. No devuelve datos ni retries — el cliente es fire-and-forget.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const body = await req.json().catch(() => null) as EventInput | null;
  if (!body || !ALLOWED_TYPES.has(body.event_type)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Extraer referer host (sin path) — para saber si viene de google, IG, etc.
  let referer: string | null = null;
  const rawRef = req.headers.get('referer');
  if (rawRef) {
    try {
      const u = new URL(rawRef);
      referer = u.hostname;
    } catch { /* referer inválido */ }
  }

  const svc = getServiceClient();
  const contentKind = body.content_kind && ALLOWED_KINDS.has(body.content_kind)
    ? body.content_kind : null;
  const fullPayload = {
    tenant_id: tenantId,
    event_type: body.event_type,
    product_id: body.product_id ?? null,
    order_id: body.order_id ?? null,
    path: body.path?.slice(0, 500) ?? null,
    session_id: body.session_id ?? null,
    amount_cents: body.amount_cents ?? null,
    referer,
    utm_source: body.utm_source?.slice(0, 80) ?? null,
    utm_medium: body.utm_medium?.slice(0, 80) ?? null,
    utm_campaign: body.utm_campaign?.slice(0, 80) ?? null,
    label: body.label?.slice(0, 120) ?? null,
    content_kind: contentKind
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('analytics_events') as any).insert(fullPayload);
    if (error && /label|content_kind|event_type/.test(error.message ?? '')) {
      // Migration 0089 pendiente — reintentamos con el schema viejo (solo si
      // el event_type sigue siendo válido en la constraint vieja)
      const legacyTypes = new Set(['page_view', 'product_view', 'add_to_cart', 'checkout_start', 'purchase']);
      if (legacyTypes.has(body.event_type)) {
        const { label: _l, content_kind: _c, ...legacy } = fullPayload;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('analytics_events') as any).insert(legacy);
      }
    }
  } catch { /* migration 0052 pendiente o rate limit — best-effort */ }
  return NextResponse.json({ ok: true });
}
