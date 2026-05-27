-- =====================================================================
-- Curplat — Site builder + course merchandising (Sprint 1)
-- Run AFTER 0001 + 0002.
-- =====================================================================

-- Add site_config to tenants (default config with all key sections enabled)
alter table public.tenants
  add column if not exists site_config jsonb not null default '{
    "sections": {
      "hero":         { "enabled": true,  "title": null, "subtitle": "Aprendé con nosotros.", "cta_label": "Ver cursos", "cta_href": "#cursos" },
      "about":        { "enabled": false, "title": "Sobre nosotros", "body": "", "image_url": null },
      "featured":     { "enabled": true,  "title": "Cursos destacados" },
      "catalog":      { "enabled": true,  "title": "Todos los cursos", "show_filters": true },
      "testimonials": { "enabled": false, "title": "Lo que dicen nuestros alumnos", "items": [] },
      "faq":          { "enabled": false, "title": "Preguntas frecuentes", "items": [] },
      "cta_final":    { "enabled": false, "title": "¿Listo para empezar?", "body": "", "cta_label": "Quiero inscribirme", "cta_href": "#cursos" }
    },
    "order": ["hero", "about", "featured", "catalog", "testimonials", "faq", "cta_final"]
  }'::jsonb;

-- Course categories per tenant
create table if not exists public.course_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists idx_categories_tenant on public.course_categories(tenant_id, position);

alter table public.course_categories enable row level security;

drop policy if exists categories_public_select on public.course_categories;
create policy categories_public_select on public.course_categories
  for select using (true);

drop policy if exists categories_owner_write on public.course_categories;
create policy categories_owner_write on public.course_categories
  for all
  using (public.is_tenant_owner(tenant_id) or public.is_super_admin())
  with check (public.is_tenant_owner(tenant_id) or public.is_super_admin());

-- Course merchandising fields
alter table public.courses
  add column if not exists category_id uuid references public.course_categories(id) on delete set null,
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_position int not null default 0;

create index if not exists idx_courses_featured on public.courses(tenant_id, is_featured, featured_position)
  where is_featured = true;
create index if not exists idx_courses_category on public.courses(category_id);
