-- 0011_checkout_custom.sql
-- ──────────────────────────────────────────────────────────────────
-- Checkout configurable: el owner edita qué campos pide antes del pago,
-- a nivel tenant (default) y opcionalmente override por curso.
--
-- Estructura de checkout_config (jsonb):
-- {
--   base_fields: {
--     name:     { enabled: bool, required: bool },
--     dni:      { enabled: bool, required: bool },
--     phone:    { enabled: bool, required: bool },
--     location: { enabled: bool, required: bool }
--   },
--   extra_fields: [
--     { id, key, label, type, required, placeholder?, options?, helper?, position }
--   ]
-- }
--
-- email + password siempre on (son necesarios para crear cuenta del comprador).
-- Si una academia no pone nada, la config default cubre todos los campos
-- como están hoy (backward compat).
--
-- enrollments.buyer_extra y sales.buyer_extra: snapshot del JSON con las
-- respuestas del comprador (clave: field.key, valor: lo que escribió).
-- Así el owner puede ver "talle de remera" sin agregar columnas nuevas.
-- ──────────────────────────────────────────────────────────────────

alter table public.tenants
  add column if not exists checkout_config jsonb default '{}'::jsonb;

alter table public.courses
  add column if not exists checkout_config jsonb;  -- null = usa el del tenant

alter table public.enrollments
  add column if not exists buyer_extra jsonb default '{}'::jsonb;

alter table public.sales
  add column if not exists buyer_extra jsonb default '{}'::jsonb;
