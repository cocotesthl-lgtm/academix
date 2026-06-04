-- 0013_subscriptions.sql
-- ──────────────────────────────────────────────────────────────────
-- Suscripciones recurrentes via MercadoPago Preapproval API.
--
-- Modelo:
--   - El curso puede ser pricing_mode='one_time' (default) o 'subscription'.
--   - Si es subscription, el checkout endpoint usa /preapproval en vez
--     de /checkout/preferences. MP cobra recurrente.
--   - Cada subscription la trackeamos en `subscriptions` con preapproval_id
--     externo de MP. El webhook /api/webhooks/mercadopago-preapproval
--     procesa eventos topic=preapproval (cambios de estado) y
--     topic=authorized_payment (cada cobro recurrente confirmado).
--   - Al primer authorized_payment, creamos enrollment + sale (igual que
--     one-time). Pagos siguientes solo agregan filas a sales sin re-enrol.
-- ──────────────────────────────────────────────────────────────────

alter table public.courses
  add column if not exists pricing_mode text default 'one_time'
    check (pricing_mode in ('one_time', 'subscription'));
alter table public.courses
  add column if not exists subscription_frequency text
    check (subscription_frequency in ('monthly', 'yearly') or subscription_frequency is null);
alter table public.courses
  add column if not exists subscription_trial_days smallint default 0
    check (subscription_trial_days >= 0 and subscription_trial_days <= 365);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  external_provider text not null default 'mercadopago',
  preapproval_id text not null,             -- id que devuelve MP
  status text not null default 'pending',   -- pending|authorized|paused|cancelled
  frequency text not null,                  -- monthly|yearly (snapshot)
  amount_cents int not null,
  currency text not null,
  started_at timestamptz default now(),
  next_billing_at timestamptz,
  cancelled_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (external_provider, preapproval_id)
);
create index if not exists subscriptions_tenant_status_idx
  on public.subscriptions (tenant_id, status);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

-- RLS
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions: tenant owners" on public.subscriptions;
create policy "subscriptions: tenant owners" on public.subscriptions
  for all using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = subscriptions.tenant_id
        and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    )
  );
drop policy if exists "subscriptions: self user" on public.subscriptions;
create policy "subscriptions: self user" on public.subscriptions
  for select using (user_id = auth.uid());
