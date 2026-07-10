import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/workspace/switch?tenant=<uuid>&to=<url>
 *
 * Cambia el workspace "activo" del owner. Setea la cookie `owner_tenant_id`
 * con el tenant_id elegido (verificando membership válida) y redirige a
 * la URL destino. Sin esto, requireOwner() siempre agarra el primer tenant
 * que devuelva la query — ignorando qué workspace clickeó el user.
 *
 * Seguridad:
 *  · El user tiene que tener membership activa como owner/admin del tenant.
 *  · La URL destino se sanitiza para permitir SOLO paths absolutos internos
 *    o subdominios propios (evita open redirect).
 */
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant') ?? '';
  const rawTo = req.nextUrl.searchParams.get('to') ?? '/dashboard';

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Verificar membership válida antes de setear la cookie.
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (svc.from('memberships') as any)
    .select('tenant_id, role, status')
    .eq('user_id', user.id).eq('tenant_id', tenantId)
    .eq('status', 'active').in('role', ['owner', 'admin'])
    .maybeSingle();

  // Si no tiene permisos sobre ese tenant, redirigimos a dashboard sin
  // setear cookie (queda con el tenant "por default" del requireOwner).
  const validTenant = !!member;

  // Sanitizar destino: SOLO paths que empiecen con "/" (interno) o URLs
  // absolutas al mismo host. Cualquier otra cosa cae a /dashboard.
  let dest = '/dashboard';
  if (rawTo.startsWith('/') && !rawTo.startsWith('//')) {
    dest = rawTo;
  } else {
    try {
      const parsed = new URL(rawTo);
      const reqHost = req.headers.get('host') ?? '';
      // Permitimos redirects a cualquier subdomain del root domain propio.
      if (parsed.host === reqHost || parsed.host.endsWith('.' + reqHost.split(':')[0])) {
        dest = parsed.pathname + parsed.search + parsed.hash;
      }
    } catch { /* URL inválida, usamos default */ }
  }

  const url = new URL(dest, req.url);
  const res = NextResponse.redirect(url);

  if (validTenant) {
    // Cookie de 30 días, HttpOnly, misma path que el resto de la app.
    res.cookies.set('owner_tenant_id', tenantId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/'
    });
  }
  return res;
}
