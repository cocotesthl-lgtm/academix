-- =====================================================================
-- 0024_platform_subscriptions.sql
-- Tablas para tracking de suscripciones que pagan los owners al founder
-- vía MercadoPago.
-- =====================================================================

-- Tracking de cada suscripción MP (preapproval) por tenant
create table if not exists public.platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  billing_period text not null check (billing_period in ('monthly', 'annual')),
  mp_preapproval_id text unique not null,
  status text not null default 'pending',
    -- pending | active | paused | cancelled | past_due
  amount_cents integer not null,
  currency text not null default 'ARS',
  promo_code text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platform_subs_tenant_idx
  on public.platform_subscriptions (tenant_id, status);

-- Cada cobro mensual que MP nos hace (uno por mes por suscripción activa)
create table if not exists public.platform_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  mp_payment_id text unique not null,
  amount_cents integer not null,
  currency text not null,
  status text not null,                   -- paid | refunded | rejected
  occurred_at timestamptz not null,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_sub_payments_tenant_idx
  on public.platform_subscription_payments (tenant_id, occurred_at desc);

-- Idempotencia de webhooks platform-MP
create table if not exists public.platform_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text unique not null,        -- "type:dataId:requestId"
  raw jsonb,
  received_at timestamptz not null default now()
);

-- RLS
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

-- platform_webhook_events: solo service_role escribe (no expone via RLS).
