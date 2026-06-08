-- 0014_instructors.sql
-- ──────────────────────────────────────────────────────────────────
-- Asignación de instructores a cursos + permisos por curso.
--
-- Un instructor es un user con membership(role='instructor') en el tenant.
-- El owner asigna cursos puntuales a cada instructor y decide qué puede
-- hacer en cada uno: editar el calendario, reagendar reservas, ver alumnos.
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.course_instructors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Permisos finos (el owner los togglea desde /owner/instructors)
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

-- RLS
alter table public.course_instructors enable row level security;

-- Owner del tenant: full CRUD
drop policy if exists "course_instructors: tenant owner full" on public.course_instructors;
create policy "course_instructors: tenant owner full" on public.course_instructors
  for all using (
    exists (select 1 from public.memberships m
      where m.tenant_id = course_instructors.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'owner' and m.status = 'active')
  );

-- Instructor: ve sólo sus propias asignaciones
drop policy if exists "course_instructors: instructor self read" on public.course_instructors;
create policy "course_instructors: instructor self read" on public.course_instructors
  for select using (user_id = auth.uid());
