-- =====================================================================
-- 0083_brand_gradient.sql
-- Owner ahora puede elegir un GRADIENT como brand accent (además del
-- hex sólido). Se usa en bandas de header, botones CTA grandes y
-- ribbons destacados — todo lo que soporta CSS `background`.
--
-- primary_color sigue siendo el hex fallback (para SVG stroke, mix
-- con alpha, íconos monocromo y cualquier lugar donde CSS gradient
-- no aplique). Los renderers usan primary_gradient si existe y
-- caen a primary_color si es null.
-- =====================================================================

alter table public.tenants
  add column if not exists primary_gradient text;
