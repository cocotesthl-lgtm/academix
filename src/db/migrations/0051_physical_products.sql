-- 0051 · Ecommerce físico completo: productos + variantes + stock + envío + órdenes
--
-- Modelo mental:
--   physical_products
--     └─ product_variants  (opcional; si no hay, se usa stock/price del producto)
--     └─ product_stock_movements  (historial de ajustes de inventario)
--
--   shipping_zones (tenant)
--     └─ shipping_rates  (flat + free-from-threshold)
--
--   physical_orders
--     └─ physical_order_items
--
-- Nota: física vs curso comparte la tabla `sales` para reporting de ingresos.
-- El flujo del webhook MP debe insertar tanto en `sales` como en `physical_orders`
-- cuando el payment corresponde a una physical_order.

-- ============================================================
-- Productos
-- ============================================================
create table if not exists public.physical_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  cover_url text,
  gallery jsonb not null default '[]'::jsonb,  -- array de URLs
  price_cents int not null default 0,
  compare_at_price_cents int,  -- precio tachado (para mostrar descuento)
  currency text not null default 'ARS',
  sku text,
  stock_qty int not null default 0,  -- usado si no hay variantes
  track_stock boolean not null default true,  -- false = stock ilimitado
  weight_g int,  -- opcional, por si integramos cotización real
  requires_shipping boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published')),
  category_id uuid references public.course_categories(id) on delete set null,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists idx_physical_products_tenant on public.physical_products(tenant_id, status);

-- ============================================================
-- Variantes (opcional — talle/color/etc)
-- ============================================================
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.physical_products(id) on delete cascade,
  -- name: label human ("M / Rojo"). options: {"talle":"M","color":"rojo"} para filtros futuros.
  name text not null,
  options jsonb not null default '{}'::jsonb,
  sku text,
  price_cents int,  -- override; null = usar precio del producto
  stock_qty int not null default 0,
  image_url text,   -- foto específica de la variante (opcional)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_variants_product on public.product_variants(product_id, sort_order);

-- ============================================================
-- Movimientos de stock (historial de ajustes)
-- ============================================================
create table if not exists public.product_stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.physical_products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  delta int not null,  -- positivo=ingreso, negativo=venta/ajuste
  reason text not null check (reason in ('sale', 'restock', 'adjustment', 'return', 'damage')),
  order_id uuid,  -- referencia opcional a physical_orders (sin FK para permitir borrado)
  actor_user_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_movs_tenant_time on public.product_stock_movements(tenant_id, created_at desc);

-- ============================================================
-- Zonas y tarifas de envío
-- ============================================================
create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,  -- "CABA", "GBA", "Interior", "Retiro en local"
  -- provinces: array de códigos ISO ("AR-C","AR-B","AR-M"…). ["*"] = todas.
  provinces jsonb not null default '[]'::jsonb,
  is_pickup boolean not null default false,  -- retiro en local (sin dirección)
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_zones_tenant on public.shipping_zones(tenant_id, sort_order);

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  zone_id uuid not null references public.shipping_zones(id) on delete cascade,
  name text not null,  -- "Estándar", "Express"
  price_cents int not null default 0,
  free_from_cents int,  -- envío gratis desde este subtotal (null = nunca gratis)
  delivery_days_min int,
  delivery_days_max int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_rates_zone on public.shipping_rates(zone_id, sort_order);

-- ============================================================
-- Órdenes físicas (independientes de `sales` — que sigue siendo para reporting)
-- ============================================================
create table if not exists public.physical_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  buyer_user_id uuid references public.profiles(id) on delete set null,
  buyer_email text not null,
  buyer_name text,
  buyer_phone text,
  -- Dirección: se guarda snapshot para no depender de un profile mutable.
  -- Estructura: { street, number, apt, city, province, postal_code, country, notes }
  shipping_address jsonb,
  shipping_zone_id uuid references public.shipping_zones(id) on delete set null,
  shipping_rate_id uuid references public.shipping_rates(id) on delete set null,
  shipping_method_label text,  -- snapshot ("Estándar CABA - 3 días")
  items_total_cents int not null default 0,
  shipping_cost_cents int not null default 0,
  discount_cents int not null default 0,
  total_cents int not null default 0,
  currency text not null default 'ARS',
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded')
  ),
  payment_id text,  -- MP payment id (link a `sales`)
  tracking_number text,
  tracking_url text,
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  notes text,  -- notas internas del owner
  buyer_notes text,  -- notas del comprador (ej: "dejar en portería")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_physical_orders_tenant_time on public.physical_orders(tenant_id, created_at desc);
create index if not exists idx_physical_orders_status on public.physical_orders(tenant_id, status);
create index if not exists idx_physical_orders_buyer on public.physical_orders(buyer_user_id);

create table if not exists public.physical_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.physical_orders(id) on delete cascade,
  product_id uuid references public.physical_products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  qty int not null default 1 check (qty > 0),
  unit_price_cents int not null,
  -- Snapshots (para que la orden sobreviva si borran producto/variante)
  product_title text not null,
  variant_label text,
  sku text
);
create index if not exists idx_order_items_order on public.physical_order_items(order_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.physical_products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_stock_movements enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.physical_orders enable row level security;
alter table public.physical_order_items enable row level security;

-- Physical products: owner all, público read published
drop policy if exists physical_products_owner on public.physical_products;
create policy physical_products_owner on public.physical_products
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = physical_products.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists physical_products_public_read on public.physical_products;
create policy physical_products_public_read on public.physical_products
  for select to anon, authenticated
  using (status = 'published');

-- Variants: hereda del producto
drop policy if exists variants_owner on public.product_variants;
create policy variants_owner on public.product_variants
  for all to authenticated
  using (
    exists (select 1 from public.physical_products p
      join public.memberships m on m.tenant_id = p.tenant_id
      where p.id = product_variants.product_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read on public.product_variants
  for select to anon, authenticated
  using (
    exists (select 1 from public.physical_products p
      where p.id = product_variants.product_id and p.status = 'published')
  );

-- Stock movements: solo owner
drop policy if exists stock_movs_owner on public.product_stock_movements;
create policy stock_movs_owner on public.product_stock_movements
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = product_stock_movements.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

-- Zonas + rates: owner all, público read (para calcular envío en checkout)
drop policy if exists zones_owner on public.shipping_zones;
create policy zones_owner on public.shipping_zones
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = shipping_zones.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists zones_public_read on public.shipping_zones;
create policy zones_public_read on public.shipping_zones
  for select to anon, authenticated using (true);

drop policy if exists rates_owner on public.shipping_rates;
create policy rates_owner on public.shipping_rates
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = shipping_rates.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists rates_public_read on public.shipping_rates;
create policy rates_public_read on public.shipping_rates
  for select to anon, authenticated using (true);

-- Órdenes: owner + comprador
drop policy if exists orders_owner on public.physical_orders;
create policy orders_owner on public.physical_orders
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = physical_orders.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists orders_buyer_read on public.physical_orders;
create policy orders_buyer_read on public.physical_orders
  for select to authenticated
  using (buyer_user_id = auth.uid());

drop policy if exists order_items_owner on public.physical_order_items;
create policy order_items_owner on public.physical_order_items
  for all to authenticated
  using (
    exists (select 1 from public.physical_orders o
      join public.memberships m on m.tenant_id = o.tenant_id
      where o.id = physical_order_items.order_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists order_items_buyer_read on public.physical_order_items;
create policy order_items_buyer_read on public.physical_order_items
  for select to authenticated
  using (
    exists (select 1 from public.physical_orders o
      where o.id = physical_order_items.order_id and o.buyer_user_id = auth.uid())
  );
