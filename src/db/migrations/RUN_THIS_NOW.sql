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

-- ── 0016 User blocks tenant ──────────────────────────────────
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

alter table public.user_tenant_blocks enable row level security;
drop policy if exists "blocks: self CRUD" on public.user_tenant_blocks;
create policy "blocks: self CRUD" on public.user_tenant_blocks
  for all using (user_id = auth.uid());

-- ── 0017 Calendario completo: source + fechas puntuales + pausas ──
alter table public.courses
  add column if not exists calendar_source text default 'instructor';
do $$ begin
  alter table public.courses
    add constraint courses_calendar_source_check
    check (calendar_source in ('instructor', 'owner'));
exception when duplicate_object then null; end $$;

create table if not exists public.calendar_dates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  instructor_user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  slot_duration_min smallint not null default 60 check (slot_duration_min between 5 and 480),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  notes text,
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);
create index if not exists calendar_dates_tenant_date_idx on public.calendar_dates (tenant_id, date);
create index if not exists calendar_dates_instructor_idx on public.calendar_dates (instructor_user_id, date) where instructor_user_id is not null;
create index if not exists calendar_dates_course_idx on public.calendar_dates (course_id, date) where course_id is not null;

create table if not exists public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  instructor_user_id uuid references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index if not exists availability_overrides_tenant_idx on public.availability_overrides (tenant_id, start_at);

alter table public.calendar_dates enable row level security;
drop policy if exists "calendar_dates: tenant owner" on public.calendar_dates;
create policy "calendar_dates: tenant owner" on public.calendar_dates
  for all using (
    exists (select 1 from public.memberships m
      where m.tenant_id = calendar_dates.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'owner' and m.status = 'active')
  );
drop policy if exists "calendar_dates: instructor self" on public.calendar_dates;
create policy "calendar_dates: instructor self" on public.calendar_dates
  for all using (
    instructor_user_id = auth.uid()
    and exists (select 1 from public.memberships m
      where m.tenant_id = calendar_dates.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'instructor' and m.status = 'active')
  );
drop policy if exists "calendar_dates: public read" on public.calendar_dates;
create policy "calendar_dates: public read" on public.calendar_dates
  for select using (true);

alter table public.availability_overrides enable row level security;
drop policy if exists "overrides: tenant owner" on public.availability_overrides;
create policy "overrides: tenant owner" on public.availability_overrides
  for all using (
    exists (select 1 from public.memberships m
      where m.tenant_id = availability_overrides.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'owner' and m.status = 'active')
  );
drop policy if exists "overrides: instructor self" on public.availability_overrides;
create policy "overrides: instructor self" on public.availability_overrides
  for all using (
    instructor_user_id = auth.uid()
    and exists (select 1 from public.memberships m
      where m.tenant_id = availability_overrides.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'instructor' and m.status = 'active')
  );
drop policy if exists "overrides: public read" on public.availability_overrides;
create policy "overrides: public read" on public.availability_overrides
  for select using (true);

-- ── 0018 Event tickets ───────────────────────────────────────
do $$ begin
  alter table public.courses drop constraint if exists courses_calendar_mode_check;
  alter table public.courses
    add constraint courses_calendar_mode_check
    check (calendar_mode in ('none', 'start_date', 'mentorship_slot', 'event_tickets'));
exception when undefined_object then null; end $$;

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

create table if not exists public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  calendar_date_id uuid references public.calendar_dates(id) on delete set null,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  seat_label text,
  buyer_email text,
  buyer_name text,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'used', 'cancelled', 'refunded')),
  qr_token text unique default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);
create index if not exists event_tickets_date_idx on public.event_tickets (calendar_date_id, status);
create index if not exists event_tickets_user_idx on public.event_tickets (user_id, status);
create index if not exists event_tickets_tenant_course_idx on public.event_tickets (tenant_id, course_id);

create unique index if not exists event_tickets_no_double_seat
  on public.event_tickets (calendar_date_id, seat_label)
  where seat_label is not null and status not in ('cancelled', 'refunded');

alter table public.event_tickets enable row level security;
drop policy if exists "event_tickets: tenant owner" on public.event_tickets;
create policy "event_tickets: tenant owner" on public.event_tickets
  for all using (
    exists (select 1 from public.memberships m
      where m.tenant_id = event_tickets.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'owner' and m.status = 'active')
  );
drop policy if exists "event_tickets: self" on public.event_tickets;
create policy "event_tickets: self" on public.event_tickets
  for select using (user_id = auth.uid());

-- ── 0019 Seat zones (V2) ──────────────────────────────────────
do $$ begin
  alter table public.calendar_dates drop constraint if exists calendar_dates_seat_mode_check;
  alter table public.calendar_dates
    add constraint calendar_dates_seat_mode_check
    check (seat_mode in ('none', 'grid', 'zones'));
exception when undefined_object then null; end $$;

alter table public.calendar_dates
  add column if not exists seat_zones jsonb default '[]'::jsonb;

-- ── 0020 Ticket validation (QR + scanner) ─────────────────────
alter table public.event_tickets
  add column if not exists qr_token text,
  add column if not exists order_number text,
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists validation_count integer not null default 0;

update public.event_tickets
  set qr_token = replace(replace(replace(encode(gen_random_bytes(9), 'base64'), '+', ''), '/', ''), '=', '')
  where qr_token is null;

update public.event_tickets
  set order_number = upper(substr(replace(replace(encode(gen_random_bytes(5), 'base64'), '+', ''), '/', ''), 1, 6))
  where order_number is null;

create unique index if not exists event_tickets_qr_token_uniq
  on public.event_tickets (qr_token);
create index if not exists event_tickets_order_number_idx
  on public.event_tickets (order_number);

alter table public.calendar_dates
  add column if not exists allow_ticket_reentry boolean not null default false;

-- ── 0021 Tenant email branding ────────────────────────────────
alter table public.tenants
  add column if not exists email_header_image_url text,
  add column if not exists email_banner_image_url text,
  add column if not exists email_footer_message text;

-- ── 0022 Affiliate validators ─────────────────────────────────
alter table public.memberships
  add column if not exists can_validate_tickets boolean not null default false;
create index if not exists memberships_validator_idx
  on public.memberships (tenant_id, role)
  where can_validate_tickets = true;

-- ── 0023 Plans + subscriptions ────────────────────────────────
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null,
  tagline text, description text,
  position integer not null default 0,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  price_cents_monthly integer not null default 0,
  price_cents_annual integer not null default 0,
  currency text not null default 'ARS',
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenants
  add column if not exists plan_id uuid references public.plans(id) on delete set null,
  add column if not exists billing_period text not null default 'monthly'
    check (billing_period in ('monthly', 'annual')),
  add column if not exists subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'past_due', 'cancelled', 'paused')),
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists last_paid_at timestamptz;

create table if not exists public.plan_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, description text,
  discount_type text not null default 'percent'
    check (discount_type in ('percent', 'fixed')),
  discount_value integer not null default 0,
  plan_ids uuid[] not null default '{}',
  applies_to text not null default 'both'
    check (applies_to in ('monthly', 'annual', 'both')),
  max_uses integer, used_count integer not null default 0,
  expires_at timestamptz, is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null, message text not null,
  cta_label text, cta_href text, promo_code text,
  bg_color text default '#a855f7', text_color text default '#ffffff',
  plan_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.plans (slug, name, tagline, description, position, is_featured, price_cents_monthly, price_cents_annual, features)
select * from (values
  ('initial', 'Initial', 'Para empezar tu academia', 'Lo esencial para vender tus primeros cursos o eventos.', 1, false, 999000, 9990000,
    '{"domains_max":0,"email_marketing_monthly":500,"storage_gb":1,"uploads_enabled":true,"featured_listings":0,"support_sla_hours":48,"support_priority":false,"extras":[]}'::jsonb),
  ('medium', 'Medium', 'Para academias en crecimiento', 'Más espacio, dominio propio, marketing y soporte rápido.', 2, true, 2499000, 24990000,
    '{"domains_max":1,"email_marketing_monthly":5000,"storage_gb":10,"uploads_enabled":true,"featured_listings":1,"support_sla_hours":12,"support_priority":false,"extras":["Email marketing a clientes","Banner destacado mensual"]}'::jsonb),
  ('pro', 'Pro', 'Para academias con volumen', 'Todo ilimitado, dominios múltiples y soporte prioritario.', 3, false, 5999000, 59990000,
    '{"domains_max":3,"email_marketing_monthly":25000,"storage_gb":50,"uploads_enabled":true,"featured_listings":999,"support_sla_hours":2,"support_priority":true,"extras":["Insignia premium","API access","Manager dedicado"]}'::jsonb)
) as new_plans(slug, name, tagline, description, position, is_featured, price_cents_monthly, price_cents_annual, features)
where not exists (select 1 from public.plans);

alter table public.plans enable row level security;
drop policy if exists "plans: public read active" on public.plans;
create policy "plans: public read active" on public.plans for select using (is_active = true);
drop policy if exists "plans: founder write" on public.plans;
create policy "plans: founder write" on public.plans for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_super_admin = true)
);

alter table public.plan_promo_codes enable row level security;
drop policy if exists "promo_codes: founder all" on public.plan_promo_codes;
create policy "promo_codes: founder all" on public.plan_promo_codes for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_super_admin = true)
);

alter table public.plan_announcements enable row level security;
drop policy if exists "announcements: public read active" on public.plan_announcements;
create policy "announcements: public read active" on public.plan_announcements
  for select using (is_active = true and (expires_at is null or expires_at > now()));
drop policy if exists "announcements: founder write" on public.plan_announcements;
create policy "announcements: founder write" on public.plan_announcements for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_super_admin = true)
);

-- ✓ Listo. Recargá la app.
