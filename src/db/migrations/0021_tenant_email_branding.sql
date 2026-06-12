-- =====================================================================
-- 0021_tenant_email_branding.sql
-- Permite al owner customizar emails que envia la plataforma con su
-- branding extra. URL-only (sin uploads) por la regla del proyecto.
--
-- - email_header_image_url: banner que va arriba del contenido del email
--   (ej. promo del proximo show, sponsor principal)
-- - email_banner_image_url: strip a la mitad del email (sponsors / cta
--   secundaria)
-- - email_footer_message: texto / HTML que va al final del email
--   (instagram, whatsapp, sitio web, lo que el owner quiera)
--
-- Render en lib/emails/templates.ts — campos opcionales, si vienen null
-- el email sale con el default actual sin esos bloques.
-- =====================================================================

alter table public.tenants
  add column if not exists email_header_image_url text,
  add column if not exists email_banner_image_url text,
  add column if not exists email_footer_message text;
