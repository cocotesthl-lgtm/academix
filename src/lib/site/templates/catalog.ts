import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@/lib/site/types';

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
      config: c
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
      config: c
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
      config: c
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
      config: c
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
      config: c
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
      config: c
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
    // Grid de categorías
    c.sections.category_cards.enabled = true;
    c.sections.category_cards.title = 'Comprá por categoría';
    c.sections.category_cards.subtitle = '';
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
    // por labels reales de tienda. El grid de categorías y la cinta
    // scrollean con anclas #category_cards / #products_strip.
    c.nav.links = [
      { id: '00000000-0000-0000-0000-000000000e01', label: 'Categorías', href: '#category_cards' },
      { id: '00000000-0000-0000-0000-000000000e02', label: 'Ofertas', href: '/tienda?cat=promo' },
      { id: '00000000-0000-0000-0000-000000000e03', label: 'Novedades', href: '#products_strip' }
    ];
    c.nav.show_my_courses = true;
    c.nav.my_courses_label = 'Mis compras';
    c.nav.show_affiliates = false;
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
      config: c
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
      config: c
    };
  })(),

  /* 9. Sitio de noticias / editorial */
  (() => {
    const c = clone();
    enableOnly(c, ['hero', 'blog_preview', 'newsletter', 'about', 'contact']);
    c.sections.hero.eyebrow = 'Sitio editorial';
    c.sections.hero.title = 'Las noticias que importan.';
    c.sections.hero.subtitle = 'Cobertura diaria, análisis y opinión sobre lo que pasa en tu comunidad.';
    c.sections.hero.cta_label = 'Ver todas las notas';
    c.sections.hero.cta_href = '/blog';
    c.sections.hero.cta_label_2 = 'Suscribirme';
    c.sections.hero.cta_href_2 = '#newsletter';
    c.sections.blog_preview.enabled = true;
    c.sections.blog_preview.title = 'Últimas notas';
    c.sections.blog_preview.subtitle = 'Lo más reciente de nuestra redacción.';
    c.sections.blog_preview.count = 6;
    c.sections.blog_preview.cta_label = 'Ver todo el blog';
    c.sections.newsletter.title = 'Recibí las noticias por email';
    c.sections.newsletter.subtitle = 'Un resumen semanal en tu casilla, sin spam.';
    c.sections.about.title = 'Sobre nosotros';
    c.sections.about.body = 'Somos un equipo pequeño con una convicción: la información local importa. Contamos historias que otros no cuentan.';
    c.sections.contact.title = 'Escribinos';
    c.sections.contact.subtitle = '¿Tenés un dato? ¿Una historia? Contanos.';
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
      config: c
    };
  })()
];

export const TEMPLATE_CATEGORIES = Array.from(new Set(SITE_TEMPLATES.map((t) => t.category)));
