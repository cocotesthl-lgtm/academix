-- 0087 · Producto físico: swatches de variantes + galería por variante + specs
--
-- Cambios:
-- 1) product_variants.swatch_color      → hex "#000000" para el chip visual
-- 2) product_variants.swatch_image_url  → thumbnail alternativo del chip
-- 3) product_variants.gallery           → galería específica por variante (jsonb array URLs)
-- 4) physical_products.specs            → ficha técnica jsonb [{"label":..,"value":..}]
--
-- Backwards compatible: todos los campos son opcionales/nullable, se defaultean
-- al comportamiento previo (una sola galería a nivel producto, sin swatches).

alter table public.product_variants
  add column if not exists swatch_color text,
  add column if not exists swatch_image_url text,
  add column if not exists gallery jsonb not null default '[]'::jsonb;

alter table public.physical_products
  add column if not exists specs jsonb not null default '[]'::jsonb;

-- Recarga schema cache de PostgREST (best-effort; ignora si extension no está).
do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;
