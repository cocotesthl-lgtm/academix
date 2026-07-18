-- =====================================================================
-- 0072_add_cern_video.sql
-- Agrega un video más al pool demo: CERN & límites del átomo.
-- =====================================================================

insert into public.demo_videos (slug, title, description, youtube_id, category_slug, position)
values (
  'cern-limites-atomo',
  'Ponen a prueba los límites del átomo en el CERN',
  'Cómo el mayor acelerador de partículas del mundo empuja los límites de nuestro conocimiento sobre la materia.',
  'YGJ6ocv_z4g',
  null,
  4
)
on conflict (slug) do nothing;
