-- 0016_user_blocks.sql
-- ──────────────────────────────────────────────────────────────────
-- Bloqueo de academia por parte del user.
-- Si un user bloquea una academia:
--   - La academia no puede sumarlo como instructor (acción silenciosa,
--     muestra "no se encontró el email" — mismo mensaje que user inexistente).
--   - Sus memberships en esa academia se desactivan automáticamente.
--   - Sus asignaciones de cursos como instructor se borran.
--   - Sus links de afiliado / promociones siguen funcionando (no rompemos
--     ventas históricas), pero deja de aparecer en listas activas.
-- El user puede desbloquear cuando quiera.
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.user_tenant_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  blocked_at timestamptz not null default now(),
  reason text,
  unique (user_id, tenant_id)
);
create index if not exists user_tenant_blocks_tenant_idx
  on public.user_tenant_blocks (tenant_id);
create index if not exists user_tenant_blocks_user_idx
  on public.user_tenant_blocks (user_id);

-- RLS: cada user maneja sus propios bloqueos.
alter table public.user_tenant_blocks enable row level security;
drop policy if exists "blocks: self CRUD" on public.user_tenant_blocks;
create policy "blocks: self CRUD" on public.user_tenant_blocks
  for all using (user_id = auth.uid());
-- El owner del tenant NO puede ver quién lo bloqueó (silencioso).
