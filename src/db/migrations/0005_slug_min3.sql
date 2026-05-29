-- =====================================================================
-- Curplat — Permitir slugs de 3 caracteres (era 4+).
-- El constraint original era ^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$
-- (1 + 2-30 + 1 = mínimo 4 chars). Lo bajamos a 3.
-- =====================================================================

alter table public.tenants drop constraint if exists tenants_slug_check;
alter table public.tenants
  add constraint tenants_slug_check
  check (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$');
