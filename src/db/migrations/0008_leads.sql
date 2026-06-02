-- 0008_leads.sql
--
-- Tabla de leads capturados por landings VSL (form multipaso después de
-- ver el video) y eventualmente por cualquier otro form de lead-capture.
-- Cada lead pertenece a un tenant + opcionalmente a un curso específico.
-- 'data' jsonb guarda los campos custom que el owner configuró en el
-- multistep_form del template VSL.
--
-- Aplicar en Supabase SQL editor.

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  course_id    uuid references public.courses(id) on delete set null,
  source       text default 'vsl',                -- 'vsl' | 'contact' | 'other'
  email        text,
  name         text,
  phone        text,
  data         jsonb default '{}'::jsonb,          -- el resto de campos custom
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  affiliate_link_id uuid references public.affiliate_links(id) on delete set null,
  referer      text,
  ip_hash      text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists leads_tenant_idx       on public.leads (tenant_id, created_at desc);
create index if not exists leads_course_idx       on public.leads (course_id, created_at desc);
create index if not exists leads_email_idx        on public.leads (tenant_id, email);

-- RLS: el owner del tenant ve sus leads. Insert es vía service-role
-- (el endpoint /api/leads usa service client; público no inserta directo).
alter table public.leads enable row level security;

drop policy if exists "owners can read their leads" on public.leads;
create policy "owners can read their leads" on public.leads
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = leads.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  );
