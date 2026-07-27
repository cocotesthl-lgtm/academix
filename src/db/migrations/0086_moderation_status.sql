-- 0086_moderation_status.sql
-- Estados de moderación founder-side para users y tenants.
--
-- 'active'      → operación normal (default)
-- 'under_review'→ marcado por founder para chequeo manual — el user/tenant
--                 sigue operando pero el founder ve un banner amarillo en
--                 el listado
-- 'suspended'   → deshabilitado — el user no puede loguear (tenants:
--                 la sección de storefront muestra "temporarily unavailable")
--
-- Enforcement:
--   Users: al login se chequea profiles.moderation_status. Si 'suspended',
--          logout + mensaje.
--   Tenants: si tenants.status='suspended' el storefront devuelve 503-like page.
--            (Tenants ya tiene status; extendemos los valores permitidos.)

alter table public.profiles
  add column if not exists moderation_status text
    not null default 'active';

-- Constraint separada para no chocar si la corremos varias veces
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_moderation_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_moderation_status_check
      check (moderation_status in ('active', 'under_review', 'suspended'));
  end if;
end$$;

-- Tenants ya tiene 'status' pero con valores originales ('active','suspended').
-- Agregamos 'under_review' al check si no está ya.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'tenants_status_check'
  ) then
    alter table public.tenants drop constraint tenants_status_check;
  end if;
  alter table public.tenants
    add constraint tenants_status_check
    check (status in ('active', 'under_review', 'suspended'));
end$$;

create index if not exists idx_profiles_moderation
  on public.profiles(moderation_status) where moderation_status <> 'active';
create index if not exists idx_tenants_status
  on public.tenants(status) where status <> 'active';
