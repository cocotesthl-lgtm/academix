-- =====================================================================
-- 0074_article_video.sql
-- Cada artículo puede tener un YouTube video opcional que reemplaza su
-- cover en posiciones destacadas (featured del category_showcase,
-- newspaper layout, etc). El video autoplayea muted como preview.
--
-- Sin sección separada de "videos destacados" — el video vive PEGADO
-- al artículo y aparece donde ese artículo se muestra en grande.
-- =====================================================================

alter table public.articles
  add column if not exists youtube_video_id text;

alter table public.demo_articles
  add column if not exists youtube_video_id text;

-- Linkeo el video hero al artículo demo destacado del bloque Mundo
-- (que es donde el owner señaló "donde están las personas chocando
-- los puños" — foto que corresponde a este artículo). Al aplicar la
-- migration, ese artículo empieza a mostrar el video autoplayeando
-- muted en vez de la foto cover.
update public.demo_articles
  set youtube_video_id = 'NbCdK4a6euQ'
  where slug = 'diplomacia-cumbre-tension'
    and (youtube_video_id is null or youtube_video_id = '');
