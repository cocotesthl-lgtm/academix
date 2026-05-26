import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';
import { cacheGet, cacheSet } from '@/lib/tenant/cache';

export type TenantBrand = {
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string;
  accent_color?: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'closed';
  brand: TenantBrand;
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

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: Tenant['status'];
  brand: TenantBrand | null;
};

export async function getTenantById(id: string): Promise<Tenant | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('tenants')
    .select('id, slug, name, status, brand')
    .eq('id', id)
    .maybeSingle<TenantRow>();
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    status: data.status,
    brand: data.brand ?? {}
  };
}
