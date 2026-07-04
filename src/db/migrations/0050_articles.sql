-- =====================================================================
-- 0050_articles.sql
-- Módulo Blog / CMS de artículos editoriales.
--
-- Separado de `courses` porque los artículos NO son productos vendibles
-- — no tienen precio, no van al carrito, no generan enrollments. Es
-- contenido puramente editorial (noticias, artículos, guías).
-- =====================================================================

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  excerpt text,
  cover_url text,
  body_html text not null default '',
  author_name text,
  category_id uuid references public.course_categories(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_articles_tenant_status
  on public.articles (tenant_id, status, published_at desc);

alter table public.articles enable row level security;

-- Owner del tenant tiene acceso completo a sus artículos.
drop policy if exists articles_owner_all on public.articles;
create policy articles_owner_all on public.articles
  for all using (public.is_tenant_owner(tenant_id))
  with check (public.is_tenant_owner(tenant_id));

-- Público (anon) puede leer artículos publicados. Necesario para el
-- storefront /blog y /blog/[slug].
drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles
  for select using (status = 'published');
