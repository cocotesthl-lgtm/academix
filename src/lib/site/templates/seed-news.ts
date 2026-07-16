import { getServiceClient } from '@/lib/supabase/service';

/**
 * Siembra artículos "listos para editar" cuando se aplica el template
 * news. Sin data el layout newspaper de blog_preview no puede renderizar
 * (return null), así el owner ve el hero + newsletter + about + contact
 * y nada de la portada tipo NYT que hace atractivo al template.
 *
 * Idempotente: si el tenant YA tiene artículos, no toca nada.
 * Todas las imágenes son de Unsplash (URL-only, sin uploads).
 */

type SeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  cover_url: string;
  author_name: string;
  body_html: string;
  daysAgo: number;   // published_at = now - daysAgo * 1 día
};

const ARTICLES: SeedArticle[] = [
  {
    slug: 'analisis-gobierno-nuevo-plan-economico',
    title: 'Análisis: el plan económico ante la nueva coyuntura',
    excerpt: 'Un informe detallado sobre las medidas anunciadas esta semana y sus implicancias para el sector productivo, con lecturas de especialistas y proyecciones.',
    cover_url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&auto=format&fit=crop&q=80',
    author_name: 'Redacción Económica',
    body_html: '<p>Editá este artículo desde el panel de <strong>Blog</strong>. Este es un artículo de ejemplo pre-cargado por el template de Noticias — reemplazá el título, resumen, portada y cuerpo con tu contenido real.</p><p>Podés escribir en HTML directo o pegar contenido con formato. El excerpt aparece en la portada y en las páginas de listado.</p>',
    daysAgo: 0
  },
  {
    slug: 'crisis-internacional-diplomacia',
    title: 'Diplomacia en tensión: qué se juega en la próxima cumbre',
    excerpt: 'Los principales líderes se reúnen esta semana para discutir la escalada del conflicto y buscar salidas negociadas.',
    cover_url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1200&auto=format&fit=crop&q=80',
    author_name: 'Corresponsal Internacional',
    body_html: '<p>Contenido del artículo. Editá desde el panel Blog.</p>',
    daysAgo: 0
  },
  {
    slug: 'ciudad-obras-modernizacion',
    title: 'La ciudad avanza con obras de modernización urbana',
    excerpt: 'Nuevos corredores viales, plazas y espacios verdes se suman al plan integral que se completará en los próximos meses.',
    cover_url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&auto=format&fit=crop&q=80',
    author_name: 'Redacción Ciudad',
    body_html: '<p>Contenido del artículo. Editá desde el panel Blog.</p>',
    daysAgo: 1
  },
  {
    slug: 'deportes-liga-nueva-temporada',
    title: 'Arrancó la nueva temporada con sorpresas en la tabla',
    excerpt: 'Los primeros resultados marcaron una jornada de sorpresas y goles que reconfiguran el mapa de la liga.',
    cover_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80',
    author_name: 'Deportes',
    body_html: '<p>Contenido del artículo. Editá desde el panel Blog.</p>',
    daysAgo: 1
  },
  {
    slug: 'cultura-cine-festival',
    title: 'Se conocieron los ganadores del festival de cine',
    excerpt: 'Una noche cargada de emoción con premios que reconocieron el trabajo del cine independiente latinoamericano.',
    cover_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop&q=80',
    author_name: 'Cultura',
    body_html: '<p>Contenido del artículo. Editá desde el panel Blog.</p>',
    daysAgo: 2
  },
  {
    slug: 'opinion-tendencias-tecnologia',
    title: 'Opinión: hacia dónde va la tecnología en el próximo lustro',
    excerpt: 'Una reflexión sobre las tendencias emergentes y cómo van a impactar en el trabajo, la educación y la vida cotidiana.',
    cover_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
    author_name: 'Columnista Invitado',
    body_html: '<p>Contenido del artículo. Editá desde el panel Blog.</p>',
    daysAgo: 3
  }
];

export async function seedNewsDemoData(tenantId: string): Promise<void> {
  const svc = getServiceClient();

  // Idempotente: bail out si ya hay artículos en el tenant
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (svc.from('articles') as any)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    if ((count ?? 0) > 0) return;
  } catch {
    // articles table doesn't exist yet → migration pendiente, no hacer nada
    return;
  }

  const now = Date.now();
  const rows = ARTICLES.map((a) => ({
    tenant_id: tenantId,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    cover_url: a.cover_url,
    body_html: a.body_html,
    author_name: a.author_name,
    status: 'published',
    published_at: new Date(now - a.daysAgo * 86400_000).toISOString()
  }));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('articles') as any).insert(rows);
    if (error) console.warn('[seedNews] insert falló:', error.message);
  } catch (e) {
    console.warn('[seedNews] insert threw:', e);
  }
}
