-- 0037 Multi-sede + reservas (tiro, gym, escape, restaurante, etc.)

-- 1. Tabla de sedes/sucursales del tenant
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  notes text,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_venues_tenant on public.venues(tenant_id, active);

-- 2. Productos ↔ sedes (qué sedes ofrecen este producto)
create table if not exists public.course_venues (
  course_id uuid not null references public.courses(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  primary key (course_id, venue_id)
);
create index if not exists idx_course_venues_venue on public.course_venues(venue_id);

-- 3. Reservas (sin pago — la plataforma sólo guarda la reserva)
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  reservation_date date not null,
  reservation_time text,            -- "19:30" o "all-day" o lo que aplique
  party_size smallint not null default 1,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.reservations add constraint reservations_status_check
    check (status in ('pending','confirmed','cancelled','completed','no_show'));
exception when duplicate_object then null; end $$;
create index if not exists idx_reservations_tenant_date on public.reservations(tenant_id, reservation_date desc);
create index if not exists idx_reservations_course on public.reservations(course_id, reservation_date);

-- 4. Ampliar product_type con 'multi_venue' y 'restaurant'
do $$
begin
  alter table public.courses drop constraint if exists courses_product_type_check;
exception when undefined_table then null;
end $$;
alter table public.courses
  add constraint courses_product_type_check
  check (product_type in ('course','event','mentorship','vip_pack','digital','physical','service','multi_venue','restaurant'));

-- 5. RLS — lectura pública para venues de un producto publicado (storefront necesita ver las sedes)
alter table public.venues enable row level security;
alter table public.course_venues enable row level security;
alter table public.reservations enable row level security;

do $$ begin
  create policy venues_public_read on public.venues for select
    using (active = true);
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
