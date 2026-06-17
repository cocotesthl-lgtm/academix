-- =====================================================================
-- 0031_vip_packs.sql
-- Generalización: courses pasa a ser "creaciones" — puede ser un curso
-- tradicional (con módulos/lecciones) o un pack VIP multimedia (galería
-- de imágenes/videos que se desbloquea con la compra).
--
-- Estrategia: reusar tabla courses + product_type + media_items jsonb.
-- Cero impacto sobre cursos existentes (product_type default 'course').
-- =====================================================================

alter table public.courses
  add column if not exists product_type text default 'course',
  add column if not exists media_items jsonb default '[]'::jsonb,
  add column if not exists preview_url text,        -- preview público (thumbnail blureado/recortado)
  add column if not exists pack_description text;    -- desc larga visible antes de comprar

do $$ begin
  alter table public.courses
    add constraint courses_product_type_check
    check (product_type in ('course', 'vip_pack'));
exception when duplicate_object then null; end $$;

-- Index para filtrar productos por tipo rápido
create index if not exists idx_courses_type on public.courses(tenant_id, product_type);
