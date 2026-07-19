-- =====================================================================
-- 0079_whatsapp_extras.sql
-- Segunda ola de features del bot:
--   1) Encriptación transparente del access_token (sólo cambia semántica
--      del campo — el tipo sigue siendo TEXT). Los tokens nuevos se
--      guardan con prefijo "enc:v1:..." vía lib/crypto/secrets.ts.
--   2) IA con Claude: nuevas columnas ai_enabled + ai_system_prompt en
--      whatsapp_config (fallback cuando no matchea ninguna regla).
--   3) Templates aprobados de Meta: tabla whatsapp_templates local con
--      cache de lo aprobado + last_used_at para ordenar.
--   4) Bucket de storage para media (imágenes/PDFs) que el owner adjunta
--      desde el inbox — Meta descarga desde una URL pública.
-- =====================================================================

-- ── 1) IA config sobre whatsapp_config ────────────────────────────────
alter table public.whatsapp_config
  add column if not exists ai_enabled boolean default false;
alter table public.whatsapp_config
  add column if not exists ai_system_prompt text;
alter table public.whatsapp_config
  add column if not exists ai_model text default 'claude-haiku-4-5-20251001';

-- ── 2) Templates cache ────────────────────────────────────────────────
create table if not exists public.whatsapp_templates (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  name           text not null,
  language       text not null,                -- "es_AR", "en_US"
  category       text,                          -- MARKETING | UTILITY | AUTHENTICATION
  status         text not null default 'APPROVED',
  body           text not null,                 -- texto con {{1}} {{2}} placeholders
  params_count   int default 0,                 -- cantidad de {{N}} en el body
  last_used_at   timestamptz,
  synced_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (tenant_id, name, language)
);
create index if not exists idx_wa_tpl_tenant on public.whatsapp_templates (tenant_id, last_used_at desc nulls last);
alter table public.whatsapp_templates enable row level security;
drop policy if exists wa_tpl_owner on public.whatsapp_templates;
create policy wa_tpl_owner on public.whatsapp_templates
  for all using (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.tenants t
      where t.id = tenant_id and t.owner_user_id = auth.uid())
  );

-- ── 3) Storage bucket para adjuntos ───────────────────────────────────
-- Bucket público (Meta necesita descargar el asset desde una URL sin
-- auth). Los objetos van dentro de /{tenant_id}/... para separar
-- ownership. Reglas de acceso: cualquiera puede LEER (Meta), sólo el
-- owner autenticado del tenant puede INSERT/UPDATE/DELETE su propio
-- prefijo. Retention: no automático (por ahora).
insert into storage.buckets (id, name, public)
  values ('whatsapp-media', 'whatsapp-media', true)
on conflict (id) do update set public = true;

-- Policies: escritura sólo por owner del tenant, lectura pública.
drop policy if exists wa_media_read on storage.objects;
create policy wa_media_read on storage.objects
  for select using (bucket_id = 'whatsapp-media');

drop policy if exists wa_media_write on storage.objects;
create policy wa_media_write on storage.objects
  for insert with check (
    bucket_id = 'whatsapp-media'
    and (
      -- El primer segmento del path debe ser un tenant.id del que el user
      -- autenticado es owner.
      exists (
        select 1 from public.tenants t
        where t.id::text = split_part(name, '/', 1)
          and t.owner_user_id = auth.uid()
      )
    )
  );

drop policy if exists wa_media_delete on storage.objects;
create policy wa_media_delete on storage.objects
  for delete using (
    bucket_id = 'whatsapp-media'
    and exists (
      select 1 from public.tenants t
      where t.id::text = split_part(name, '/', 1)
        and t.owner_user_id = auth.uid()
    )
  );

-- ── 4) Nada más que hacer en whatsapp_conversations — crm_lead_id ya
-- existe desde 0078. Sólo aseguramos el índice para lookups del CRM.
create index if not exists idx_wa_conv_crm_lead on public.whatsapp_conversations (crm_lead_id) where crm_lead_id is not null;
