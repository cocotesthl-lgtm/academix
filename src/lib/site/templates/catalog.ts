import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@/lib/site/types';
import type { ModuleKey } from '@/lib/modules/types';

/**
 * Catálogo de templates curados (hardcoded — sin DB). El owner los aplica
 * desde /owner/templates y se sobrescribe su site_config completo.
 *
 * Cada template empieza desde DEFAULT_SITE_CONFIG (deep clone) y mergea
 * los overrides puntuales: textos, color sugerido, orden de secciones,
 * cuáles enabled/disabled, content de muestra.
 */

export type SiteTemplate = {
  id: string;
  name: string;
  category: string;       // "Servicios" | "Comercio" | "Educación" | "Experiencias" | etc
  emoji: string;
  shortDesc: string;
  longDesc?: string;
  suggestedPrimary: string;  // color recomendado #hex
  config: SiteConfig;
  /**
   * Apps que este template necesita. Cuando el owner aplica el template,
   * se prenden estas apps y se apagan las demás (excepto los macros
   * baseline `team`, `sales`, `site` que no son apps sino estructura).
   *
   * Si no se declara, el template no toca los módulos del tenant
   * (backward compat con templates aplicados antes de este cambio).
   */
  modules?: ModuleKey[];
};

function clone(): SiteConfig {
  return JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIG)) as SiteConfig;
}

/* ───────── Helpers para construir templates rápido ───────── */

function enableOnly(cfg: SiteConfig, keys: Array<keyof SiteConfig['sections']>): SiteConfig {
  for (const k of Object.keys(cfg.sections) as Array<keyof SiteConfig['sections']>) {
    cfg.sections[k].enabled = keys.includes(k);
  }
  cfg.order = keys as SiteConfig['order'];
  return cfg;
}

/* ───────── Catálogo ───────── */

export const SITE_TEMPLATES: SiteTemplate[] = [
  /* 1. Estudio profesional (abogados / contadores / consultores) */
  (() => {
    const c = clone();
    enableOnly(c, ['hero', 'about', 'features', 'testimonials', 'faq', 'contact', 'cta_final']);
    c.sections.hero.eyebrow = 'Empresas y personas';
    c.sections.hero.title = 'Asesoramiento legal a tu medida';
    c.sections.hero.subtitle = 'Soluciones estratégicas y confidenciales para personas, familias y empresas.';
    c.sections.hero.cta_label = 'Contactar';
    c.sections.hero.cta_href = '#contact';
    c.sections.hero.cta_label_2 = 'Conocer servicios';
    c.sections.hero.cta_href_2 = '#features';
    c.sections.about.title = 'Quiénes somos';
    c.sections.about.body = 'Más de 10 años de experiencia brindando resultados favorables. Especialistas en Derecho Civil, Comercial y de Familia.';
    c.sections.features.title = 'Áreas de práctica';
    c.sections.contact.title = 'Consulta sin cargo';
    c.nav.show_my_courses = false;
    c.nav.show_affiliates = false;
    return {
      id: 'professional',
      name: 'Estudio profesional',
      category: 'Servicios',
      emoji: '⚖️',
      shortDesc: 'Para abogados, contadores, consultores. Hero institucional + áreas de práctica + contacto.',
      suggestedPrimary: '#1f2937',
      config: c,
      // Sin apps de venta — solo el sitio institucional + formulario de contacto.
      modules: []
    };
  })(),

  /* 2. Restaurante / Gastronomía */
  (() => {
    const c = clone();
    enableOnly(c, ['hero', 'about', 'gallery', 'features', 'testimonials', 'map', 'contact']);
    c.sections.hero.eyebrow = 'Cocina de autor';
    c.sections.hero.title = 'Donde la pasta se hace a mano';
    c.sections.hero.subtitle = 'Reservá tu mesa o pasá a almorzar de martes a domingo.';
    c.sections.hero.cta_label = 'Reservar mesa';
    c.sections.hero.cta_href = '#contact';
    c.sections.about.title = 'Nuestra historia';
    c.sections.about.body = 'Tradición familiar desde 1978. Recetas que pasaron de la abuela al chef actual.';
    c.sections.features.title = 'Qué nos hace únicos';
    c.sections.gallery.title = 'Algunos de nuestros platos';
    c.nav.show_my_courses = false;
    c.nav.show_affiliates = false;
    c.nav.my_courses_label = 'Mis reservas';
    return {
      id: 'restaurant',
      name: 'Restaurante',
      category: 'Gastronomía',
      emoji: '🍽️',
      shortDesc: 'Hero + galería de platos + mapa + form de reserva. Pensado para parrillas, bistros, cafés.',
      suggestedPrimary: '#b91c1c',
      config: c,
      // Reservas de mesa
      modules: ['calendar', 'reservations']
    };
  })(),

  /* 3. Multi-sede experiencia (tiro, escape, paintball, kart) */
  (() => {
    const c = clone();
    enableOnly(c, ['hero', 'features', 'gallery', 'testimonials', 'faq', 'map', 'cta_final']);
    c.sections.hero.eyebrow = 'Adrenalina sin límites';
    c.sections.hero.title = 'Una experiencia que no vas a olvidar';
    c.sections.hero.subtitle = 'Reservá tu sesión en cualquiera de nuestras sedes. Equipamiento incluido.';
    c.sections.hero.cta_label = 'Reservar ahora';
    c.sections.hero.cta_href = '#catalog';
    c.sections.features.title = 'Lo que incluye';
    c.sections.gallery.title = 'Galería';
    c.sections.cta_final.title = 'Listo para vivirlo';
    c.nav.show_my_courses = true;
    c.nav.my_courses_label = 'Mis reservas';
    c.nav.show_affiliates = false;
    return {
      id: 'experience',
      name: 'Experiencia / Multi-sede',
      category: 'Experiencias',
      emoji: '🎯',
      shortDesc: 'Para tiro, escape rooms, paintball, kart. Hero impactante + galería + sedes + reservas.',
      suggestedPrimary: '#dc2626',
      config: c,
      // Reservas y tickets (con QR de entrada)
      modules: ['calendar', 'reservations', 'events']
    };
  })(),

  /* 4. Estética / Belleza (uñas, peluquería, spa) */
  (() => {
    const c = clone();
    enableOnly(c, ['hero', 'features', 'gallery', 'testimonials', 'pricing', 'contact']);
    c.sections.hero.eyebrow = 'Tu momento de pausa';
    c.sections.hero.title = 'Belleza que se siente';
    c.sections.hero.subtitle = 'Servicios profesionales en un ambiente pensado para vos.';
    c.sections.hero.cta_label = 'Reservar turno';
    c.sections.hero.cta_href = '#pricing';
    c.sections.features.title = 'Servicios';
    c.sections.gallery.title = 'Trabajos recientes';
    c.sections.pricing.title = 'Precios';
    c.nav.show_my_courses = true;
    c.nav.my_courses_label = 'Mis turnos';
    c.nav.show_affiliates = false;
    return {
      id: 'beauty',
      name: 'Estética / Belleza',
      category: 'Servicios',
      emoji: '💅',
      shortDesc: 'Para salones, manicura, peluquería, spa, masajes. Galería + servicios + precios + turnos.',
      suggestedPrimary: '#ec4899',
      config: c,
      // Turnos + planes de bonos/paquetes
      modules: ['calendar', 'reservations', 'catalog', 'plans']
    };
  })(),

  /* 5. Gimnasio / Estudio fitness */
  (() => {
    const c = clone();
    enableOnly(c, ['hero', 'stats', 'features', 'instructor', 'pricing', 'testimonials', 'cta_final']);
    c.sections.hero.eyebrow = 'Sin excusas';
    c.sections.hero.title = 'Entrená duro, vivas como vivas';
    c.sections.hero.subtitle = 'Clases grupales, musculación, funcional. Probá una semana gratis.';
    c.sections.hero.cta_label = 'Probar gratis';
    c.sections.hero.cta_href = '#pricing';
    c.sections.stats.title = '';
    c.sections.features.title = 'Lo que ofrecemos';
    c.sections.instructor.title = 'Nuestros profes';
    c.sections.pricing.title = 'Planes';
    c.nav.show_my_courses = true;
    c.nav.my_courses_label = 'Mi membresía';
    c.nav.show_affiliates = false;
    return {
      id: 'gym',
      name: 'Gimnasio / Fitness',
      category: 'Servicios',
      emoji: '🏋️',
      shortDesc: 'Hero motivador + stats + instructores + planes mensuales + testimonios. Para gimnasios y estudios.',
      suggestedPrimary: '#16a34a',
      config: c,
      // Membresías (planes recurrentes) + reserva de clases
      modules: ['catalog', 'plans', 'calendar', 'reservations']
    };
  })(),

  /* 6. Academia online (default — el que ya teníamos) */
  (() => {
    const c = clone();
    return {
      id: 'academy',
      name: 'Academia online',
      category: 'Educación',
      emoji: '🎓',
      shortDesc: 'El default de OfferNow. Cursos online, catálogo, testimonios. Para creators y formadores.',
      suggestedPrimary: '#f97316',
      config: c,
      // Cursos + VIP + bundles + afiliados (todo lo típico de un creator)
      modules: ['catalog', 'courses', 'vip', 'bundles', 'promotions', 'crm', 'affiliates']
    };
  })(),

  /* 7. E-commerce (Amazon / MercadoLibre / Tienda Nube style) */
  (() => {
    const c = clone();
    // Sin features/testimonials/faq — no van en un ecommerce estándar.
    // Reemplazado por benefits_bar + category_cards + products_strip
    // que son los bloques que sí ves en Amazon, ML, Tienda Nube, Shopify.
    enableOnly(c, ['hero', 'benefits_bar', 'category_cards', 'products_strip', 'products', 'contact']);
    // Hero en modo slider auto — como el carrusel superior de MercadoLibre
    c.sections.hero.layout = 'gallery';
    c.sections.hero.title = 'Nueva colección';
    c.sections.hero.subtitle = 'Envíos a todo el país. Cambios sin vueltas en 30 días.';
    c.sections.hero.cta_label = 'Ver toda la tienda';
    c.sections.hero.cta_href = '/tienda';
    c.sections.hero.eyebrow = '';
    c.sections.hero.slide_interval = 5;
    c.sections.hero.slides = [
      { id: 'hs1', title: '3X2 · LLEVÁS 3, PAGÁS 2', subtitle: '10% EXTRA POR TRANSFERENCIA', cta_label: 'Ver colección', cta_href: '/tienda?cat=promo', image_url: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=1800&auto=format&fit=crop&q=80', text_color: '#ffffff', overlay: 0.5 },
      { id: 'hs2', title: 'MODA HOMBRE', subtitle: '¡Hasta 20% OFF! · Nueva colección internacional', cta_label: 'Ver ofertas', cta_href: '/tienda?cat=hombre', image_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1800&auto=format&fit=crop&q=80', text_color: '#ffffff', overlay: 0.35 },
      { id: 'hs3', title: 'DESCUENTAZOS', subtitle: 'Celulares, tablets y accesorios · Envío gratis', cta_label: 'Ver descuentos', cta_href: '/tienda?cat=tech', image_url: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=1800&auto=format&fit=crop&q=80', text_color: '#ffffff', overlay: 0.4 }
    ];
    // Cinta debajo del hero — envíos + cuotas + transferencia
    c.sections.benefits_bar.enabled = true;
    c.sections.benefits_bar.variant = 'dark';
    // Grid de categorías: layout 'banners' (2 tarjetas horizontales estilo
    // Tienda Nube — texto e imagen partidos 50/50 dentro de un card blanco).
    // El owner puede cambiarlo a 'mixed' o 'squares' desde el editor.
    c.sections.category_cards.enabled = true;
    c.sections.category_cards.title = 'Comprá por categoría';
    c.sections.category_cards.subtitle = '';
    c.sections.category_cards.layout = 'banners';
    c.sections.category_cards.items = [
      {
        id: 'cc1',
        span: 1,
        eyebrow: 'FASHION',
        label: 'TUS SWEATERS FAVORITOS',
        subtitle: 'Nueva colección otoño-invierno',
        cta_label: 'Ver ofertas',
        cta_href: '/tienda?cat=ropa-hombre',
        image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1000&auto=format&fit=crop&q=80',
        text_color: '#111827',
        overlay: 0.05
      },
      {
        id: 'cc2',
        span: 1,
        eyebrow: 'TECNO',
        label: 'LLEVÁ TU CUIDADO AL MÁXIMO',
        subtitle: 'Planchitas, secadores y más',
        cta_label: 'Ver ofertas',
        // Alineado con el slug del seed (categoría 'tecnologia'). Antes
        // linkeaba a 'tech' que no existía → 404 al hacer click.
        cta_href: '/tienda?cat=tecnologia',
        image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1000&auto=format&fit=crop&q=80',
        text_color: '#111827',
        overlay: 0.05
      }
    ];
    // Cinta de productos horizontal
    c.sections.products_strip.enabled = true;
    c.sections.products_strip.title = 'Destacados de la semana';
    c.sections.products_strip.source = 'featured';
    c.sections.products_strip.count = 12;
    // Grid completo de productos abajo
    c.sections.products.enabled = true;
    c.sections.products.title = 'Todos los productos';
    c.sections.products.count = 12;
    // Contact al final para consultas de post-venta
    c.sections.contact.title = 'Atención al cliente';
    c.sections.contact.subtitle = 'Consultas sobre envíos, cambios y devoluciones.';
    // Nav ecommerce: reemplaza "Cursos / Testimonios / FAQ" (nav académica)
    // por labels reales de tienda. Sin "Categorías" acá porque el mega-menú
    // (show_categories_mega abajo) ya provee esa entrada al principio de la nav.
    c.nav.links = [
      { id: '00000000-0000-0000-0000-000000000e02', label: 'Ofertas', href: '/tienda?cat=promo' },
      { id: '00000000-0000-0000-0000-000000000e03', label: 'Novedades', href: '#products_strip' }
    ];
    c.nav.show_my_courses = true;
    c.nav.my_courses_label = 'Mis compras';
    c.nav.show_affiliates = false;
    // Mega-menú de categorías tipo MercadoLibre prendido por default.
    // Requiere categorías con is_featured=true (el seed las crea así).
    c.nav.show_categories_mega = true;
    c.nav.categories_mega_label = 'Categorías';
    // Footer en tono ecommerce
    c.footer.text = 'Envíos a todo el país · Cambios y devoluciones sin vueltas · Pagos seguros';
    return {
      id: 'ecommerce',
      name: 'E-commerce',
      category: 'Comercio',
      emoji: '🛍️',
      shortDesc: 'Estilo Amazon / MercadoLibre / Tienda Nube. Hero slider + cinta beneficios + categorías + productos.',
      longDesc: 'Template pensado para negocios que venden productos físicos. No incluye FAQs, testimonios ni "por qué elegirnos" — cosas que no van en un ecommerce estándar. Sí incluye lo que sí va: hero rotativo, cinta con envíos/cuotas/transferencia, grid de categorías con imágenes grandes, carrusel horizontal de productos destacados, y grid completo del catálogo.',
      suggestedPrimary: '#0a0a0a',
      config: c,
      // Tienda física + promos + bundles + gift cards (via ecommerce)
      modules: ['catalog', 'ecommerce', 'promotions', 'bundles']
    };
  })(),

  /* 8. Creator / Portfolio (fotógrafo, diseñador, freelance) */
  (() => {
    const c = clone();
    enableOnly(c, ['hero', 'about', 'gallery', 'features', 'testimonials', 'contact']);
    c.sections.hero.eyebrow = 'Fotógrafo / Diseñador';
    c.sections.hero.title = 'Hacé que tu marca destaque';
    c.sections.hero.subtitle = 'Sesiones de foto, diseño, contenido para redes. Trabajemos juntos.';
    c.sections.hero.cta_label = 'Ver portfolio';
    c.sections.hero.cta_href = '#gallery';
    c.sections.about.title = 'Sobre mí';
    c.sections.gallery.title = 'Trabajos seleccionados';
    c.sections.features.title = 'Servicios';
    c.nav.show_my_courses = false;
    c.nav.show_affiliates = false;
    return {
      id: 'creator',
      name: 'Portfolio creativo',
      category: 'Servicios',
      emoji: '📷',
      shortDesc: 'Hero + galería full-screen + sobre mí + servicios. Para fotógrafos, diseñadores, freelance.',
      suggestedPrimary: '#0891b2',
      config: c,
      // Portfolio puro — sin apps. Sólo contact form.
      modules: []
    };
  })(),

  /* 9. Sitio de noticias / editorial (estilo NYT / Clarín / La Nación) */
  (() => {
    const c = clone();
    // Sin hero promocional ni about/contact — un sitio de noticias real
    // no tiene eso en la portada. El "hero" es el masthead del header,
    // y sobre eso va directo la portada + columnas de headlines +
    // vitrinas por categoría + newsletter.
    enableOnly(c, ['blog_preview', 'article_list', 'videos_reel', 'featured_event', 'category_showcase', 'pricing', 'newsletter']);
    // Strip destacado de un evento puntual (por default Mundial 2030).
    // El owner puede cambiar título/tag desde el editor para cubrir
    // elecciones, cumbres, grandes peleas, terremotos, etc.
    c.sections.featured_event.enabled = true;
    c.sections.featured_event.title = 'Mundial de fútbol 2030';
    c.sections.featured_event.subtitle = '';
    c.sections.featured_event.tag = 'mundial-2030';
    c.sections.featured_event.count = 4;
    c.sections.featured_event.accent_color = '#0891b2';
    // Strip de shorts (YouTube) tipo NYT "Watch Today's Videos".
    // El click en un thumb va a /reels?v=<slug> con player fullscreen
    // vertical autoplay.
    c.sections.videos_reel.enabled = true;
    c.sections.videos_reel.title = 'Videos destacados';
    c.sections.videos_reel.count = 5;
    // Suscripción/membresía tipo NYT/WSJ/The Times: 3 planes con distintas
    // periodicidades. El owner conecta los precios y el link con el
    // sistema de plans/preapproval de OfferNow desde el editor.
    c.sections.pricing.enabled = true;
    c.sections.pricing.title = 'Suscribite y accedé sin límites';
    c.sections.pricing.subtitle = 'Membresía digital con acceso completo a todas nuestras notas, análisis y podcasts.';
    c.sections.pricing.tiers = [
      {
        id: 'plan-mensual',
        name: 'Mensual',
        price: '$ 1.990 / mes',
        description: 'Cancelás cuando quieras',
        features: [
          'Acceso ilimitado a todas las notas',
          'Podcasts y newsletters exclusivos',
          'Sin publicidad',
          'App móvil incluida'
        ],
        cta_label: 'Empezar mes gratis',
        cta_href: '#pricing'
      },
      {
        id: 'plan-semestral',
        name: 'Semestral',
        price: '$ 9.990 / 6 meses',
        description: 'Ahorrás ~17%',
        features: [
          'Todo lo del plan Mensual',
          'Precio congelado por 6 meses',
          'Acceso a archivo histórico',
          'Sección VIP y columnistas'
        ],
        cta_label: 'Suscribirme',
        cta_href: '#pricing',
        highlighted: true
      },
      {
        id: 'plan-anual',
        name: 'Anual',
        price: '$ 17.990 / año',
        description: 'Ahorrás ~25% · 2 meses gratis',
        features: [
          'Todo lo del plan Semestral',
          'Regalo: 1 suscripción secundaria',
          'Descuentos en eventos y talleres',
          'Prioridad en atención al cliente'
        ],
        cta_label: 'Suscribirme anual',
        cta_href: '#pricing'
      }
    ];
    // article_list: 2 columnas debajo de la portada (Últimas + Tendencias).
    c.sections.article_list.enabled = true;
    c.sections.article_list.columns = [
      { id: 'al-latest',   title: 'Últimas noticias', count: 5, order: 'latest', skip: 6 },
      { id: 'al-trending', title: 'Tendencias',       count: 5, order: 'random', skip: 0 }
    ];
    // Vitrinas por categoría — 4 bloques principales tipo NYT "Life & Style".
    // El owner puede reordenar / agregar más desde el editor. Los colores
    // matchean los accent_color del seed de categorías (ver seed-news.ts).
    c.sections.category_showcase.enabled = true;
    c.sections.category_showcase.blocks = [
      { id: 'cs-mundo',      title: 'Mundo',      category_slug: 'mundo',      accent_color: '#0891b2', count: 5 },
      { id: 'cs-politica',   title: 'Política',   category_slug: 'politica',   accent_color: '#7c3aed', count: 5 },
      { id: 'cs-economia',   title: 'Economía',   category_slug: 'economia',   accent_color: '#ca8a04', count: 5 },
      { id: 'cs-deportes',   title: 'Deportes',   category_slug: 'deportes',   accent_color: '#16a34a', count: 5 },
      { id: 'cs-negocios',   title: 'Negocios',   category_slug: 'negocios',   accent_color: '#0d9488', count: 5 },
      { id: 'cs-policiales', title: 'Policiales', category_slug: 'policiales', accent_color: '#991b1b', count: 5 },
      { id: 'cs-lifestyle',  title: 'Lifestyle',  category_slug: 'lifestyle',  accent_color: '#db2777', count: 5 }
    ];
    // Portada en layout newspaper: 1 gran artículo + 2 laterales + fila de 3.
    // Total 6 artículos organizados con jerarquía tipo NYT.
    c.sections.blog_preview.enabled = true;
    c.sections.blog_preview.title = 'Portada';
    c.sections.blog_preview.subtitle = '';
    c.sections.blog_preview.count = 6;
    c.sections.blog_preview.layout = 'newspaper';
    c.sections.blog_preview.cta_label = 'Ver todas las notas';
    c.sections.newsletter.title = 'Recibí las noticias por email';
    c.sections.newsletter.subtitle = 'Un resumen semanal en tu casilla, sin spam.';
    // Header en modo masthead: logo grande centrado en serif + nav de
    // secciones abajo, look NYT/WSJ/The Times. El "hero" desaparece
    // porque el masthead ya cumple esa función.
    c.nav.style = 'masthead';
    // Nav de secciones editoriales — el owner puede editarlas en el builder.
    // Cada link va a /blog?cat=... asumiendo que las categorías del blog
    // tienen esos slugs (o quedan como placeholder para que el owner los
    // ajuste a sus propias categorías).
    // Nav apunta a las 8 categorías del seed (ver seed-news.ts NEWS_CATEGORIES)
    c.nav.links = [
      { id: '00000000-0000-0000-0000-000000000n01', label: 'Últimas',    href: '/blog?cat=ultimas' },
      { id: '00000000-0000-0000-0000-000000000n02', label: 'Mundo',      href: '/blog?cat=mundo' },
      { id: '00000000-0000-0000-0000-000000000n03', label: 'Deportes',   href: '/blog?cat=deportes' },
      { id: '00000000-0000-0000-0000-000000000n04', label: 'Política',   href: '/blog?cat=politica' },
      { id: '00000000-0000-0000-0000-000000000n05', label: 'Economía',   href: '/blog?cat=economia' },
      { id: '00000000-0000-0000-0000-000000000n06', label: 'Negocios',   href: '/blog?cat=negocios' },
      { id: '00000000-0000-0000-0000-000000000n07', label: 'Policiales', href: '/blog?cat=policiales' },
      { id: '00000000-0000-0000-0000-000000000n08', label: 'Lifestyle',  href: '/blog?cat=lifestyle' }
    ];
    c.nav.show_my_courses = false;
    c.nav.show_affiliates = false;
    return {
      id: 'news',
      name: 'Sitio de noticias',
      category: 'Editorial',
      emoji: '📰',
      shortDesc: 'Portada con las últimas notas, newsletter y sección editorial. Blog CMS + SEO + RSS listos.',
      longDesc: 'Ideal para portales de noticias locales, revistas independientes o blogs de opinión. Incluye artículos con imagen destacada, categorías, RSS feed automático, sitemap.xml y meta tags Open Graph. Podés cobrar por suscripciones premium.',
      suggestedPrimary: '#dc2626',
      config: c,
      // Blog + forms de contacto + planes de suscripción premium
      modules: ['crm', 'blog', 'forms', 'catalog', 'plans']
    };
  })()
];

export const TEMPLATE_CATEGORIES = Array.from(new Set(SITE_TEMPLATES.map((t) => t.category)));
