-- 0052 · Analytics de storefront (funnel de conversión)
--
-- Tracking mínimo pero suficiente para responder:
--   ¿Cuántas visitas a la home / producto / checkout / gracias?
--   ¿Qué producto convierte mejor?
--   ¿Dónde se pierde la gente en el funnel?
--
-- Solo guardamos eventos, no PII más allá de session_id (uuid v4 en
-- localStorage). Ninguna dirección IP ni fingerprint del browser.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null check (event_type in (
    'page_view',
    'product_view',
    'add_to_cart',
    'checkout_start',
    'purchase'
  )),
  -- Referencias opcionales, según el evento:
  product_id uuid references public.physical_products(id) on delete set null,
  order_id uuid,  -- physical_orders.id (sin FK para permitir borrado)
  path text,      -- URL relativa (para page_view: "/", "/tienda", etc)
  session_id uuid,        -- uuid del cliente en localStorage (analytics_sid)
  amount_cents int,       -- solo purchase (para revenue attribution)
  referer text,           -- host del referer (dominio de origen, sin path)
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_tenant_time on public.analytics_events(tenant_id, created_at desc);
create index if not exists idx_analytics_tenant_type_time on public.analytics_events(tenant_id, event_type, created_at desc);
create index if not exists idx_analytics_product on public.analytics_events(product_id) where product_id is not null;
create index if not exists idx_analytics_session on public.analytics_events(tenant_id, session_id);

-- RLS: escritura anon (para tracking desde storefront), lectura solo owner
alter table public.analytics_events enable row level security;

drop policy if exists analytics_insert_public on public.analytics_events;
create policy analytics_insert_public on public.analytics_events
  for insert to anon, authenticated with check (true);

drop policy if exists analytics_read_owner on public.analytics_events;
create policy analytics_read_owner on public.analytics_events
  for select to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = analytics_events.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );
