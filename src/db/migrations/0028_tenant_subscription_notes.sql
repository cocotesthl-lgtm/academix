-- =====================================================================
-- 0028_tenant_subscription_notes.sql
-- Campo de notas para los planes regalados por el founder (contexto:
-- "regalo lanzamiento 3 meses", "embajador", "deuda compensada", etc).
-- =====================================================================

alter table public.tenants
  add column if not exists subscription_notes text;
