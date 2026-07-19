-- =====================================================================
-- 0082_whatsapp_broadcast_scheduled.sql
-- Broadcasts (envío masivo a N conversaciones) + mensajes agendados
-- (programados para enviar más tarde).
--
-- Broadcast: 1 row en whatsapp_broadcasts + N rows en whatsapp_broadcast_jobs
-- (uno por destinatario). Un cron los procesa con throttling suave.
--
-- Scheduled: 1 row por mensaje agendado. Mismo cron los procesa cuando
-- vence su send_at.
-- =====================================================================

-- ── Broadcasts ──────────────────────────────────────────────────
create table if not exists public.whatsapp_broadcasts (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  name           text not null,
  message_body   text not null,
  status         text not null default 'draft',  -- draft | sending | done | cancelled
  total_recipients int default 0,
  sent_count       int default 0,
  failed_count     int default 0,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  completed_at     timestamptz
);
create index if not exists idx_wa_bcast_tenant on public.whatsapp_broadcasts (tenant_id, created_at desc);
alter table public.whatsapp_broadcasts enable row level security;
drop policy if exists wa_bcast_owner on public.whatsapp_broadcasts;
create policy wa_bcast_owner on public.whatsapp_broadcasts
  for all using (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_user_id = auth.uid())
  );

create table if not exists public.whatsapp_broadcast_jobs (
  id                uuid primary key default gen_random_uuid(),
  broadcast_id      uuid not null references public.whatsapp_broadcasts(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  conversation_id   uuid references public.whatsapp_conversations(id) on delete set null,
  wa_customer_id    text not null,
  status            text not null default 'pending',  -- pending | sending | sent | failed
  wa_message_id     text,
  error_message     text,
  scheduled_at      timestamptz not null default now(),  -- cuándo mandarlo (para throttling)
  sent_at           timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_wa_bcast_jobs_pending on public.whatsapp_broadcast_jobs (tenant_id, status, scheduled_at)
  where status = 'pending';
alter table public.whatsapp_broadcast_jobs enable row level security;
drop policy if exists wa_bcast_jobs_owner on public.whatsapp_broadcast_jobs;
create policy wa_bcast_jobs_owner on public.whatsapp_broadcast_jobs
  for all using (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_user_id = auth.uid())
  );

-- ── Scheduled messages ──────────────────────────────────────────
create table if not exists public.whatsapp_scheduled_messages (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  conversation_id   uuid not null references public.whatsapp_conversations(id) on delete cascade,
  wa_customer_id    text not null,
  body              text not null,
  status            text not null default 'pending', -- pending | sent | cancelled | failed
  send_at           timestamptz not null,
  sent_at           timestamptz,
  wa_message_id     text,
  error_message     text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now()
);
create index if not exists idx_wa_sched_pending on public.whatsapp_scheduled_messages (tenant_id, status, send_at)
  where status = 'pending';
alter table public.whatsapp_scheduled_messages enable row level security;
drop policy if exists wa_sched_owner on public.whatsapp_scheduled_messages;
create policy wa_sched_owner on public.whatsapp_scheduled_messages
  for all using (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_user_id = auth.uid())
  );
