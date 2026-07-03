-- =====================================================================
-- 0048_site_draft_published.sql
-- Builder Wix-style: separación borrador vs publicado.
--
--   tenants.site_config              → DRAFT (lo que el owner edita)
--   tenants.site_config_published    → SNAPSHOT publicado (lo que muestra
--                                       el storefront público)
--   tenants.site_config_published_at → timestamp del último publish
--
-- Comportamiento:
--   - Autosave del editor persiste en `site_config` (draft).
--   - Botón "Publicar" copia `site_config` → `site_config_published`.
--   - Storefront público lee `site_config_published`.
--   - Preview del owner sigue leyendo `site_config` (para ver el draft).
--
-- Backfill: tenants existentes reciben `site_config_published = site_config`
-- para que su sitio siga viéndose igual (nadie pierde su sitio en producción).
-- =====================================================================

alter table public.tenants
  add column if not exists site_config_published jsonb,
  add column if not exists site_config_published_at timestamptz;

-- Backfill: los tenants existentes se consideran ya publicados con su
-- config actual. Sin esto, todos los sitios en prod se verían con el
-- default hasta que el owner apretara Publicar.
update public.tenants
  set site_config_published = site_config,
      site_config_published_at = coalesce(site_config_published_at, now())
  where site_config_published is null;
