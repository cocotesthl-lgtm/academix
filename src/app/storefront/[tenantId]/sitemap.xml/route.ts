import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Sitemap XML por tenant. Cada storefront tiene el suyo en /sitemap.xml.
 * Google lo descubre desde /robots.txt y lo usa para indexar rápido.
 *
 * Incluye:
 *   - Home /
 *   - Cada publicación (course) publicada → /c/<slug>
 *   - Cada artículo publicado → /blog/<slug>
 *   - Index del blog → /blog
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return new Response('Not found', { status: 404 });

  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const origin = isLocal
    ? `${u.protocol}//${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
    : `${u.protocol}//${tenant.slug}.${env.rootDomain}`;

  const svc = getServiceClient();

  // Fetch publicaciones y artículos publicados en paralelo (defensivo si
  // migration 0050 no corrió → catch devuelve array vacío).
  type Row = { slug: string; updated_at: string };
  const [{ data: coursesRaw }, articlesRaw] = await Promise.all([
    svc.from('courses').select('slug, updated_at')
      .eq('tenant_id', tenantId).eq('status', 'published'),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('articles') as any)
          .select('slug, updated_at').eq('tenant_id', tenantId).eq('status', 'published');
        return (data ?? []) as Row[];
      } catch { return [] as Row[]; }
    })()
  ]);
  const courses = (coursesRaw ?? []) as Row[];
  const articles = articlesRaw;

  const nowIso = new Date().toISOString();
  const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [
    { loc: `${origin}/`, lastmod: nowIso, changefreq: 'weekly', priority: '1.0' }
  ];

  if (articles.length > 0) {
    urls.push({ loc: `${origin}/blog`, lastmod: nowIso, changefreq: 'daily', priority: '0.7' });
  }
  for (const c of courses) {
    urls.push({
      loc: `${origin}/c/${c.slug}`,
      lastmod: c.updated_at || nowIso,
      changefreq: 'weekly',
      priority: '0.8'
    });
  }
  for (const a of articles) {
    urls.push({
      loc: `${origin}/blog/${a.slug}`,
      lastmod: a.updated_at || nowIso,
      changefreq: 'monthly',
      priority: '0.6'
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
