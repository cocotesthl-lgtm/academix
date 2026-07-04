-- =====================================================================
-- 0049_whatsapp_float.sql
-- Botón flotante de WhatsApp en el storefront.
--
--   whatsapp_number: número en formato internacional sin '+' ni espacios
--                    (ej. '5491123456789'). Si es null → botón no aparece.
--   whatsapp_greeting: mensaje pre-cargado que abre el chat. Ej.:
--                     'Hola, vi tu sitio y quería consultar por...'
--                     Si es null → el chat se abre vacío.
--   whatsapp_position: 'left' | 'right' (default 'right')
-- =====================================================================

alter table public.tenants
  add column if not exists whatsapp_number text,
  add column if not exists whatsapp_greeting text,
  add column if not exists whatsapp_position text not null default 'right';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_whatsapp_position_check') then
    alter table public.tenants add constraint tenants_whatsapp_position_check
      check (whatsapp_position in ('left', 'right'));
  end if;
end $$;
