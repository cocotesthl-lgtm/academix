-- 0018_event_tickets.sql
-- ──────────────────────────────────────────────────────────────────
-- Sistema de tickets para eventos (clase presencial, taller, show, etc).
-- Distinto a mentorship_slot (1-a-1, 1 hora):
--   - Un evento = un calendar_dates row con capacity.
--   - El comprador compra N tickets (1..capacity).
--   - 2 modos: 'general' (sin asientos) o 'grid' (asientos numerados).
--
-- Cada ticket vendido es una fila en event_tickets — permite emitir QR,
-- chequear in, refundear individual, etc.
-- ──────────────────────────────────────────────────────────────────

-- Sumar 'event_tickets' al enum de calendar_mode
do $$ begin
  alter table public.courses drop constraint if exists courses_calendar_mode_check;
  alter table public.courses
    add constraint courses_calendar_mode_check
    check (calendar_mode in ('none', 'start_date', 'mentorship_slot', 'event_tickets'));
exception when undefined_object then null; end $$;

-- Extender calendar_dates con campos de evento
alter table public.calendar_dates
  add column if not exists capacity smallint default 0,
  add column if not exists seat_mode text default 'none',
  add column if not exists seat_rows smallint default 0,
  add column if not exists seat_cols smallint default 0;
do $$ begin
  alter table public.calendar_dates
    add constraint calendar_dates_seat_mode_check
    check (seat_mode in ('none', 'grid'));
exception when duplicate_object then null; end $$;

-- Tickets vendidos
create table if not exists public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  calendar_date_id uuid references public.calendar_dates(id) on delete set null,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  -- Para asientos numerados (seat_mode='grid'): "R3-S15" o similar
  seat_label text,
  buyer_email text,
  buyer_name text,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'used', 'cancelled', 'refunded')),
  -- Para emitir QR de check-in en futuro
  qr_token text unique default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);
create index if not exists event_tickets_date_idx
  on public.event_tickets (calendar_date_id, status);
create index if not exists event_tickets_user_idx
  on public.event_tickets (user_id, status);
create index if not exists event_tickets_tenant_course_idx
  on public.event_tickets (tenant_id, course_id);

-- Anti double-booking de asiento: 1 ticket activo por (date, seat_label)
create unique index if not exists event_tickets_no_double_seat
  on public.event_tickets (calendar_date_id, seat_label)
  where seat_label is not null and status not in ('cancelled', 'refunded');

-- RLS
alter table public.event_tickets enable row level security;

drop policy if exists "event_tickets: tenant owner" on public.event_tickets;
create policy "event_tickets: tenant owner" on public.event_tickets
  for all using (
    exists (select 1 from public.memberships m
      where m.tenant_id = event_tickets.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists "event_tickets: instructor of course" on public.event_tickets;
create policy "event_tickets: instructor of course" on public.event_tickets
  for select using (
    exists (select 1 from public.course_instructors ci
      where ci.course_id = event_tickets.course_id
        and ci.user_id = auth.uid()
        and ci.can_view_students = true)
  );

drop policy if exists "event_tickets: self" on public.event_tickets;
create policy "event_tickets: self" on public.event_tickets
  for select using (user_id = auth.uid());
