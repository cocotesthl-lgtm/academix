-- =====================================================================
-- 0067_demo_pool.sql
-- Pool global de contenido demo — arquitectura shadow / copy-on-edit.
--
-- Problema que resuelve: hasta ahora cada tenant que aplicaba un template
-- (Noticias, Ecommerce, etc) recibía ~40 rows de contenido demo en su
-- propia tabla (articles, physical_products, course_categories). Con 1000
-- tenants eso son 40k rows de contenido idéntico ocupando storage sin
-- ningún valor real (todos ven lo mismo).
--
-- Solución: tres tablas globales (`demo_articles`, `demo_physical_products`,
-- `demo_course_categories`) que viven una sola vez. Cada tabla real
-- (articles, physical_products, course_categories) recibe un campo
-- `demo_ref` que apunta al slug del demo cuando la row es una versión
-- CUSTOMIZADA de ese demo.
--
-- Storefront lee: real UNION visible-demos (donde visible = no está
-- hidden ni customizado por el tenant).
--
-- Copy-on-edit: cuando el owner edita un demo, se crea una row real
-- con demo_ref = slug del demo. A partir de ahí el demo global deja
-- de mostrarse para ese tenant y en su lugar aparece la versión custom.
--
-- Hide: cuando el owner "borra" un demo, se inserta en tenant_demo_hidden
-- (soft-hide) en vez de tocar el pool global.
--
-- Idempotente. Todas las tablas demo_* son públicas de lectura (RLS
-- select-all) pero solo super_admins pueden escribir (mantenimiento
-- vía SQL directo por ahora, UI de admin puede venir después).
-- =====================================================================

-- ── 1. tenant_demo_hidden ─────────────────────────────────────────────
create table if not exists public.tenant_demo_hidden (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  resource_type text not null check (resource_type in ('article', 'physical_product', 'course_category')),
  demo_slug text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, resource_type, demo_slug)
);
create index if not exists idx_demo_hidden_tenant
  on public.tenant_demo_hidden (tenant_id, resource_type);

alter table public.tenant_demo_hidden enable row level security;
drop policy if exists demo_hidden_owner_all on public.tenant_demo_hidden;
create policy demo_hidden_owner_all on public.tenant_demo_hidden
  for all
  using (exists (
    select 1 from public.memberships m
    where m.tenant_id = tenant_demo_hidden.tenant_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'staff')
      and m.status = 'active'
  ))
  with check (exists (
    select 1 from public.memberships m
    where m.tenant_id = tenant_demo_hidden.tenant_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'staff')
      and m.status = 'active'
  ));

-- ── 2. demo_articles ──────────────────────────────────────────────────
-- Pool global de artículos demo. Todos los tenants los ven a menos que
-- los hayan escondido (tenant_demo_hidden) o customizado (articles con
-- demo_ref = slug). Sin tenant_id porque son globales.
create table if not exists public.demo_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,     -- UNIQUE global, referenciado por demo_ref
  title text not null,
  excerpt text,
  cover_url text,
  body_html text not null default '',
  author_name text,
  category_slug text,             -- se resuelve al slug de demo_course_categories
  status text not null default 'published' check (status in ('draft', 'published')),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_demo_articles_status
  on public.demo_articles (status, published_at desc);
create index if not exists idx_demo_articles_category
  on public.demo_articles (category_slug);

alter table public.demo_articles enable row level security;
-- Lectura pública (anon + auth) — cualquier storefront puede leer el pool
drop policy if exists demo_articles_public_read on public.demo_articles;
create policy demo_articles_public_read on public.demo_articles
  for select using (status = 'published');

-- Campo demo_ref en articles (nullable). Cuando NO-null, esta row es
-- una customización del demo con slug=demo_ref. La UNIQUE (tenant_id, slug)
-- ya existente evita duplicados dentro del tenant.
alter table public.articles
  add column if not exists demo_ref text;
create index if not exists idx_articles_demo_ref
  on public.articles (tenant_id, demo_ref)
  where demo_ref is not null;

-- ── 3. demo_course_categories ────────────────────────────────────────
-- Pool global de categorías (mains + subs). parent_slug en vez de
-- parent_id porque en pool global no hay FK a categorías del tenant.
create table if not exists public.demo_course_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  parent_slug text,              -- referencia al slug del padre (mismo pool)
  position int not null default 0,
  is_featured boolean not null default false,
  accent_color text,             -- para el highlight en category_showcase
  created_at timestamptz not null default now()
);
create index if not exists idx_demo_cats_parent
  on public.demo_course_categories (parent_slug);

alter table public.demo_course_categories enable row level security;
drop policy if exists demo_cats_public_read on public.demo_course_categories;
create policy demo_cats_public_read on public.demo_course_categories
  for select using (true);

alter table public.course_categories
  add column if not exists demo_ref text;
create index if not exists idx_cats_demo_ref
  on public.course_categories (tenant_id, demo_ref)
  where demo_ref is not null;

-- ── 4. demo_physical_products ────────────────────────────────────────
-- Pool global de productos físicos. Sin variantes por ahora (los demos
-- se muestran como productos simples). Cuando el owner customiza, se
-- crea una row real donde pueden agregarse variantes.
create table if not exists public.demo_physical_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  cover_url text,
  gallery jsonb not null default '[]'::jsonb,
  price_cents int not null default 0,
  compare_at_price_cents int,     -- precio tachado, null = sin descuento
  stock_qty int not null default 0,
  category_slug text,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);
create index if not exists idx_demo_products_status
  on public.demo_physical_products (status);
create index if not exists idx_demo_products_category
  on public.demo_physical_products (category_slug);

alter table public.demo_physical_products enable row level security;
drop policy if exists demo_products_public_read on public.demo_physical_products;
create policy demo_products_public_read on public.demo_physical_products
  for select using (status = 'published');

alter table public.physical_products
  add column if not exists demo_ref text;
create index if not exists idx_products_demo_ref
  on public.physical_products (tenant_id, demo_ref)
  where demo_ref is not null;
