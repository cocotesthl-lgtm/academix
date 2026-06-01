-- 0007_course_landings.sql
--
-- Cada curso ahora tiene su propia landing page con plantilla elegible
-- (classic / hotmart / funnel / vsl) y un config jsonb con overrides
-- (textos del hero, garantía, bonus, FAQ específico del curso, etc).
--
-- Preparado para futuro A/B/C testing por afiliado vía landing_variants:
-- el afiliado va a poder elegir qué variante usar en sus links para
-- comparar conversión. Variants tiene shape:
--   { "B": { "template": "funnel", "config": {...} }, "C": {...} }
-- La variante "default" es lo que la columna landing_template / landing_config
-- definen y es lo que ven los visitantes sin ?v=B.
--
-- Aplicar en Supabase SQL editor.

alter table public.courses
  add column if not exists landing_template text default 'classic',
  add column if not exists landing_config   jsonb default '{}'::jsonb,
  add column if not exists landing_variants jsonb default null;

-- Constraint suave: template debe ser uno de los conocidos
alter table public.courses
  drop constraint if exists courses_landing_template_check;
alter table public.courses
  add constraint courses_landing_template_check
  check (landing_template in ('classic', 'hotmart', 'funnel', 'vsl'));
