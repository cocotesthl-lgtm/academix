-- 0043 Cuentas / planes contratados — para automotrices, telcos, ISP, prepagas, etc.
-- Modelo: cada cliente tiene N planes (un plan = un contrato). Cada plan tiene
-- N facturas (cuotas). El owner emite, el cliente paga.

create table if not exists public.customer_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_name text not null,                  -- "Plan Familiar", "Línea 1144-XXXX", "Patente AA999BB", etc.
  description text,                         -- detalles extra del plan
  monthly_amount_cents bigint not null default 0,
  currency text not null default 'ARS',
  status text not null default 'active',    -- active | suspended | cancelled | finished
  start_date date not null default current_date,
  end_date date,                            -- null = indefinido
  notes text,                               -- notas internas del owner (no visible al cliente)
  customer_message text,                    -- mensaje visible al cliente en su panel
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$ begin
  alter table public.customer_plans add constraint cp_status_check
    check (status in ('active','suspended','cancelled','finished'));
exception when duplicate_object then null; end $$;
create index if not exists idx_cp_tenant_status on public.customer_plans(tenant_id, status);
create index if not exists idx_cp_user on public.customer_plans(user_id);

-- Facturas / cuotas del plan
create table if not exists public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.customer_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  number text,                              -- "F001-0001" o lo que el owner quiera (opcional)
  concept text not null,                    -- "Cuota Marzo 2026", "Ajuste IPC", "Reparación A234"
  amount_cents bigint not null,             -- positivo = factura, negativo = crédito/ajuste a favor
  currency text not null default 'ARS',
  issued_at date not null default current_date,
  due_at date,
  status text not null default 'pending',   -- pending | paid | overdue | cancelled | partial
  paid_at timestamptz,
  payment_method text,                      -- 'mercadopago' | 'cash' | 'transfer' | 'wallet' | etc
  payment_ref text,                         -- nro de comprobante, txid, etc
  paid_amount_cents bigint,                 -- útil para partial
  notes text,                               -- notas internas
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.customer_invoices add constraint ci_status_check
    check (status in ('pending','paid','overdue','cancelled','partial'));
exception when duplicate_object then null; end $$;
create index if not exists idx_ci_tenant_status on public.customer_invoices(tenant_id, status, due_at);
create index if not exists idx_ci_plan on public.customer_invoices(plan_id, issued_at desc);
create index if not exists idx_ci_user on public.customer_invoices(user_id, status, due_at);

-- RLS — owner ve todo lo de su tenant, user ve sus propios planes/facturas
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
