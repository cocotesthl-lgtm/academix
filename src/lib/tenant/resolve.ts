import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';
import { cacheGet, cacheSet } from '@/lib/tenant/cache';

export type TenantBrand = {
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string;
  accent_color?: string;
  /** Imagen 1200×630 usada como preview en WhatsApp/Twitter/Facebook cuando se comparte un link. */
  og_image_url?: string;
  /** Frase corta (ej. "Cursos de inglés online"). Se concatena al title para llegar a 50-60 chars ideales de SEO. */
  tagline?: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'closed';
  brand: TenantBrand;
  /**
   * CSS gradient string (linear-gradient(...)) opcional que reemplaza
   * al brand.primary_color en superficies grandes (botones CTA, bandas
   * de header, ribbons). Se aplica como `--brand-bg` en el storefront;
   * los consumers usan var(--brand-bg, var(--brand)) para caer al hex
   * sólido si el owner no configuró gradient.
   */
  primaryGradient?: string | null;
};

export async function resolveTenantIdBySlug(slug: string): Promise<string | null> {
  const key = `slug:${slug.toLowerCase()}`;
  const cached = await cacheGet(key);
  if (cached !== undefined) return cached;

  const sb = getServiceClient();
  const { data } = await sb
    .from('tenants')
    .select('id')
    .eq('slug', slug.toLowerCase())
    .maybeSingle<{ id: string }>();
  const id = data?.id ?? null;
  await cacheSet(key, id);
  return id;
}

/**
 * Resolver tenant por custom domain (ej. "tuempresa.com").
 * Usado por el proxy cuando el request viene de un host que NO es
 * apex.<root> ni *.<root>.
 *
 * Defensivo: si migration 0026 no corrió, devuelve null sin romper.
 */
export async function resolveTenantIdByCustomDomain(host: string): Promise<string | null> {
  const cleanHost = host.split(':')[0].toLowerCase();
  const key = `domain:${cleanHost}`;
  const cached = await cacheGet(key);
  if (cached !== undefined) return cached;

  const sb = getServiceClient();
  try {
    const { data } = await sb
      .from('tenants').select('id')
      .eq('custom_domain', cleanHost)
      .maybeSingle<{ id: string }>();
    const id = data?.id ?? null;
    await cacheSet(key, id);
    return id;
  } catch {
    // Migration 0026 no corrió → no hay columna
    return null;
  }
}

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: Tenant['status'];
  brand: TenantBrand | null;
  primary_gradient?: string | null;
};

export async function getTenantById(id: string): Promise<Tenant | null> {
  const sb = getServiceClient();
  // Query defensiva por primary_gradient (migration 0083 puede no
  // haber corrido). Intenta con la columna; si falla, retry sin ella.
  const cols = 'id, slug, name, status, brand, primary_gradient';
  const fallback = 'id, slug, name, status, brand';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any = await sb.from('tenants').select(cols).eq('id', id).maybeSingle();
  if (res.error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res = await sb.from('tenants').select(fallback).eq('id', id).maybeSingle();
  }
  const data = res.data as TenantRow | null;
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    status: data.status,
    brand: data.brand ?? {},
    primaryGradient: data.primary_gradient ?? null
  };
}
