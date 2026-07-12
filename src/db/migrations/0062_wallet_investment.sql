-- 0062_wallet_investment.sql
--
-- App Saldos — extensiones:
--
--   1. `concept` en wallet_transactions — texto libre para etiquetar
--      cada movimiento (ej: "Depósito", "Reembolso", "Rendimiento",
--      "Ajuste puntual"). Independiente del `kind` técnico. El owner
--      lo elige al hacer una operación manual.
--
--   2. Modo Inversiones (flag por tenant). Cuando está prendido, el
--      owner ve el botón "Otorgar rendimientos" en /owner/wallets y
--      puede aplicar un % a uno o todos los saldos.
--
--   3. Tasa de rendimiento default sugerida (en basis points: 500 = 5%).
--      Se usa como valor pre-cargado en el formulario de rendimientos.
--
-- Idempotente.

alter table public.tenants
  add column if not exists wallet_investment_enabled boolean not null default false,
  add column if not exists wallet_default_yield_rate_bps integer not null default 0;

comment on column public.tenants.wallet_investment_enabled is
  'Si está en true, el owner puede aplicar rendimientos a los wallets desde el panel.';
comment on column public.tenants.wallet_default_yield_rate_bps is
  'Tasa de rendimiento sugerida por default, en basis points (500 = 5.00%).';

alter table public.wallet_transactions
  add column if not exists concept text;

comment on column public.wallet_transactions.concept is
  'Etiqueta libre del movimiento (Depósito, Reembolso, Rendimiento, Pago, etc). Se muestra en el historial además del kind técnico.';
