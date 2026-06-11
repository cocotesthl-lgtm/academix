-- 0019_seat_zones.sql
-- ──────────────────────────────────────────────────────────────────
-- V2 de seat selection: zonas con grids individuales + multiplicador de
-- precio. Cada zona es un grid (filas × columnas) con su propio nombre,
-- color y multiplicador. Sirve para VIP / General / Pullman / Platea.
-- ──────────────────────────────────────────────────────────────────

-- Sumar 'zones' al constraint
do $$ begin
  alter table public.calendar_dates drop constraint if exists calendar_dates_seat_mode_check;
  alter table public.calendar_dates
    add constraint calendar_dates_seat_mode_check
    check (seat_mode in ('none', 'grid', 'zones'));
exception when undefined_object then null; end $$;

-- Estructura JSON:
-- [
--   { "id": "vip", "name": "VIP", "rows": 3, "cols": 10,
--     "price_multiplier": 2.0, "color": "#a855f7" },
--   { "id": "general", "name": "General", "rows": 8, "cols": 20,
--     "price_multiplier": 1.0, "color": "#3b82f6" }
-- ]
alter table public.calendar_dates
  add column if not exists seat_zones jsonb default '[]'::jsonb;

-- Los seat_label en event_tickets se prefijan con la zona en modo 'zones'.
-- Ej: "vip:A1", "general:B5". El UNIQUE existente sobre (calendar_date_id,
-- seat_label) sigue funcionando — los labels con prefijo son únicos.
