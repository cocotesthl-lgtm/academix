-- =====================================================================
-- 0060_dropshipping.sql
-- Marketplace interno de dropshipping.
--
-- Modelo:
--   · Cualquier tenant puede activar el rol 'supplier' (self-serve).
--   · Como supplier, publica productos mayoristas en 'supplier_products'.
--   · Cualquier reseller navega el catálogo mayorista y agrega productos
--     a su tienda vía 'catalog_listings' con un markup.
--   · Al agregar, se crea un shadow physical_products row en el catálogo
--     del reseller (misma tabla que sus productos propios) con el precio
--     final (wholesale × markup). El storefront funciona igual: buyer no
--     ve que es dropship (white-label).
--   · Al concretarse una compra, generamos un 'supplier_orders' para que
--     el supplier vea qué mandar. Payment settle manual entre partes.
--
-- Fase 1 (esta migration): schema base. Fases siguientes: browse UI,
-- order routing en webhook MP, tracking sync.
-- =====================================================================

-- 1) Rol supplier: cualquier tenant lo puede activar solo desde /owner/dropship
alter table public.tenants
  add column if not exists is_supplier boolean not null default false,
  add column if not exists supplier_display_name text,
  add column if not exists supplier_bio text,
  add column if not exists supplier_lead_time_days int;   -- típico "envío en 3-5 días"

-- 2) Catálogo mayorista del supplier. Distinto de physical_products porque
--    tiene wholesale_price + no es visible al buyer directamente.
create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  cover_url text,
  gallery jsonb not null default '[]'::jsonb,
  wholesale_price_cents bigint not null default 0,
  currency text not null default 'ARS',
  sku text,
  stock_qty int not null default 0,
  track_stock boolean not null default true,
  weight_g int,
  category text,                            -- string simple, no FK (categorías del supplier son suyas)
  origin_province text,                     -- provincia desde donde envía (para mostrar al reseller)
  status text not null default 'draft' check (status in ('draft','published')),
  suggested_retail_cents bigint,            -- precio sugerido al reseller (opcional)
  min_markup_percent int,                   -- para forzar un margen mínimo (protege al supplier)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_tenant_id, slug)
);
create index if not exists idx_supplier_products_status
  on public.supplier_products(status, supplier_tenant_id);
create index if not exists idx_supplier_products_category
  on public.supplier_products(category) where category is not null;

-- 3) Listing: reseller → supplier_product con markup + shadow product.
--    Al crearse un listing, disparamos (server-side) la creación del shadow
--    physical_products row en el catálogo del reseller.
create table if not exists public.catalog_listings (
  id uuid primary key default gen_random_uuid(),
  reseller_tenant_id uuid not null references public.tenants(id) on delete cascade,
  supplier_product_id uuid not null references public.supplier_products(id) on delete cascade,
  -- Shadow product en el catálogo del reseller. Cuando el reseller elimina
  -- el listing, borramos también el physical_products (cascada aplicativa).
  physical_product_id uuid references public.physical_products(id) on delete set null,
  markup_type text not null default 'percent' check (markup_type in ('percent','fixed')),
  markup_value numeric(10,2) not null default 40,   -- default 40% de markup
  -- Sync: cuando el supplier actualiza precio/stock, ¿el listing se auto-actualiza?
  auto_sync_price boolean not null default true,
  auto_sync_stock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reseller_tenant_id, supplier_product_id)   -- un reseller no lista 2 veces el mismo
);
create index if not exists idx_catalog_listings_reseller
  on public.catalog_listings(reseller_tenant_id);
create index if not exists idx_catalog_listings_supplier
  on public.catalog_listings(supplier_product_id);

-- 4) Órdenes ruteadas al supplier. Cuando un buyer compra en el storefront
--    del reseller y hay al menos un item dropship, este row se crea para
--    que el supplier vea qué mandar y a dónde.
create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_tenant_id uuid not null references public.tenants(id) on delete cascade,
  reseller_tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Orden origen en el reseller (para trazabilidad).
  reseller_order_id uuid references public.physical_orders(id) on delete set null,
  -- Snapshot del buyer (nunca lo cambia después — el supplier ve lo que hay).
  buyer_email text not null,
  buyer_name text,
  buyer_phone text,
  shipping_address jsonb,
  -- Items (jsonb array de { supplier_product_id, qty, wholesale_price_cents, title }).
  items jsonb not null default '[]'::jsonb,
  wholesale_total_cents bigint not null default 0,
  currency text not null default 'ARS',
  -- Notas: reseller puede escribir algo ("por favor no incluir factura"),
  -- supplier puede escribir tracking o comentarios.
  reseller_notes text,
  supplier_notes text,
  tracking_number text,
  carrier text,      -- Andreani, Correo Argentino, OCA, etc.
  status text not null default 'pending'
    check (status in ('pending','confirmed','shipped','delivered','cancelled','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz
);
create index if not exists idx_supplier_orders_supplier
  on public.supplier_orders(supplier_tenant_id, status);
create index if not exists idx_supplier_orders_reseller
  on public.supplier_orders(reseller_tenant_id, status);

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.supplier_products enable row level security;
alter table public.catalog_listings enable row level security;
alter table public.supplier_orders enable row level security;

-- supplier_products: read público de status='published' (para que cualquier
-- reseller pueda navegar el catálogo mayorista). Write solo owner del supplier.
drop policy if exists sup_products_public_read on public.supplier_products;
create policy sup_products_public_read on public.supplier_products
  for select using (status = 'published');

drop policy if exists sup_products_owner_write on public.supplier_products;
create policy sup_products_owner_write on public.supplier_products
  for all
  using (public.is_tenant_owner(supplier_tenant_id) or public.is_super_admin())
  with check (public.is_tenant_owner(supplier_tenant_id) or public.is_super_admin());

-- catalog_listings: read + write del reseller. El supplier también puede ver
-- (para saber quién lo está vendiendo).
drop policy if exists listings_reseller_write on public.catalog_listings;
create policy listings_reseller_write on public.catalog_listings
  for all
  using (public.is_tenant_owner(reseller_tenant_id) or public.is_super_admin())
  with check (public.is_tenant_owner(reseller_tenant_id) or public.is_super_admin());

drop policy if exists listings_supplier_read on public.catalog_listings;
create policy listings_supplier_read on public.catalog_listings
  for select
  using (exists (
    select 1 from public.supplier_products sp
    where sp.id = catalog_listings.supplier_product_id
      and (public.is_tenant_owner(sp.supplier_tenant_id) or public.is_super_admin())
  ));

-- supplier_orders: supplier ve las suyas (para fulfillment), reseller ve las
-- suyas (para saber estado). Ambos pueden leer, cada uno escribe sus campos
-- (aplicativo se encarga de gate escritura por campo — RLS solo autoriza row).
drop policy if exists sup_orders_supplier_access on public.supplier_orders;
create policy sup_orders_supplier_access on public.supplier_orders
  for all
  using (public.is_tenant_owner(supplier_tenant_id) or public.is_super_admin())
  with check (public.is_tenant_owner(supplier_tenant_id) or public.is_super_admin());

drop policy if exists sup_orders_reseller_read on public.supplier_orders;
create policy sup_orders_reseller_read on public.supplier_orders
  for select
  using (public.is_tenant_owner(reseller_tenant_id) or public.is_super_admin());
