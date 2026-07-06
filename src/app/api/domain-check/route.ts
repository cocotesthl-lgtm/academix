import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RESERVED = new Set([
  'admin', 'app', 'api', 'www', 'mail', 'ftp', 'root',
  'signup', 'login', 'logout', 'signout', 'onboarding', 'workspaces',
  'account', 'billing', 'settings', 'help', 'support', 'docs',
  'terms', 'privacy', 'legal', 'blog', 'news',
  'buscar', 'affiliate', 'affiliates', 'demo', 'gracias'
]);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$|^[a-z0-9]{3}$/;

/**
 * GET /api/domain-check?slug=miNegocio
 * Devuelve { available: bool, reason?: string }.
 * Público. Usado por la landing marketing para el widget "Comprobar disponibilidad".
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get('slug') ?? '').trim().toLowerCase();

  if (!raw) return NextResponse.json({ available: false, reason: 'empty' });
  if (raw.length < 3) return NextResponse.json({ available: false, reason: 'too_short' });
  if (raw.length > 40) return NextResponse.json({ available: false, reason: 'too_long' });
  if (!SLUG_RE.test(raw)) return NextResponse.json({ available: false, reason: 'invalid_chars' });
  if (RESERVED.has(raw)) return NextResponse.json({ available: false, reason: 'reserved' });

  const svc = getServiceClient();
  const { data } = await svc.from('tenants')
    .select('id').eq('slug', raw).maybeSingle<{ id: string }>();
  if (data) return NextResponse.json({ available: false, reason: 'taken' });

  return NextResponse.json({ available: true });
}
