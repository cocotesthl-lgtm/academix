-- 0089 · Analytics v2: click tracking + content_kind + más event types
--
-- Cambios:
-- 1) Ampliar check(event_type) para incluir:
--      · click            → click genérico en cualquier CTA (usa label)
--      · course_view      → vista de landing de curso
--      · event_view       → vista de landing de evento (tickets)
--      · vip_view         → vista de pack VIP
--      · article_view     → vista de artículo del blog
--      · paylink_view     → vista de link de pago
-- 2) Nueva columna `label text`: para clicks (nombre del CTA) o
--    labels custom en cualquier evento.
-- 3) Nueva columna `content_kind text`: 'physical' | 'course' | 'event' |
--    'vip' | 'article' | 'paylink' — para agrupar views/purchases por tipo.
-- 4) DROP del FK `product_id → physical_products(id)`: ahora product_id
--    puede apuntar a courses, events, vip_packs, articles, pay_links —
--    el contexto lo da content_kind. Perdemos la garantía de FK, pero
--    ganamos poder trackear todo el catálogo con la misma tabla.

-- 1) Ampliar check
alter table public.analytics_events
  drop constraint if exists analytics_events_event_type_check;

alter table public.analytics_events
  add constraint analytics_events_event_type_check check (event_type in (
    'page_view',
    'product_view',
    'add_to_cart',
    'checkout_start',
    'purchase',
    'click',
    'course_view',
    'event_view',
    'vip_view',
    'article_view',
    'paylink_view'
  ));

-- 2) Nuevas columnas
alter table public.analytics_events
  add column if not exists label text,
  add column if not exists content_kind text;

-- Índice para top clicks
create index if not exists idx_analytics_click_label
  on public.analytics_events(tenant_id, label)
  where event_type = 'click';

-- Índice para breakdown por content_kind
create index if not exists idx_analytics_content_kind
  on public.analytics_events(tenant_id, content_kind, event_type)
  where content_kind is not null;

-- 3) DROP FK product_id → physical_products (ahora es uuid genérico)
do $$
declare
  con_name text;
begin
  select tc.constraint_name into con_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
    and tc.table_name = 'analytics_events'
    and kcu.column_name = 'product_id'
  limit 1;
  if con_name is not null then
    execute format('alter table public.analytics_events drop constraint %I', con_name);
  end if;
end $$;

-- Recarga schema cache
do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;
