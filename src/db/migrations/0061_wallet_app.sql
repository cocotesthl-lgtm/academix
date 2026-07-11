-- 0061_wallet_app.sql
--
-- App "Saldos" formalizada como módulo instalable + configuración por tenant:
--
--   1. Nombre/símbolo de la moneda personalizables por tenant.
--      Ej: BTC, USD, ARS, "Créditos", "★". Se muestra en toda la UI de saldos.
--
--   2. Bonus de saldo configurable en CUALQUIER producto (curso, físico,
--      digital, suscripción). Cuando el buyer paga, se le acredita `bonus_cents`
--      extra en su wallet. Independiente del tipo de producto — un curso puede
--      regalar $500 en saldo, un producto físico puede regalar créditos, etc.
--
-- Todo idempotente (add column if not exists) para no romper si se re-ejecuta.

-- ── 1. Currency personalizable por tenant ────────────────────────────
alter table public.tenants
  add column if not exists wallet_currency_label text default 'ARS',
  add column if not exists wallet_currency_symbol text default '$';

comment on column public.tenants.wallet_currency_label is
  'Nombre corto de la moneda de la wallet interna (ej: ARS, USD, BTC, "Créditos", "Puntos"). Se muestra al lado del balance.';
comment on column public.tenants.wallet_currency_symbol is
  'Símbolo prefijo o postfijo (ej: $, ₿, ¥, ★). Convención: se muestra antes del monto.';

-- ── 2. Bonus wallet en cualquier producto ────────────────────────────
-- Cursos, servicios, digitales, mentorías → todo lo que vive en `courses`
alter table public.courses
  add column if not exists wallet_bonus_cents integer not null default 0;

comment on column public.courses.wallet_bonus_cents is
  'Cuánto saldo (en centavos) se le acredita al buyer cuando compra este producto. Se suma a su wallet en la moneda del tenant. Independiente de topup_amount_cents (que es solo para product_type=topup).';

-- Productos físicos (tabla aparte)
alter table public.physical_products
  add column if not exists wallet_bonus_cents integer not null default 0;

comment on column public.physical_products.wallet_bonus_cents is
  'Cuánto saldo (en centavos) se le acredita al buyer cuando compra este producto físico.';

-- ── 3. RLS: los nuevos campos heredan las políticas existentes de sus
--    tablas — no hace falta tocar policies.
