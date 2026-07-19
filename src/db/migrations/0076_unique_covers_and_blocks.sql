-- =====================================================================
-- 0076_unique_covers_and_blocks.sql
-- Dos correcciones sobre el pool demo + tenants existentes:
--
-- 1) COVERS ÚNICAS: cada artículo demo recibe un cover_url distinto.
--    Antes había mucho reuse (11 rows compartían la misma foto de
--    congreso, 9 el mismo de billetes, etc), lo que hacía muy obvio
--    el "es demo" al ver la home. Ahora cada slug tiene su unsplash
--    propio, curado por categoría.
--
-- 2) TENANTS EXISTENTES: los sitios que ya aplicaron el template news
--    tienen category_showcase.blocks con sólo 4 bloques (Mundo /
--    Deportes / Economía / Lifestyle) y count=7. El template nuevo
--    tiene 7 bloques con count=5. Este script parcha el JSON de
--    site_config in-place para que los sitios existentes también
--    muestren Política, Negocios, Policiales y respeten el layout
--    1+4. Idempotente: si ya tienen los bloques, no duplica.
-- =====================================================================

-- ── 1) COVERS ÚNICOS POR SLUG ────────────────────────────────────────

-- Últimas
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=1600&auto=format&fit=crop&q=80' where slug = 'clima-alerta-tormenta';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=1600&auto=format&fit=crop&q=80' where slug = 'salud-nueva-vacuna-aprobada';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&auto=format&fit=crop&q=80' where slug = 'ciudad-obras-modernizacion';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&auto=format&fit=crop&q=80' where slug = 'analisis-plan-economico';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1600&auto=format&fit=crop&q=80' where slug = 'decision-silenciosa-cambia-pais';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1600&auto=format&fit=crop&q=80' where slug = 'errores-lideres-crisis';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&auto=format&fit=crop&q=80' where slug = 'economia-crece-lugar-equivocado';

-- Mundo (el diplomacia-cumbre-tension mantiene su cover porque tiene video overlay)
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1600&auto=format&fit=crop&q=80' where slug = 'diplomacia-cumbre-tension';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1600&auto=format&fit=crop&q=80' where slug = 'europa-elecciones-parlamento';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1553546895-531931aa1aa8?w=1600&auto=format&fit=crop&q=80' where slug = 'asia-pacifico-comercio';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1544413660-299165566b1d?w=1600&auto=format&fit=crop&q=80' where slug = 'medio-oriente-conflicto';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1512446733611-9099a758e63c?w=1600&auto=format&fit=crop&q=80' where slug = 'mundo-tecnologia-china';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1600&auto=format&fit=crop&q=80' where slug = 'mundo-migraciones-crisis';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=1600&auto=format&fit=crop&q=80' where slug = 'mundo-cambio-climatico';

-- Deportes
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80' where slug = 'liga-nueva-temporada';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1600&auto=format&fit=crop&q=80' where slug = 'tenis-final-abierta';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1600&auto=format&fit=crop&q=80' where slug = 'basquet-derrota-historica';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1541447271487-09612b3f49f7?w=1600&auto=format&fit=crop&q=80' where slug = 'formula1-nueva-temporada';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1512299546147-98b0c76f6be6?w=1600&auto=format&fit=crop&q=80' where slug = 'deportes-rugby-final';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1600&auto=format&fit=crop&q=80' where slug = 'deportes-atletismo-record';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1600&auto=format&fit=crop&q=80' where slug = 'deportes-natacion-panamericano';

-- Política
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=1600&auto=format&fit=crop&q=80' where slug = 'ley-debate-congreso';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=1600&auto=format&fit=crop&q=80' where slug = 'gabinete-cambios-anunciados';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1518057111178-44a106bad636?w=1600&auto=format&fit=crop&q=80' where slug = 'provincias-reunion-gobernadores';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1600&auto=format&fit=crop&q=80' where slug = 'mapa-electoral-2027';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1580128637411-c17ae3d99e7d?w=1600&auto=format&fit=crop&q=80' where slug = 'siglo-populismo-latinoamericano';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=1600&auto=format&fit=crop&q=80' where slug = 'mito-democracia-directa';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1575320181282-9afab399332c?w=1600&auto=format&fit=crop&q=80' where slug = 'gobierno-vs-oposicion-poder-real';

-- Economía
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1600&auto=format&fit=crop&q=80' where slug = 'inflacion-baja-segundo-mes';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&auto=format&fit=crop&q=80' where slug = 'dolar-mercado-cambiario';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=1600&auto=format&fit=crop&q=80' where slug = 'exportaciones-record-trimestre';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1600&auto=format&fit=crop&q=80' where slug = 'economia-consumo-caida';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1600&auto=format&fit=crop&q=80' where slug = 'economia-bonos-riesgo-pais';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1600&auto=format&fit=crop&q=80' where slug = 'economia-inversion-industria';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=1600&auto=format&fit=crop&q=80' where slug = '10-paises-mayor-inflacion';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1621501103258-d0984c86ea55?w=1600&auto=format&fit=crop&q=80' where slug = 'dolarizacion-que-pasaria';

-- Negocios
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&auto=format&fit=crop&q=80' where slug = 'startup-argentina-recibe-inversion';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1600&auto=format&fit=crop&q=80' where slug = 'fusion-empresas-tecnologia';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&auto=format&fit=crop&q=80' where slug = 'emprendedor-historia-exito';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1600&auto=format&fit=crop&q=80' where slug = 'empresas-explotaron-2026';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1600&auto=format&fit=crop&q=80' where slug = 'emprendedores-fracasan-motivos';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1600&auto=format&fit=crop&q=80' where slug = 'pyme-argentina-30-paises';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1600&auto=format&fit=crop&q=80' where slug = 'fusion-corporativa-oculta';

-- Policiales
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1591123120675-6f7f1aae0e5b?w=1600&auto=format&fit=crop&q=80' where slug = 'operativo-narcotrafico-detenidos';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1601582589907-f92af5ed9db8?w=1600&auto=format&fit=crop&q=80' where slug = 'robo-banco-esclarecido';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1600&auto=format&fit=crop&q=80' where slug = 'ciberdelito-fraude-online';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1508921912186-1d1a45ebb3c1?w=1600&auto=format&fit=crop&q=80' where slug = 'crimen-347-madrugada';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1600&auto=format&fit=crop&q=80' where slug = 'ruta-narco-tres-continentes';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1600&auto=format&fit=crop&q=80' where slug = 'nuevos-fraudes-cuentas';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1587560699334-cc4ff634909a?w=1600&auto=format&fit=crop&q=80' where slug = 'detective-caso-20-anios';

-- Lifestyle
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600&auto=format&fit=crop&q=80' where slug = 'cine-festival-ganadores';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&auto=format&fit=crop&q=80' where slug = 'gastronomia-nuevo-restaurante';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&auto=format&fit=crop&q=80' where slug = 'viajes-destino-tendencia';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=1600&auto=format&fit=crop&q=80' where slug = 'moda-tendencias-otono';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1600&auto=format&fit=crop&q=80' where slug = 'lifestyle-yoga-oficina';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1600&auto=format&fit=crop&q=80' where slug = 'lifestyle-libros-recomendados';
update public.demo_articles set cover_url = 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1600&auto=format&fit=crop&q=80' where slug = 'lifestyle-decoracion-tendencias';

-- ── 2) PARCHAR category_showcase.blocks EN TENANTS EXISTENTES ────────
--
-- site_config es una columna JSONB dentro de la tabla tenants (draft),
-- y hay una segunda columna site_config_published con el snapshot que
-- el storefront efectivamente sirve al público. Parchamos las DOS
-- columnas para que el cambio se vea sin que el owner tenga que
-- volver a publicar. jsonb_set sólo actúa si el path ya existe, así
-- que sitios sin showcase activo no se ven afectados.

-- Draft
update public.tenants
set site_config = jsonb_set(
  site_config,
  '{sections,category_showcase,blocks}',
  '[
    {"id":"cs-mundo","title":"Mundo","category_slug":"mundo","accent_color":"#0891b2","count":5},
    {"id":"cs-politica","title":"Política","category_slug":"politica","accent_color":"#7c3aed","count":5},
    {"id":"cs-economia","title":"Economía","category_slug":"economia","accent_color":"#ca8a04","count":5},
    {"id":"cs-deportes","title":"Deportes","category_slug":"deportes","accent_color":"#16a34a","count":5},
    {"id":"cs-negocios","title":"Negocios","category_slug":"negocios","accent_color":"#0d9488","count":5},
    {"id":"cs-policiales","title":"Policiales","category_slug":"policiales","accent_color":"#991b1b","count":5},
    {"id":"cs-lifestyle","title":"Lifestyle","category_slug":"lifestyle","accent_color":"#db2777","count":5}
  ]'::jsonb,
  false
)
where site_config is not null
  and (site_config #> '{sections,category_showcase,enabled}')::text = 'true';

-- Published snapshot
update public.tenants
set site_config_published = jsonb_set(
  site_config_published,
  '{sections,category_showcase,blocks}',
  '[
    {"id":"cs-mundo","title":"Mundo","category_slug":"mundo","accent_color":"#0891b2","count":5},
    {"id":"cs-politica","title":"Política","category_slug":"politica","accent_color":"#7c3aed","count":5},
    {"id":"cs-economia","title":"Economía","category_slug":"economia","accent_color":"#ca8a04","count":5},
    {"id":"cs-deportes","title":"Deportes","category_slug":"deportes","accent_color":"#16a34a","count":5},
    {"id":"cs-negocios","title":"Negocios","category_slug":"negocios","accent_color":"#0d9488","count":5},
    {"id":"cs-policiales","title":"Policiales","category_slug":"policiales","accent_color":"#991b1b","count":5},
    {"id":"cs-lifestyle","title":"Lifestyle","category_slug":"lifestyle","accent_color":"#db2777","count":5}
  ]'::jsonb,
  false
)
where site_config_published is not null
  and (site_config_published #> '{sections,category_showcase,enabled}')::text = 'true';
