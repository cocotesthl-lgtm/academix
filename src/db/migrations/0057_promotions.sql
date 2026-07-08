-- =====================================================================
-- 0057_promotions.sql
-- Promociones automáticas del carrito (Shopify: "Discounts" / TN: "Promociones").
--
-- Distintas de:
--   · bundles: son productos combinados vendidos como uno (kit)
--   · coupons: requieren código escrito por el buyer
-- Las promotions se aplican SOLAS al llegar a la condición en el cart.
--
-- Tipos MVP (más comunes en Shopify/TN):
--   · nx_pay_m       — 3x2, 4x3, 2x1: comprá N, pagás M (el más barato gratis)
--   · qty_percent    — comprando N+ unidades, X% off en los que califican
--   · min_amount_free_shipping — envío gratis desde $X en el cart
--
-- Scope: 'all' | 'category' | 'products'
--   · all      → aplica a cualquier item del cart
--   · category → aplica solo a items cuya category_id esté en target_ids
--   · products → aplica solo a items cuyo product_id esté en target_ids
-- =====================================================================

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  type text not null check (type in (
    'nx_pay_m', 'qty_percent', 'min_amount_free_shipping', 'min_amount_percent'
  )),
  -- Parámetros por tipo (los que no aplican quedan null)
  buy_qty int,               -- nx_pay_m: cantidad a comprar (ej. 3)
  pay_qty int,               -- nx_pay_m: cantidad a pagar  (ej. 2)
  min_qty int,               -- qty_percent: cantidad mínima
  min_amount_cents bigint,   -- min_amount_*: monto mínimo del cart
  discount_percent int,      -- qty_percent + min_amount_percent: 5-90
  -- Scope
  scope text not null default 'all' check (scope in ('all', 'category', 'products')),
  target_ids jsonb not null default '[]'::jsonb,  -- array de uuids (categories o products)
  -- Vigencia y estado
  starts_at timestamptz,
  ends_at timestamptz,
  enabled boolean not null default true,
  -- Prioridad para orden de aplicación (mayor = primero). Por si hay dos
  -- promos que compiten para el mismo item, la de mayor prioridad gana.
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_promotions_tenant on public.promotions(tenant_id, enabled);
create index if not exists idx_promotions_active
  on public.promotions(tenant_id, enabled, starts_at, ends_at);

alter table public.promotions enable row level security;

-- Lectura pública (storefront muestra badges "3x2" en las cards de producto)
drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read on public.promotions
  for select using (enabled = true);

-- Owner/admin/staff pueden escribir
drop policy if exists promotions_owner_write on public.promotions;
create policy promotions_owner_write on public.promotions
  for all using (
    exists (select 1 from public.memberships m
            where m.tenant_id = promotions.tenant_id and m.user_id = auth.uid()
              and m.role in ('owner', 'admin', 'staff') and m.status = 'active')
  ) with check (
    exists (select 1 from public.memberships m
            where m.tenant_id = promotions.tenant_id and m.user_id = auth.uid()
              and m.role in ('owner', 'admin', 'staff') and m.status = 'active')
  );

-- ── physical_orders: guardar promociones aplicadas ─────────────────
-- Snapshot para reporting: qué promos se aplicaron a esta orden y cuánto
-- descontaron. jsonb: [{promotion_id, title, type, discount_cents}]
alter table public.physical_orders
  add column if not exists applied_promotions jsonb not null default '[]'::jsonb,
  add column if not exists promo_discount_cents bigint not null default 0;
