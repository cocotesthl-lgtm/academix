-- =====================================================================
-- 0069_article_tags.sql
-- Tags para artículos (Infobae/La Nación style — chips al final del post).
-- Aplica a articles del tenant y a demo_articles del pool.
--
-- text[] simple. Sin tabla separada de tags porque:
--   - No hay uso analítico intenso hoy
--   - GIN index sobre text[] es suficiente para search
--   - Simplicidad > normalización para este caso
-- =====================================================================

alter table public.articles
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_articles_tags
  on public.articles using gin (tags);

alter table public.demo_articles
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_demo_articles_tags
  on public.demo_articles using gin (tags);

-- Poblar tags en el pool demo con temas realistas (uno o dos por artículo).
-- Solo actualizamos si tags está vacío para no pisar customizaciones.
update public.demo_articles set tags = ARRAY['política', 'economía']
  where slug = 'analisis-plan-economico' and (tags is null or cardinality(tags) = 0);
update public.demo_articles set tags = ARRAY['ciudad', 'obras']
  where slug = 'ciudad-obras-modernizacion' and (tags is null or cardinality(tags) = 0);
update public.demo_articles set tags = ARRAY['salud', 'vacunas']
  where slug = 'salud-nueva-vacuna-aprobada' and (tags is null or cardinality(tags) = 0);
update public.demo_articles set tags = ARRAY['clima', 'alerta']
  where slug = 'clima-alerta-tormenta' and (tags is null or cardinality(tags) = 0);
update public.demo_articles set tags = ARRAY['diplomacia', 'internacional', 'cumbre']
  where slug = 'diplomacia-cumbre-tension' and (tags is null or cardinality(tags) = 0);
update public.demo_articles set tags = ARRAY['europa', 'elecciones']
  where slug = 'europa-elecciones-parlamento' and (tags is null or cardinality(tags) = 0);
update public.demo_articles set tags = ARRAY['comercio exterior', 'asia']
  where slug = 'asia-pacifico-comercio' and (tags is null or cardinality(tags) = 0);
update public.demo_articles set tags = ARRAY['inflación', 'economía']
  where slug = 'inflacion-baja-segundo-mes' and (tags is null or cardinality(tags) = 0);
update public.demo_articles set tags = ARRAY['dólar', 'mercados']
  where slug = 'dolar-mercado-cambiario' and (tags is null or cardinality(tags) = 0);
update public.demo_articles set tags = ARRAY['fútbol', 'liga']
  where slug = 'liga-nueva-temporada' and (tags is null or cardinality(tags) = 0);
update public.demo_articles set tags = ARRAY['tenis', 'final']
  where slug = 'tenis-final-abierta' and (tags is null or cardinality(tags) = 0);
