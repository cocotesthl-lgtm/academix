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
  const logo = tenant.brand?.logo_url ?? null;
  const description = truncate(
    `${tenant.name} — sitio oficial. Publicaciones, artículos y contacto.`,
    160
  );
  return {
    metadataBase: new URL(origin),
    title: {
      default: tenant.name,
      template: `%s · ${tenant.name}`
    },
    description,
    openGraph: {
      type: 'website',
      siteName: tenant.name,
      title: tenant.name,
      description,
      url: origin,
      images: logo ? [{ url: logo }] : undefined,
      locale: 'es_AR'
    },
    twitter: {
      card: logo ? 'summary_large_image' : 'summary',
      title: tenant.name,
      description,
      images: logo ? [logo] : undefined
    },
    alternates: { canonical: origin }
  };
}
