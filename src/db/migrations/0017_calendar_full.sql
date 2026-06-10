-- 0017_calendar_full.sql
-- ──────────────────────────────────────────────────────────────────
-- Calendario completo: source por curso + fechas puntuales + pausas.
--
-- courses.calendar_source:
--   'instructor' → slots vienen de availability_rules de los instructores
--     asignados al curso (comportamiento actual, default).
--   'owner' → slots vienen de availability_rules tenant-wide
--     (instructor_user_id IS NULL) + calendar_dates con instructor null.
--     El owner define cuándo se da el curso sin importar quién lo dicta.
--
-- calendar_dates: fechas PUNTUALES (one-off). Ej: "el sábado 15 de marzo
-- el curso se da de 10 a 14". Distinto a availability_rules que son
-- recurrentes semanales.
--
-- availability_overrides: PAUSAS / cancelaciones que se RESTAN del set
-- de slots generados. Ej: "Juan está de vacaciones del 1 al 7 de abril",
-- "el curso de rescate suspendido la semana del 20", "la academia cerrada
-- por feriado". Pueden scopearse a tenant / instructor / curso.
-- ──────────────────────────────────────────────────────────────────

alter table public.courses
  add column if not exists calendar_source text default 'instructor';
do $$ begin
  alter table public.courses
    add constraint courses_calendar_source_check
    check (calendar_source in ('instructor', 'owner'));
exception when duplicate_object then null; end $$;

-- ── Fechas puntuales (one-off) ──
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
create index if not exists calendar_dates_tenant_date_idx
  on public.calendar_dates (tenant_id, date);
create index if not exists calendar_dates_instructor_idx
  on public.calendar_dates (instructor_user_id, date)
  where instructor_user_id is not null;
create index if not exists calendar_dates_course_idx
  on public.calendar_dates (course_id, date)
  where course_id is not null;

-- ── Pausas / cancelaciones ──
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
create index if not exists availability_overrides_tenant_idx
  on public.availability_overrides (tenant_id, start_at);
create index if not exists availability_overrides_instructor_idx
  on public.availability_overrides (instructor_user_id, start_at)
  where instructor_user_id is not null;
create index if not exists availability_overrides_course_idx
  on public.availability_overrides (course_id, start_at)
  where course_id is not null;

-- ── RLS ──
-- calendar_dates: owner del tenant CRUD, instructor CRUD propias, anon SELECT
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

-- availability_overrides: idem
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
