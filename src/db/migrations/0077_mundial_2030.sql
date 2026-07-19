-- =====================================================================
-- 0077_mundial_2030.sql
-- Suma 4 artículos al pool demo para poblar la nueva sección
-- featured_event con contenido de ejemplo alrededor del Mundial 2030.
--
-- La sección featured_event filtra por TAG (no por categoría), lo que
-- permite agrupar notas de distintas secciones (Deportes, Política,
-- Cultura, Clima) bajo un mismo evento — igual que hacen los grandes
-- portales para eventos que atraviesan múltiples ángulos editoriales.
--
-- Todas taggeadas con 'mundial-2030' + tags secundarios coherentes.
-- Evergreen: no citan fechas específicas ni jugadores reales.
-- =====================================================================

insert into public.demo_articles
  (slug, title, excerpt, cover_url, author_name, category_slug, published_at, body_html, tags)
values

(
  'mundial-2030-tercer-puesto-europa',
  'La lucha por el tercer puesto del Mundial: quiénes son los candidatos que nadie está viendo',
  'La atención se la llevan las selecciones favoritas, pero el bronce se juega entre tres candidatas que hoy están volando por debajo del radar. Estos son los nombres que están mirando los apostadores profesionales.',
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80',
  'Bureau Europa',
  'deportes',
  now() - interval '6 hours',
  E'<p>Todo el ruido mediático del Mundial 2030 se concentra en el pequeño grupo de tres o cuatro selecciones favoritas al título. Pero los apostadores profesionales — esos que mueven cientos de millones de dólares antes de cada gran torneo — están mirando otra cosa: el podio. Y más específicamente, el partido por el tercer puesto, donde se juega valor real a cuotas que la mayoría subestima.</p><figure><img src="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80" alt="Estadio de fútbol" /><figcaption>El podio de un Mundial tiene consecuencias que van mucho más allá del prestigio deportivo.</figcaption></figure><p>Tres candidatas concentran hoy el interés silencioso de las mesas de análisis. La primera es una selección europea con generación de recambio inédita, que acumuló minutos internacionales en las últimas dos ventanas FIFA y llega con cuerpo técnico estable después de años de rotación. Los datos avanzados de <em>expected goals</em> la ubican en el top-5 mundial de eficiencia ofensiva, aunque su nombre casi no aparece en las quinielas populares.</p><p>La segunda es una selección sudamericana que atravesó un proceso de renovación radical en los últimos 18 meses. Su directora técnica — la primera mujer en dirigir a un seleccionado varonil clasificado al Mundial — introdujo un modelo de juego basado en presión alta y transiciones veloces que ya sorprendió a rivales tradicionales en amistosos internacionales.</p><figure><img src="https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=1600&auto=format&fit=crop&q=80" alt="Pelota de fútbol" /><figcaption>Los análisis de datos identificaron patrones que las quinielas populares no incorporan.</figcaption></figure><p>La tercera candidata es la sorpresa: una selección africana con base fisiológica extraordinaria y edad promedio inferior a los 26 años. Los estudios biomecánicos que se filtraron a la prensa técnica muestran capacidad aeróbica en el 95% de los partidos analizados — un dato que en torneos largos, con partidos cada tres días, se transforma en ventaja acumulativa contra rivales más veteranos.</p><p>El podio importa más de lo que parece. Un tercer puesto en un Mundial equivale, en términos de derechos comerciales, de negociación con esponsors y de contratos individuales de jugadores, a un aumento estimado del 40% en los ingresos de la federación durante los cuatro años siguientes. Es dinero real, no gloria abstracta. Y los que están mirando ese premio no siempre son los que aparecen en las tapas.</p>',
  ARRAY['mundial-2030','futbol','deportes','europa']
),

(
  'mundial-2030-tactica-defensiva-inglaterra-argentina',
  'La táctica defensiva que le cambió la cara a Inglaterra frente a Argentina: qué copiar y qué evitar',
  'El planteo funcionó mejor de lo esperado y ya se está estudiando en cinco academias tácticas europeas. Los detalles que hicieron la diferencia y por qué no cualquier selección puede reproducirlo.',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80',
  'Deportes',
  'deportes',
  now() - interval '12 hours',
  E'<p>El planteo defensivo que Inglaterra ensayó en el último amistoso previo al Mundial contra Argentina no pasó desapercibido para nadie del ambiente. Cinco academias tácticas europeas ya lo están estudiando frame por frame, y varios directores técnicos de clubes de la Premier League confirmaron off-the-record que van a incorporar elementos a sus propios sistemas defensivos. La pregunta es qué se puede copiar y qué es imposible reproducir sin los jugadores exactos.</p><figure><img src="https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&auto=format&fit=crop&q=80" alt="Jugadores en cancha" /><figcaption>La reorganización del bloque bajo cambió la lógica del partido.</figcaption></figure><p>El primer elemento que llamó la atención fue la <strong>línea de cinco asimétrica</strong>: no una defensa clásica de cinco jugadores, sino una estructura variable que se convertía en cuatro cuando la pelota estaba lejos y en cinco cuando entraba a la zona de peligro. La transición era ejecutada por un mediocampista específicamente asignado a esa función — no un lateral bajando, no un central saliendo, sino un rol híbrido diseñado para ese planteo.</p><p>El segundo elemento fue la <strong>presión escalonada al lateral izquierdo argentino</strong>. En vez de perseguirlo en toda la cancha, Inglaterra dejó que subiera hasta la línea del mediocampo y ahí lo cazó con dos jugadores en simultáneo, obligándolo a pasar la pelota hacia atrás. Fueron 22 recuperaciones en zona intermedia — el número más alto que Argentina había recibido en los últimos 15 amistosos.</p><figure><img src="https://images.unsplash.com/photo-1552667466-07770ae110d0?w=1600&auto=format&fit=crop&q=80" alt="Estadio lleno" /><figcaption>El público no notó lo que estaba pasando tácticamente en el centro del campo.</figcaption></figure><p>Lo que difícilmente se pueda replicar es el tercer elemento: la <strong>ejecución individual de los dos centrales</strong>. Ambos leyeron correctamente 87% de los movimientos ofensivos, según los datos de la propia federación inglesa. Es un porcentaje que no depende de dibujo táctico sino de calidad individual, y por eso los técnicos de otras selecciones ya adelantaron que van a intentar replicar la estructura pero saben que sin ese perfil de defensores el sistema pierde eficacia.</p><p>Para Argentina la lección es incómoda: el planteo funcionó mejor de lo esperado, no fue un accidente, y las selecciones grandes van a estudiar cómo neutralizar exactamente el juego que la selección viene practicando desde hace cuatro años. El Mundial va a ser el laboratorio donde se pruebe si el sistema argentino tiene contramedidas o si el partido contra Inglaterra fue un anticipo de lo que le espera contra rivales que copien la fórmula.</p>',
  ARRAY['mundial-2030','futbol','tactica','deportes']
),

(
  'mundial-2030-copa-trofeo-historia',
  'Quién creó el icónico trofeo de la Copa Mundial de la FIFA: la historia detrás del oro que todos quieren levantar',
  'Un escultor italiano poco conocido, un encargo con plazos imposibles y una decisión artística que estuvo a punto de arruinar todo. La historia real detrás del objeto más deseado del deporte mundial.',
  'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=1600&auto=format&fit=crop&q=80',
  'Cultura',
  'lifestyle',
  now() - interval '1 day',
  E'<p>El trofeo que las cámaras enfocan cada cuatro años cuando el capitán de la selección campeona lo levanta sobre su cabeza tiene una historia poco conocida — y bastante distinta a la mitología oficial de la FIFA. El objeto pesa 6,175 kilos, mide 36,8 centímetros, está fabricado en oro macizo de 18 quilates, y su base incorpora dos bandas de malaquita. Detrás del diseño hubo un escultor italiano que casi renuncia al proyecto por diferencias artísticas con los dirigentes.</p><figure><img src="https://images.unsplash.com/photo-1571154070106-fed35d0e8f4d?w=1600&auto=format&fit=crop&q=80" alt="Trofeo dorado en museo" /><figcaption>El diseño actual reemplazó al trofeo Jules Rimet que Brasil ganó en propiedad tras su tercer título mundial.</figcaption></figure><p>El encargo llegó en 1971. La FIFA había perdido el trofeo original — el Jules Rimet — que se convirtió en propiedad de Brasil en 1970. Necesitaba un reemplazo, y necesitaba tenerlo antes del Mundial de 1974 en Alemania. Se convocó a 53 escultores de todo el mundo para presentar propuestas. El ganador fue Silvio Gazzaniga, un artista milanés de 53 años que hasta entonces era conocido en círculos muy específicos del arte religioso italiano.</p><p>Gazzaniga presentó un diseño que rompía con las convenciones de los trofeos deportivos tradicionales. En vez de una copa clásica, propuso <em>"dos atletas emergentes del momento de la victoria, sosteniendo la Tierra"</em>. La FIFA lo aprobó — pero las discusiones sobre los detalles se extendieron por meses. Gazzaniga se negó a modificar las proporciones que consideraba fundamentales para la lectura escultórica del objeto, y en un momento amenazó con retirarse del proyecto.</p><figure><img src="https://images.unsplash.com/photo-1552667466-07770ae110d0?w=1600&auto=format&fit=crop&q=80" alt="Estadio celebración" /><figcaption>El trofeo se convirtió en el objeto deportivo más reconocible del planeta.</figcaption></figure><p>La fabricación se realizó en Bertoni, un taller de orfebrería a las afueras de Milán que en ese momento tenía menos de 20 empleados. Bertoni sigue siendo hoy el único taller autorizado a producir las réplicas oficiales y a hacer las reparaciones cuando el trofeo lo requiere. La base del trofeo, según reglas de la FIFA, puede grabar los nombres de los países campeones hasta 2038 — momento en el que se cambiará el diseño de la base para hacer lugar a nuevos ganadores.</p><p>Un dato que casi nadie sabe: los capitanes de las selecciones campeonas no reciben el trofeo original. Reciben una réplica bañada en oro. El trofeo real vuelve a Zúrich inmediatamente después de la ceremonia, custodiado por seguridad privada. Sólo se ve el original en manos de los campeones durante los pocos minutos de la ceremonia de premiación — y esa foto, esa imagen icónica, es prácticamente el único momento del Mundial donde ese objeto está literalmente en la vida cotidiana del mundo.</p>',
  ARRAY['mundial-2030','futbol','cultura','historia']
),

(
  'mundial-2030-clima-entradas-fifa',
  'Expertos climáticos piden a la FIFA y estrellas del pop abaratar entradas: qué está en juego',
  'El costo de asistir a un partido del Mundial 2030 quedó fuera del alcance del hincha promedio. Un movimiento internacional busca presionar a las autoridades para replantear el modelo antes del sorteo final.',
  'https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?w=1600&auto=format&fit=crop&q=80',
  'Deportes',
  'deportes',
  now() - interval '2 days',
  E'<p>El costo de asistir a un partido del Mundial 2030 dejó de ser una discusión de nicho para convertirse en una campaña internacional. Una coalición inesperada — climatólogos, economistas del deporte, ONGs de derechos culturales y hasta figuras del entretenimiento global — está presionando a la FIFA y a los tres países organizadores para que replanteen el modelo de precios antes del sorteo final. El argumento no es sentimental: es económico y ambiental.</p><figure><img src="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80" alt="Estadio lleno" /><figcaption>El costo actual de una entrada estándar equivale a dos meses de salario mínimo en varios países.</figcaption></figure><p>Los números son contundentes. El precio promedio de una entrada estándar para partidos de fase de grupos en el Mundial 2030 supera los 260 dólares. Para las semifinales, arranca en 750 y llega a 2.400 en categorías premium. La final, según los precios oficiales publicados, tiene entradas que van de 890 a 6.700 dólares. En países de América Latina y África, esos valores equivalen a entre uno y tres meses de salario mensual promedio.</p><p>La coalición que se armó incluye nombres inesperados. Cinco figuras del pop internacional — con audiencias combinadas superiores a los 400 millones de seguidores — firmaron una carta abierta pidiendo a la FIFA que destine el 15% de las localidades a precios subsidiados para residentes de los tres países anfitriones. La razón declarada: "un Mundial sin hinchada local es un Mundial vacío de alma".</p><figure><img src="https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80" alt="Cancha de fútbol" /><figcaption>La ocupación real de tribunas es un factor que afecta hasta la calidad del espectáculo transmitido.</figcaption></figure><p>El ángulo climático es el que sorprendió más. Un grupo de climatólogos y expertos en transporte sustentable publicó un estudio que muestra que los precios altos empujan a hinchas a comprar entradas puntuales y viajar en vuelos internacionales de corta estadía, generando huella de carbono por asistente hasta 4 veces mayor que la de un hincha local. La conclusión: un modelo de precios inclusivo no sólo es socialmente más justo sino ambientalmente más eficiente.</p><p>La FIFA aún no respondió formalmente. En privado, según fuentes de la organización, se están evaluando esquemas de "cuotas de acceso local" similares a los que introdujo el COI para las Olimpíadas de París. La decisión, si llega, tendría que anunciarse antes del cierre del calendario oficial. Lo que está en juego no es sólo un debate económico — es la definición de qué significa un Mundial en el siglo XXI: un espectáculo global para quien pueda pagarlo, o un patrimonio cultural que debe tener acceso mínimo garantizado para las comunidades que lo hospedan.</p>',
  ARRAY['mundial-2030','clima','fifa','deportes']
)

on conflict (slug) do nothing;

-- Backfill de tags si por corridas parciales quedaron rows sin ellos
update public.demo_articles set tags = ARRAY['mundial-2030','futbol','deportes','europa']
  where slug = 'mundial-2030-tercer-puesto-europa' and (tags is null or array_length(tags,1) is null);
update public.demo_articles set tags = ARRAY['mundial-2030','futbol','tactica','deportes']
  where slug = 'mundial-2030-tactica-defensiva-inglaterra-argentina' and (tags is null or array_length(tags,1) is null);
update public.demo_articles set tags = ARRAY['mundial-2030','futbol','cultura','historia']
  where slug = 'mundial-2030-copa-trofeo-historia' and (tags is null or array_length(tags,1) is null);
update public.demo_articles set tags = ARRAY['mundial-2030','clima','fifa','deportes']
  where slug = 'mundial-2030-clima-entradas-fifa' and (tags is null or array_length(tags,1) is null);

-- ── PARCHAR TENANTS EXISTENTES ────────────────────────────────────────
--
-- Encendemos featured_event con la config del Mundial 2030 en todos los
-- tenants que ya tienen category_showcase activo (el marcador de sitios
-- editoriales). El path se crea si no existe (create_missing=true por
-- default en jsonb_set).

update public.tenants
set site_config = jsonb_set(
  coalesce(site_config, '{}'::jsonb),
  '{sections,featured_event}',
  '{"enabled":true,"title":"Mundial de fútbol 2030","subtitle":"","tag":"mundial-2030","count":4,"accent_color":"#0891b2"}'::jsonb,
  true
)
where site_config is not null
  and (site_config #> '{sections,category_showcase,enabled}')::text = 'true';

update public.tenants
set site_config_published = jsonb_set(
  coalesce(site_config_published, '{}'::jsonb),
  '{sections,featured_event}',
  '{"enabled":true,"title":"Mundial de fútbol 2030","subtitle":"","tag":"mundial-2030","count":4,"accent_color":"#0891b2"}'::jsonb,
  true
)
where site_config_published is not null
  and (site_config_published #> '{sections,category_showcase,enabled}')::text = 'true';
