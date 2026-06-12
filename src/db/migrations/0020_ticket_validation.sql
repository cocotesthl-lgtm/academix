-- =====================================================================
-- 0020_ticket_validation.sql
-- QR + validation tracking + re-entry toggle.
--
-- - qr_token: string corto (12 chars base32) unique. Va dentro del QR
--   embebido en email/PDF + scanner lo recibe del cliente. NO usamos el
--   uuid del ticket directamente (más corto y menos info expuesta).
-- - order_number: codigo legible humano para fallback manual (BZ-A4B2C).
-- - validated_at / validated_by / validation_count: tracking de uso.
-- - calendar_dates.allow_ticket_reentry: si true, se puede escanear
--   más de una vez (estadios con re-entry permitido).
-- =====================================================================

alter table public.event_tickets
  add column if not exists qr_token text,
  add column if not exists order_number text,
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists validation_count integer not null default 0;

-- Tokens unicos a nivel global. Si ya hay tickets sin token, generarlos
-- con un default ad-hoc (el code de app va a sobreescribir esto en
-- proximas inserciones).
update public.event_tickets
  set qr_token = replace(replace(replace(encode(gen_random_bytes(9), 'base64'), '+', ''), '/', ''), '=', '')
  where qr_token is null;

update public.event_tickets
  set order_number = upper(substr(replace(replace(encode(gen_random_bytes(5), 'base64'), '+', ''), '/', ''), 1, 6))
  where order_number is null;

create unique index if not exists event_tickets_qr_token_uniq
  on public.event_tickets (qr_token);

create index if not exists event_tickets_order_number_idx
  on public.event_tickets (order_number);

alter table public.calendar_dates
  add column if not exists allow_ticket_reentry boolean not null default false;
