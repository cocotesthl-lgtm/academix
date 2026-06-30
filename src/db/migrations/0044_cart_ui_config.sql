-- =====================================================================
-- 0044_cart_ui_config.sql
-- Configuración UI del modo carrito: dónde mostrar el botón y cómo
-- mostrar el carrito al click.
--   cart_position: 'header' | 'floating' | 'both'   (default 'header')
--   cart_display:  'dropdown' | 'page'              (default 'dropdown')
-- =====================================================================

alter table public.tenants
  add column if not exists cart_position text not null default 'header',
  add column if not exists cart_display text not null default 'dropdown';

-- Constraints (defensivo: drop+add con if-exists para idempotencia)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_cart_position_check') then
    alter table public.tenants add constraint tenants_cart_position_check
      check (cart_position in ('header', 'floating', 'both'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_cart_display_check') then
    alter table public.tenants add constraint tenants_cart_display_check
      check (cart_display in ('dropdown', 'page'));
  end if;
end $$;
