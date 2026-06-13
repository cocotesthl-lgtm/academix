-- =====================================================================
-- 0023_plans_subscriptions.sql
-- Sistema de planes Initial / Medium / Pro que pagan los owners al
-- founder. Cobro vía MP suscripciones — pero esta migration solo monta
-- el schema y los datos, el cobro real se wirea en fase posterior.
--
-- Diseño:
-- - plans: catálogo de planes (founder los edita)
-- - tenants: agregamos plan_id + billing_period + subscription_status
-- - plan_promo_codes: códigos descuento (founder los crea)
-- - plan_announcements: banner promocional cuando owner se loguea
-- =====================================================================

-- Catálogo de planes
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text,
  description text,
  position integer not null default 0,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  price_cents_monthly integer not null default 0,
  price_cents_annual integer not null default 0,
  currency text not null default 'ARS',
  -- Features estructuradas
  features jsonb not null default '{}'::jsonb,
  /* features expected shape:
     {
       "domains_max": 0|1|3,
       "email_marketing_monthly": 0|1000|5000|25000,
       "storage_gb": 0|2|10|50,
       "uploads_enabled": true|false,
       "featured_listings": 0|1|999,
       "support_sla_hours": 48|12|2,
       "support_priority": true|false,
       "extras": ["custom feature 1", "custom feature 2"]
     }
  */
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tenant ahora tiene plan + billing
alter table public.tenants
  add column if not exists plan_id uuid references public.plans(id) on delete set null,
  add column if not exists billing_period text not null default 'monthly'
    check (billing_period in ('monthly', 'annual')),
  add column if not exists subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'past_due', 'cancelled', 'paused')),
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists last_paid_at timestamptz;

-- Códigos promocionales para planes
create table if not exists public.plan_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text,
  discount_type text not null default 'percent'
    check (discount_type in ('percent', 'fixed')),
  discount_value integer not null default 0,
  plan_ids uuid[] not null default '{}',  -- vacío = aplica a todos
  applies_to text not null default 'both'
    check (applies_to in ('monthly', 'annual', 'both')),
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Anuncios / banner promocional (siempre 1 activo a la vez)
create table if not exists public.plan_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  cta_label text,
  cta_href text,
  promo_code text,
  bg_color text default '#a855f7',
  text_color text default '#ffffff',
  plan_ids uuid[] not null default '{}',  -- vacío = aplica a todos
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Seed 3 planes de referencia (solo si la tabla está vacía)
insert into public.plans (slug, name, tagline, description, position, is_featured, price_cents_monthly, price_cents_annual, features)
select * from (values
  (
    'initial', 'Initial', 'Para empezar tu academia',
    'Lo esencial para vender tus primeros cursos o eventos.',
    1, false, 999000, 9990000,
    '{"domains_max":0,"email_marketing_monthly":500,"storage_gb":1,"uploads_enabled":true,"featured_listings":0,"support_sla_hours":48,"support_priority":false,"extras":[]}'::jsonb
  ),
  (
    'medium', 'Medium', 'Para academias en crecimiento',
    'Más espacio, dominio propio, marketing y soporte rápido.',
    2, true, 2499000, 24990000,
    '{"domains_max":1,"email_marketing_monthly":5000,"storage_gb":10,"uploads_enabled":true,"featured_listings":1,"support_sla_hours":12,"support_priority":false,"extras":["Email marketing a clientes","Banner destacado mensual"]}'::jsonb
  ),
  (
    'pro', 'Pro', 'Para academias con volumen',
    'Todo ilimitado, dominios múltiples y soporte prioritario.',
    3, false, 5999000, 59990000,
    '{"domains_max":3,"email_marketing_monthly":25000,"storage_gb":50,"uploads_enabled":true,"featured_listings":999,"support_sla_hours":2,"support_priority":true,"extras":["Insignia premium","API access","Manager dedicado"]}'::jsonb
  )
) as new_plans(slug, name, tagline, description, position, is_featured, price_cents_monthly, price_cents_annual, features)
where not exists (select 1 from public.plans);

-- RLS — solo founder edita, todos leen los activos
alter table public.plans enable row level security;
drop policy if exists "plans: public read active" on public.plans;
create policy "plans: public read active" on public.plans
  for select using (is_active = true);
drop policy if exists "plans: founder write" on public.plans;
create policy "plans: founder write" on public.plans
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_super_admin = true)
  );

alter table public.plan_promo_codes enable row level security;
drop policy if exists "promo_codes: founder all" on public.plan_promo_codes;
create policy "promo_codes: founder all" on public.plan_promo_codes
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_super_admin = true)
  );

alter table public.plan_announcements enable row level security;
drop policy if exists "announcements: public read active" on public.plan_announcements;
create policy "announcements: public read active" on public.plan_announcements
  for select using (is_active = true and (expires_at is null or expires_at > now()));
drop policy if exists "announcements: founder write" on public.plan_announcements;
create policy "announcements: founder write" on public.plan_announcements
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_super_admin = true)
  );
