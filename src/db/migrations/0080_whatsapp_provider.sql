-- =====================================================================
-- 0080_whatsapp_provider.sql
-- Segunda vía de conexión de WhatsApp: modo "Simple" con QR (via
-- Evolution API — wrapper open-source sobre Baileys). Convive con el
-- modo "Pro" existente (Cloud API oficial de Meta).
--
-- Diseño:
--   - Columna `provider` en whatsapp_config: 'cloud_api' | 'qr'
--   - Campos específicos de QR: evolution_url, instance_name, api_key
--   - Todos los sends (text/media/template) ramifican por provider en
--     app-layer — la DB no cambia semánticamente.
--
-- El owner elige el provider en /owner/whatsapp/connect (UI de 2
-- tarjetas). El provider queda fijo por tenant (no se puede mezclar
-- Cloud API + QR en el mismo tenant — cada uno tiene su propio número
-- y su propio historial).
-- =====================================================================

alter table public.whatsapp_config
  add column if not exists provider text not null default 'cloud_api';

-- Config específica de Evolution API (modo QR)
alter table public.whatsapp_config
  add column if not exists evolution_url text;              -- ej "https://mi-evolution.railway.app"
alter table public.whatsapp_config
  add column if not exists evolution_instance text;         -- nombre único de la instancia dentro de esa Evolution
alter table public.whatsapp_config
  add column if not exists evolution_api_key text;          -- api key global de la instancia Evolution (encriptada como el access_token)
alter table public.whatsapp_config
  add column if not exists qr_status text default 'disconnected'; -- disconnected | pending_qr | connected

-- Check para forzar valores válidos en provider
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'whatsapp_config_provider_check'
  ) then
    alter table public.whatsapp_config
      add constraint whatsapp_config_provider_check
      check (provider in ('cloud_api', 'qr'));
  end if;
end$$;
