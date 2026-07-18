-- =====================================================================
-- 0073_videos_featured.sql
-- Video destacado: primer video de la sección se muestra GRANDE con
-- autoplay muted (tipo hero preview) arriba de la strip de shorts.
-- =====================================================================

alter table public.demo_videos
  add column if not exists is_featured boolean not null default false;

alter table public.videos
  add column if not exists is_featured boolean not null default false;

-- Nuevo video destacado — versión larga sobre IA + agua (no un short).
-- Position -1 para que quede primero en el orden natural.
insert into public.demo_videos (slug, title, description, youtube_id, is_featured, position)
values (
  'ia-agua-explicacion-completa',
  'Por esto la IA consume tanta agua',
  'La explicación completa del impacto ambiental de los datacenters que entrenan modelos como ChatGPT.',
  'NbCdK4a6euQ',
  true,
  -1
)
on conflict (slug) do update set is_featured = excluded.is_featured;
