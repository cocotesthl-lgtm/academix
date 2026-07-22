import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolvePostAuthRedirect } from '@/lib/auth/actions';
import { capturePendingReferral } from '@/lib/affiliates/referral-capture';

export const dynamic = 'force-dynamic';

/**
 * Callback que vuelve desde Supabase OAuth o desde email confirm/magic link.
 * 1. Intercambia code por session (setea cookies)
 * 2. Si vino con `next=...` explícito, lo usa
 * 3. Sino, detecta rol del user (owner/student/etc) y manda al destino
 *    apropiado via postAuthRedirect
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url));
  }

  // Si el next es explícito y NO es el default genérico, respetarlo.
  // (ej. cuando alguien pone /affiliate o /learn intencional).
  if (next && next !== '/onboarding' && next.startsWith('/')) {
    return NextResponse.redirect(new URL(next, req.url));
  }

  // Sino, detectamos rol del user y vamos al lugar correcto.
  const userId = data?.user?.id;
  if (!userId) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  // Captura referrer para el multinivel (L1→L2→L3). Cubre los flows que
  // no pasan por signupAction: email confirm delayed, OAuth (Google), magic
  // link. Idempotente — si ya fue capturado no hace nada.
  await capturePendingReferral(userId);

  const dest = await resolvePostAuthRedirect(userId);
  // dest puede ser absolute URL (cross-subdomain a app.<root>) o path
  // relativo (/onboarding, /learn). next/server.redirect maneja ambos.
  if (dest.startsWith('http')) {
    return NextResponse.redirect(dest);
  }
  return NextResponse.redirect(new URL(dest, req.url));
}
