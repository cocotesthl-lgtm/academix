import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantIdBySlug } from '@/lib/tenant/resolve';

export const config = {
  matcher: ['/((?!_next/|favicon.ico|.*\\..*).*)']
};

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com';
const AUTH_PATHS = ['/login', '/signup', '/onboarding', '/logout', '/auth'];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function extractSubdomain(host: string): { kind: 'apex' | 'sub'; slug?: string } {
  const cleanHost = host.split(':')[0].toLowerCase();

  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return { kind: 'apex' };
  }
  if (cleanHost.endsWith('.localhost')) {
    const sub = cleanHost.slice(0, -'.localhost'.length);
    if (!sub) return { kind: 'apex' };
    return { kind: 'sub', slug: sub };
  }
  if (cleanHost === ROOT_DOMAIN || cleanHost === `www.${ROOT_DOMAIN}`) {
    return { kind: 'apex' };
  }
  if (cleanHost.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = cleanHost.slice(0, -(`.${ROOT_DOMAIN}`.length));
    return { kind: 'sub', slug: sub };
  }
  return { kind: 'apex' };
}

export async function proxy(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const parsed = extractSubdomain(host);

  if (parsed.kind === 'apex') {
    const res = NextResponse.next();
    res.headers.set('x-portal', 'marketing');
    return res;
  }

  const slug = parsed.slug!;

  // Auth pages serve from (auth) group at apex paths — pass through on any subdomain.
  if (isAuthPath(pathname)) {
    const res = NextResponse.next();
    res.headers.set('x-portal', slug === 'admin' ? 'founder' : slug === 'app' ? 'owner' : 'storefront');
    return res;
  }

  if (slug === 'admin') {
    url.pathname = `/founder${pathname === '/' ? '/dashboard' : pathname}`;
    const res = NextResponse.rewrite(url);
    res.headers.set('x-portal', 'founder');
    return res;
  }

  if (slug === 'app') {
    url.pathname = `/owner${pathname === '/' ? '/dashboard' : pathname}`;
    const res = NextResponse.rewrite(url);
    res.headers.set('x-portal', 'owner');
    return res;
  }

  const tenantId = await resolveTenantIdBySlug(slug);
  if (!tenantId) {
    url.pathname = '/not-found';
    return NextResponse.rewrite(url);
  }

  url.pathname = `/storefront/${tenantId}${pathname === '/' ? '' : pathname}`;
  const res = NextResponse.rewrite(url);
  res.headers.set('x-portal', 'storefront');
  res.headers.set('x-tenant-id', tenantId);
  res.headers.set('x-tenant-slug', slug);
  return res;
}
