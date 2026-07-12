-- 0064_paypal_provider.sql
--
-- Habilita 'paypal' como provider en la tabla integrations.
-- El owner conecta su cuenta PayPal Business pegando Client ID +
-- Client Secret que obtiene en developer.paypal.com (60 segundos,
-- sin OAuth partner porque PayPal no lo aprueba automáticamente).
--
-- Storage layout para paypal:
--   provider = 'paypal'
--   external_account_id = email de la cuenta business
--   access_token_enc = Client Secret (plaintext, mismo modelo que MP)
--   metadata = { client_id, sandbox: boolean }
--   webhook_secret = PayPal Webhook ID (para verificar firmas en Fase B)

do $$ begin
  alter table public.integrations drop constraint integrations_provider_check;
exception when undefined_object then null; end $$;

alter table public.integrations add constraint integrations_provider_check
  check (provider in ('mercadopago','shopify','google_drive','paypal'));
