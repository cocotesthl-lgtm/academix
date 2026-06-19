-- =====================================================================
-- 0034_cart_mode.sql
-- Modo carrito (opcional, off por default).
-- Cuando está ON, los botones "Comprar ya" cambian a "Agregar al carrito"
-- y aparece un widget flotante con drawer. El checkout final crea 1 sola
-- preferencia MP con multiple items.
-- =====================================================================

alter table public.tenants
  add column if not exists cart_enabled boolean not null default false;
