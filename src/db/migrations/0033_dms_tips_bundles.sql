-- =====================================================================
-- 0033_dms_tips_bundles.sql
-- Tres features de Fase 7 en una migration:
--  1) DMs: mensajes 1:1 entre fan y owner/staff
--  2) Tips: propinas/donaciones extra (top-up sobre un pack)
--  3) Bundles: pack de packs con descuento
-- =====================================================================

-- ── DM threads + messages ───────────────────────────────────
create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  -- Última actividad para ordenar inbox
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  unread_for_owner int not null default 0,
  unread_for_fan   int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, fan_user_id)
);
create index if not exists idx_dm_threads_tenant_last on public.dm_threads(tenant_id, last_message_at desc);
create index if not exists idx_dm_threads_fan on public.dm_threads(fan_user_id);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  -- 'fan' o 'owner' (denormalizado para queries rápidas sin join a memberships)
  sender_kind text not null check (sender_kind in ('fan', 'owner')),
  body text not null,
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_dm_messages_thread on public.dm_messages(thread_id, created_at);

alter table public.dm_threads  enable row level security;
alter table public.dm_messages enable row level security;

-- Threads: fan ve los suyos, owner/staff ve todos los del tenant
drop policy if exists dm_threads_access on public.dm_threads;
create policy dm_threads_access on public.dm_threads
  for select using (
    auth.uid() = fan_user_id
    or exists (select 1 from public.memberships m
               where m.tenant_id = dm_threads.tenant_id and m.user_id = auth.uid()
                 and m.role in ('owner','admin','staff'))
  );

drop policy if exists dm_messages_access on public.dm_messages;
create policy dm_messages_access on public.dm_messages
  for select using (
    exists (select 1 from public.dm_threads t
            where t.id = dm_messages.thread_id
              and (t.fan_user_id = auth.uid()
                   or exists (select 1 from public.memberships m
                              where m.tenant_id = t.tenant_id and m.user_id = auth.uid()
                                and m.role in ('owner','admin','staff'))))
  );

-- ── Tips (propinas) ─────────────────────────────────────────
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,  -- opcional: tip para un pack específico
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null,
  currency text not null default 'ARS',
  message text,
  -- Estado del cobro vía MP
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  external_provider text default 'mercadopago',
  external_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_tips_tenant on public.tips(tenant_id, created_at desc);
create index if not exists idx_tips_course on public.tips(course_id) where course_id is not null;
create index if not exists idx_tips_external on public.tips(external_provider, external_id);

alter table public.tips enable row level security;

drop policy if exists tips_access on public.tips;
create policy tips_access on public.tips
  for select using (
    auth.uid() = fan_user_id
    or exists (select 1 from public.memberships m
               where m.tenant_id = tips.tenant_id and m.user_id = auth.uid()
                 and m.role in ('owner','admin','staff'))
  );

-- ── Bundles (pack de packs) ─────────────────────────────────
create table if not exists public.bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  cover_url text,
  price_cents bigint not null default 0,
  currency text not null default 'ARS',
  status text not null default 'draft' check (status in ('draft','published')),
  -- Discount visual: cuánto "ahorrarían" comprando suelto (display only)
  list_price_cents bigint default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists idx_bundles_tenant on public.bundles(tenant_id);

create table if not exists public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null default 0,
  unique (bundle_id, course_id)
);
create index if not exists idx_bundle_items_bundle on public.bundle_items(bundle_id, position);

alter table public.bundles enable row level security;
alter table public.bundle_items enable row level security;

drop policy if exists bundles_owner_all on public.bundles;
create policy bundles_owner_all on public.bundles
  for all using (
    exists (select 1 from public.memberships m
            where m.tenant_id = bundles.tenant_id and m.user_id = auth.uid()
              and m.role in ('owner','admin'))
  ) with check (
    exists (select 1 from public.memberships m
            where m.tenant_id = bundles.tenant_id and m.user_id = auth.uid()
              and m.role in ('owner','admin'))
  );

drop policy if exists bundle_items_owner_all on public.bundle_items;
create policy bundle_items_owner_all on public.bundle_items
  for all using (
    exists (select 1 from public.bundles b
            join public.memberships m on m.tenant_id = b.tenant_id and m.user_id = auth.uid()
              and m.role in ('owner','admin')
            where b.id = bundle_items.bundle_id)
  ) with check (
    exists (select 1 from public.bundles b
            join public.memberships m on m.tenant_id = b.tenant_id and m.user_id = auth.uid()
              and m.role in ('owner','admin')
            where b.id = bundle_items.bundle_id)
  );
