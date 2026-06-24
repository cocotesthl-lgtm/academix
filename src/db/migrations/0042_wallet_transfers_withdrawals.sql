-- 0042 Transferencias entre usuarios + solicitudes de retiro

-- Feature flags por tenant (owner decide si los habilita)
alter table public.tenants add column if not exists wallet_transfers_enabled boolean not null default false;
alter table public.tenants add column if not exists wallet_withdrawals_enabled boolean not null default false;

-- Extender kinds permitidos en wallet_transactions
do $$ begin
  alter table public.wallet_transactions drop constraint if exists wallet_tx_kind_check;
exception when undefined_object then null; end $$;
alter table public.wallet_transactions add constraint wallet_tx_kind_check
  check (kind in ('topup','spend','refund','admin_adjust','transfer_out','transfer_in','withdrawal'));

-- Solicitudes de retiro — el user solicita, el owner aprueba/rechaza.
-- El saldo se debita INMEDIATAMENTE al crear la solicitud (kind='withdrawal');
-- si el owner rechaza, se acredita de vuelta (kind='refund').
create table if not exists public.wallet_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ARS',
  method text,                  -- 'cbu' | 'mercadopago' | 'cash' | 'crypto' | etc (texto libre)
  destination text,             -- CBU/alias/email/wallet — texto libre, lo escribe el user
  note text,                    -- comentario opcional del user
  status text not null default 'pending',
  reject_reason text,
  withdrawal_tx_id uuid references public.wallet_transactions(id) on delete set null,
  refund_tx_id uuid references public.wallet_transactions(id) on delete set null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null
);
do $$ begin
  alter table public.wallet_withdrawal_requests add constraint wwr_status_check
    check (status in ('pending','approved','rejected','paid'));
exception when duplicate_object then null; end $$;
create index if not exists idx_wwr_tenant_status on public.wallet_withdrawal_requests(tenant_id, status, requested_at desc);
create index if not exists idx_wwr_user on public.wallet_withdrawal_requests(user_id, requested_at desc);

alter table public.wallet_withdrawal_requests enable row level security;

do $$ begin
  create policy wwr_owner_read on public.wallet_withdrawal_requests for select
    using (exists (select 1 from public.memberships m where m.tenant_id = wallet_withdrawal_requests.tenant_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy wwr_self_read on public.wallet_withdrawal_requests for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
