-- 0015_instructor_availability.sql
-- ──────────────────────────────────────────────────────────────────
-- Disponibilidad por instructor + tracking de quién atiende cada slot.
--
-- availability_rules.instructor_user_id:
--   NULL  → regla tenant-wide (legacy: el owner declaraba sus horarios
--           cuando no había instructores). Sigue funcionando.
--   valor → regla DEL instructor. Cada uno declara sus propios horarios
--           desde /instructor/availability.
--
-- bookings.instructor_user_id: cuando un curso tiene instructores
-- asignados, al reservar guardamos cuál atiende el slot. Sino NULL.
-- ──────────────────────────────────────────────────────────────────

alter table public.availability_rules
  add column if not exists instructor_user_id uuid references auth.users(id) on delete cascade;

create index if not exists availability_rules_instructor_idx
  on public.availability_rules (tenant_id, instructor_user_id, weekday);

alter table public.bookings
  add column if not exists instructor_user_id uuid references auth.users(id) on delete set null;

create index if not exists bookings_instructor_idx
  on public.bookings (instructor_user_id, slot_start);

-- El UNIQUE original (tenant_id, slot_start) impedía que dos instructores
-- distintos tomen el mismo slot. Lo reemplazamos por uno que SÍ permite
-- diferentes instructores en el mismo horario (cada uno con sus reservas
-- independientes).
drop index if exists public.bookings_no_double_booking;
create unique index if not exists bookings_no_double_per_instructor
  on public.bookings (tenant_id, coalesce(instructor_user_id::text, '_tenant'), slot_start)
  where status <> 'cancelled';

-- RLS: ampliamos para que el INSTRUCTOR pueda CRUD sus propias rules.
-- (La policy existente "tenant owners full" sigue activa para el owner.)
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
