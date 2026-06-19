-- 0038 V2 de venues: horarios por sede + seña opcional + emails

-- Horarios disponibles por sede (jsonb estilo {mon:[{from:"10:00",to:"19:00"}], tue:[...], ...})
alter table public.venues add column if not exists hours jsonb not null default '{}'::jsonb;
-- Fechas puntuales bloqueadas (array de YYYY-MM-DD)
alter table public.venues add column if not exists blackout_dates jsonb not null default '[]'::jsonb;
-- Duración de cada slot en minutos (30/60/90/120)
alter table public.venues add column if not exists slot_minutes smallint not null default 60;

-- Seña opcional por producto
alter table public.courses add column if not exists deposit_cents bigint not null default 0;
alter table public.courses add column if not exists deposit_required boolean not null default false;

-- Tracking del pago de seña en la reserva
alter table public.reservations add column if not exists deposit_paid boolean not null default false;
alter table public.reservations add column if not exists deposit_external_id text;
