-- =====================================================================
-- 0029_course_ribbon.sql
-- Cinta (ribbon) por curso — aparece sobre la tarjeta del catálogo.
-- Ej. "OFERTA", "DESTACADO", "ÚLTIMOS DÍAS", "NUEVO".
-- =====================================================================

alter table public.courses
  add column if not exists ribbon_text text,
  add column if not exists ribbon_tone text default 'featured'
    check (ribbon_tone in ('featured', 'sale', 'urgent', 'new', 'info'));
