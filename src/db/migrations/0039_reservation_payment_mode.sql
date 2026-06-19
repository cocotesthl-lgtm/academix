-- 0039 Modo de pago de reservas decidido por el owner

-- Modos:
--   'none'    → sin pago online (cobra en el lugar)
--   'deposit' → el cliente paga sólo la seña (% del precio) para confirmar
--   'full'    → el cliente paga el total para confirmar
--   'choice'  → el cliente elige al momento entre pagar total o seña
alter table public.courses add column if not exists payment_mode text not null default 'none';
do $$ begin
  alter table public.courses add constraint courses_payment_mode_check
    check (payment_mode in ('none','deposit','full','choice'));
exception when duplicate_object then null; end $$;

-- Porcentaje de seña sobre el precio (cuando aplica)
alter table public.courses add column if not exists deposit_percent smallint not null default 30;
do $$ begin
  alter table public.courses add constraint courses_deposit_percent_check
    check (deposit_percent between 1 and 99);
exception when duplicate_object then null; end $$;

-- Backfill: si v2 tenía deposit_required=true, mantenemos el flujo en modo 'deposit'.
update public.courses set payment_mode = 'deposit' where deposit_required = true and payment_mode = 'none';

-- En la reserva, recordamos qué pagó el cliente (full o deposit)
alter table public.reservations add column if not exists payment_choice text;
alter table public.reservations add column if not exists payment_amount_cents bigint;
