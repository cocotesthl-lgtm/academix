-- =====================================================================
-- 0068_populate_demo_pool.sql
-- One-shot populator del pool demo global (news + ecommerce).
-- Migra las ~40 rows de news + ~12 de ecommerce que antes se insertaban
-- per-tenant al pool compartido. A partir de acá los templates NO
-- insertan nada — sólo modifican site_config.
--
-- Idempotente vía ON CONFLICT DO NOTHING sobre el UNIQUE slug.
-- =====================================================================

-- ── CATEGORÍAS DEMO (news + ecommerce) ────────────────────────────────
insert into public.demo_course_categories (slug, name, parent_slug, position, is_featured, accent_color)
values
  -- ── NEWS MAINS ─────────────────────────────────────────────
  ('ultimas',    'Últimas noticias', null, 0, true, '#dc2626'),
  ('mundo',      'Mundo',            null, 1, true, '#0891b2'),
  ('deportes',   'Deportes',         null, 2, true, '#16a34a'),
  ('politica',   'Política',         null, 3, true, '#7c3aed'),
  ('economia',   'Economía',         null, 4, true, '#ca8a04'),
  ('negocios',   'Negocios',         null, 5, true, '#0d9488'),
  ('policiales', 'Policiales',       null, 6, true, '#991b1b'),
  ('lifestyle',  'Lifestyle',        null, 7, true, '#db2777'),
  -- ── NEWS SUBS ──────────────────────────────────────────────
  ('sub-ee-uu',        'EE.UU.',           'mundo',       8,  false, null),
  ('sub-europa',       'Europa',           'mundo',       9,  false, null),
  ('sub-asia',         'Asia',             'mundo',       10, false, null),
  ('sub-latam',        'Latinoamérica',    'mundo',       11, false, null),
  ('sub-medio-oriente','Medio Oriente',    'mundo',       12, false, null),
  ('sub-futbol',       'Fútbol',           'deportes',    13, false, null),
  ('sub-tenis',        'Tenis',            'deportes',    14, false, null),
  ('sub-basquet',      'Básquet',          'deportes',    15, false, null),
  ('sub-rugby',        'Rugby',            'deportes',    16, false, null),
  ('sub-formula1',     'Fórmula 1',        'deportes',    17, false, null),
  ('sub-congreso',     'Congreso',         'politica',    18, false, null),
  ('sub-gobierno',     'Gobierno',         'politica',    19, false, null),
  ('sub-provincias',   'Provincias',       'politica',    20, false, null),
  ('sub-elecciones',   'Elecciones',       'politica',    21, false, null),
  ('sub-inflacion',    'Inflación',        'economia',    22, false, null),
  ('sub-dolar',        'Dólar',            'economia',    23, false, null),
  ('sub-bonos',        'Bonos',            'economia',    24, false, null),
  ('sub-consumo',      'Consumo',          'economia',    25, false, null),
  ('sub-empresas',     'Empresas',         'negocios',    26, false, null),
  ('sub-emprendedores','Emprendedores',    'negocios',    27, false, null),
  ('sub-fusiones',     'Fusiones y adquisiciones', 'negocios', 28, false, null),
  ('sub-crimenes',     'Crímenes',         'policiales',  29, false, null),
  ('sub-narcotrafico', 'Narcotráfico',     'policiales',  30, false, null),
  ('sub-ciberdelito',  'Ciberdelito',      'policiales',  31, false, null),
  ('sub-cine',         'Cine',             'lifestyle',   32, false, null),
  ('sub-gastronomia',  'Gastronomía',      'lifestyle',   33, false, null),
  ('sub-viajes',       'Viajes',           'lifestyle',   34, false, null),
  ('sub-moda',         'Moda',             'lifestyle',   35, false, null),
  ('sub-bienestar',    'Bienestar',        'lifestyle',   36, false, null),
  ('sub-libros',       'Libros',           'lifestyle',   37, false, null),
  -- ── ECOMMERCE MAINS ────────────────────────────────────────
  ('ec-ropa',       'Ropa',           null, 100, true, '#0a0a0a'),
  ('ec-tecnologia', 'Tecnología',     null, 101, true, '#0a0a0a'),
  ('ec-hogar',      'Hogar',          null, 102, true, '#0a0a0a'),
  ('ec-deportes',   'Deportes',       null, 103, true, '#0a0a0a')
on conflict (slug) do nothing;

-- ── ARTÍCULOS DEMO (news) ─────────────────────────────────────────────
insert into public.demo_articles (slug, title, excerpt, cover_url, author_name, category_slug, published_at)
values
  -- Últimas
  ('analisis-plan-economico', 'Análisis: el plan económico ante la nueva coyuntura', 'Un informe detallado sobre las medidas anunciadas esta semana y sus implicancias para el sector productivo.', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&auto=format&fit=crop&q=80', 'Redacción Económica', 'ultimas', now()),
  ('ciudad-obras-modernizacion', 'La ciudad avanza con obras de modernización urbana', 'Nuevos corredores viales, plazas y espacios verdes se suman al plan integral.', 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&auto=format&fit=crop&q=80', 'Redacción Ciudad', 'ultimas', now() - interval '1 day'),
  ('salud-nueva-vacuna-aprobada', 'Aprueban nueva vacuna con eficacia superior al 90%', 'El anuncio marca un hito en la lucha contra la enfermedad.', 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=800&auto=format&fit=crop&q=80', 'Salud', 'ultimas', now() - interval '1 day'),
  ('clima-alerta-tormenta', 'Alerta meteorológica: tormentas fuertes en varias provincias', 'El Servicio Meteorológico Nacional emitió alertas de nivel amarillo.', 'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=800&auto=format&fit=crop&q=80', 'Clima', 'ultimas', now() - interval '1 day'),
  -- Mundo
  ('diplomacia-cumbre-tension', 'Diplomacia en tensión: qué se juega en la próxima cumbre', 'Los principales líderes se reúnen esta semana.', 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1200&auto=format&fit=crop&q=80', 'Corresponsal Internacional', 'mundo', now()),
  ('europa-elecciones-parlamento', 'Elecciones parlamentarias en Europa: quién saca ventaja', 'Las encuestas muestran un panorama fragmentado.', 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&auto=format&fit=crop&q=80', 'Bureau Europa', 'mundo', now() - interval '2 days'),
  ('asia-pacifico-comercio', 'Nuevo acuerdo comercial en el Pacífico redefine bloques', 'Ocho países firman un tratado.', 'https://images.unsplash.com/photo-1553546895-531931aa1aa8?w=800&auto=format&fit=crop&q=80', 'Bureau Asia', 'mundo', now() - interval '3 days'),
  ('medio-oriente-conflicto', 'Escalada en Medio Oriente: análisis en profundidad', 'Nuestro corresponsal explica los factores.', 'https://images.unsplash.com/photo-1544413660-299165566b1d?w=800&auto=format&fit=crop&q=80', 'Corresponsal Internacional', 'mundo', now() - interval '4 days'),
  ('mundo-tecnologia-china', 'China acelera su plan de autosuficiencia tecnológica', 'Nuevas fábricas de chips y satélites propios.', 'https://images.unsplash.com/photo-1512446733611-9099a758e63c?w=800&auto=format&fit=crop&q=80', 'Corresponsal Asia', 'mundo', now() - interval '5 days'),
  ('mundo-migraciones-crisis', 'Crisis migratoria en el Mediterráneo: cifras récord', 'Miles de personas cruzan cada mes en condiciones precarias.', 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&auto=format&fit=crop&q=80', 'Enviado Especial', 'mundo', now() - interval '6 days'),
  ('mundo-cambio-climatico', 'La ONU alerta por el impacto acelerado del cambio climático', 'Un informe de más de 500 páginas resume la evidencia.', 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800&auto=format&fit=crop&q=80', 'Medio Ambiente', 'mundo', now() - interval '7 days'),
  -- Deportes
  ('liga-nueva-temporada', 'Arrancó la nueva temporada con sorpresas en la tabla', 'Los primeros resultados marcaron una jornada de sorpresas.', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80', 'Deportes', 'deportes', now() - interval '1 day'),
  ('tenis-final-abierta', 'El tenis vivió una final abierta y con vueltas', 'Tres horas de juego dejaron a los fans al borde del asiento.', 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&auto=format&fit=crop&q=80', 'Deportes', 'deportes', now() - interval '2 days'),
  ('basquet-derrota-historica', 'Derrota histórica en el arranque del torneo', 'El equipo local cayó por primera vez en su cancha.', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80', 'Deportes', 'deportes', now() - interval '3 days'),
  ('formula1-nueva-temporada', 'Fórmula 1: se viene una temporada llena de cambios', 'Nuevos autos, nuevas reglas y sorpresas.', 'https://images.unsplash.com/photo-1541447271487-09612b3f49f7?w=800&auto=format&fit=crop&q=80', 'Motorsport', 'deportes', now() - interval '4 days'),
  ('deportes-rugby-final', 'Rugby: se define la final del torneo esta noche', 'Los dos históricos rivales se enfrentan por el título.', 'https://images.unsplash.com/photo-1512299546147-98b0c76f6be6?w=800&auto=format&fit=crop&q=80', 'Deportes', 'deportes', now() - interval '5 days'),
  ('deportes-atletismo-record', 'Nuevo récord nacional en atletismo', 'Una marca que llevaba 15 años sin ser superada finalmente cayó.', 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80', 'Atletismo', 'deportes', now() - interval '6 days'),
  ('deportes-natacion-panamericano', 'Natación: el equipo brilló en el Panamericano', 'Cinco medallas de oro y récords personales.', 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&auto=format&fit=crop&q=80', 'Deportes', 'deportes', now() - interval '7 days'),
  -- Política
  ('ley-debate-congreso', 'Debate en el Congreso: ley clave se define esta semana', 'Diputados y senadores intercambian posiciones.', 'https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&auto=format&fit=crop&q=80', 'Política', 'politica', now()),
  ('gabinete-cambios-anunciados', 'Cambios en el gabinete: quiénes entran y quiénes salen', 'El primer mandatario anunció modificaciones en cinco ministerios.', 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=800&auto=format&fit=crop&q=80', 'Política', 'politica', now() - interval '2 days'),
  ('provincias-reunion-gobernadores', 'Gobernadores de provincias se reunieron', 'Una cumbre inédita busca sentar posición común.', 'https://images.unsplash.com/photo-1518057111178-44a106bad636?w=800&auto=format&fit=crop&q=80', 'Federal', 'politica', now() - interval '3 days'),
  -- Economía
  ('inflacion-baja-segundo-mes', 'Cayó la inflación mensual por segundo mes consecutivo', 'El índice de precios mostró una desaceleración marcada.', 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&auto=format&fit=crop&q=80', 'Economía', 'economia', now()),
  ('dolar-mercado-cambiario', 'Dólar hoy: cierre estable tras jornada volátil', 'El tipo de cambio se mantuvo dentro de la banda esperada.', 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80', 'Finanzas', 'economia', now() - interval '1 day'),
  ('exportaciones-record-trimestre', 'Récord de exportaciones en el trimestre', 'Las ventas al exterior superaron todas las proyecciones.', 'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=800&auto=format&fit=crop&q=80', 'Comercio Exterior', 'economia', now() - interval '3 days'),
  ('economia-consumo-caida', 'El consumo mostró señales de recuperación en abril', 'Los rubros de electro y textil lideraron la mejora.', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop&q=80', 'Consumo', 'economia', now() - interval '5 days'),
  ('economia-bonos-riesgo-pais', 'El riesgo país bajó a mínimos del año', 'Los bonos soberanos tuvieron una jornada positiva.', 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&auto=format&fit=crop&q=80', 'Finanzas', 'economia', now() - interval '6 days'),
  ('economia-inversion-industria', 'Anuncian inversiones millonarias en el sector industrial', 'Tres proyectos que suman más de 500 millones de dólares.', 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800&auto=format&fit=crop&q=80', 'Industria', 'economia', now() - interval '7 days'),
  -- Negocios
  ('startup-argentina-recibe-inversion', 'Startup argentina recibe inversión millonaria', 'La empresa cerró una ronda serie B por USD 20 millones.', 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop&q=80', 'Negocios', 'negocios', now() - interval '1 day'),
  ('fusion-empresas-tecnologia', 'Fusión de dos gigantes tecnológicos redefine el sector', 'La operación creó la tercera empresa más grande del país.', 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&auto=format&fit=crop&q=80', 'M&A', 'negocios', now() - interval '2 days'),
  ('emprendedor-historia-exito', 'De la nada al éxito: la historia del emprendedor del año', 'Cómo un joven de 28 años construyó una empresa millonaria.', 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&auto=format&fit=crop&q=80', 'Perfiles', 'negocios', now() - interval '3 days'),
  -- Policiales
  ('operativo-narcotrafico-detenidos', 'Gran operativo antinarcóticos: veinte detenidos', 'Fuerzas federales desarticularon una banda en tres provincias.', 'https://images.unsplash.com/photo-1591123120675-6f7f1aae0e5b?w=800&auto=format&fit=crop&q=80', 'Policiales', 'policiales', now()),
  ('robo-banco-esclarecido', 'Esclarecen robo a un banco céntrico', 'La investigación permitió identificar y capturar a los autores.', 'https://images.unsplash.com/photo-1601582589907-f92af5ed9db8?w=800&auto=format&fit=crop&q=80', 'Policiales', 'policiales', now() - interval '2 days'),
  ('ciberdelito-fraude-online', 'Alerta por nueva modalidad de fraude online', 'Especialistas explican cómo prevenir el engaño.', 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&auto=format&fit=crop&q=80', 'Ciberseguridad', 'policiales', now() - interval '3 days'),
  -- Lifestyle
  ('cine-festival-ganadores', 'Se conocieron los ganadores del festival de cine', 'Una noche cargada de emoción con premios al cine independiente.', 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop&q=80', 'Cultura', 'lifestyle', now() - interval '2 days'),
  ('gastronomia-nuevo-restaurante', 'Abrió un restaurante que ya es sensación', 'La propuesta combina cocina de autor con precios accesibles.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80', 'Gastronomía', 'lifestyle', now() - interval '3 days'),
  ('viajes-destino-tendencia', 'El destino tendencia del año para escaparse', 'Playa, montaña o ciudad: tres opciones para todos los gustos.', 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80', 'Viajes', 'lifestyle', now() - interval '4 days'),
  ('moda-tendencias-otono', 'Las 5 tendencias de moda para el otoño', 'Colores tierra, capas y ropa oversized dominan la temporada.', 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=800&auto=format&fit=crop&q=80', 'Estilo', 'lifestyle', now() - interval '5 days'),
  ('lifestyle-yoga-oficina', 'Yoga en la oficina: 5 posturas para bajar el estrés', 'Ejercicios que podés hacer sin levantarte de la silla.', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop&q=80', 'Bienestar', 'lifestyle', now() - interval '6 days'),
  ('lifestyle-libros-recomendados', 'Los 10 libros del año que hay que leer', 'Ficción, ensayo, memoirs y bestsellers seleccionados.', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&auto=format&fit=crop&q=80', 'Libros', 'lifestyle', now() - interval '7 days'),
  ('lifestyle-decoracion-tendencias', 'Decoración: el estilo que se impone este año', 'Minimalismo cálido, madera clara y verde salvia.', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&auto=format&fit=crop&q=80', 'Diseño', 'lifestyle', now() - interval '8 days')
on conflict (slug) do nothing;

-- ── PRODUCTOS FÍSICOS DEMO (ecommerce) ────────────────────────────────
insert into public.demo_physical_products (slug, title, description, cover_url, price_cents, compare_at_price_cents, stock_qty, category_slug)
values
  -- Ropa
  ('remera-basica-blanca', 'Remera básica de algodón', 'Corte regular, 100% algodón peinado. Ideal para uso diario.', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=80', 490000, 690000, 25, 'ec-ropa'),
  ('sweater-oversized', 'Sweater oversized', 'Tejido grueso, calce holgado. Colores neutros de temporada.', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&auto=format&fit=crop&q=80', 1290000, null, 15, 'ec-ropa'),
  ('jean-slim', 'Jean slim fit', 'Denim premium, 5 bolsillos, tiro medio. Talles del 38 al 48.', 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&auto=format&fit=crop&q=80', 1590000, null, 30, 'ec-ropa'),
  -- Tecnología
  ('auriculares-bluetooth', 'Auriculares bluetooth premium', 'Cancelación activa de ruido, 30hs de batería, estuche de carga.', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80', 8990000, 12990000, 12, 'ec-tecnologia'),
  ('teclado-mecanico', 'Teclado mecánico RGB', 'Switches Cherry MX Red, retroiluminado, layout latino.', 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=800&auto=format&fit=crop&q=80', 4590000, null, 8, 'ec-tecnologia'),
  ('mouse-inalambrico', 'Mouse inalámbrico ergonómico', 'Sensor óptico 1600 DPI, batería de larga duración.', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80', 1890000, 2490000, 40, 'ec-tecnologia'),
  -- Hogar
  ('vela-aromatica', 'Vela aromática natural', 'Cera de soja, aroma a lavanda, 40 horas de duración.', 'https://images.unsplash.com/photo-1602874801007-097e0dea2fb4?w=800&auto=format&fit=crop&q=80', 680000, null, 50, 'ec-hogar'),
  ('sabanas-algodon', 'Set de sábanas de algodón', 'Percal 200 hilos, incluye ajustable + funda de almohada.', 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&auto=format&fit=crop&q=80', 2490000, null, 18, 'ec-hogar'),
  -- Deportes
  ('mochila-trekking', 'Mochila trekking 40L', 'Impermeable, tirantes acolchados, correa de pecho ajustable.', 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=800&auto=format&fit=crop&q=80', 3490000, 4290000, 20, 'ec-deportes'),
  ('botella-termica', 'Botella térmica 750ml', 'Acero inoxidable, mantiene temperatura 12h. Colores varios.', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80', 890000, null, 60, 'ec-deportes')
on conflict (slug) do nothing;
