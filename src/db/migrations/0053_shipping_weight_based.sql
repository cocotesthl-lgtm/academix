-- 0053 · Tarifas de envío por peso
--
-- Permite tarifas semi-realistas para Correo Argentino / Andreani sin
-- integrarse con sus APIs (que requieren cuenta del owner + credenciales).
--
-- Modelo: tarifa base + costo por kg. Ejemplo típico Correo AR CABA:
--   base: $3.500  +  $800 × cada kg extra sobre 1kg
--
-- El cálculo del envío ahora es:
--   costo = base_price_cents + (max(0, total_weight_g - included_grams) * per_kg_cents / 1000)
--
-- Todos los productos ya tienen weight_g (opcional, migration 0051).
-- Si un producto no tiene peso, se asume 500g default para el cálculo.

alter table public.shipping_rates
  add column if not exists per_kg_cents int,
  add column if not exists included_grams int default 1000;
