import { getServiceClient } from '@/lib/supabase/service';

/**
 * Siembra 8 categorías editoriales + ~30 artículos placeholder repartidos
 * entre ellas cuando se aplica el template de Noticias. Sin data, las
 * secciones blog_preview (portada newspaper) y category_showcase
 * (vitrinas Life & Style) retornan null y el sitio queda vacío.
 *
 * Todo idempotente vía UNIQUE (tenant_id, slug) tanto en artículos como
 * en categorías — re-aplicar el template completa lo que falte sin pisar
 * ediciones del owner.
 */

type SeedCategory = {
  slug: string;
  name: string;
  accent_color: string;   // color del label (NYT Life & Style uses turquoise, WSJ teal, etc)
};

/** Las 8 categorías default de un sitio de noticias hispano. */
export const NEWS_CATEGORIES: SeedCategory[] = [
  { slug: 'ultimas',      name: 'Últimas noticias', accent_color: '#dc2626' },
  { slug: 'mundo',        name: 'Mundo',            accent_color: '#0891b2' },
  { slug: 'deportes',     name: 'Deportes',         accent_color: '#16a34a' },
  { slug: 'politica',     name: 'Política',         accent_color: '#7c3aed' },
  { slug: 'economia',     name: 'Economía',         accent_color: '#ca8a04' },
  { slug: 'negocios',     name: 'Negocios',         accent_color: '#0d9488' },
  { slug: 'policiales',   name: 'Policiales',       accent_color: '#991b1b' },
  { slug: 'lifestyle',    name: 'Lifestyle',        accent_color: '#db2777' }
];

/**
 * Subcategorías por categoría padre. Se crean con parent_id apuntando
 * a la categoría del mismo slug. Sirven para el nav de subsecciones
 * dentro de cada categoría (estilo The Times /money → Tax · Pensions
 * · Mortgages · etc).
 */
type SeedSubCategory = { slug: string; name: string; parent_slug: string };
export const NEWS_SUBCATEGORIES: SeedSubCategory[] = [
  // Mundo
  { slug: 'sub-ee-uu',        name: 'EE.UU.',           parent_slug: 'mundo' },
  { slug: 'sub-europa',       name: 'Europa',           parent_slug: 'mundo' },
  { slug: 'sub-asia',         name: 'Asia',             parent_slug: 'mundo' },
  { slug: 'sub-latam',        name: 'Latinoamérica',    parent_slug: 'mundo' },
  { slug: 'sub-medio-oriente',name: 'Medio Oriente',    parent_slug: 'mundo' },
  // Deportes
  { slug: 'sub-futbol',       name: 'Fútbol',           parent_slug: 'deportes' },
  { slug: 'sub-tenis',        name: 'Tenis',            parent_slug: 'deportes' },
  { slug: 'sub-basquet',      name: 'Básquet',          parent_slug: 'deportes' },
  { slug: 'sub-rugby',        name: 'Rugby',            parent_slug: 'deportes' },
  { slug: 'sub-formula1',     name: 'Fórmula 1',        parent_slug: 'deportes' },
  // Política
  { slug: 'sub-congreso',     name: 'Congreso',         parent_slug: 'politica' },
  { slug: 'sub-gobierno',     name: 'Gobierno',         parent_slug: 'politica' },
  { slug: 'sub-provincias',   name: 'Provincias',       parent_slug: 'politica' },
  { slug: 'sub-elecciones',   name: 'Elecciones',       parent_slug: 'politica' },
  // Economía
  { slug: 'sub-inflacion',    name: 'Inflación',        parent_slug: 'economia' },
  { slug: 'sub-dolar',        name: 'Dólar',            parent_slug: 'economia' },
  { slug: 'sub-bonos',        name: 'Bonos',            parent_slug: 'economia' },
  { slug: 'sub-consumo',      name: 'Consumo',          parent_slug: 'economia' },
  // Negocios
  { slug: 'sub-empresas',     name: 'Empresas',         parent_slug: 'negocios' },
  { slug: 'sub-emprendedores',name: 'Emprendedores',    parent_slug: 'negocios' },
  { slug: 'sub-fusiones',     name: 'Fusiones y adquisiciones', parent_slug: 'negocios' },
  // Policiales
  { slug: 'sub-crimenes',     name: 'Crímenes',         parent_slug: 'policiales' },
  { slug: 'sub-narcotrafico', name: 'Narcotráfico',     parent_slug: 'policiales' },
  { slug: 'sub-ciberdelito',  name: 'Ciberdelito',      parent_slug: 'policiales' },
  // Lifestyle
  { slug: 'sub-cine',         name: 'Cine',             parent_slug: 'lifestyle' },
  { slug: 'sub-gastronomia',  name: 'Gastronomía',      parent_slug: 'lifestyle' },
  { slug: 'sub-viajes',       name: 'Viajes',           parent_slug: 'lifestyle' },
  { slug: 'sub-moda',         name: 'Moda',             parent_slug: 'lifestyle' },
  { slug: 'sub-bienestar',    name: 'Bienestar',        parent_slug: 'lifestyle' },
  { slug: 'sub-libros',       name: 'Libros',           parent_slug: 'lifestyle' }
];

type SeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  cover_url: string;
  author_name: string;
  category_slug: string;
  daysAgo: number;
};

/** ~30 artículos: 3-4 por categoría para poblar bien las vitrinas. */
const ARTICLES: SeedArticle[] = [
  // ── Últimas ────────────────────────────────────────────────────
  { slug: 'analisis-plan-economico',                title: 'Análisis: el plan económico ante la nueva coyuntura', excerpt: 'Un informe detallado sobre las medidas anunciadas esta semana y sus implicancias para el sector productivo.', cover_url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&auto=format&fit=crop&q=80', author_name: 'Redacción Económica', category_slug: 'ultimas', daysAgo: 0 },
  { slug: 'ciudad-obras-modernizacion',             title: 'La ciudad avanza con obras de modernización urbana', excerpt: 'Nuevos corredores viales, plazas y espacios verdes se suman al plan integral que se completará en los próximos meses.', cover_url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&auto=format&fit=crop&q=80', author_name: 'Redacción Ciudad', category_slug: 'ultimas', daysAgo: 1 },
  { slug: 'salud-nueva-vacuna-aprobada',            title: 'Aprueban nueva vacuna con eficacia superior al 90%', excerpt: 'El anuncio marca un hito en la lucha contra la enfermedad y despierta expectativas en la comunidad médica.', cover_url: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=800&auto=format&fit=crop&q=80', author_name: 'Salud', category_slug: 'ultimas', daysAgo: 1 },
  { slug: 'clima-alerta-tormenta',                  title: 'Alerta meteorológica: tormentas fuertes en varias provincias', excerpt: 'El Servicio Meteorológico Nacional emitió alertas de nivel amarillo para las próximas 48 horas.', cover_url: 'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=800&auto=format&fit=crop&q=80', author_name: 'Clima', category_slug: 'ultimas', daysAgo: 1 },

  // ── Mundo ──────────────────────────────────────────────────────
  { slug: 'diplomacia-cumbre-tension',              title: 'Diplomacia en tensión: qué se juega en la próxima cumbre', excerpt: 'Los principales líderes se reúnen esta semana para discutir la escalada del conflicto y buscar salidas negociadas.', cover_url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1200&auto=format&fit=crop&q=80', author_name: 'Corresponsal Internacional', category_slug: 'mundo', daysAgo: 0 },
  { slug: 'europa-elecciones-parlamento',           title: 'Elecciones parlamentarias en Europa: quién saca ventaja', excerpt: 'Las encuestas muestran un panorama fragmentado con nuevos partidos entrando en escena.', cover_url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&auto=format&fit=crop&q=80', author_name: 'Bureau Europa', category_slug: 'mundo', daysAgo: 2 },
  { slug: 'asia-pacifico-comercio-acuerdo',         title: 'Nuevo acuerdo comercial en el Pacífico redefine bloques', excerpt: 'Ocho países firman un tratado que promete cambiar la lógica del comercio regional.', cover_url: 'https://images.unsplash.com/photo-1553546895-531931aa1aa8?w=800&auto=format&fit=crop&q=80', author_name: 'Bureau Asia', category_slug: 'mundo', daysAgo: 3 },
  { slug: 'medio-oriente-conflicto',                title: 'Escalada en Medio Oriente: análisis en profundidad', excerpt: 'Nuestro corresponsal explica los factores que llevaron a la situación actual.', cover_url: 'https://images.unsplash.com/photo-1544413660-299165566b1d?w=800&auto=format&fit=crop&q=80', author_name: 'Corresponsal Internacional', category_slug: 'mundo', daysAgo: 4 },

  // ── Deportes ───────────────────────────────────────────────────
  { slug: 'liga-nueva-temporada',                   title: 'Arrancó la nueva temporada con sorpresas en la tabla', excerpt: 'Los primeros resultados marcaron una jornada de sorpresas y goles que reconfiguran el mapa de la liga.', cover_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80', author_name: 'Deportes', category_slug: 'deportes', daysAgo: 1 },
  { slug: 'tenis-final-abierta',                    title: 'El tenis vivió una final abierta y con vueltas', excerpt: 'Tres horas de juego dejaron a los fans al borde del asiento y coronaron un campeón inesperado.', cover_url: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&auto=format&fit=crop&q=80', author_name: 'Deportes', category_slug: 'deportes', daysAgo: 2 },
  { slug: 'basquet-derrota-historica',              title: 'Derrota histórica en el arranque del torneo', excerpt: 'El equipo local cayó por primera vez en su cancha después de más de un año invicto.', cover_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80', author_name: 'Deportes', category_slug: 'deportes', daysAgo: 3 },
  { slug: 'formula1-nueva-temporada',               title: 'Fórmula 1: se viene una temporada llena de cambios', excerpt: 'Nuevos autos, nuevas reglas y varias sorpresas en las escuderías top marcan el 2026.', cover_url: 'https://images.unsplash.com/photo-1541447271487-09612b3f49f7?w=800&auto=format&fit=crop&q=80', author_name: 'Motorsport', category_slug: 'deportes', daysAgo: 4 },

  // ── Política ───────────────────────────────────────────────────
  { slug: 'ley-debate-congreso',                    title: 'Debate en el Congreso: ley clave se define esta semana', excerpt: 'Diputados y senadores intercambian posiciones sobre una reforma que divide a los bloques.', cover_url: 'https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&auto=format&fit=crop&q=80', author_name: 'Política', category_slug: 'politica', daysAgo: 0 },
  { slug: 'gabinete-cambios-anunciados',            title: 'Cambios en el gabinete: quiénes entran y quiénes salen', excerpt: 'El primer mandatario anunció modificaciones en cinco ministerios clave.', cover_url: 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=800&auto=format&fit=crop&q=80', author_name: 'Política', category_slug: 'politica', daysAgo: 2 },
  { slug: 'provincias-reunion-gobernadores',        title: 'Gobernadores de provincias se reunieron para coordinar agenda', excerpt: 'Una cumbre inédita busca sentar posición común frente al gobierno nacional.', cover_url: 'https://images.unsplash.com/photo-1518057111178-44a106bad636?w=800&auto=format&fit=crop&q=80', author_name: 'Federal', category_slug: 'politica', daysAgo: 3 },

  // ── Economía ───────────────────────────────────────────────────
  { slug: 'inflacion-baja-segundo-mes',             title: 'Cayó la inflación mensual por segundo mes consecutivo', excerpt: 'El índice de precios mostró una desaceleración marcada según el informe oficial publicado esta mañana.', cover_url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&auto=format&fit=crop&q=80', author_name: 'Economía', category_slug: 'economia', daysAgo: 0 },
  { slug: 'dolar-mercado-cambiario',                title: 'Dólar hoy: cierre estable tras jornada volátil', excerpt: 'El tipo de cambio se mantuvo dentro de la banda esperada por el mercado tras las últimas medidas.', cover_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80', author_name: 'Finanzas', category_slug: 'economia', daysAgo: 1 },
  { slug: 'exportaciones-record-trimestre',         title: 'Récord de exportaciones en el trimestre', excerpt: 'Las ventas al exterior superaron todas las proyecciones de los analistas del sector.', cover_url: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=800&auto=format&fit=crop&q=80', author_name: 'Comercio Exterior', category_slug: 'economia', daysAgo: 3 },

  // ── Negocios ───────────────────────────────────────────────────
  { slug: 'startup-argentina-recibe-inversion',     title: 'Startup argentina recibe inversión millonaria de fondos internacionales', excerpt: 'La empresa de tecnología cerró una ronda serie B por USD 20 millones para expansión regional.', cover_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop&q=80', author_name: 'Negocios', category_slug: 'negocios', daysAgo: 1 },
  { slug: 'fusion-empresas-tecnologia',             title: 'Fusión de dos gigantes tecnológicos redefine el sector', excerpt: 'La operación creó la tercera empresa más grande de tecnología del país.', cover_url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&auto=format&fit=crop&q=80', author_name: 'M&A', category_slug: 'negocios', daysAgo: 2 },
  { slug: 'emprendedor-historia-exito',             title: 'De la nada al éxito: la historia del emprendedor del año', excerpt: 'Cómo un joven de 28 años construyó una empresa que hoy vale millones.', cover_url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&auto=format&fit=crop&q=80', author_name: 'Perfiles', category_slug: 'negocios', daysAgo: 3 },

  // ── Policiales ─────────────────────────────────────────────────
  { slug: 'operativo-narcotrafico-detenidos',       title: 'Gran operativo antinarcóticos: veinte detenidos y kilos de droga incautados', excerpt: 'Fuerzas federales desarticularon una banda que operaba en tres provincias del norte.', cover_url: 'https://images.unsplash.com/photo-1591123120675-6f7f1aae0e5b?w=800&auto=format&fit=crop&q=80', author_name: 'Policiales', category_slug: 'policiales', daysAgo: 0 },
  { slug: 'robo-banco-esclarecido',                 title: 'Esclarecen robo a un banco céntrico ocurrido la semana pasada', excerpt: 'La investigación permitió identificar y capturar a los tres autores del hecho.', cover_url: 'https://images.unsplash.com/photo-1601582589907-f92af5ed9db8?w=800&auto=format&fit=crop&q=80', author_name: 'Policiales', category_slug: 'policiales', daysAgo: 2 },
  { slug: 'ciberdelito-fraude-online',              title: 'Alerta por nueva modalidad de fraude online que afecta a bancarios', excerpt: 'Especialistas explican cómo prevenir el engaño y qué hacer si ya sos víctima.', cover_url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&auto=format&fit=crop&q=80', author_name: 'Ciberseguridad', category_slug: 'policiales', daysAgo: 3 },

  // ── Lifestyle ──────────────────────────────────────────────────
  { slug: 'cine-festival-ganadores',                title: 'Se conocieron los ganadores del festival de cine', excerpt: 'Una noche cargada de emoción con premios que reconocieron el trabajo del cine independiente latinoamericano.', cover_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop&q=80', author_name: 'Cultura', category_slug: 'lifestyle', daysAgo: 2 },
  { slug: 'gastronomia-nuevo-restaurante',          title: 'Abrió un restaurante que ya es sensación', excerpt: 'La propuesta combina cocina de autor con precios accesibles y ya no consigue mesa hasta el mes que viene.', cover_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80', author_name: 'Gastronomía', category_slug: 'lifestyle', daysAgo: 3 },
  { slug: 'viajes-destino-tendencia',               title: 'El destino tendencia del año para escaparse este fin de semana', excerpt: 'Playa, montaña o ciudad: tres opciones distintas para todos los gustos y presupuestos.', cover_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80', author_name: 'Viajes', category_slug: 'lifestyle', daysAgo: 4 },
  { slug: 'moda-tendencias-otono',                  title: 'Las 5 tendencias de moda para el otoño', excerpt: 'Los colores tierra, las capas y la ropa oversized dominan la temporada.', cover_url: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=800&auto=format&fit=crop&q=80', author_name: 'Estilo', category_slug: 'lifestyle', daysAgo: 5 },
  { slug: 'lifestyle-yoga-oficina',                 title: 'Yoga en la oficina: 5 posturas para bajar el estrés', excerpt: 'Ejercicios que podés hacer sin levantarte de la silla y sin que nadie te vea raro.', cover_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop&q=80', author_name: 'Bienestar', category_slug: 'lifestyle', daysAgo: 6 },
  { slug: 'lifestyle-libros-recomendados',          title: 'Los 10 libros del año que hay que leer', excerpt: 'Ficción, ensayo, memoirs y bestsellers seleccionados por nuestros críticos.', cover_url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&auto=format&fit=crop&q=80', author_name: 'Libros', category_slug: 'lifestyle', daysAgo: 7 },
  { slug: 'lifestyle-decoracion-tendencias',        title: 'Decoración: el estilo que se impone este año', excerpt: 'Minimalismo cálido, madera clara y verde salvia se llevan todos los aplausos.', cover_url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&auto=format&fit=crop&q=80', author_name: 'Diseño', category_slug: 'lifestyle', daysAgo: 8 },

  // ── Mundo extras (para llenar 7 con distintas imágenes) ────────
  { slug: 'mundo-tecnologia-china',                 title: 'China acelera su plan de autosuficiencia tecnológica', excerpt: 'Nuevas fábricas de chips y satélites propios marcan una carrera contrarreloj.', cover_url: 'https://images.unsplash.com/photo-1512446733611-9099a758e63c?w=800&auto=format&fit=crop&q=80', author_name: 'Corresponsal Asia', category_slug: 'mundo', daysAgo: 5 },
  { slug: 'mundo-migraciones-crisis',               title: 'Crisis migratoria en el Mediterráneo: cifras récord', excerpt: 'Miles de personas cruzan cada mes en condiciones cada vez más precarias.', cover_url: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&auto=format&fit=crop&q=80', author_name: 'Enviado Especial', category_slug: 'mundo', daysAgo: 6 },
  { slug: 'mundo-cambio-climatico',                 title: 'La ONU alerta por el impacto acelerado del cambio climático', excerpt: 'Un informe de más de 500 páginas resume la evidencia científica actual.', cover_url: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800&auto=format&fit=crop&q=80', author_name: 'Medio Ambiente', category_slug: 'mundo', daysAgo: 7 },

  // ── Deportes extras ────────────────────────────────────────────
  { slug: 'deportes-rugby-final',                   title: 'Rugby: se define la final del torneo esta noche', excerpt: 'Los dos históricos rivales se enfrentan por el título después de una semana intensa.', cover_url: 'https://images.unsplash.com/photo-1512299546147-98b0c76f6be6?w=800&auto=format&fit=crop&q=80', author_name: 'Deportes', category_slug: 'deportes', daysAgo: 5 },
  { slug: 'deportes-atletismo-record',              title: 'Nuevo récord nacional en atletismo', excerpt: 'Una marca que llevaba 15 años sin ser superada finalmente cayó anoche.', cover_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80', author_name: 'Atletismo', category_slug: 'deportes', daysAgo: 6 },
  { slug: 'deportes-natacion-panamericano',         title: 'Natación: el equipo brilló en el Panamericano', excerpt: 'Cinco medallas de oro y récords personales de casi todos los competidores.', cover_url: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&auto=format&fit=crop&q=80', author_name: 'Deportes', category_slug: 'deportes', daysAgo: 7 },

  // ── Economía extras ────────────────────────────────────────────
  { slug: 'economia-consumo-caida',                 title: 'El consumo mostró señales de recuperación en abril', excerpt: 'Los rubros de electro y textil lideraron la mejora respecto al mes anterior.', cover_url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop&q=80', author_name: 'Consumo', category_slug: 'economia', daysAgo: 5 },
  { slug: 'economia-bonos-riesgo-pais',             title: 'El riesgo país bajó a mínimos del año', excerpt: 'Los bonos soberanos tuvieron una jornada positiva en el mercado internacional.', cover_url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&auto=format&fit=crop&q=80', author_name: 'Finanzas', category_slug: 'economia', daysAgo: 6 },
  { slug: 'economia-inversion-industria',           title: 'Anuncian inversiones millonarias en el sector industrial', excerpt: 'Tres proyectos que suman más de 500 millones de dólares se pondrán en marcha este año.', cover_url: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800&auto=format&fit=crop&q=80', author_name: 'Industria', category_slug: 'economia', daysAgo: 7 }
];

export async function seedNewsDemoData(tenantId: string): Promise<void> {
  const svc = getServiceClient();

  // ── 1. Categorías ──────────────────────────────────────────────
  // Upsert idempotente por (tenant_id, slug). course_categories tiene esa
  // constraint. Después leemos el id para asignar a los artículos.
  const catRows = NEWS_CATEGORIES.map((c, i) => ({
    tenant_id: tenantId,
    slug: c.slug,
    name: c.name,
    position: i,
    is_featured: true
  }));
  const categoryIdBySlug = new Map<string, string>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedCats, error: catErr } = await (svc.from('course_categories') as any)
      .upsert(catRows, { onConflict: 'tenant_id,slug', ignoreDuplicates: false })
      .select('id, slug');
    if (catErr) console.warn('[seedNews] cats upsert falló:', catErr.message);
    for (const row of (insertedCats ?? []) as Array<{ id: string; slug: string }>) {
      categoryIdBySlug.set(row.slug, row.id);
    }
    // Fallback: si la respuesta no trajo los ids (algunos backends), leer.
    if (categoryIdBySlug.size === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (svc.from('course_categories') as any)
        .select('id, slug').eq('tenant_id', tenantId);
      for (const row of (data ?? []) as Array<{ id: string; slug: string }>) {
        categoryIdBySlug.set(row.slug, row.id);
      }
    }

    // Subcategorías con parent_id resuelto — algunas migraciones no tienen
    // parent_id todavía, así que si el insert falla lo reintentamos sin él.
    // La migration 0054 agrega parent_id + is_featured.
    const subRows = NEWS_SUBCATEGORIES
      .filter((s) => categoryIdBySlug.has(s.parent_slug))
      .map((s, i) => ({
        tenant_id: tenantId,
        slug: s.slug,
        name: s.name,
        position: NEWS_CATEGORIES.length + i,
        is_featured: false,
        parent_id: categoryIdBySlug.get(s.parent_slug)!
      }));
    if (subRows.length > 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: subErr } = await (svc.from('course_categories') as any)
          .upsert(subRows, { onConflict: 'tenant_id,slug', ignoreDuplicates: true });
        if (subErr) {
          // Fallback: sin parent_id (migration 0054 pendiente en este tenant).
          console.warn('[seedNews] subcats con parent_id falló, reintento sin:', subErr.message);
          const fallback = subRows.map(({ parent_id: _ignored, ...rest }) => {
            void _ignored;
            return rest;
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (svc.from('course_categories') as any)
            .upsert(fallback, { onConflict: 'tenant_id,slug', ignoreDuplicates: true });
        }
      } catch (e) {
        console.warn('[seedNews] subcats seed threw:', e);
      }
    }
  } catch (e) {
    console.warn('[seedNews] cats seed threw:', e);
  }

  // ── 2. Artículos con category_id resuelto ──────────────────────
  const now = Date.now();
  const artRows = ARTICLES.map((a) => ({
    tenant_id: tenantId,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    cover_url: a.cover_url,
    body_html: '<p>Editá este artículo desde el panel de <strong>Blog</strong>. Este es contenido pre-cargado por el template de Noticias — reemplazá título, resumen, portada y cuerpo con tu contenido real.</p>',
    author_name: a.author_name,
    category_id: categoryIdBySlug.get(a.category_slug) ?? null,
    status: 'published',
    published_at: new Date(now - a.daysAgo * 86400_000).toISOString()
  }));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('articles') as any)
      .upsert(artRows, { onConflict: 'tenant_id,slug', ignoreDuplicates: true });
    if (error) console.warn('[seedNews] articles upsert falló:', error.message);
  } catch (e) {
    console.warn('[seedNews] articles upsert threw:', e);
  }
}
