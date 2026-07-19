-- =====================================================================
-- 0078_whatsapp_bot.sql
-- WhatsApp Business Platform (Cloud API oficial de Meta) — schema para
-- conectar cada tenant a su propio bot de WhatsApp, guardar
-- conversaciones/mensajes en base y correr respuestas automáticas por
-- keyword o mensaje de bienvenida.
--
-- Diseño:
--   - whatsapp_config: 1 row por tenant con credentials Meta
--   - whatsapp_conversations: 1 row por (tenant, customer_phone)
--   - whatsapp_messages: 1 row por mensaje (in/out), FK a conversation
--   - whatsapp_bot_rules: reglas ordenadas de auto-reply
--
-- Todas las tablas tienen RLS con policies "solo owner del tenant lee/
-- escribe". El service role (webhook + bot engine) bypassea RLS.
-- =====================================================================

-- ── CONFIG ────────────────────────────────────────────────────────────
create table if not exists public.whatsapp_config (
  tenant_id                uuid primary key references public.tenants(id) on delete cascade,
  phone_number_id          text,        -- ID del número en la plataforma Meta
  business_account_id      text,        -- WhatsApp Business Account ID
  access_token             text,        -- Token permanente del sistema (encriptado en app-layer si el owner lo pide)
  display_phone            text,        -- número visible +54 9 11...
  verify_token             text,        -- token que Meta manda en GET /webhook
  webhook_signature_secret text,        -- app secret para validar X-Hub-Signature-256
  bot_enabled              boolean default true,
  greeting_enabled         boolean default true,
  greeting_body            text default 'Hola! Gracias por escribirnos. En breve te respondemos.',
  away_enabled             boolean default false,
  away_body                text default 'Estamos fuera de horario. Te contestamos en cuanto volvamos.',
  away_start               time,        -- desde qué hora (formato local del tenant)
  away_end                 time,        -- hasta qué hora
  connected_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
alter table public.whatsapp_config enable row level security;
drop policy if exists wa_config_owner on public.whatsapp_config;
create policy wa_config_owner on public.whatsapp_config
  for all using (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_id = auth.uid())
  );

-- ── CONVERSATIONS ────────────────────────────────────────────────────
create table if not exists public.whatsapp_conversations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  wa_customer_id        text not null,          -- número del cliente (E.164 sin +)
  customer_name         text,                    -- nombre reportado por WA
  last_message_at       timestamptz,
  last_message_body     text,                    -- preview de la última (truncado)
  last_message_from_bot boolean default false,   -- para pintar "vos" vs "cliente" en preview
  unread_count          int default 0,
  status                text default 'open',     -- open | closed | archived
  bot_paused            boolean default false,   -- si el humano tomó el control se pausa el bot
  assigned_user_id      uuid references auth.users(id),  -- staff que atiende (opcional)
  crm_lead_id           uuid,                    -- link opcional a leads del CRM
  tags                  text[],
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id, wa_customer_id)
);
create index if not exists idx_wa_conv_tenant_time on public.whatsapp_conversations (tenant_id, last_message_at desc);
create index if not exists idx_wa_conv_status on public.whatsapp_conversations (tenant_id, status);
alter table public.whatsapp_conversations enable row level security;
drop policy if exists wa_conv_owner on public.whatsapp_conversations;
create policy wa_conv_owner on public.whatsapp_conversations
  for all using (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_id = auth.uid())
  );

-- ── MESSAGES ─────────────────────────────────────────────────────────
create table if not exists public.whatsapp_messages (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  conversation_id  uuid not null references public.whatsapp_conversations(id) on delete cascade,
  wa_message_id    text,                        -- ID que devuelve Meta (para dedupe + status updates)
  direction        text not null,               -- 'in' (cliente→nosotros) | 'out' (nosotros→cliente)
  from_bot         boolean default false,       -- si es 'out' y from_bot=true, lo mandó el auto-reply
  msg_type         text default 'text',         -- text | image | audio | video | document | sticker | location | interactive
  body             text,                         -- para text; caption para media
  media_url        text,                         -- URL del asset descargable (procesada async si es necesario)
  status           text default 'sent',          -- sent | delivered | read | failed
  error_message    text,
  created_at       timestamptz not null default now(),
  delivered_at     timestamptz,
  read_at          timestamptz
);
create index if not exists idx_wa_msg_conv_time on public.whatsapp_messages (conversation_id, created_at asc);
create index if not exists idx_wa_msg_wa_id on public.whatsapp_messages (wa_message_id) where wa_message_id is not null;
alter table public.whatsapp_messages enable row level security;
drop policy if exists wa_msg_owner on public.whatsapp_messages;
create policy wa_msg_owner on public.whatsapp_messages
  for all using (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_id = auth.uid())
  );

-- ── BOT RULES ────────────────────────────────────────────────────────
create table if not exists public.whatsapp_bot_rules (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  name           text not null,                 -- rótulo interno "Pregunta por precios"
  trigger_type   text not null default 'keyword', -- 'keyword' | 'welcome' | 'fallback'
  keywords       text[],                         -- lista de keywords/frases exactas (case-insensitive)
  match_mode     text default 'contains',        -- 'contains' | 'exact' | 'starts_with'
  reply_body     text not null,                  -- respuesta a enviar (puede tener {{nombre}} placeholder)
  active         boolean default true,
  position       int default 0,                  -- orden: primero match gana
  hit_count      int default 0,                  -- cuántas veces disparó (para analytics)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_wa_rules_tenant_pos on public.whatsapp_bot_rules (tenant_id, position asc);
alter table public.whatsapp_bot_rules enable row level security;
drop policy if exists wa_rules_owner on public.whatsapp_bot_rules;
create policy wa_rules_owner on public.whatsapp_bot_rules
  for all using (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_id = auth.uid())
  );
