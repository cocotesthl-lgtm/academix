-- =====================================================================
-- OfferNow — Initial schema (Week 2 of MVP build)
-- Multi-tenant SaaS for academias. RLS-first.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- =====================================================================
-- Helpers (used by RLS policies)
-- =====================================================================

create or replace function public.is_super_admin()
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare v boolean;
begin
  select is_super_admin into v from public.profiles where id = auth.uid();
  return coalesce(v, false);
end;
$$;

create or replace function public.is_member(p_tenant uuid, p_role text default null)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare v boolean;
begin
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant
      and m.status = 'active'
      and (p_role is null or m.role = p_role)
  ) into v;
  return v;
end;
$$;

create or replace function public.is_tenant_owner(p_tenant uuid)
returns boolean
language plpgsql stable
as $$ begin return public.is_member(p_tenant, 'owner'); end; $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- =====================================================================
-- Identity & tenancy
-- =====================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique,
  display_name text,
  avatar_url text,
  is_super_admin boolean not null default false,
  referred_by_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_referred_by on public.profiles(referred_by_user_id);

create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug citext unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$'),
  name text not null,
  owner_user_id uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  brand jsonb not null default '{}'::jsonb,
  commission_rate_override numeric(5,4),
  affiliate_budget_pct numeric(5,4) not null default 0.30,
  affiliate_split jsonb not null default '{"l1":0.20,"l2":0.10,"l3":0.05}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tenants_owner on public.tenants(owner_user_id);
create trigger trg_tenants_updated before update on public.tenants
for each row execute function public.set_updated_at();

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('owner','instructor','student','affiliate')),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id, role)
);
create index idx_memberships_user on public.memberships(user_id);
create index idx_memberships_tenant_role on public.memberships(tenant_id, role);

-- =====================================================================
-- Content
-- =====================================================================

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  cover_url text,
  price_cents int not null default 0 check (price_cents >= 0),
  currency text not null default 'ARS',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  affiliate_enabled boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index idx_courses_tenant_status on public.courses(tenant_id, status);
create trigger trg_courses_updated before update on public.courses
for each row execute function public.set_updated_at();

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null default 0,
  title text not null,
  created_at timestamptz not null default now()
);
create index idx_modules_course on public.modules(course_id, position);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  position int not null default 0,
  title text not null,
  duration_seconds int,
  drive_file_id text,
  drive_embed_url text,
  is_preview boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_lessons_module on public.lessons(module_id, position);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'direct' check (source in ('direct','affiliate','founder_grant')),
  affiliate_attribution_id uuid,
  sale_id uuid,
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index idx_enrollments_user on public.enrollments(user_id);
create index idx_enrollments_tenant on public.enrollments(tenant_id, created_at desc);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz,
  last_position_seconds int not null default 0,
  updated_at timestamptz not null default now(),
  unique (enrollment_id, lesson_id)
);
create trigger trg_progress_updated before update on public.lesson_progress
for each row execute function public.set_updated_at();

-- =====================================================================
-- Money: sales, commission rules, owner debt ledger
-- =====================================================================

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid references public.courses(id),
  buyer_user_id uuid references public.profiles(id),
  external_provider text not null check (external_provider in ('mercadopago','shopify','manual')),
  external_id text not null,
  amount_gross_cents int not null,
  amount_net_cents int,
  currency text not null,
  status text not null default 'paid' check (status in ('pending','paid','refunded','disputed')),
  raw_payload jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (external_provider, external_id)
);
create index idx_sales_tenant_time on public.sales(tenant_id, occurred_at desc);

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global','tenant')),
  tenant_id uuid references public.tenants(id) on delete cascade,
  rate numeric(5,4) not null check (rate >= 0 and rate <= 1),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  set_by uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now(),
  check ((scope = 'global' and tenant_id is null) or (scope = 'tenant' and tenant_id is not null))
);
create index idx_commission_rules_lookup on public.commission_rules(scope, tenant_id, effective_from desc);

-- Helper: effective commission rate for a tenant at a given time
create or replace function public.effective_commission_rate(p_tenant uuid, p_at timestamptz default now())
returns numeric language sql stable as $$
  with override as (
    select commission_rate_override as rate from public.tenants where id = p_tenant
  ),
  tenant_rule as (
    select rate from public.commission_rules
    where scope = 'tenant' and tenant_id = p_tenant
      and effective_from <= p_at and (effective_to is null or effective_to > p_at)
    order by effective_from desc limit 1
  ),
  global_rule as (
    select rate from public.commission_rules
    where scope = 'global'
      and effective_from <= p_at and (effective_to is null or effective_to > p_at)
    order by effective_from desc limit 1
  )
  select coalesce((select rate from override where rate is not null),
                  (select rate from tenant_rule),
                  (select rate from global_rule),
                  0.05);
$$;

create table public.owner_debt_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid references public.sales(id),
  type text not null check (type in ('commission_accrued','debt_payment','adjustment','writeoff','refund_reversal')),
  amount_cents bigint not null,
  balance_after_cents bigint not null,
  commission_rate_applied numeric(5,4),
  status text not null default 'open' check (status in ('open','settled')),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_debt_tenant_time on public.owner_debt_ledger(tenant_id, created_at desc);
create index idx_debt_open on public.owner_debt_ledger(tenant_id, status) where status = 'open';

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  amount_cents bigint not null,
  external_provider text not null,
  external_id text not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (external_provider, external_id)
);

-- =====================================================================
-- Affiliates (3-level)
-- =====================================================================

create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  affiliate_user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  unique (course_id, affiliate_user_id)
);
create index idx_aff_links_user on public.affiliate_links(affiliate_user_id);

create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_link_id uuid not null references public.affiliate_links(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  visitor_hash text not null,
  ip inet,
  user_agent text,
  referer text,
  created_at timestamptz not null default now()
);
-- visitor_hash already incorporates the day (sha256(ip+ua+YYYY-MM-DD)), so the
-- unique index on (link, hash) is enough — same visitor on the same day collides,
-- next day produces a new hash.
create unique index idx_aff_click_dedupe on public.affiliate_clicks(affiliate_link_id, visitor_hash);

create table public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  buyer_user_id uuid references public.profiles(id),
  buyer_cookie_hash text,
  l1_user_id uuid references public.profiles(id),
  l2_user_id uuid references public.profiles(id),
  l3_user_id uuid references public.profiles(id),
  origin_link_id uuid references public.affiliate_links(id),
  cookie_set_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  sale_id uuid references public.sales(id)
);
create index idx_aff_attr_buyer on public.affiliate_attributions(buyer_user_id, course_id) where consumed_at is null;
create index idx_aff_attr_cookie on public.affiliate_attributions(buyer_cookie_hash, course_id) where consumed_at is null;

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  attribution_id uuid not null references public.affiliate_attributions(id),
  level int not null check (level in (1,2,3)),
  user_id uuid not null references public.profiles(id),
  rate numeric(5,4) not null,
  amount_cents bigint not null,
  status text not null default 'accrued' check (status in ('accrued','paid','void')),
  created_at timestamptz not null default now(),
  unique (sale_id, level)
);
create index idx_aff_comm_user_status on public.affiliate_commissions(user_id, status);

-- =====================================================================
-- Support
-- =====================================================================

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  subject text not null,
  status text not null default 'open' check (status in ('open','pending','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_tickets_tenant_status on public.support_tickets(tenant_id, status, last_message_at desc);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id),
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_ticket_msgs on public.ticket_messages(ticket_id, created_at);

-- =====================================================================
-- Integrations & ops
-- =====================================================================

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('mercadopago','shopify','google_drive')),
  status text not null default 'connected' check (status in ('connected','expired','revoked')),
  scope text,
  access_token_enc text,
  refresh_token_enc text,
  expires_at timestamptz,
  external_account_id text,
  webhook_secret text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);
create trigger trg_integrations_updated before update on public.integrations
for each row execute function public.set_updated_at();

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id),
  tenant_id uuid references public.tenants(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index idx_audit_action_time on public.audit_log(action, created_at desc);

-- =====================================================================
-- Default global commission rule (5%)
-- =====================================================================

insert into public.commission_rules (scope, rate, reason)
values ('global', 0.05, 'Default global commission at platform bootstrap')
on conflict do nothing;

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.sales enable row level security;
alter table public.commission_rules enable row level security;
alter table public.owner_debt_ledger enable row level security;
alter table public.debt_payments enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_attributions enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.integrations enable row level security;
alter table public.audit_log enable row level security;
alter table public.webhook_events enable row level security;

-- profiles
create policy profiles_self_select on public.profiles for select using (id = auth.uid() or public.is_super_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_super_admin = (select is_super_admin from public.profiles where id = auth.uid()));
create policy profiles_admin_all on public.profiles for all using (public.is_super_admin()) with check (public.is_super_admin());

-- tenants
create policy tenants_member_select on public.tenants for select using (public.is_super_admin() or public.is_member(id));
create policy tenants_public_select on public.tenants for select using (status = 'active');
create policy tenants_owner_update on public.tenants for update using (public.is_tenant_owner(id)) with check (
  public.is_tenant_owner(id)
  and commission_rate_override is not distinct from (select commission_rate_override from public.tenants t where t.id = tenants.id)
);
create policy tenants_admin_all on public.tenants for all using (public.is_super_admin()) with check (public.is_super_admin());

-- memberships
create policy memberships_self_select on public.memberships for select using (user_id = auth.uid() or public.is_tenant_owner(tenant_id) or public.is_super_admin());
create policy memberships_owner_write on public.memberships for all using (public.is_tenant_owner(tenant_id) or public.is_super_admin()) with check (public.is_tenant_owner(tenant_id) or public.is_super_admin());

-- courses / modules / lessons
create policy courses_public_select on public.courses for select using (status = 'published' or public.is_member(tenant_id) or public.is_super_admin());
create policy courses_owner_write on public.courses for all using (public.is_tenant_owner(tenant_id) or public.is_member(tenant_id, 'instructor') or public.is_super_admin()) with check (public.is_tenant_owner(tenant_id) or public.is_member(tenant_id, 'instructor') or public.is_super_admin());

create policy modules_select on public.modules for select using (
  exists (select 1 from public.courses c where c.id = course_id and (c.status = 'published' or public.is_member(c.tenant_id) or public.is_super_admin()))
);
create policy modules_write on public.modules for all using (public.is_tenant_owner(tenant_id) or public.is_member(tenant_id, 'instructor') or public.is_super_admin()) with check (public.is_tenant_owner(tenant_id) or public.is_member(tenant_id, 'instructor') or public.is_super_admin());

create policy lessons_select on public.lessons for select using (
  is_preview = true
  or public.is_super_admin()
  or exists (
    select 1 from public.enrollments e
    where e.user_id = auth.uid() and e.status = 'active'
      and e.course_id = (select course_id from public.modules where id = module_id)
  )
  or public.is_member(tenant_id, 'owner')
  or public.is_member(tenant_id, 'instructor')
);
create policy lessons_write on public.lessons for all using (public.is_tenant_owner(tenant_id) or public.is_member(tenant_id, 'instructor') or public.is_super_admin()) with check (public.is_tenant_owner(tenant_id) or public.is_member(tenant_id, 'instructor') or public.is_super_admin());

-- enrollments
create policy enrollments_self_select on public.enrollments for select using (user_id = auth.uid() or public.is_tenant_owner(tenant_id) or public.is_super_admin());
-- writes only via service role (webhooks)

-- lesson_progress
create policy progress_self_all on public.lesson_progress for all using (user_id = auth.uid() or public.is_tenant_owner(tenant_id) or public.is_super_admin()) with check (user_id = auth.uid());

-- sales / debt / commission_rules — read-only to owners; writes via service role
create policy sales_owner_select on public.sales for select using (public.is_tenant_owner(tenant_id) or public.is_super_admin());
create policy debt_owner_select on public.owner_debt_ledger for select using (public.is_tenant_owner(tenant_id) or public.is_super_admin());
create policy debt_pay_owner_select on public.debt_payments for select using (public.is_tenant_owner(tenant_id) or public.is_super_admin());
create policy commission_rules_select on public.commission_rules for select using (true);
create policy commission_rules_admin_write on public.commission_rules for all using (public.is_super_admin()) with check (public.is_super_admin());

-- affiliate
create policy aff_links_select on public.affiliate_links for select using (affiliate_user_id = auth.uid() or public.is_tenant_owner(tenant_id) or public.is_super_admin());
create policy aff_links_self_insert on public.affiliate_links for insert with check (affiliate_user_id = auth.uid());
create policy aff_comm_self_select on public.affiliate_commissions for select using (user_id = auth.uid() or public.is_tenant_owner(tenant_id) or public.is_super_admin());
-- aff_clicks / attributions writes via service role only

-- support_tickets
create policy tickets_participants_select on public.support_tickets for select using (opened_by = auth.uid() or public.is_tenant_owner(tenant_id) or public.is_super_admin());
create policy tickets_owner_insert on public.support_tickets for insert with check (opened_by = auth.uid() and public.is_tenant_owner(tenant_id));
create policy tickets_update on public.support_tickets for update using (public.is_tenant_owner(tenant_id) or public.is_super_admin()) with check (public.is_tenant_owner(tenant_id) or public.is_super_admin());

create policy ticket_msgs_select on public.ticket_messages for select using (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.opened_by = auth.uid() or public.is_tenant_owner(t.tenant_id) or public.is_super_admin()))
);
create policy ticket_msgs_insert on public.ticket_messages for insert with check (
  author_user_id = auth.uid()
  and exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.opened_by = auth.uid() or public.is_tenant_owner(t.tenant_id) or public.is_super_admin()))
);

-- integrations — never expose tokens to client; service role only writes/reads tokens
create policy integrations_owner_select on public.integrations for select using (public.is_tenant_owner(tenant_id) or public.is_super_admin());
-- writes: service role only

-- audit_log — readable to super_admin, plus owner sees their tenant rows
create policy audit_admin_select on public.audit_log for select using (public.is_super_admin() or (tenant_id is not null and public.is_tenant_owner(tenant_id)));

-- webhook_events — service role only

-- =====================================================================
-- Storage hint: create buckets `branding` (public read) and `attachments` (private)
-- via Supabase dashboard. RLS policies on storage.objects to scope by tenant_id.
-- =====================================================================
