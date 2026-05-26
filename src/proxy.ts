import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { resolveTenantIdBySlug } from '@/lib/tenant/resolve';
import { env } from '@/lib/env';

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

function buildResponse(req: NextRequest): { response: NextResponse; portal: string; tenantId?: string; tenantSlug?: string } {
  const host = req.headers.get('host') ?? '';
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    return { response: NextResponse.next({ request: req }), portal: 'api' };
  }

  const parsed = extractSubdomain(host);

  if (parsed.kind === 'apex') {
    return { response: NextResponse.next({ request: req }), portal: 'marketing' };
  }

  const slug = parsed.slug!;

  if (isAuthPath(pathname)) {
    const portal = slug === 'admin' ? 'founder' : slug === 'app' ? 'owner' : 'storefront';
    return { response: NextResponse.next({ request: req }), portal };
  }

  if (slug === 'admin') {
    url.pathname = `/founder${pathname === '/' ? '/dashboard' : pathname}`;
    return { response: NextResponse.rewrite(url, { request: req }), portal: 'founder' };
  }

  if (slug === 'app') {
    url.pathname = `/owner${pathname === '/' ? '/dashboard' : pathname}`;
    return { response: NextResponse.rewrite(url, { request: req }), portal: 'owner' };
  }

  // tenant subdomain
  return { response: NextResponse.next({ request: req }), portal: 'storefront-pending', tenantSlug: slug };
}

export async function proxy(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  let { response, portal, tenantSlug } = buildResponse(req);

  // Resolve tenant subdomain (deferred so we can rewrite to /not-found if missing)
  if (portal === 'storefront-pending' && tenantSlug) {
    const tenantId = await resolveTenantIdBySlug(tenantSlug);
    if (!tenantId) {
      url.pathname = '/not-found';
      response = NextResponse.rewrite(url, { request: req });
      portal = 'not-found';
    } else {
      url.pathname = `/storefront/${tenantId}${pathname === '/' ? '' : pathname}`;
      response = NextResponse.rewrite(url, { request: req });
      response.headers.set('x-tenant-id', tenantId);
      response.headers.set('x-tenant-slug', tenantSlug);
      portal = 'storefront';
    }
  }

  response.headers.set('x-portal', portal);

  // Refresh Supabase session (rotates access_token via refresh_token if needed)
  try {
    const supabase = createServerClient(env.supabase.url(), env.supabase.anonKey(), {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(toSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          for (const { name, value, options } of toSet) {
            response.cookies.set({
              name,
              value,
              ...options
            });
          }
        }
      }
    });
    await supabase.auth.getUser();
  } catch {
    // Env not configured or transient error — skip refresh, request still proceeds.
  }

  return response;
}
