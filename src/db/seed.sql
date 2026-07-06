-- =====================================================================
-- OfferNow — Optional seed data (Week 10)
-- Run AFTER 0001_init.sql + 0002_storage_policies.sql.
-- Requires: at least one signed-up user exists (auth.users / profiles).
--
-- This script picks the FIRST profile in the database as the demo owner,
-- creates two example academias, with a couple of published courses each.
-- =====================================================================

do $$
declare
  demo_user uuid;
  tenant1 uuid := gen_random_uuid();
  tenant2 uuid := gen_random_uuid();
  course1 uuid := gen_random_uuid();
  course2 uuid := gen_random_uuid();
  course3 uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid();
  m2 uuid := gen_random_uuid();
begin
  select id into demo_user from public.profiles order by created_at asc limit 1;
  if demo_user is null then
    raise notice 'No profile found — sign up at least one user first via /signup.';
    return;
  end if;

  -- Tenant 1: Diseño UX
  insert into public.tenants (id, slug, name, owner_user_id, brand, status)
  values (tenant1, 'demouxdesign', 'Demo UX Design', demo_user,
          '{"primary_color": "#f97316", "accent_color": "#ec4899"}'::jsonb, 'active')
  on conflict (slug) do nothing;

  insert into public.memberships (user_id, tenant_id, role, status)
  values (demo_user, tenant1, 'owner', 'active')
  on conflict do nothing;

  insert into public.courses (id, tenant_id, slug, title, description, price_cents, currency, status, affiliate_enabled, created_by)
  values
    (course1, tenant1, 'ux-research-demo', 'UX Research desde cero (demo)',
     'Curso demo con 2 módulos. Aprendé entrevistas, encuestas y validación con usuarios reales.',
     24900*100, 'ARS', 'published', true, demo_user),
    (course2, tenant1, 'figma-demo', 'Figma profesional (demo)',
     'De principiante a auto-layout y componentes avanzados.',
     19900*100, 'ARS', 'published', true, demo_user)
  on conflict do nothing;

  insert into public.modules (id, tenant_id, course_id, position, title)
  values
    (m1, tenant1, course1, 0, 'Fundamentos de research'),
    (m2, tenant1, course1, 1, 'Análisis y reporting')
  on conflict do nothing;

  insert into public.lessons (tenant_id, module_id, position, title, is_preview)
  values
    (tenant1, m1, 0, 'Por qué investigar antes de diseñar', true),
    (tenant1, m1, 1, 'Entrevistas en profundidad', false),
    (tenant1, m2, 0, 'Affinity mapping', false)
  on conflict do nothing;

  -- Tenant 2: Trading
  insert into public.tenants (id, slug, name, owner_user_id, brand, status)
  values (tenant2, 'demotrading', 'Demo Trading Academy', demo_user,
          '{"primary_color": "#10b981", "accent_color": "#3b82f6"}'::jsonb, 'active')
  on conflict (slug) do nothing;

  insert into public.memberships (user_id, tenant_id, role, status)
  values (demo_user, tenant2, 'owner', 'active')
  on conflict do nothing;

  insert into public.courses (id, tenant_id, slug, title, description, price_cents, currency, status, affiliate_enabled, created_by)
  values
    (course3, tenant2, 'price-action-demo', 'Price action básico (demo)',
     'Lectura de velas, soportes y resistencias.',
     14900*100, 'ARS', 'published', true, demo_user)
  on conflict do nothing;

  raise notice 'Seed listo. Academias en: demouxdesign.localhost:3000 y demotrading.localhost:3000';
end $$;
