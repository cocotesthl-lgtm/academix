-- 0063_multi_currency_wallets.sql
--
-- Multi-currency wallets: cada tenant puede tener múltiples monedas
-- (ej: ARS, Robux, Litecoin, "Créditos Gimnasio"…). Cada cliente tiene
-- una wallet POR moneda.
--
-- Cambios:
--   1. Nueva tabla `wallet_currencies` — catálogo de monedas del tenant
--      (label, symbol, logo opcional, is_default, position).
--   2. `wallets` UNIQUE cambia de (tenant_id, user_id) → (tenant_id, user_id, currency).
--   3. Ampliar wallet_tx_kind_check para incluir 'yield'.
--   4. Seed: para cada tenant, migrar la wallet_currency_label/symbol
--      configurada en 0061 como su primera moneda default.

-- ── 1. Catálogo de monedas ──────────────────────────────────────
create table if not exists public.wallet_currencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,                    -- slug corto: 'ars', 'robux', 'ltc'
  label text not null,                   -- 'ARS', 'Robux', 'Litecoin'
  symbol text not null default '$',      -- '$', 'R$', 'Ł'
  logo_url text,                         -- URL opcional del logo/icono
  is_default boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index if not exists idx_wallet_currencies_tenant on public.wallet_currencies(tenant_id, position);
alter table public.wallet_currencies enable row level security;

drop policy if exists wallet_currencies_owner on public.wallet_currencies;
create policy wallet_currencies_owner on public.wallet_currencies
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = wallet_currencies.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

-- Public read: los clientes ven las monedas del sitio en /saldo
drop policy if exists wallet_currencies_public_read on public.wallet_currencies;
create policy wallet_currencies_public_read on public.wallet_currencies
  for select to anon, authenticated using (true);

-- ── 2. Cambiar unique de wallets a (tenant_id, user_id, currency) ─
-- Drop del constraint viejo — puede llamarse distinto según cómo
-- postgres lo autogeneró. Probamos ambos nombres típicos.
do $$ begin
  alter table public.wallets drop constraint wallets_tenant_id_user_id_key;
exception when undefined_object then null; end $$;
do $$ begin
  alter table public.wallets drop constraint wallets_tenant_user_unique;
exception when undefined_object then null; end $$;

-- Nuevo unique multi-currency (idempotente vía if not exists en el índice)
create unique index if not exists wallets_tenant_user_currency_uidx
  on public.wallets(tenant_id, user_id, currency);

-- ── 3. Ampliar kind check para 'yield' ────────────────────────
do $$ begin
  alter table public.wallet_transactions drop constraint if exists wallet_tx_kind_check;
exception when undefined_object then null; end $$;
alter table public.wallet_transactions add constraint wallet_tx_kind_check
  check (kind in ('topup','spend','refund','admin_adjust','transfer_out','transfer_in','withdrawal','yield'));

-- ── 4. Seed: crear wallet_currency default para cada tenant ────
-- Usa la configuración de 0061 (wallet_currency_label/symbol). Si el
-- tenant no la tenía, cae a 'ARS' / '$'. Solo inserta si el tenant no
-- tiene ya una moneda default (no duplica en re-ejecuciones).
insert into public.wallet_currencies (tenant_id, code, label, symbol, is_default, position)
select
  t.id,
  lower(coalesce(t.wallet_currency_label, 'ARS')),
  coalesce(t.wallet_currency_label, 'ARS'),
  coalesce(t.wallet_currency_symbol, '$'),
  true,
  0
from public.tenants t
where not exists (
  select 1 from public.wallet_currencies wc where wc.tenant_id = t.id and wc.is_default = true
);
