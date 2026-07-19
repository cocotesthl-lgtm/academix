-- =====================================================================
-- 0081_whatsapp_analytics_helpers.sql
-- Índices auxiliares para el dashboard de analytics y filtros del
-- inbox. La columna `tags text[]` en whatsapp_conversations ya existía
-- desde 0078; agregamos índice GIN para búsquedas por tag.
-- =====================================================================

-- Index GIN para filtrado por tags (WHERE tags && ARRAY['soporte'])
create index if not exists idx_wa_conv_tags on public.whatsapp_conversations using gin (tags);

-- Index compuesto para el analytics de mensajes por día
create index if not exists idx_wa_msg_tenant_created on public.whatsapp_messages (tenant_id, created_at desc);

-- Index para first-response time analytics: mensajes 'out' por conversación
create index if not exists idx_wa_msg_out_conv on public.whatsapp_messages (conversation_id, created_at asc)
  where direction = 'out';
