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

  /* 7. E-commerce simple */
  (() => {
    const c = clone();
    enableOnly(c, ['hero', 'trusted_by', 'catalog', 'features', 'testimonials', 'faq', 'cta_final']);
    c.sections.hero.eyebrow = 'Nuevo drop';
    c.sections.hero.title = 'Diseño que te representa';
    c.sections.hero.subtitle = 'Envíos a todo el país. Cambios sin vueltas en 30 días.';
    c.sections.hero.cta_label = 'Ver productos';
    c.sections.hero.cta_href = '#catalog';
    c.sections.catalog.title = 'Tienda';
    c.sections.features.title = 'Por qué elegirnos';
    c.nav.show_my_courses = true;
    c.nav.my_courses_label = 'Mis compras';
    c.nav.show_affiliates = false;
    return {
      id: 'ecommerce',
      name: 'E-commerce simple',
      category: 'Comercio',
      emoji: '🛍️',
      shortDesc: 'Catálogo grande + features + testimonios. Para indumentaria, accesorios, productos digitales.',
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
  })()
];

export const TEMPLATE_CATEGORIES = Array.from(new Set(SITE_TEMPLATES.map((t) => t.category)));
