import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Feed RSS 2.0 del blog. Los lectores tipo Feedly, Google News, etc.
 * consumen esta URL para mostrar los últimos artículos publicados.
 * También lo detecta el crawler de Google como señal de contenido nuevo.
 *
 * URL: <tenant>/rss.xml
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
  // Defensivo si migration 0050 no corrió.
  type Row = {
    slug: string; title: string; excerpt: string | null;
    body_html: string; author_name: string | null; published_at: string;
  };
  let rows: Row[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('articles') as any)
      .select('slug, title, excerpt, body_html, author_name, published_at')
      .eq('tenant_id', tenantId).eq('status', 'published')
      .order('published_at', { ascending: false }).limit(50);
    rows = (data ?? []) as Row[];
  } catch { /* migration pendiente → feed vacío */ }

  const lastBuild = rows[0]?.published_at ?? new Date().toISOString();
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(tenant.name)}</title>
    <link>${escapeXml(origin)}/blog</link>
    <atom:link href="${escapeXml(origin)}/rss.xml" rel="self" type="application/rss+xml" />
    <description>Últimas publicaciones de ${escapeXml(tenant.name)}</description>
    <language>es-AR</language>
    <lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
${rows.map((a) => `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(`${origin}/blog/${a.slug}`)}</link>
      <guid isPermaLink="true">${escapeXml(`${origin}/blog/${a.slug}`)}</guid>
      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>
      ${a.author_name ? `<dc:creator>${escapeXml(a.author_name)}</dc:creator>` : ''}
      <description>${escapeXml(a.excerpt ?? '')}</description>
      <content:encoded><![CDATA[${a.body_html}]]></content:encoded>
    </item>`).join('\n')}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=1800'
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
