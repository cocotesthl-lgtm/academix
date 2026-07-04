import { env } from '@/lib/env';
import { getTenantById } from '@/lib/tenant/resolve';
import type { Metadata } from 'next';

/**
 * URL absoluta del storefront de un tenant (para meta canonical / OG).
 * Ej.: `https://academia.bzseguridad.store`
 */
export function storefrontOrigin(slug: string): string {
  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const host = isLocal
    ? `${slug}.localhost${u.port ? ':' + u.port : ''}`
    : `${slug}.${env.rootDomain}`;
  return `${u.protocol}//${host}`;
}

/** Trunca respetando palabras completas, agrega "…" al final. */
export function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '';
  const clean = String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

/**
 * Metadata default para todo el storefront del tenant. Se usa desde el
 * layout — cada page individual puede overridear con la suya.
 */
export async function tenantMetadata(tenantId: string): Promise<Metadata> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) return { title: 'Sitio no encontrado' };
  const origin = storefrontOrigin(tenant.slug);
  // OG image debe ser 1200×630 (1.91:1). El logo NO cumple ese ratio →
  // solo usamos og_image_url si el owner lo cargó específicamente para esto.
  const ogImage = tenant.brand?.og_image_url ?? null;
  const tagline = tenant.brand?.tagline?.trim();

  // Title de 50-60 chars ideal para SEO. Si hay tagline, lo concatenamos.
  const titleWithTagline = tagline
    ? truncate(`${tenant.name} — ${tagline}`, 60)
    : tenant.name;

  const description = truncate(
    tagline
      ? `${tenant.name} — ${tagline}. Publicaciones, artículos y contacto.`
      : `${tenant.name} — sitio oficial. Publicaciones, artículos y contacto.`,
    160
  );
  return {
    metadataBase: new URL(origin),
    title: {
      default: titleWithTagline,
      template: `%s · ${tenant.name}`
    },
    description,
    openGraph: {
      type: 'website',
      siteName: tenant.name,
      title: titleWithTagline,
      description,
      url: origin,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
      locale: 'es_AR'
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: titleWithTagline,
      description,
      images: ogImage ? [ogImage] : undefined
    },
    alternates: { canonical: origin }
  };
}
