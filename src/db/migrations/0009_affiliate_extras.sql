-- 0009_affiliate_extras.sql
--
-- Recursos extra para el sistema de afiliados:
--   - promo_materials: banners, copys, videos, PDFs que el owner pone a
--     disposición de sus afiliados (URLs externas, sin storage propio).
--   - community_links: invitaciones a grupos (WhatsApp, Telegram, Discord,
--     Reddit, Facebook, etc) que el owner publica para sus afiliados.
--   - affiliate_broadcasts: mensajes que el owner manda a TODOS sus
--     afiliados (anuncios, novedades, campañas).
--   - affiliate_message_reads: track de quién leyó cada broadcast para
--     mostrar badge "no leído" en el panel del afiliado.
--
-- Aplicar en Supabase SQL editor.

create table if not exists public.promo_materials (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  type         text not null default 'asset', -- 'banner' | 'video' | 'copy' | 'image' | 'pdf' | 'asset'
  title        text not null,
  description  text,
  asset_url    text,                          -- URL externa (Drive, Imgur, Vimeo, etc)
  copy_text    text,                          -- texto sugerido para copy-paste en mails/posts
  thumbnail_url text,
  position     int default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists promo_materials_tenant_idx on public.promo_materials (tenant_id, position);

create table if not exists public.community_links (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  network     text not null,                  -- 'whatsapp'|'telegram'|'discord'|'facebook'|'reddit'|'instagram'|'other'
  label       text not null,
  url         text not null,
  description text,
  audience    text not null default 'affiliates', -- 'affiliates'|'students'|'all'
  position    int default 0,
  created_at  timestamptz not null default now()
);
create index if not exists community_links_tenant_idx on public.community_links (tenant_id, audience, position);

create table if not exists public.affiliate_broadcasts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  author_user_id  uuid references public.profiles(id) on delete set null,
  subject         text not null,
  body            text not null,
  pinned          boolean default false,
  created_at      timestamptz not null default now()
);
create index if not exists affiliate_broadcasts_tenant_idx on public.affiliate_broadcasts (tenant_id, pinned desc, created_at desc);

create table if not exists public.affiliate_message_reads (
  message_id         uuid not null references public.affiliate_broadcasts(id) on delete cascade,
  affiliate_user_id  uuid not null references public.profiles(id) on delete cascade,
  read_at            timestamptz not null default now(),
  primary key (message_id, affiliate_user_id)
);
-- Lookup "qué mensajes leyó este afiliado" en el panel del afiliado (panel
-- listing). El PK indexa por message_id primero, este índice cubre el camino
-- inverso (por afiliado).
create index if not exists affiliate_message_reads_user_idx
  on public.affiliate_message_reads (affiliate_user_id);

-- RLS: lectura abierta a owners y afiliados del tenant. Mutaciones vía service-role
-- desde las server actions del owner.
alter table public.promo_materials       enable row level security;
alter table public.community_links       enable row level security;
alter table public.affiliate_broadcasts  enable row level security;
alter table public.affiliate_message_reads enable row level security;

drop policy if exists "tenant members read promo materials" on public.promo_materials;
create policy "tenant members read promo materials" on public.promo_materials
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = promo_materials.tenant_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

drop policy if exists "tenant members read community links" on public.community_links;
create policy "tenant members read community links" on public.community_links
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = community_links.tenant_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

drop policy if exists "tenant affiliates read broadcasts" on public.affiliate_broadcasts;
create policy "tenant affiliates read broadcasts" on public.affiliate_broadcasts
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = affiliate_broadcasts.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('affiliate','owner')
        and m.status = 'active'
    )
  );

drop policy if exists "affiliates manage their own reads" on public.affiliate_message_reads;
create policy "affiliates manage their own reads" on public.affiliate_message_reads
  for all using (affiliate_user_id = auth.uid())
  with check (affiliate_user_id = auth.uid());
