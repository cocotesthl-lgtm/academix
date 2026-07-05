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

-- ── 0028 Tenant subscription notes (founder) ─────────────────
alter table public.tenants
  add column if not exists subscription_notes text;

-- ── 0029 Course ribbon ────────────────────────────────────────
alter table public.courses
  add column if not exists ribbon_text text,
  add column if not exists ribbon_tone text default 'featured';
do $$ begin
  alter table public.courses
    add constraint courses_ribbon_tone_check
    check (ribbon_tone in ('featured', 'sale', 'urgent', 'new', 'info'));
exception when duplicate_object then null; end $$;

-- ── 0030 Forms + CRM (MVP) ────────────────────────────────────
create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  success_message text default '¡Gracias! Recibimos tu mensaje.',
  redirect_url text,
  submit_label text default 'Enviar',
  default_pipeline_id uuid,
  default_stage_id uuid,
  notify_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists idx_forms_tenant on public.forms(tenant_id);

create table if not exists public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  position int not null default 0,
  field_type text not null,
  name text not null,
  label text not null,
  placeholder text,
  required boolean not null default false,
  options jsonb,
  help_text text,
  created_at timestamptz not null default now(),
  unique (form_id, name)
);
do $$ begin
  alter table public.form_fields add constraint form_fields_type_check
    check (field_type in ('text','email','phone','textarea','select','checkbox','number'));
exception when duplicate_object then null; end $$;
create index if not exists idx_form_fields_form on public.form_fields(form_id, position);

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  submitter_email text,
  submitter_name text,
  submitter_phone text,
  source_url text,
  user_agent text,
  ip_hash text,
  lead_id uuid,
  submitted_at timestamptz not null default now()
);
create index if not exists idx_form_submissions_form on public.form_submissions(form_id, submitted_at desc);
create index if not exists idx_form_submissions_tenant on public.form_submissions(tenant_id, submitted_at desc);

create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_pipelines_tenant on public.crm_pipelines(tenant_id);

create table if not exists public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  name text not null,
  color text default '#a855f7',
  position int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_stages_pipeline on public.crm_stages(pipeline_id, position);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  stage_id uuid not null references public.crm_stages(id) on delete restrict,
  name text,
  email text,
  phone text,
  value_cents bigint default 0,
  currency text default 'ARS',
  source text default 'manual',
  source_form_id uuid,
  source_submission_id uuid,
  data jsonb default '{}'::jsonb,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  notes text,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_crm_leads_tenant on public.crm_leads(tenant_id);
create index if not exists idx_crm_leads_stage on public.crm_leads(stage_id, position);
create index if not exists idx_crm_leads_assigned on public.crm_leads(assigned_to_user_id);

create table if not exists public.crm_lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  payload jsonb,
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_lead_activity_lead on public.crm_lead_activity(lead_id, created_at desc);

alter table public.forms enable row level security;
alter table public.form_fields enable row level security;
alter table public.form_submissions enable row level security;
alter table public.crm_pipelines enable row level security;
alter table public.crm_stages enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_lead_activity enable row level security;

-- ── 0031 VIP packs (courses generalizadas) ───────────────────
alter table public.courses
  add column if not exists product_type text default 'course',
  add column if not exists media_items jsonb default '[]'::jsonb,
  add column if not exists preview_url text,
  add column if not exists pack_description text;
do $$ begin
  alter table public.courses
    add constraint courses_product_type_check
    check (product_type in ('course', 'vip_pack'));
exception when duplicate_object then null; end $$;
create index if not exists idx_courses_type on public.courses(tenant_id, product_type);

-- ── 0032 VIP comments + likes ───────────────────────────────
create table if not exists public.vip_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  item_id text not null,
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

-- ── 0033 DMs + Tips + Bundles ───────────────────────────────
create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  unread_for_owner int not null default 0,
  unread_for_fan int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, fan_user_id)
);
create index if not exists idx_dm_threads_tenant_last on public.dm_threads(tenant_id, last_message_at desc);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_kind text not null,
  body text not null,
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.dm_messages add constraint dm_messages_kind_check
    check (sender_kind in ('fan','owner'));
exception when duplicate_object then null; end $$;
create index if not exists idx_dm_messages_thread on public.dm_messages(thread_id, created_at);

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null,
  currency text not null default 'ARS',
  message text,
  status text not null default 'pending',
  external_provider text default 'mercadopago',
  external_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.tips add constraint tips_status_check
    check (status in ('pending','paid','failed','refunded'));
exception when duplicate_object then null; end $$;
create index if not exists idx_tips_tenant on public.tips(tenant_id, created_at desc);

create table if not exists public.bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  cover_url text,
  price_cents bigint not null default 0,
  currency text not null default 'ARS',
  status text not null default 'draft',
  list_price_cents bigint default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create table if not exists public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null default 0,
  unique (bundle_id, course_id)
);

alter table public.dm_threads  enable row level security;
alter table public.dm_messages enable row level security;
alter table public.tips        enable row level security;
alter table public.bundles     enable row level security;
alter table public.bundle_items enable row level security;

-- ── 0034 Cart mode (toggle + tabla de órdenes multi-item) ───
alter table public.tenants
  add column if not exists cart_enabled boolean not null default false;

create table if not exists public.cart_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,        -- [{id, qty}]
  total_cents bigint not null,
  buyer_email text,
  buyer_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',           -- pending/paid/failed
  external_provider text default 'mercadopago',
  external_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.cart_orders add constraint cart_orders_status_check
    check (status in ('pending','paid','failed','refunded'));
exception when duplicate_object then null; end $$;
create index if not exists idx_cart_orders_tenant on public.cart_orders(tenant_id, created_at desc);
alter table public.cart_orders enable row level security;

-- ── 0026 Public listing + custom domains ─────────────────────
alter table public.tenants
  add column if not exists public_listing boolean not null default true,
  add column if not exists custom_domain text;
create unique index if not exists tenants_custom_domain_uniq
  on public.tenants (custom_domain) where custom_domain is not null;

create table if not exists public.tenant_domain_status (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  domain text not null,
  vercel_verified boolean not null default false,
  vercel_apex_a_record text,
  vercel_cname_target text,
  last_checked_at timestamptz,
  vercel_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 0025 Trial days per plan ──────────────────────────────────
alter table public.plans
  add column if not exists trial_days integer not null default 0;
-- 0027: reset trial a 0 (founder no quiere trials por default)
update public.plans set trial_days = 0;

-- ── 0024 Platform subscriptions ───────────────────────────────
create table if not exists public.platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  billing_period text not null check (billing_period in ('monthly', 'annual')),
  mp_preapproval_id text unique not null,
  status text not null default 'pending',
  amount_cents integer not null,
  currency text not null default 'ARS',
  promo_code text, raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platform_subs_tenant_idx
  on public.platform_subscriptions (tenant_id, status);

create table if not exists public.platform_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  mp_payment_id text unique not null,
  amount_cents integer not null, currency text not null,
  status text not null, occurred_at timestamptz not null,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_sub_payments_tenant_idx
  on public.platform_subscription_payments (tenant_id, occurred_at desc);

create table if not exists public.platform_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null, external_id text unique not null,
  raw jsonb, received_at timestamptz not null default now()
);

alter table public.platform_subscriptions enable row level security;
drop policy if exists "platform_subscriptions: owner read" on public.platform_subscriptions;
create policy "platform_subscriptions: owner read" on public.platform_subscriptions
  for select using (
    exists (select 1 from public.memberships m
      where m.tenant_id = platform_subscriptions.tenant_id
        and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

alter table public.platform_subscription_payments enable row level security;
drop policy if exists "platform_sub_payments: owner read" on public.platform_subscription_payments;
create policy "platform_sub_payments: owner read" on public.platform_subscription_payments
  for select using (
    exists (select 1 from public.memberships m
      where m.tenant_id = platform_subscription_payments.tenant_id
        and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

-- ── 0036 Ampliar product_type a tipos generales ───
do $$
begin
  alter table public.courses drop constraint if exists courses_product_type_check;
exception when undefined_table then null;
end $$;
alter table public.courses
  add constraint courses_product_type_check
  check (product_type in ('course','event','mentorship','vip_pack','digital','physical','service','multi_venue','restaurant'));

-- ── 0037 Multi-sede + reservas ───
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null, address text, phone text, notes text,
  active boolean not null default true, position int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_venues_tenant on public.venues(tenant_id, active);

create table if not exists public.course_venues (
  course_id uuid not null references public.courses(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  primary key (course_id, venue_id)
);
create index if not exists idx_course_venues_venue on public.course_venues(venue_id);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  customer_name text not null, customer_email text not null, customer_phone text,
  reservation_date date not null, reservation_time text,
  party_size smallint not null default 1,
  notes text, status text not null default 'pending',
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.reservations add constraint reservations_status_check
    check (status in ('pending','confirmed','cancelled','completed','no_show'));
exception when duplicate_object then null; end $$;
create index if not exists idx_reservations_tenant_date on public.reservations(tenant_id, reservation_date desc);
create index if not exists idx_reservations_course on public.reservations(course_id, reservation_date);

alter table public.venues enable row level security;
alter table public.course_venues enable row level security;
alter table public.reservations enable row level security;

do $$ begin
  create policy venues_public_read on public.venues for select using (active = true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy course_venues_public_read on public.course_venues for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy venues_owner_all on public.venues for all
    using (exists (select 1 from public.memberships m where m.tenant_id = venues.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'))
    with check (exists (select 1 from public.memberships m where m.tenant_id = venues.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy course_venues_owner_all on public.course_venues for all
    using (exists (
      select 1 from public.courses c
      join public.memberships m on m.tenant_id = c.tenant_id
      where c.id = course_venues.course_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    ));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy reservations_owner_read on public.reservations for select
    using (exists (select 1 from public.memberships m where m.tenant_id = reservations.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
exception when duplicate_object then null; end $$;

-- ── 0038 V2 venues: horarios + seña + emails ───
alter table public.venues add column if not exists hours jsonb not null default '{}'::jsonb;
alter table public.venues add column if not exists blackout_dates jsonb not null default '[]'::jsonb;
alter table public.venues add column if not exists slot_minutes smallint not null default 60;
alter table public.courses add column if not exists deposit_cents bigint not null default 0;
alter table public.courses add column if not exists deposit_required boolean not null default false;
alter table public.reservations add column if not exists deposit_paid boolean not null default false;
alter table public.reservations add column if not exists deposit_external_id text;

-- ── 0043 Cuentas / planes contratados ───
create table if not exists public.customer_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_name text not null, description text,
  monthly_amount_cents bigint not null default 0,
  currency text not null default 'ARS',
  status text not null default 'active',
  start_date date not null default current_date,
  end_date date, notes text, customer_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$ begin
  alter table public.customer_plans add constraint cp_status_check
    check (status in ('active','suspended','cancelled','finished'));
exception when duplicate_object then null; end $$;
create index if not exists idx_cp_tenant_status on public.customer_plans(tenant_id, status);
create index if not exists idx_cp_user on public.customer_plans(user_id);

create table if not exists public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.customer_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  number text, concept text not null,
  amount_cents bigint not null, currency text not null default 'ARS',
  issued_at date not null default current_date,
  due_at date,
  status text not null default 'pending',
  paid_at timestamptz, payment_method text, payment_ref text,
  paid_amount_cents bigint, notes text,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.customer_invoices add constraint ci_status_check
    check (status in ('pending','paid','overdue','cancelled','partial'));
exception when duplicate_object then null; end $$;
create index if not exists idx_ci_tenant_status on public.customer_invoices(tenant_id, status, due_at);
create index if not exists idx_ci_plan on public.customer_invoices(plan_id, issued_at desc);
create index if not exists idx_ci_user on public.customer_invoices(user_id, status, due_at);

alter table public.customer_plans enable row level security;
alter table public.customer_invoices enable row level security;
do $$ begin
  create policy cp_owner_all on public.customer_plans for all
    using (exists (select 1 from public.memberships m where m.tenant_id = customer_plans.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'))
    with check (exists (select 1 from public.memberships m where m.tenant_id = customer_plans.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy cp_self_read on public.customer_plans for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy ci_owner_all on public.customer_invoices for all
    using (exists (select 1 from public.memberships m where m.tenant_id = customer_invoices.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'))
    with check (exists (select 1 from public.memberships m where m.tenant_id = customer_invoices.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy ci_self_read on public.customer_invoices for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── 0042 Wallet transferencias + retiros ───
alter table public.tenants add column if not exists wallet_transfers_enabled boolean not null default false;
alter table public.tenants add column if not exists wallet_withdrawals_enabled boolean not null default false;
do $$ begin
  alter table public.wallet_transactions drop constraint if exists wallet_tx_kind_check;
exception when undefined_object then null; end $$;
alter table public.wallet_transactions add constraint wallet_tx_kind_check
  check (kind in ('topup','spend','refund','admin_adjust','transfer_out','transfer_in','withdrawal'));
create table if not exists public.wallet_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ARS',
  method text, destination text, note text,
  status text not null default 'pending',
  reject_reason text,
  withdrawal_tx_id uuid references public.wallet_transactions(id) on delete set null,
  refund_tx_id uuid references public.wallet_transactions(id) on delete set null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz, processed_by uuid references auth.users(id) on delete set null
);
do $$ begin
  alter table public.wallet_withdrawal_requests add constraint wwr_status_check
    check (status in ('pending','approved','rejected','paid'));
exception when duplicate_object then null; end $$;
create index if not exists idx_wwr_tenant_status on public.wallet_withdrawal_requests(tenant_id, status, requested_at desc);
create index if not exists idx_wwr_user on public.wallet_withdrawal_requests(user_id, requested_at desc);
alter table public.wallet_withdrawal_requests enable row level security;
do $$ begin
  create policy wwr_owner_read on public.wallet_withdrawal_requests for select
    using (exists (select 1 from public.memberships m where m.tenant_id = wallet_withdrawal_requests.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy wwr_self_read on public.wallet_withdrawal_requests for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── 0041 Wallets / saldo disponible ───
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  balance_cents bigint not null default 0,
  currency text not null default 'ARS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists idx_wallets_tenant on public.wallets(tenant_id, balance_cents desc);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null,
  balance_after_cents bigint not null,
  kind text not null,
  course_id uuid references public.courses(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  note text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.wallet_transactions add constraint wallet_tx_kind_check
    check (kind in ('topup','spend','refund','admin_adjust'));
exception when duplicate_object then null; end $$;
create index if not exists idx_wallet_tx_tenant_date on public.wallet_transactions(tenant_id, created_at desc);
create index if not exists idx_wallet_tx_user on public.wallet_transactions(user_id, created_at desc);

alter table public.courses add column if not exists topup_amount_cents bigint;

do $$ begin
  alter table public.courses drop constraint if exists courses_product_type_check;
exception when undefined_table then null; end $$;
alter table public.courses
  add constraint courses_product_type_check
  check (product_type in ('course','event','mentorship','vip_pack','digital','physical','service','multi_venue','restaurant','topup'));

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
do $$ begin
  create policy wallets_owner_read on public.wallets for select
    using (exists (select 1 from public.memberships m where m.tenant_id = wallets.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy wallets_self_read on public.wallets for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy wallet_tx_owner_read on public.wallet_transactions for select
    using (exists (select 1 from public.memberships m where m.tenant_id = wallet_transactions.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy wallet_tx_self_read on public.wallet_transactions for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── 0040 Trazabilidad de pago parcial ───
alter table public.sales add column if not exists payment_kind text;
do $$ begin
  alter table public.sales add constraint sales_payment_kind_check
    check (payment_kind is null or payment_kind in ('full','deposit'));
exception when duplicate_object then null; end $$;

-- ── 0039 Modo de pago de reservas ───
alter table public.courses add column if not exists payment_mode text not null default 'none';
do $$ begin
  alter table public.courses add constraint courses_payment_mode_check
    check (payment_mode in ('none','deposit','full','choice'));
exception when duplicate_object then null; end $$;
alter table public.courses add column if not exists deposit_percent smallint not null default 30;
do $$ begin
  alter table public.courses add constraint courses_deposit_percent_check
    check (deposit_percent between 1 and 99);
exception when duplicate_object then null; end $$;
update public.courses set payment_mode = 'deposit' where deposit_required = true and payment_mode = 'none';
alter table public.reservations add column if not exists payment_choice text;
alter table public.reservations add column if not exists payment_amount_cents bigint;

-- ── 0035 Labels editables sección "Contenido del curso" ───
alter table public.courses add column if not exists content_title text;
alter table public.courses add column if not exists module_label text;
alter table public.courses add column if not exists lesson_label text;
alter table public.courses add column if not exists show_content_section boolean not null default true;

-- ── 0050 Blog / CMS de artículos ──
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  excerpt text,
  cover_url text,
  body_html text not null default '',
  author_name text,
  category_id uuid references public.course_categories(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists idx_articles_tenant_status on public.articles (tenant_id, status, published_at desc);
alter table public.articles enable row level security;
drop policy if exists articles_owner_all on public.articles;
create policy articles_owner_all on public.articles for all using (public.is_tenant_owner(tenant_id)) with check (public.is_tenant_owner(tenant_id));
drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles for select using (status = 'published');

-- ── 0049 Botón flotante de WhatsApp ──
alter table public.tenants
  add column if not exists whatsapp_number text,
  add column if not exists whatsapp_greeting text,
  add column if not exists whatsapp_position text not null default 'right';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_whatsapp_position_check') then
    alter table public.tenants add constraint tenants_whatsapp_position_check
      check (whatsapp_position in ('left', 'right'));
  end if;
end $$;

-- ── 0048 Site draft vs published (builder Wix-style) ──
alter table public.tenants
  add column if not exists site_config_published jsonb,
  add column if not exists site_config_published_at timestamptz;
update public.tenants
  set site_config_published = site_config,
      site_config_published_at = coalesce(site_config_published_at, now())
  where site_config_published is null;

-- ── 0047 Flow 'Trabajá con nosotros' (afiliación) ──
alter table public.tenants
  add column if not exists affiliate_mode text not null default 'disabled',
  add column if not exists affiliate_commission_rate numeric(4,3),
  add column if not exists affiliate_terms text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_affiliate_mode_check') then
    alter table public.tenants add constraint tenants_affiliate_mode_check
      check (affiliate_mode in ('disabled', '1click', 'approval'));
  end if;
end $$;

-- ── 0046 Permisos modulares por membership ──
alter table public.memberships add column if not exists permissions jsonb;
update public.memberships
  set permissions = '{"catalog":["admin"],"calendar":["admin"],"crm":["admin"],"team":["admin"],"sales":["admin"],"site":["admin"]}'::jsonb
  where role = 'owner' and permissions is null;
update public.memberships
  set permissions = '{"catalog":["view"],"calendar":["edit"],"crm":["view"]}'::jsonb
  where role = 'instructor' and permissions is null;
update public.memberships
  set permissions = '{"crm":["view"],"sales":["view"]}'::jsonb
  where role = 'affiliate' and permissions is null;

-- ── 0045 Módulos activables por workspace ──
alter table public.tenants add column if not exists modules jsonb not null default
  '{"catalog":true,"calendar":true,"crm":true,"team":true,"sales":true,"site":true}'::jsonb;
update public.tenants set modules =
  '{"catalog":true,"calendar":true,"crm":true,"team":true,"sales":true,"site":true}'::jsonb
  where modules is null or modules = '{}'::jsonb;

-- ── 0044 Cart UI config (posición + modo dropdown vs página) ──
alter table public.tenants add column if not exists cart_position text not null default 'header';
alter table public.tenants add column if not exists cart_display text not null default 'dropdown';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_cart_position_check') then
    alter table public.tenants add constraint tenants_cart_position_check
      check (cart_position in ('header', 'floating', 'both'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_cart_display_check') then
    alter table public.tenants add constraint tenants_cart_display_check
      check (cart_display in ('dropdown', 'page'));
  end if;
end $$;

-- ── 0051 Ecommerce físico completo ──
-- Modelo mental:
--   physical_products
--     └─ product_variants  (opcional; si no hay, se usa stock/price del producto)
--     └─ product_stock_movements  (historial de ajustes de inventario)
--
--   shipping_zones (tenant)
--     └─ shipping_rates  (flat + free-from-threshold)
--
--   physical_orders
--     └─ physical_order_items
--
-- Nota: física vs curso comparte la tabla `sales` para reporting de ingresos.
-- El flujo del webhook MP debe insertar tanto en `sales` como en `physical_orders`
-- cuando el payment corresponde a una physical_order.

-- ============================================================
-- Productos
-- ============================================================
create table if not exists public.physical_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  cover_url text,
  gallery jsonb not null default '[]'::jsonb,  -- array de URLs
  price_cents int not null default 0,
  compare_at_price_cents int,  -- precio tachado (para mostrar descuento)
  currency text not null default 'ARS',
  sku text,
  stock_qty int not null default 0,  -- usado si no hay variantes
  track_stock boolean not null default true,  -- false = stock ilimitado
  weight_g int,  -- opcional, por si integramos cotización real
  requires_shipping boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published')),
  category_id uuid references public.course_categories(id) on delete set null,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists idx_physical_products_tenant on public.physical_products(tenant_id, status);

-- ============================================================
-- Variantes (opcional — talle/color/etc)
-- ============================================================
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.physical_products(id) on delete cascade,
  -- name: label human ("M / Rojo"). options: {"talle":"M","color":"rojo"} para filtros futuros.
  name text not null,
  options jsonb not null default '{}'::jsonb,
  sku text,
  price_cents int,  -- override; null = usar precio del producto
  stock_qty int not null default 0,
  image_url text,   -- foto específica de la variante (opcional)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_variants_product on public.product_variants(product_id, sort_order);

-- ============================================================
-- Movimientos de stock (historial de ajustes)
-- ============================================================
create table if not exists public.product_stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.physical_products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  delta int not null,  -- positivo=ingreso, negativo=venta/ajuste
  reason text not null check (reason in ('sale', 'restock', 'adjustment', 'return', 'damage')),
  order_id uuid,  -- referencia opcional a physical_orders (sin FK para permitir borrado)
  actor_user_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_movs_tenant_time on public.product_stock_movements(tenant_id, created_at desc);

-- ============================================================
-- Zonas y tarifas de envío
-- ============================================================
create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,  -- "CABA", "GBA", "Interior", "Retiro en local"
  -- provinces: array de códigos ISO ("AR-C","AR-B","AR-M"…). ["*"] = todas.
  provinces jsonb not null default '[]'::jsonb,
  is_pickup boolean not null default false,  -- retiro en local (sin dirección)
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_zones_tenant on public.shipping_zones(tenant_id, sort_order);

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  zone_id uuid not null references public.shipping_zones(id) on delete cascade,
  name text not null,  -- "Estándar", "Express"
  price_cents int not null default 0,
  free_from_cents int,  -- envío gratis desde este subtotal (null = nunca gratis)
  delivery_days_min int,
  delivery_days_max int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_rates_zone on public.shipping_rates(zone_id, sort_order);

-- ============================================================
-- Órdenes físicas (independientes de `sales` — que sigue siendo para reporting)
-- ============================================================
create table if not exists public.physical_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  buyer_user_id uuid references public.profiles(id) on delete set null,
  buyer_email text not null,
  buyer_name text,
  buyer_phone text,
  -- Dirección: se guarda snapshot para no depender de un profile mutable.
  -- Estructura: { street, number, apt, city, province, postal_code, country, notes }
  shipping_address jsonb,
  shipping_zone_id uuid references public.shipping_zones(id) on delete set null,
  shipping_rate_id uuid references public.shipping_rates(id) on delete set null,
  shipping_method_label text,  -- snapshot ("Estándar CABA - 3 días")
  items_total_cents int not null default 0,
  shipping_cost_cents int not null default 0,
  discount_cents int not null default 0,
  total_cents int not null default 0,
  currency text not null default 'ARS',
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded')
  ),
  payment_id text,  -- MP payment id (link a `sales`)
  tracking_number text,
  tracking_url text,
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  notes text,  -- notas internas del owner
  buyer_notes text,  -- notas del comprador (ej: "dejar en portería")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_physical_orders_tenant_time on public.physical_orders(tenant_id, created_at desc);
create index if not exists idx_physical_orders_status on public.physical_orders(tenant_id, status);
create index if not exists idx_physical_orders_buyer on public.physical_orders(buyer_user_id);

create table if not exists public.physical_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.physical_orders(id) on delete cascade,
  product_id uuid references public.physical_products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  qty int not null default 1 check (qty > 0),
  unit_price_cents int not null,
  -- Snapshots (para que la orden sobreviva si borran producto/variante)
  product_title text not null,
  variant_label text,
  sku text
);
create index if not exists idx_order_items_order on public.physical_order_items(order_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.physical_products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_stock_movements enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.physical_orders enable row level security;
alter table public.physical_order_items enable row level security;

-- Physical products: owner all, público read published
drop policy if exists physical_products_owner on public.physical_products;
create policy physical_products_owner on public.physical_products
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = physical_products.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists physical_products_public_read on public.physical_products;
create policy physical_products_public_read on public.physical_products
  for select to anon, authenticated
  using (status = 'published');

-- Variants: hereda del producto
drop policy if exists variants_owner on public.product_variants;
create policy variants_owner on public.product_variants
  for all to authenticated
  using (
    exists (select 1 from public.physical_products p
      join public.memberships m on m.tenant_id = p.tenant_id
      where p.id = product_variants.product_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read on public.product_variants
  for select to anon, authenticated
  using (
    exists (select 1 from public.physical_products p
      where p.id = product_variants.product_id and p.status = 'published')
  );

-- Stock movements: solo owner
drop policy if exists stock_movs_owner on public.product_stock_movements;
create policy stock_movs_owner on public.product_stock_movements
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = product_stock_movements.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

-- Zonas + rates: owner all, público read (para calcular envío en checkout)
drop policy if exists zones_owner on public.shipping_zones;
create policy zones_owner on public.shipping_zones
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = shipping_zones.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists zones_public_read on public.shipping_zones;
create policy zones_public_read on public.shipping_zones
  for select to anon, authenticated using (true);

drop policy if exists rates_owner on public.shipping_rates;
create policy rates_owner on public.shipping_rates
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = shipping_rates.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists rates_public_read on public.shipping_rates;
create policy rates_public_read on public.shipping_rates
  for select to anon, authenticated using (true);

-- Órdenes: owner + comprador
drop policy if exists orders_owner on public.physical_orders;
create policy orders_owner on public.physical_orders
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = physical_orders.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists orders_buyer_read on public.physical_orders;
create policy orders_buyer_read on public.physical_orders
  for select to authenticated
  using (buyer_user_id = auth.uid());

drop policy if exists order_items_owner on public.physical_order_items;
create policy order_items_owner on public.physical_order_items
  for all to authenticated
  using (
    exists (select 1 from public.physical_orders o
      join public.memberships m on m.tenant_id = o.tenant_id
      where o.id = physical_order_items.order_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

drop policy if exists order_items_buyer_read on public.physical_order_items;
create policy order_items_buyer_read on public.physical_order_items
  for select to authenticated
  using (
    exists (select 1 from public.physical_orders o
      where o.id = physical_order_items.order_id and o.buyer_user_id = auth.uid())
  );

-- ── 0052 Analytics de storefront (funnel de conversión) ──
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null check (event_type in (
    'page_view', 'product_view', 'add_to_cart', 'checkout_start', 'purchase'
  )),
  product_id uuid references public.physical_products(id) on delete set null,
  order_id uuid,
  path text,
  session_id uuid,
  amount_cents int,
  referer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);
create index if not exists idx_analytics_tenant_time on public.analytics_events(tenant_id, created_at desc);
create index if not exists idx_analytics_tenant_type_time on public.analytics_events(tenant_id, event_type, created_at desc);
create index if not exists idx_analytics_product on public.analytics_events(product_id) where product_id is not null;
create index if not exists idx_analytics_session on public.analytics_events(tenant_id, session_id);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_insert_public on public.analytics_events;
create policy analytics_insert_public on public.analytics_events
  for insert to anon, authenticated with check (true);

drop policy if exists analytics_read_owner on public.analytics_events;
create policy analytics_read_owner on public.analytics_events
  for select to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = analytics_events.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

-- ── 0053 Tarifas por peso ──
alter table public.shipping_rates
  add column if not exists per_kg_cents int,
  add column if not exists included_grams int default 1000;

-- ── 0054 Categorías con jerarquía (mega-menu) ──
alter table public.course_categories
  add column if not exists parent_id uuid references public.course_categories(id) on delete set null,
  add column if not exists is_featured boolean not null default false;
create index if not exists idx_categories_parent on public.course_categories(parent_id);
create index if not exists idx_categories_tenant_featured on public.course_categories(tenant_id, is_featured);

-- ✓ Listo. Recargá la app.
