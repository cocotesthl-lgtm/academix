-- =====================================================================
-- 0030_forms_and_crm.sql
-- Form Builder + CRM (Fase 1 — MVP)
--
-- Forms: el owner crea formularios con campos custom (texto, email, etc).
-- Submissions: cada envío se guarda como JSONB para flexibilidad total.
-- CRM Leads: cada submission opcionalmente crea un "lead" en una pipeline.
-- Pipelines + Stages: tableros tipo Kanban configurables por el owner.
-- =====================================================================

-- ─── Forms ────────────────────────────────────────────────────────────
create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  success_message text default '¡Gracias! Recibimos tu mensaje.',
  redirect_url text,
  submit_label text default 'Enviar',
  -- Conexión con CRM (opcional): pipeline + stage default donde caen los leads.
  default_pipeline_id uuid,         -- FK suelta, validada en app por simplicidad
  default_stage_id uuid,
  -- Notificación email al owner cuando llega un envío
  notify_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists idx_forms_tenant on public.forms(tenant_id);

create table if not exists public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  position int not null default 0,
  -- Tipos soportados: text, email, phone, textarea, select, checkbox, number
  field_type text not null check (field_type in ('text','email','phone','textarea','select','checkbox','number')),
  name text not null,             -- key del field (sin espacios) — usado en data jsonb
  label text not null,
  placeholder text,
  required boolean not null default false,
  options jsonb,                  -- para 'select': [{value, label}]
  help_text text,
  created_at timestamptz not null default now(),
  unique (form_id, name)
);
create index if not exists idx_form_fields_form on public.form_fields(form_id, position);

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,        -- { field_name: value, ... }
  submitter_email text,                            -- denormalizado para búsqueda rápida
  submitter_name text,
  submitter_phone text,
  source_url text,                                 -- de qué página vino
  user_agent text,
  ip_hash text,                                    -- sha256(ip+ua+día) para dedupe
  lead_id uuid,                                    -- FK suelta a crm_leads si se creó
  submitted_at timestamptz not null default now()
);
create index if not exists idx_form_submissions_form on public.form_submissions(form_id, submitted_at desc);
create index if not exists idx_form_submissions_tenant on public.form_submissions(tenant_id, submitted_at desc);

-- ─── CRM: Pipelines / Stages / Leads ──────────────────────────────────

create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,       -- pipeline default del tenant
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_pipelines_tenant on public.crm_pipelines(tenant_id);

create table if not exists public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  name text not null,
  color text default '#a855f7',                    -- hex, para badge en kanban
  position int not null default 0,
  is_won boolean not null default false,            -- stage final "ganado"
  is_lost boolean not null default false,           -- stage final "perdido"
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_stages_pipeline on public.crm_stages(pipeline_id, position);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  stage_id uuid not null references public.crm_stages(id) on delete restrict,
  -- Identificación
  name text,
  email text,
  phone text,
  -- Valor del deal (opcional, para forecast)
  value_cents bigint default 0,
  currency text default 'ARS',
  -- Tracking
  source text default 'manual',                     -- 'form', 'manual', 'import'
  source_form_id uuid,                              -- FK suelta a forms
  source_submission_id uuid,                        -- FK suelta a form_submissions
  -- Datos extra (campos del form)
  data jsonb default '{}'::jsonb,
  -- Asignación al equipo
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  -- Notas internas
  notes text,
  -- Estado
  position int not null default 0,                  -- orden dentro del stage (kanban)
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_crm_leads_tenant on public.crm_leads(tenant_id);
create index if not exists idx_crm_leads_stage on public.crm_leads(stage_id, position);
create index if not exists idx_crm_leads_assigned on public.crm_leads(assigned_to_user_id);
create index if not exists idx_crm_leads_email on public.crm_leads(tenant_id, email);

-- Historial de cambios / actividad por lead (movimientos, asignaciones, comentarios).
create table if not exists public.crm_lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  -- Tipos: 'created', 'stage_changed', 'assigned', 'comment', 'edited', 'archived'
  activity_type text not null,
  payload jsonb,                                    -- detalles tipo {from_stage, to_stage}
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_lead_activity_lead on public.crm_lead_activity(lead_id, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────

alter table public.forms enable row level security;
alter table public.form_fields enable row level security;
alter table public.form_submissions enable row level security;
alter table public.crm_pipelines enable row level security;
alter table public.crm_stages enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_lead_activity enable row level security;

-- Helper: el caller pertenece al tenant (rol owner o staff)
-- Reutilizamos is_tenant_owner si existe; sino fallback básico.
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'is_tenant_owner') then
    create function public.is_tenant_owner(tid uuid) returns boolean
      language sql security definer set search_path = public, auth
      as $f$
        select exists (
          select 1 from public.memberships
          where tenant_id = tid and user_id = auth.uid() and role in ('owner','admin','staff')
        );
      $f$;
  end if;
end $$;

-- Forms: el owner ve / edita los del tenant. Lectura pública para forms con
-- envío anónimo está manejada vía service_role (route handler), no expuesta a anon.
drop policy if exists forms_owner_all on public.forms;
create policy forms_owner_all on public.forms
  for all using (public.is_tenant_owner(tenant_id))
  with check (public.is_tenant_owner(tenant_id));

drop policy if exists form_fields_owner_all on public.form_fields;
create policy form_fields_owner_all on public.form_fields
  for all using (
    exists (select 1 from public.forms f where f.id = form_id and public.is_tenant_owner(f.tenant_id))
  ) with check (
    exists (select 1 from public.forms f where f.id = form_id and public.is_tenant_owner(f.tenant_id))
  );

drop policy if exists form_submissions_owner_select on public.form_submissions;
create policy form_submissions_owner_select on public.form_submissions
  for select using (public.is_tenant_owner(tenant_id));

-- CRM Pipelines / Stages / Leads / Activity: visible solo a miembros del tenant
drop policy if exists crm_pipelines_owner_all on public.crm_pipelines;
create policy crm_pipelines_owner_all on public.crm_pipelines
  for all using (public.is_tenant_owner(tenant_id))
  with check (public.is_tenant_owner(tenant_id));

drop policy if exists crm_stages_owner_all on public.crm_stages;
create policy crm_stages_owner_all on public.crm_stages
  for all using (
    exists (select 1 from public.crm_pipelines p where p.id = pipeline_id and public.is_tenant_owner(p.tenant_id))
  ) with check (
    exists (select 1 from public.crm_pipelines p where p.id = pipeline_id and public.is_tenant_owner(p.tenant_id))
  );

drop policy if exists crm_leads_owner_all on public.crm_leads;
create policy crm_leads_owner_all on public.crm_leads
  for all using (public.is_tenant_owner(tenant_id))
  with check (public.is_tenant_owner(tenant_id));

drop policy if exists crm_lead_activity_owner_all on public.crm_lead_activity;
create policy crm_lead_activity_owner_all on public.crm_lead_activity
  for all using (
    exists (select 1 from public.crm_leads l where l.id = lead_id and public.is_tenant_owner(l.tenant_id))
  ) with check (
    exists (select 1 from public.crm_leads l where l.id = lead_id and public.is_tenant_owner(l.tenant_id))
  );
