-- =====================================================================
-- 0046_memberships_permissions.sql
-- Permisos modulares por membership (F3.a).
--
-- Cada membership gana un jsonb 'permissions' con la forma:
--   { catalog: ['view'|'edit'|'admin'], calendar: [...], crm: [...],
--     team: [...], sales: [...], site: [...] }
--
-- Módulo faltante en el jsonb = sin acceso. Acción "admin" implica
-- "edit" implica "view" (hierarchy manejada en TS, no en DB).
--
-- Backfill por role_preset actual (el role ya existente sigue funcionando
-- como preset). Los tenants pueden overridear permission por miembro
-- desde /owner/equipo (F3.b).
-- =====================================================================

alter table public.memberships
  add column if not exists permissions jsonb;

-- Owner: full admin sobre todos los módulos
update public.memberships
  set permissions = '{"catalog":["admin"],"calendar":["admin"],"crm":["admin"],"team":["admin"],"sales":["admin"],"site":["admin"]}'::jsonb
  where role = 'owner' and permissions is null;

-- Instructor: puede ver el catálogo, editar su agenda, ver leads/alumnos
update public.memberships
  set permissions = '{"catalog":["view"],"calendar":["edit"],"crm":["view"]}'::jsonb
  where role = 'instructor' and permissions is null;

-- Affiliate: ve sus leads y sus comisiones
update public.memberships
  set permissions = '{"crm":["view"],"sales":["view"]}'::jsonb
  where role = 'affiliate' and permissions is null;

-- Student: sin permisos de panel (siguen consumiendo por el storefront).
-- Se deja null explícitamente. Nada que hacer.
