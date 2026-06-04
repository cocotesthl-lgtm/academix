-- 0012_calendar.sql
-- ──────────────────────────────────────────────────────────────────
-- Calendario en el checkout. Dos modos por curso:
--  - start_date: el comprador elige una fecha de inicio (sin disponibilidad).
--  - mentorship_slot: el owner declara horarios semanales y el comprador
--    elige un slot puntual. No double-booking via UNIQUE.
--
-- Tabla availability_rules: bloques semanales recurrentes del tenant.
-- Tabla bookings: reservas confirmadas (1 por enrollment con slot).
-- ──────────────────────────────────────────────────────────────────

-- Modo + label + obligatoriedad por curso
alter table public.courses
  add column if not exists calendar_mode     text default 'none'
    check (calendar_mode in ('none', 'start_date', 'mentorship_slot'));
alter table public.courses
  add column if not exists calendar_label    text;
alter table public.courses
  add column if not exists calendar_required boolean default true;
-- Para mentorship_slot: cuántos días hacia adelante mostrar disponibilidad.
alter table public.courses
  add column if not exists calendar_horizon_days smallint default 30;

-- Disponibilidad semanal recurrente del tenant (compartida entre cursos)
create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),  -- 0=domingo
  start_min smallint not null check (start_min between 0 and 1439),  -- mins desde 00:00
  end_min smallint not null check (end_min between 1 and 1440),
  slot_duration_min smallint not null default 60 check (slot_duration_min between 5 and 480),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);
create index if not exists availability_rules_tenant_weekday_idx
  on public.availability_rules (tenant_id, weekday);

-- Reservas (1 fila por slot tomado)
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
-- Anti double-booking para mentorship_slot 1-a-1: el mismo slot no puede
-- estar tomado por dos bookings activos en el mismo tenant.
create unique index if not exists bookings_no_double_booking
  on public.bookings (tenant_id, slot_start)
  where status <> 'cancelled';
create index if not exists bookings_tenant_course_idx
  on public.bookings (tenant_id, course_id, slot_start);

-- Para start_date: lo guardamos directo en enrollments como una fecha.
alter table public.enrollments
  add column if not exists booking_date date;
-- Para mentorship_slot: cuando se confirma el booking, lo linkeamos al enrollment.
alter table public.enrollments
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

-- RLS: tenant-isolated. Las lee/edita solo el owner del tenant.
alter table public.availability_rules enable row level security;
drop policy if exists "availability_rules: tenant owners" on public.availability_rules;
create policy "availability_rules: tenant owners" on public.availability_rules
  for all using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = availability_rules.tenant_id
        and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    )
  );
-- Anon SELECT para que el storefront pueda calcular slots disponibles.
drop policy if exists "availability_rules: public read" on public.availability_rules;
create policy "availability_rules: public read" on public.availability_rules
  for select using (true);

alter table public.bookings enable row level security;
drop policy if exists "bookings: tenant owners" on public.bookings;
create policy "bookings: tenant owners" on public.bookings
  for all using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = bookings.tenant_id
        and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    )
  );
-- Anon SELECT para saber qué slots ya están tomados (solo slot_start del tenant + course).
-- No se exponen datos del comprador en este SELECT público — solo el slot.
drop policy if exists "bookings: public read slots" on public.bookings;
create policy "bookings: public read slots" on public.bookings
  for select using (status <> 'cancelled');
