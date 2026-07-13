-- 0066_paypal_auto_convert.sql
--
-- Conversión automática de precios locales → PayPal según una tasa
-- que el owner configura una sola vez. Alternativa al patrón Hotmart
-- (precio manual por producto): si el owner elige "tasa global", no
-- necesita tocar cada producto — el sistema divide price_cents / rate
-- y aplica.
--
-- Precedencia (en /api/paypal/create-order):
--   1. courses.paypal_price_cents (si está seteado, override manual)
--   2. tenants.paypal_auto_convert (si ON, precio local ÷ rate)
--   3. Fallback: price_cents interpretado 1:1 en la moneda de PayPal
--
-- Campos:
--   paypal_auto_convert     — feature flag para conversión automática
--   paypal_conversion_rate  — cuántas unidades del precio local = 1 PayPal
--                             (ej: rate=1000 → 1 USD cuesta 1000 ARS)
--   paypal_round_cents      — si true, redondea al entero más cercano
--                             (14.99 → 15, sin centavos)

alter table public.tenants
  add column if not exists paypal_auto_convert boolean not null default false,
  add column if not exists paypal_conversion_rate numeric(14,4),
  add column if not exists paypal_round_cents boolean not null default false;

comment on column public.tenants.paypal_auto_convert is
  'Si true, precios locales se convierten a la moneda de PayPal usando paypal_conversion_rate. Si el producto tiene paypal_price_cents override, se usa ese en su lugar.';
comment on column public.tenants.paypal_conversion_rate is
  'Tasa: cuántas unidades del precio local equivalen a 1 unidad de la moneda de PayPal. Ej: 1000 → 1 USD = 1000 ARS.';
comment on column public.tenants.paypal_round_cents is
  'Si true, redondea el resultado al entero más cercano (ej: 14.87 → 15). Útil para precios "limpios" tipo 15 USD.';
