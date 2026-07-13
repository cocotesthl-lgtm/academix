-- 0065_paypal_price.sql
--
-- Precio separado para PayPal, tipo Hotmart. El owner setea un precio
-- local (ARS) para MP y opcionalmente un precio USD/EUR/etc. para
-- PayPal. Cuando el buyer paga vía PayPal, se usa ese precio; si no
-- está seteado, se usa price_cents con la moneda de PayPal (comporta-
-- miento actual).
--
-- Ejemplo: curso a $14.900 ARS con paypal_price_cents=1500 (USD). El
-- buyer local ve $14.900 ARS y paga con MP; el buyer del exterior paga
-- 15 USD por PayPal.
--
-- Nullable en ambas tablas — la mayoría de los owners no van a usar
-- multi-moneda al principio y no queremos forzarlos.

alter table public.courses
  add column if not exists paypal_price_cents integer;

comment on column public.courses.paypal_price_cents is
  'Precio específico para cobros vía PayPal (en la moneda del tenant, integrations.metadata.currency). Si null, PayPal usa price_cents en la moneda de PayPal.';

alter table public.physical_products
  add column if not exists paypal_price_cents integer;

comment on column public.physical_products.paypal_price_cents is
  'Precio específico para cobros vía PayPal (en la moneda del tenant, integrations.metadata.currency). Si null, PayPal usa price_cents.';
