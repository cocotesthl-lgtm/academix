-- 0006_buyer_info.sql
--
-- Captura datos del comprador en el checkout para que el owner pueda
-- impartir la clase: nombre/apellido, DNI, ubicación, email, celular.
-- Se persiste en sales (registro de la venta) y también se denormaliza
-- en enrollments (vista rápida para el owner desde el dashboard de
-- alumnos sin tener que joinear).
--
-- Aplicar en Supabase SQL editor.

alter table public.sales
  add column if not exists buyer_name      text,
  add column if not exists buyer_dni       text,
  add column if not exists buyer_location  text,
  add column if not exists buyer_email     text,
  add column if not exists buyer_phone     text;

alter table public.enrollments
  add column if not exists buyer_name      text,
  add column if not exists buyer_dni       text,
  add column if not exists buyer_location  text,
  add column if not exists buyer_email     text,
  add column if not exists buyer_phone     text;

-- Índices para que el owner pueda buscar alumnos por DNI o email rápido
create index if not exists enrollments_buyer_dni_idx
  on public.enrollments (tenant_id, buyer_dni)
  where buyer_dni is not null;

create index if not exists enrollments_buyer_email_idx
  on public.enrollments (tenant_id, buyer_email)
  where buyer_email is not null;
