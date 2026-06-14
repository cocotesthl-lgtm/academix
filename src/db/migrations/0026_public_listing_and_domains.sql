-- =====================================================================
-- 0026_public_listing_and_domains.sql
-- Privacidad del listado público + dominios custom por tenant.
-- =====================================================================

-- Public listing toggle
alter table public.tenants
  add column if not exists public_listing boolean not null default true,
  add column if not exists custom_domain text;

-- Custom domains pueden ser varios por tenant (futuro), pero por ahora 1.
-- Si tenants.custom_domain está set, el storefront responde en ese host.
create unique index if not exists tenants_custom_domain_uniq
  on public.tenants (custom_domain) where custom_domain is not null;

-- Estado de verificación del dominio en Vercel
create table if not exists public.tenant_domain_status (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  domain text not null,
  vercel_verified boolean not null default false,
  vercel_apex_a_record text,         -- ej. 76.76.21.21
  vercel_cname_target text,           -- ej. cname.vercel-dns.com
  last_checked_at timestamptz,
  vercel_response jsonb,              -- raw response para debug
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
