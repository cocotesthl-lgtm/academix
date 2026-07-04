import { getTenantById } from '@/lib/tenant/resolve';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * robots.txt por tenant. Le dice a Google (y otros crawlers) que puede
 * indexar todo el sitio y dónde está el sitemap.
 *
 * Solo bloqueamos rutas internas de auth y APIs.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return new Response('User-agent: *\nDisallow: /', { status: 404 });

  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const origin = isLocal
    ? `${u.protocol}//${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
    : `${u.protocol}//${tenant.slug}.${env.rootDomain}`;

  const suspended = tenant.status === 'suspended' || tenant.status === 'closed';
  const body = suspended
    ? `User-agent: *\nDisallow: /`
    : `User-agent: *
Allow: /
Disallow: /api/
Disallow: /login
Disallow: /signup
Disallow: /learn
Disallow: /affiliate

Sitemap: ${origin}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  });
}
