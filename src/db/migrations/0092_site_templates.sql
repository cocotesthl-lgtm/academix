-- 0092 · Site templates en DB (editables por el founder)
--
-- Los templates que aparecen en /onboarding y /owner/templates hoy viven
-- hardcodeados en src/lib/site/templates/catalog.ts. Con esta tabla, el
-- founder puede activarlos/desactivarlos, editar metadata (nombre, emoji,
-- descripción, primary color, orden) y — en la próxima fase — editar el
-- diseño completo con el mismo builder que usan los tenants.
--
-- Estrategia de auto-seed:
--   · Si al leer la tabla está vacía, el loader inserta todos los
--     templates hardcodeados como `is_system=true` (idempotente).
--   · Después la DB es la fuente de verdad; el catálogo hardcoded queda
--     como fallback si Supabase no responde.

create table if not exists public.site_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  emoji text,
  short_desc text,
  long_desc text,
  suggested_primary text,
  config jsonb not null default '{}'::jsonb,
  -- ModuleKey[] serializado como text[] — el loader convierte al enum.
  modules text[] not null default '{}',
  is_active boolean not null default true,
  -- true si fue seeded desde el catálogo hardcoded (marca visual en el
  -- founder panel; NO impide borrarlo — es solo un tag).
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_site_templates_active on public.site_templates(is_active, sort_order);
create index if not exists idx_site_templates_category on public.site_templates(category);

alter table public.site_templates enable row level security;

-- Lectura pública: cualquiera puede ver templates activos (onboarding es
-- unauthenticated).
drop policy if exists site_templates_public_read on public.site_templates;
create policy site_templates_public_read on public.site_templates
  for select to anon, authenticated using (is_active);

-- Escritura: sólo super_admin. Founder edita todo desde /founder/templates.
drop policy if exists site_templates_admin_all on public.site_templates;
create policy site_templates_admin_all on public.site_templates
  for all to authenticated
  using (exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.is_super_admin = true))
  with check (exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.is_super_admin = true));

do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;
