-- ═══════════════════════════════════════════════════════════════
-- 🚨 CORRER ESTO EN SUPABASE SQL EDITOR — fix "recurso no existe"
-- ═══════════════════════════════════════════════════════════════
-- Combina las migrations 0011 + 0012 + 0013 en un solo bloque
-- idempotente. Pegalo entero y dale RUN. Tarda 1 segundo.
--
-- Después borrar este archivo (es solo el bundle).
-- ═══════════════════════════════════════════════════════════════

-- ── 0011 Checkout custom ──────────────────────────────────────
alter table public.tenants
  add column if not exists checkout_config jsonb default '{}'::jsonb;

alter table public.courses
  add column if not exists checkout_config jsonb;

alter table public.enrollments
  add column if not exists buyer_extra jsonb default '{}'::jsonb;

alter table public.sales
  add column if not exists buyer_extra jsonb default '{}'::jsonb;

-- ── 0012 Calendar ─────────────────────────────────────────────
alter table public.courses
  add column if not exists calendar_mode text default 'none';
do $$ begin
  alter table public.courses
    add constraint courses_calendar_mode_check
    check (calendar_mode in ('none', 'start_date', 'mentorship_slot'));
exception when duplicate_object then null; end $$;

alter table public.courses add column if not exists calendar_label text;
alter table public.courses add column if not exists calendar_required boolean default true;
alter table public.courses add column if not exists calendar_horizon_days smallint default 30;

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  slot_duration_min smallint not null default 60 check (slot_duration_min between 5 and 480),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);
create index if not exists availability_rules_tenant_weekday_idx
  on public.availability_rules (tenant_id, weekday);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  buyer_email text,
  buyer_name text,
  notes text,
  created_at timestamptz not null default now(),
  check (slot_end > slot_start)
);
create unique index if not exists bookings_no_double_booking
  on public.bookings (tenant_id, slot_start)
  where status <> 'cancelled';
create index if not exists bookings_tenant_course_idx
  on public.bookings (tenant_id, course_id, slot_start);

alter table public.enrollments add column if not exists booking_date date;
alter table public.enrollments add column if not exists booking_id uuid
  references public.bookings(id) on delete set null;

alter table public.availability_rules enable row level security;
drop policy if exists "availability_rules: tenant owners" on public.availability_rules;
create policy "availability_rules: tenant owners" on public.availability_rules
  for all using (
    exists (select 1 from public.memberships m
      where m.tenant_id = availability_rules.tenant_id
        and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );
drop policy if exists "availability_rules: public read" on public.availability_rules;
create policy "availability_rules: public read" on public.availability_rules
  for select using (true);

alter table public.bookings enable row level security;
drop policy if exists "bookings: tenant owners" on public.bookings;
create policy "bookings: tenant owners" on public.bookings
  for all using (
    exists (select 1 from public.memberships m
      where m.tenant_id = bookings.tenant_id
        and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );
drop policy if exists "bookings: public read slots" on public.bookings;
create policy "bookings: public read slots" on public.bookings
  for select using (status <> 'cancelled');

-- ── 0013 Subscriptions ────────────────────────────────────────
alter table public.courses
  add column if not exists pricing_mode text default 'one_time';
do $$ begin
  alter table public.courses
    add constraint courses_pricing_mode_check
    check (pricing_mode in ('one_time', 'subscription'));
exception when duplicate_object then null; end $$;

alter table public.courses add column if not exists subscription_frequency text;
do $$ begin
  alter table public.courses
    add constraint courses_subscription_frequency_check
    check (subscription_frequency in ('monthly', 'yearly') or subscription_frequency is null);
exception when duplicate_object then null; end $$;

alter table public.courses add column if not exists subscription_trial_days smallint default 0;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  external_provider text not null default 'mercadopago',
  preapproval_id text not null,
  status text not null default 'pending',
  frequency text not null,
  amount_cents int not null,
  currency text not null,
  started_at timestamptz default now(),
  next_billing_at timestamptz,
  cancelled_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (external_provider, preapproval_id)
);
create index if not exists subscriptions_tenant_status_idx on public.subscriptions (tenant_id, status);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions: tenant owners" on public.subscriptions;
create policy "subscriptions: tenant owners" on public.subscriptions
  for all using (
    exists (select 1 from public.memberships m
      where m.tenant_id = subscriptions.tenant_id
        and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );
drop policy if exists "subscriptions: self user" on public.subscriptions;
create policy "subscriptions: self user" on public.subscriptions
  for select using (user_id = auth.uid());

-- ── 0014 Instructores ────────────────────────────────────────
create table if not exists public.course_instructors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  can_edit_calendar boolean not null default false,
  can_reschedule    boolean not null default false,
  can_view_students boolean not null default true,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index if not exists course_instructors_tenant_user_idx
  on public.course_instructors (tenant_id, user_id);
create index if not exists course_instructors_course_idx
  on public.course_instructors (course_id);

alter table public.course_instructors enable row level security;
drop policy if exists "course_instructors: tenant owner full" on public.course_instructors;
create policy "course_instructors: tenant owner full" on public.course_instructors
  for all using (
    exists (select 1 from public.memberships m
      where m.tenant_id = course_instructors.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'owner' and m.status = 'active')
  );
drop policy if exists "course_instructors: instructor self read" on public.course_instructors;
create policy "course_instructors: instructor self read" on public.course_instructors
  for select using (user_id = auth.uid());

-- ── 0015 Per-instructor availability ─────────────────────────
alter table public.availability_rules
  add column if not exists instructor_user_id uuid references auth.users(id) on delete cascade;
create index if not exists availability_rules_instructor_idx
  on public.availability_rules (tenant_id, instructor_user_id, weekday);

alter table public.bookings
  add column if not exists instructor_user_id uuid references auth.users(id) on delete set null;
create index if not exists bookings_instructor_idx
  on public.bookings (instructor_user_id, slot_start);

drop index if exists public.bookings_no_double_booking;
create unique index if not exists bookings_no_double_per_instructor
  on public.bookings (tenant_id, coalesce(instructor_user_id::text, '_tenant'), slot_start)
  where status <> 'cancelled';

drop policy if exists "availability_rules: instructor self CRUD" on public.availability_rules;
create policy "availability_rules: instructor self CRUD" on public.availability_rules
  for all using (
    instructor_user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = availability_rules.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'instructor' and m.status = 'active'
    )
  );

-- ✓ Listo. Recargá la app.
