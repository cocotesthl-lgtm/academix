-- =====================================================================
-- 0071_videos_pool.sql
-- Videos cortos (YouTube Shorts) para sitios de noticias / editoriales.
--
-- Mismo patrón que artículos: pool global (demo_videos) + tabla real
-- (videos) con demo_ref para copy-on-edit. Storefront muestra strip
-- horizontal en homepage + player fullscreen vertical scroll (/reels).
-- =====================================================================

-- ── Pool global ───────────────────────────────────────────────────────
create table if not exists public.demo_videos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  youtube_id text not null,          -- ID extraído de youtube.com/shorts/{id}
  category_slug text,                -- referencia a demo_course_categories
  position int not null default 0,   -- para orden custom en la strip
  created_at timestamptz not null default now()
);
create index if not exists idx_demo_videos_position
  on public.demo_videos (position);
create index if not exists idx_demo_videos_category
  on public.demo_videos (category_slug);

alter table public.demo_videos enable row level security;
drop policy if exists demo_videos_public_read on public.demo_videos;
create policy demo_videos_public_read on public.demo_videos
  for select using (true);

-- ── Tabla per-tenant ──────────────────────────────────────────────────
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  youtube_id text not null,
  category_id uuid references public.course_categories(id) on delete set null,
  position int not null default 0,
  demo_ref text,                    -- slug del demo que este video customiza
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists idx_videos_tenant_pos
  on public.videos (tenant_id, position);
create index if not exists idx_videos_demo_ref
  on public.videos (tenant_id, demo_ref) where demo_ref is not null;

alter table public.videos enable row level security;

-- Lectura pública para storefront
drop policy if exists videos_public_read on public.videos;
create policy videos_public_read on public.videos
  for select using (true);

-- Owner/admin/staff del tenant tiene acceso completo
drop policy if exists videos_owner_all on public.videos;
create policy videos_owner_all on public.videos
  for all
  using (exists (
    select 1 from public.memberships m
    where m.tenant_id = videos.tenant_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'staff')
      and m.status = 'active'
  ))
  with check (exists (
    select 1 from public.memberships m
    where m.tenant_id = videos.tenant_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'staff')
      and m.status = 'active'
  ));

-- ── Populator del pool global ─────────────────────────────────────────
-- 4 videos demo cubriendo temas evergreen (educativos, no perecederos).
insert into public.demo_videos (slug, title, description, youtube_id, category_slug, position)
values
  ('agua-ia',           '¿Cuánta agua consume la inteligencia artificial?', 'Los datacenters que entrenan modelos como ChatGPT necesitan cantidades gigantes de agua para refrigeración.', 'gr2sJB7SP6U', 'sub-tecnologia', 0),
  ('computadora-cuantica', '¿Qué es una computadora cuántica?', 'La próxima revolución tecnológica explicada en 60 segundos.', 'YTOJBByHju0', 'sub-tecnologia', 1),
  ('revolucion-francesa',  'La Revolución Francesa en 60 segundos', 'Un resumen express del evento que cambió la historia moderna.', 'XsHsJKjCyu0', 'mundo', 2),
  ('motor-reaccion',    'Prueba de un motor a reacción', 'Ingeniería aeroespacial mostrada en vivo.', '3pOTYZ0qsWs', null, 3)
on conflict (slug) do nothing;
