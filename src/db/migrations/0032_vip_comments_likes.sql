-- =====================================================================
-- 0032_vip_comments_likes.sql
-- Interacción en packs VIP: comentarios y likes por item.
-- Solo usuarios enrolled pueden comentar/likear (validado en server actions).
-- =====================================================================

create table if not exists public.vip_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  item_id text not null,                          -- id del item dentro de media_items jsonb
  user_id uuid not null references auth.users(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_vip_comments_item on public.vip_comments(course_id, item_id, created_at desc);

create table if not exists public.vip_likes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  item_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, item_id, user_id)
);
create index if not exists idx_vip_likes_item on public.vip_likes(course_id, item_id);

alter table public.vip_comments enable row level security;
alter table public.vip_likes    enable row level security;

-- RLS: cualquier enrolled del course puede leer + insertar.
-- Para el MVP usamos service_role en server actions, así que basta con
-- bloquear el access anon directo.
drop policy if exists vip_comments_owner on public.vip_comments;
create policy vip_comments_owner on public.vip_comments
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.memberships m
               where m.tenant_id = vip_comments.tenant_id
                 and m.user_id = auth.uid()
                 and m.role in ('owner','admin','staff'))
  );

drop policy if exists vip_likes_owner on public.vip_likes;
create policy vip_likes_owner on public.vip_likes
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.memberships m
               where m.tenant_id = vip_likes.tenant_id
                 and m.user_id = auth.uid()
                 and m.role in ('owner','admin','staff'))
  );
