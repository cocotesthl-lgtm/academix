-- =====================================================================
-- 0022_affiliate_validators.sql
-- Permite al owner habilitar afiliados como "asistentes de molinete"
-- — pueden escanear tickets el día del evento sin tener acceso completo
-- al panel del owner.
--
-- Flag por membership (granular): un afiliado puede ser validator de un
-- tenant pero no de otros. Default false — no se habilita masivamente.
-- =====================================================================

alter table public.memberships
  add column if not exists can_validate_tickets boolean not null default false;

create index if not exists memberships_validator_idx
  on public.memberships (tenant_id, role)
  where can_validate_tickets = true;
