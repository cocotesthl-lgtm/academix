-- 0041 Sistema de saldo: wallets por usuario × tenant + transacciones

-- Saldo actual del usuario en cada tenant.
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  balance_cents bigint not null default 0,
  currency text not null default 'ARS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists idx_wallets_tenant on public.wallets(tenant_id, balance_cents desc);

-- Movimientos: append-only para auditoría. balance_after_cents snapshot
-- para recuperar el saldo histórico en cualquier momento.
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null,   -- positivo = crédito, negativo = débito
  balance_after_cents bigint not null,
  kind text not null,             -- 'topup' | 'spend' | 'refund' | 'admin_adjust'
  course_id uuid references public.courses(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  note text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.wallet_transactions add constraint wallet_tx_kind_check
    check (kind in ('topup','spend','refund','admin_adjust'));
exception when duplicate_object then null; end $$;
create index if not exists idx_wallet_tx_tenant_date on public.wallet_transactions(tenant_id, created_at desc);
create index if not exists idx_wallet_tx_user on public.wallet_transactions(user_id, created_at desc);

-- Monto a acreditar cuando se compra el producto (default: price_cents).
-- Si está seteado, permite "Pagás $900, te damos $1000 de saldo" (10% bonus).
alter table public.courses add column if not exists topup_amount_cents bigint;

-- Ampliar product_type con 'topup'
do $$ begin
  alter table public.courses drop constraint if exists courses_product_type_check;
exception when undefined_table then null; end $$;
alter table public.courses
  add constraint courses_product_type_check
  check (product_type in ('course','event','mentorship','vip_pack','digital','physical','service','multi_venue','restaurant','topup'));

-- RLS: owner ve todas las wallets del tenant, user ve solo la propia.
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

do $$ begin
  create policy wallets_owner_read on public.wallets for select
    using (exists (select 1 from public.memberships m where m.tenant_id = wallets.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy wallets_self_read on public.wallets for select
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy wallet_tx_owner_read on public.wallet_transactions for select
    using (exists (select 1 from public.memberships m where m.tenant_id = wallet_transactions.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy wallet_tx_self_read on public.wallet_transactions for select
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
