-- =====================================================================
-- 0045_tenants_modules.sql
-- Módulos activables por workspace (F2 de la evolución nav).
--
-- Cada tenant elige qué módulos usa. La sidebar del panel se filtra por
-- esto. Default: TODOS prendidos → los tenants existentes no ven ningún
-- cambio. Nuevos tenants pueden arrancar con un preset (F2.2).
--
-- Módulos macro (grupos del sidebar):
--   catalog   → Publicaciones, VIP, Bundles, Categorías, Cupones, Checkout
--   calendar  → Calendario, Reservas, Validar, Asistencia, Sedes
--   crm       → Leads, Clientes, Formularios, Mensajes, Afiliados
--   team      → Equipo, Instructores
--   sales     → Ventas, Suscripciones, Saldos, Finanzas
--   site      → Editor, Templates, Identidad, Dominio
--
-- Inicio y Configuración nunca se filtran.
-- =====================================================================

alter table public.tenants
  add column if not exists modules jsonb not null default '{
    "catalog": true,
    "calendar": true,
    "crm": true,
    "team": true,
    "sales": true,
    "site": true
  }'::jsonb;

-- Backfill defensivo: cualquier tenant existente con NULL o {} recibe
-- todos prendidos (aunque el default lo asegure para nuevos rows).
update public.tenants
  set modules = '{
    "catalog": true,
    "calendar": true,
    "crm": true,
    "team": true,
    "sales": true,
    "site": true
  }'::jsonb
  where modules is null or modules = '{}'::jsonb;
