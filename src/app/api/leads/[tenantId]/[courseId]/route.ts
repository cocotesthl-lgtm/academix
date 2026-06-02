import { NextRequest, NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { getServiceClient } from '@/lib/supabase/service';
import { verifyAffiliateCookie, cookieName } from '@/lib/affiliates/cookie';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Captura de lead desde landings VSL (form multi-paso después del video).
 * Recibe JSON con los campos del form + opcional source/utm.
 * Hashea la IP para no almacenarla directa (privacy).
 * Resuelve affiliate link si hay cookie firmada para este tenant.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; courseId: string }> }
) {
  const { tenantId, courseId } = await params;
  const svc = getServiceClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Validamos que el curso pertenece al tenant
  const { data: course } = await svc
    .from('courses')
    .select('id, tenant_id')
    .eq('id', courseId)
    .eq('tenant_id', tenantId)
    .maybeSingle<{ id: string; tenant_id: string }>();
  if (!course) return NextResponse.json({ error: 'course_not_found' }, { status: 404 });

  // Extraer campos conocidos del body, el resto va en data jsonb
  const name = (body.name as string | undefined)?.trim().slice(0, 120) || null;
  const email = (body.email as string | undefined)?.trim().slice(0, 200) || null;
  const phone = (body.phone as string | undefined)?.trim().slice(0, 40) || null;
  const utm_source = (body.utm_source as string | undefined)?.trim().slice(0, 80) || null;
  const utm_medium = (body.utm_medium as string | undefined)?.trim().slice(0, 80) || null;
  const utm_campaign = (body.utm_campaign as string | undefined)?.trim().slice(0, 80) || null;
  const source = (body.source as string | undefined)?.trim().slice(0, 40) || 'vsl';

  // El resto va a data (excluyendo los nombres reservados)
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (['name', 'email', 'phone', 'utm_source', 'utm_medium', 'utm_campaign', 'source'].includes(k)) continue;
    if (typeof v === 'string' && v.length > 5000) continue;
    data[k] = v;
  }

  // Affiliate cookie (si llega vía link de afiliado)
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(cookieName(tenantId))?.value ?? null;
  const affPayload = rawCookie ? verifyAffiliateCookie(rawCookie) : null;
  const affLinkId = affPayload && affPayload.courseId === courseId ? affPayload.linkId : null;

  // Hash de IP para privacy
  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0].trim()) || h.get('x-real-ip') || '0.0.0.0';
  const ua = h.get('user-agent') ?? '';
  const referer = h.get('referer') ?? '';
  const ip_hash = createHash('sha256').update(ip + new Date().toISOString().slice(0, 10)).digest('hex').slice(0, 32);

  const payload = {
    tenant_id: tenantId,
    course_id: courseId,
    source,
    email, name, phone,
    data,
    utm_source, utm_medium, utm_campaign,
    affiliate_link_id: affLinkId,
    referer: referer.slice(0, 500),
    ip_hash,
    user_agent: ua.slice(0, 500)
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (svc.from('leads') as any)
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead_id: (row as { id: string }).id });
}
