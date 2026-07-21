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
    enableOnly(c, ['hero', 'about', 'features', 'stats', 'testimonials', 'faq', 'contact', 'cta_final']);
    c.sections.hero.layout = 'split';
    c.sections.hero.eyebrow = 'Estudio jurídico · Fundado en 2008';
    c.sections.hero.title = 'Asesoramiento legal a tu medida';
    c.sections.hero.subtitle = 'Soluciones estratégicas y confidenciales para personas, familias y empresas. Consulta inicial sin cargo.';
    c.sections.hero.cta_label = 'Consulta gratuita';
    c.sections.hero.cta_href = '#contact';
    c.sections.hero.cta_label_2 = 'Conocer áreas';
    c.sections.hero.cta_href_2 = '#features';
    c.sections.hero.image_url = 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1400&auto=format&fit=crop&q=80';
    c.sections.about.title = 'Quiénes somos';
    c.sections.about.body = 'Somos un equipo de abogados con más de 15 años de trayectoria brindando resultados favorables. Nuestra práctica se especializa en Derecho Civil, Comercial, de Familia y Laboral. Cada caso es único: escuchamos, analizamos y diseñamos la estrategia que mejor se adapta a tus objetivos.';
    c.sections.about.image_url = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&auto=format&fit=crop&q=80';
    c.sections.stats.title = '';
    c.sections.stats.items = [
      { id: 'st1', number: '15+', label: 'Años de trayectoria' },
      { id: 'st2', number: '2.400', label: 'Casos resueltos' },
      { id: 'st3', number: '92%', label: 'Sentencias favorables' },
      { id: 'st4', number: '4.9/5', label: 'Reputación cliente' }
    ];
    c.sections.features.title = 'Áreas de práctica';
    c.sections.features.items = [
      { id: 'f1', icon: '🏛️', title: 'Derecho Civil', body: 'Contratos, sucesiones, responsabilidad civil y daños. Redacción y revisión de escrituras.' },
      { id: 'f2', icon: '💼', title: 'Derecho Comercial', body: 'Constitución de sociedades, fusiones, adquisiciones, contratos comerciales y compliance.' },
      { id: 'f3', icon: '❤️', title: 'Derecho de Familia', body: 'Divorcios, régimen comunicacional, cuota alimentaria, adopciones y sucesiones familiares.' },
      { id: 'f4', icon: '⚖️', title: 'Derecho Laboral', body: 'Reclamos por despido, indemnizaciones, accidentes de trabajo y negociación con empleadores.' },
      { id: 'f5', icon: '📋', title: 'Derecho Administrativo', body: 'Trámites ante organismos públicos, recursos, amparos y defensa ante el Estado.' },
      { id: 'f6', icon: '🛡️', title: 'Consumidor', body: 'Reclamos por productos defectuosos, servicios no prestados, deudas mal calculadas.' }
    ];
    c.sections.testimonials.title = 'Lo que dicen nuestros clientes';
    c.sections.testimonials.items = [
      { id: 't1', name: 'Laura M.', role: 'Empresaria', rating: 5, photo_url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&auto=format&fit=crop&q=80', text: 'Resolvieron mi caso comercial en 4 meses cuando otros me habían dicho que iba a llevar años. Total profesionalismo.' },
      { id: 't2', name: 'Ricardo B.', role: 'Consultor independiente', rating: 5, photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&auto=format&fit=crop&q=80', text: 'Me acompañaron en la sucesión de mi padre con muchísima empatía. Nunca me sentí solo en el proceso.' },
      { id: 't3', name: 'María F.', role: 'Docente', rating: 5, photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&auto=format&fit=crop&q=80', text: 'Muy claros al explicar. Me hicieron entender cada paso del proceso legal. Recomiendo 100%.' }
    ];
    c.sections.faq.title = 'Preguntas frecuentes';
    c.sections.faq.items = [
      { id: 'q1', q: '¿Cobran la primera consulta?', a: 'No. La primera consulta es sin cargo y sin compromiso. Escuchamos tu caso y te decimos si podemos ayudarte y cómo.' },
      { id: 'q2', q: '¿Cómo son los honorarios?', a: 'Cada caso se cotiza en función de la complejidad, tiempo estimado y monto involucrado. Trabajamos con honorarios fijos o pactados por porcentaje según el caso.' },
      { id: 'q3', q: '¿Atienden fuera de Buenos Aires?', a: 'Sí. Trabajamos con corresponsales en todas las provincias y podemos representarte en cualquier jurisdicción del país.' },
      { id: 'q4', q: '¿Qué documentación tengo que llevar a la primera reunión?', a: 'Todo lo que tengas relacionado con el tema: contratos, mensajes, comprobantes, resoluciones. Cuanta más información mejor podemos evaluar.' },
      { id: 'q5', q: '¿Cuánto puede durar un juicio?', a: 'Depende del fuero y complejidad. Un divorcio de mutuo acuerdo se resuelve en 3-4 meses; un litigio comercial puede tomar 1-3 años. Te damos un estimado realista desde el primer día.' }
    ];
    c.sections.contact.title = 'Consulta sin cargo';
    c.sections.contact.subtitle = 'Contanos tu caso. Te respondemos dentro de las 24 horas hábiles con una evaluación inicial.';
    c.sections.cta_final.title = '¿Necesitás asesoramiento?';
    c.sections.cta_final.body = 'Consulta inicial sin cargo y sin compromiso.';
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
    enableOnly(c, ['hero', 'about', 'gallery', 'features', 'testimonials', 'faq', 'map', 'contact']);
    c.sections.hero.layout = 'centered';
    c.sections.hero.eyebrow = 'Cocina de autor · Desde 1978';
    c.sections.hero.title = 'Donde la pasta se hace a mano';
    c.sections.hero.subtitle = 'Recetas de tres generaciones en el corazón de Palermo. Reservá tu mesa o pasá a almorzar de martes a domingo.';
    c.sections.hero.cta_label = 'Reservar mesa';
    c.sections.hero.cta_href = '#contact';
    c.sections.hero.cta_label_2 = 'Ver la carta';
    c.sections.hero.cta_href_2 = '#gallery';
    c.sections.hero.image_url = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1800&auto=format&fit=crop&q=80';
    c.sections.about.title = 'Nuestra historia';
    c.sections.about.body = 'Nonna Rosa abrió la primera trattoria en 1978 con tres mesas y una receta secreta de rigatoni al ragù. Casi 50 años después, seguimos amasando la pasta cada mañana con la misma harina italiana y respetamos cada receta al pie de la letra. Somos un restaurante familiar en el que se come como en casa.';
    c.sections.about.image_url = 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200&auto=format&fit=crop&q=80';
    c.sections.features.title = 'Qué nos hace únicos';
    c.sections.features.items = [
      { id: 'f1', icon: '🍝', title: 'Pasta fresca del día', body: 'La amasamos cada mañana. Nunca usamos pasta congelada ni industrial.' },
      { id: 'f2', icon: '🌱', title: 'Ingredientes locales', body: 'Trabajamos con productores del interior. Vegetales de estación y quesos artesanales.' },
      { id: 'f3', icon: '🍷', title: 'Carta de vinos curada', body: 'Más de 120 etiquetas argentinas e italianas seleccionadas por nuestro sommelier.' },
      { id: 'f4', icon: '👨‍🍳', title: 'Cocina abierta', body: 'Podés ver cómo se prepara cada plato desde tu mesa. Sin filtros, sin secretos.' }
    ];
    c.sections.gallery.title = 'Nuestros platos';
    c.sections.gallery.subtitle = 'Una muestra de lo que vas a encontrar en la carta';
    c.sections.gallery.columns = 3;
    c.sections.gallery.items = [
      { id: 'g1', image_url: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=900&auto=format&fit=crop&q=80', caption: 'Rigatoni al ragù de la nonna' },
      { id: 'g2', image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&auto=format&fit=crop&q=80', caption: 'Pizza margherita al horno de leña' },
      { id: 'g3', image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&auto=format&fit=crop&q=80', caption: 'Bowl de vegetales de estación' },
      { id: 'g4', image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=900&auto=format&fit=crop&q=80', caption: 'Ribeye con papas rústicas' },
      { id: 'g5', image_url: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=900&auto=format&fit=crop&q=80', caption: 'Tiramisú casero' },
      { id: 'g6', image_url: 'https://images.unsplash.com/photo-1481931098730-318b6f776db0?w=900&auto=format&fit=crop&q=80', caption: 'Ravioles rellenos con calabaza' }
    ];
    c.sections.testimonials.title = 'Lo que dice la gente';
    c.sections.testimonials.items = [
      { id: 't1', name: 'Carla D.', role: 'Comensal recurrente', rating: 5, photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&auto=format&fit=crop&q=80', text: 'La pasta es una locura. Vamos al menos una vez por mes desde hace 3 años.' },
      { id: 't2', name: 'Diego P.', role: 'Vecino de Palermo', rating: 5, photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&auto=format&fit=crop&q=80', text: 'El mejor rigatoni al ragù de Buenos Aires. La atención es igual de buena que la comida.' },
      { id: 't3', name: 'Sofía L.', role: 'Foodie', rating: 5, photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&auto=format&fit=crop&q=80', text: 'El tiramisú vale el viaje. Ambiente re familiar y la carta de vinos impecable.' }
    ];
    c.sections.faq.title = 'Antes de venir';
    c.sections.faq.items = [
      { id: 'q1', q: '¿Se puede venir sin reserva?', a: 'Sí, atendemos por orden de llegada, pero los fines de semana suele haber demora. Recomendamos reservar.' },
      { id: 'q2', q: '¿Tienen opciones sin TACC / vegetarianas?', a: 'Sí. Marcamos claramente en la carta todo lo apto celíaco y vegetariano. Consultanos por opciones veganas.' },
      { id: 'q3', q: '¿Aceptan grupos grandes?', a: 'Sí. Para grupos de más de 8 personas te pedimos reservar con 48hs de anticipación así preparamos el salón.' },
      { id: 'q4', q: '¿Cuál es el horario?', a: 'Martes a jueves de 12 a 15hs y de 20 a 24hs. Viernes y sábado de 12 a 16hs y de 20hs a 1am. Domingo solo mediodía. Cerramos lunes.' },
      { id: 'q5', q: '¿Se puede pedir para llevar?', a: 'Sí. Pedidos por WhatsApp o desde la app. Envíos por Rappi y PedidosYa.' }
    ];
    c.sections.contact.title = 'Reservá tu mesa';
    c.sections.contact.subtitle = 'Contanos día, horario y cuántos son. Te confirmamos por WhatsApp en el momento.';
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
    enableOnly(c, ['hero', 'stats', 'features', 'gallery', 'testimonials', 'faq', 'pricing', 'map', 'cta_final']);
    c.sections.hero.layout = 'centered';
    c.sections.hero.eyebrow = 'Adrenalina sin límites · 4 sedes';
    c.sections.hero.title = 'Una experiencia que no vas a olvidar';
    c.sections.hero.subtitle = 'Kart en pista profesional, paintball outdoor y escape rooms temáticos. Equipamiento incluido, apto desde 8 años.';
    c.sections.hero.cta_label = 'Reservar ahora';
    c.sections.hero.cta_href = '#pricing';
    c.sections.hero.cta_label_2 = 'Ver galería';
    c.sections.hero.cta_href_2 = '#gallery';
    c.sections.hero.image_url = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1800&auto=format&fit=crop&q=80';
    c.sections.stats.title = '';
    c.sections.stats.items = [
      { id: 'st1', number: '45k+', label: 'Personas que vinieron' },
      { id: 'st2', number: '4', label: 'Sedes en el país' },
      { id: 'st3', number: '4.9', label: 'Rating promedio' },
      { id: 'st4', number: '8', label: 'Actividades distintas' }
    ];
    c.sections.features.title = 'Lo que ofrecemos';
    c.sections.features.items = [
      { id: 'f1', icon: '🏎️', title: 'Karting profesional', body: 'Karts de 200cc en pista de 850m. Cronometrado real, transponders individuales, briefing de seguridad.' },
      { id: 'f2', icon: '🎯', title: 'Paintball outdoor', body: 'Campo de 3 hectáreas con búnkers, torres y trincheras. Marcadoras eléctricas y 200 bolas por persona.' },
      { id: 'f3', icon: '🔐', title: 'Escape rooms temáticos', body: '6 salas con niveles de dificultad diferentes. Terror, aventura, misterio y sci-fi. Grupos de 2 a 8.' },
      { id: 'f4', icon: '🎮', title: 'Simuladores VR', body: 'Estación de realidad virtual con 12 experiencias inmersivas. Ideal para cumpleaños y eventos corporativos.' },
      { id: 'f5', icon: '🎂', title: 'Cumpleaños y eventos', body: 'Paquetes cerrados con salón, comida y bebida. Coordinador dedicado. Regalos para el cumpleañero.' },
      { id: 'f6', icon: '👥', title: 'Team building', body: 'Actividades diseñadas para empresas. Torneos, dinámicas de equipo, reportes de desempeño post-evento.' }
    ];
    c.sections.gallery.title = 'Un vistazo';
    c.sections.gallery.columns = 3;
    c.sections.gallery.items = [
      { id: 'g1', image_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&auto=format&fit=crop&q=80', caption: 'Pista de karting' },
      { id: 'g2', image_url: 'https://images.unsplash.com/photo-1590686960451-2b7f96dcbfe4?w=900&auto=format&fit=crop&q=80', caption: 'Campo de paintball' },
      { id: 'g3', image_url: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=900&auto=format&fit=crop&q=80', caption: 'Escape room "El Museo"' },
      { id: 'g4', image_url: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=900&auto=format&fit=crop&q=80', caption: 'VR arena' },
      { id: 'g5', image_url: 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=900&auto=format&fit=crop&q=80', caption: 'Podio del torneo mensual' },
      { id: 'g6', image_url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=900&auto=format&fit=crop&q=80', caption: 'Cumpleaños en el salón privado' }
    ];
    c.sections.pricing.title = 'Elegí tu experiencia';
    c.sections.pricing.subtitle = 'Precios por persona. Grupos +6 personas tienen descuento automático.';
    c.sections.pricing.tiers = [
      {
        id: 'p1', name: 'Solo Karting',
        price: '$ 12.900',
        description: '2 tandas de 10 minutos · Ranking',
        features: ['Briefing de seguridad', '20 minutos de pista', 'Cronómetro individual', 'Foto del podio', 'Casco y guantes incluidos'],
        cta_label: 'Reservar karting',
        cta_href: '#contact'
      },
      {
        id: 'p2', name: 'Combo Doble',
        price: '$ 22.900',
        description: 'Karting + Escape room',
        features: ['20 min de karting', '60 min de escape room', 'Cerveza o gaseosa incluida', 'Foto grupal', 'Ideal para 2-4 personas'],
        cta_label: 'Reservar combo',
        cta_href: '#contact',
        highlighted: true
      },
      {
        id: 'p3', name: 'Full Adrenalina',
        price: '$ 34.900',
        description: '3 actividades · 3 horas',
        features: ['Karting + Paintball + VR', 'Almuerzo o merienda', 'Ranking del día', 'Regalo temático', 'Foto profesional'],
        cta_label: 'Reservar full',
        cta_href: '#contact'
      }
    ];
    c.sections.testimonials.title = 'Historias reales';
    c.sections.testimonials.items = [
      { id: 't1', name: 'Grupo Cumpleaños Nico', role: 'Cumpleaños de 30', rating: 5, photo_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&auto=format&fit=crop&q=80', text: 'Fuimos 15 amigos por el cumple. Todo espectacular. La atención del staff, la comida y la pista impecables.' },
      { id: 't2', name: 'Tomás L.', role: 'Piloto amateur', rating: 5, photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&auto=format&fit=crop&q=80', text: 'La mejor pista de karting de la zona. Karts en excelente estado, staff que sabe. Voy cada 15 días.' },
      { id: 't3', name: 'Vero R.', role: 'RRHH', rating: 5, photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&auto=format&fit=crop&q=80', text: 'Hicimos team building para la empresa (35 personas). Se coordinó todo perfecto y la energía del equipo cambió por completo.' }
    ];
    c.sections.faq.title = 'Antes de venir';
    c.sections.faq.items = [
      { id: 'q1', q: '¿Qué edad mínima?', a: 'Karting desde 8 años (menores necesitan autorización). Paintball desde 12. Escape rooms sin restricción, pero se recomienda +10.' },
      { id: 'q2', q: '¿Necesito reservar?', a: 'Sí, especialmente los fines de semana. Los cupos son limitados y suele estar completo.' },
      { id: 'q3', q: '¿Qué pasa si llueve?', a: 'El karting es indoor, escape rooms y VR también. Solo paintball se puede reprogramar si llueve intensamente.' },
      { id: 'q4', q: '¿Cómo llego?', a: 'Estacionamiento gratuito propio. También llegás por colectivo, colectivo 60/113/152 paran a 3 cuadras. Google Maps te lleva directo.' },
      { id: 'q5', q: '¿Cancelo o cambio la reserva?', a: 'Sin costo hasta 48hs antes. Después se retiene el 50%. Podés reprogramar para dentro de los 90 días.' }
    ];
    c.sections.cta_final.title = 'Listo para vivirlo';
    c.sections.cta_final.body = 'Reservá ahora y en 2 minutos tenés el cupo confirmado.';
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
    enableOnly(c, ['hero', 'about', 'features', 'gallery', 'testimonials', 'pricing', 'faq', 'contact']);
    c.sections.hero.layout = 'centered';
    c.sections.hero.eyebrow = 'Salón de belleza · Palermo Soho';
    c.sections.hero.title = 'Tu momento de pausa';
    c.sections.hero.subtitle = 'Servicios profesionales en un ambiente pensado para vos. Reservá tu turno online en menos de 1 minuto.';
    c.sections.hero.cta_label = 'Reservar turno';
    c.sections.hero.cta_href = '#pricing';
    c.sections.hero.cta_label_2 = 'Ver trabajos';
    c.sections.hero.cta_href_2 = '#gallery';
    c.sections.hero.image_url = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1800&auto=format&fit=crop&q=80';
    c.sections.about.title = 'Sobre nuestro espacio';
    c.sections.about.body = 'Somos un salón boutique con más de 8 años en Palermo. Trabajamos con productos premium (OPI, Kérastase, Wella) y protocolos de higiene certificados. Cada cliente recibe atención personalizada — no somos una cadena, somos un espacio.';
    c.sections.about.image_url = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&auto=format&fit=crop&q=80';
    c.sections.features.title = 'Servicios';
    c.sections.features.items = [
      { id: 'f1', icon: '💅', title: 'Manicura y pedicura', body: 'Esculpidas, semipermanente, kapping, decoraciones. Marcas OPI y Kiara Sky.' },
      { id: 'f2', icon: '💇', title: 'Peluquería', body: 'Cortes, coloración, mechas, tratamientos capilares. Especialistas en color y rubios naturales.' },
      { id: 'f3', icon: '💆', title: 'Cosmetología', body: 'Faciales, limpieza profunda, radiofrecuencia, peelings químicos. Diagnóstico gratuito.' },
      { id: 'f4', icon: '👁️', title: 'Cejas y pestañas', body: 'Diseño, henna, laminado, lifting de pestañas. Extensiones pelo a pelo y volumen ruso.' },
      { id: 'f5', icon: '💄', title: 'Maquillaje', body: 'Social, novia, quinceañera, editorial. Airbrush y técnicas HD para foto/video.' },
      { id: 'f6', icon: '🕯️', title: 'Depilación', body: 'Cera tibia, definitiva con láser diodo. Consulta previa sin cargo para evaluar tu piel.' }
    ];
    c.sections.gallery.title = 'Trabajos recientes';
    c.sections.gallery.subtitle = 'Antes / después reales de nuestras clientes';
    c.sections.gallery.columns = 3;
    c.sections.gallery.items = [
      { id: 'g1', image_url: 'https://images.unsplash.com/photo-1610992015762-45dca7a1eecf?w=900&auto=format&fit=crop&q=80', caption: 'Nail art geométrico' },
      { id: 'g2', image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=900&auto=format&fit=crop&q=80', caption: 'Balayage rubio miel' },
      { id: 'g3', image_url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=900&auto=format&fit=crop&q=80', caption: 'Corte francés + brushing' },
      { id: 'g4', image_url: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=900&auto=format&fit=crop&q=80', caption: 'Lifting de pestañas' },
      { id: 'g5', image_url: 'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=900&auto=format&fit=crop&q=80', caption: 'Maquillaje social' },
      { id: 'g6', image_url: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=900&auto=format&fit=crop&q=80', caption: 'Manicura francesa clásica' }
    ];
    c.sections.pricing.title = 'Precios';
    c.sections.pricing.subtitle = 'Sacá tu turno online. Los precios se actualizan mensualmente.';
    c.sections.pricing.tiers = [
      {
        id: 'p1', name: 'Uñas',
        price: 'Desde $ 8.900',
        description: 'Manicura y pedicura',
        features: ['Manicura completa · $ 8.900', 'Semipermanente · $ 12.900', 'Esculpidas · $ 18.900', 'Pedicura spa · $ 11.900'],
        cta_label: 'Reservar turno',
        cta_href: '#contact'
      },
      {
        id: 'p2', name: 'Peluquería',
        price: 'Desde $ 12.900',
        description: 'Corte + brushing + tratamiento',
        features: ['Corte + brushing · $ 12.900', 'Color completo · $ 24.900', 'Mechas californianas · $ 34.900', 'Tratamiento Kérastase · $ 16.900'],
        cta_label: 'Reservar turno',
        cta_href: '#contact',
        highlighted: true
      },
      {
        id: 'p3', name: 'Estética',
        price: 'Desde $ 15.900',
        description: 'Faciales y depilación',
        features: ['Limpieza facial · $ 15.900', 'Radiofrecuencia · $ 22.900', 'Diseño de cejas · $ 6.900', 'Peeling químico · $ 28.900'],
        cta_label: 'Reservar turno',
        cta_href: '#contact'
      }
    ];
    c.sections.testimonials.title = 'Nuestras clientas cuentan';
    c.sections.testimonials.items = [
      { id: 't1', name: 'Camila R.', role: 'Cliente hace 3 años', rating: 5, photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&auto=format&fit=crop&q=80', text: 'Vengo cada 15 días y nunca me falla. El semipermanente dura las 3 semanas completas. Recomendadísimas.' },
      { id: 't2', name: 'Lucía M.', role: 'Cliente reciente', rating: 5, photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&auto=format&fit=crop&q=80', text: 'Vine a probar el balayage y quedé enamorada. La colorista sabe muchísimo, entendió qué quería en 5 minutos.' },
      { id: 't3', name: 'Sofía P.', role: 'Novia', rating: 5, photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&auto=format&fit=crop&q=80', text: 'Me maquilló para el casamiento y todo el mundo me preguntó por ella. Divina como persona, muy profesional.' }
    ];
    c.sections.faq.title = 'Preguntas frecuentes';
    c.sections.faq.items = [
      { id: 'q1', q: '¿Cómo saco turno?', a: 'Online en 1 minuto o por WhatsApp. Te llega recordatorio 24hs antes.' },
      { id: 'q2', q: '¿Aceptan tarjeta?', a: 'Todas las tarjetas de débito y crédito, hasta 3 cuotas sin interés. También transferencia con 10% off.' },
      { id: 'q3', q: '¿Puedo cambiar el turno?', a: 'Sí, sin cargo hasta 12hs antes. Después se descuenta 50% del servicio como seña.' },
      { id: 'q4', q: '¿Trabajan con novias?', a: 'Sí. Ofrecemos paquetes completos (prueba + día D) con descuento. Coordinamos horarios especiales.' },
      { id: 'q5', q: '¿Tienen productos veganos / cruelty free?', a: 'Sí, todos los productos que usamos son cruelty free. Consultanos por opciones veganas específicas.' }
    ];
    c.sections.contact.title = 'Escribinos por WhatsApp';
    c.sections.contact.subtitle = 'O reservá directo online. Respondemos en el momento durante el horario del salón.';
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
    enableOnly(c, ['hero', 'stats', 'features', 'gallery', 'instructor', 'pricing', 'testimonials', 'faq', 'cta_final']);
    c.sections.hero.layout = 'centered';
    c.sections.hero.eyebrow = 'Gimnasio 24/7 · Sin excusas';
    c.sections.hero.title = 'Entrená duro, vivas como vivas';
    c.sections.hero.subtitle = 'Musculación, funcional, spinning, boxeo, yoga. Más de 60 clases semanales. Primera semana gratis sin compromiso.';
    c.sections.hero.cta_label = 'Probar 7 días gratis';
    c.sections.hero.cta_href = '#pricing';
    c.sections.hero.cta_label_2 = 'Ver instalaciones';
    c.sections.hero.cta_href_2 = '#gallery';
    c.sections.hero.image_url = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1800&auto=format&fit=crop&q=80';
    c.sections.stats.title = '';
    c.sections.stats.items = [
      { id: 'st1', number: '2.400+', label: 'Socios activos' },
      { id: 'st2', number: '60+', label: 'Clases por semana' },
      { id: 'st3', number: '24/7', label: 'Acceso con huella' },
      { id: 'st4', number: '15', label: 'Profes matriculados' }
    ];
    c.sections.features.title = 'Todo lo que ofrecemos';
    c.sections.features.items = [
      { id: 'f1', icon: '🏋️', title: 'Musculación', body: 'Máquinas Life Fitness + peso libre. Sala renovada 2024 con espacio para 60 personas.' },
      { id: 'f2', icon: '💪', title: 'Funcional', body: 'Clases HIIT, TRX, kettlebells, cross training. De 45 minutos, todos los niveles.' },
      { id: 'f3', icon: '🚴', title: 'Spinning', body: 'Bicicletas Keiser M3i con display personalizado. Rutinas con música en vivo.' },
      { id: 'f4', icon: '🥊', title: 'Boxeo', body: 'Escuela para principiantes hasta avanzados. Rounds, técnica y trabajo con guante.' },
      { id: 'f5', icon: '🧘', title: 'Yoga & Pilates', body: 'Vinyasa, yin y reformer. Salón con luz natural, calefaccionado en invierno.' },
      { id: 'f6', icon: '🥗', title: 'Nutricionista incluida', body: 'Plan de alimentación mensual sin costo extra. Consultas 1 a 1 por WhatsApp.' }
    ];
    c.sections.gallery.title = 'Nuestras instalaciones';
    c.sections.gallery.columns = 3;
    c.sections.gallery.items = [
      { id: 'g1', image_url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&auto=format&fit=crop&q=80', caption: 'Sala de musculación' },
      { id: 'g2', image_url: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=900&auto=format&fit=crop&q=80', caption: 'Área de funcional' },
      { id: 'g3', image_url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&auto=format&fit=crop&q=80', caption: 'Salón de spinning' },
      { id: 'g4', image_url: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=900&auto=format&fit=crop&q=80', caption: 'Ring de boxeo' },
      { id: 'g5', image_url: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=900&auto=format&fit=crop&q=80', caption: 'Sala de yoga' },
      { id: 'g6', image_url: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=900&auto=format&fit=crop&q=80', caption: 'Vestuarios y duchas' }
    ];
    c.sections.instructor.title = 'Nuestros profes';
    c.sections.instructor.display_mode = 'grid';
    c.sections.instructor.items = [
      { id: 'i1', name: 'Lucas B.', credentials: 'Profesor de Educación Física · 12 años', bio: 'Musculación, hipertrofia y powerlifting. Formó a atletas nacionales.', photo_url: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400&h=400&auto=format&fit=crop&q=80' },
      { id: 'i2', name: 'Cami R.', credentials: 'Personal trainer · Instructora HIIT', bio: 'Especialista en funcional femenino y postparto. Clases de energía alta.', photo_url: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=400&h=400&auto=format&fit=crop&q=80' },
      { id: 'i3', name: 'Javi M.', credentials: 'Ex boxeador amateur · 10 años enseñando', bio: 'Boxeo desde cero. Técnica, guante y acondicionamiento físico.', photo_url: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=400&h=400&auto=format&fit=crop&q=80' },
      { id: 'i4', name: 'Vale S.', credentials: 'Instructora Yoga Alliance 500hs', bio: 'Vinyasa flow y yin restaurativo. Certificada en meditación mindfulness.', photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&auto=format&fit=crop&q=80' }
    ];
    c.sections.pricing.title = 'Planes';
    c.sections.pricing.subtitle = 'Sin permanencia. Cambiás de plan o cancelás cuando quieras.';
    c.sections.pricing.tiers = [
      {
        id: 'p1', name: 'Solo musculación',
        price: '$ 24.900 / mes',
        description: 'Acceso libre a la sala',
        features: ['Acceso 24/7 con huella', 'Sala de musculación completa', 'Vestuarios y duchas', 'App con rutinas', 'Sin permanencia'],
        cta_label: 'Empezar',
        cta_href: '#contact'
      },
      {
        id: 'p2', name: 'Full',
        price: '$ 34.900 / mes',
        description: 'Todo el gimnasio + clases',
        features: ['Musculación + todas las clases', 'Nutricionista incluida', 'App con rutinas + tracking', 'Toallas + lockers', 'Sin permanencia · 1a semana gratis'],
        cta_label: 'Probar 7 días gratis',
        cta_href: '#contact',
        highlighted: true
      },
      {
        id: 'p3', name: 'Personal training',
        price: '$ 89.900 / mes',
        description: 'Plan Full + entrenador personal',
        features: ['Todo el plan Full', '8 sesiones 1 a 1 al mes', 'Plan alimentario personalizado', 'Análisis de composición corporal', 'Reportes de progreso mensuales'],
        cta_label: 'Consultar',
        cta_href: '#contact'
      }
    ];
    c.sections.testimonials.title = 'Historias de socios';
    c.sections.testimonials.items = [
      { id: 't1', name: 'Federico M.', role: 'Bajó 18kg en 8 meses', rating: 5, photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&auto=format&fit=crop&q=80', text: 'Vine sin haber pisado un gimnasio en mi vida. Los profes me llevaron paso a paso. Cambié un montón, no solo físico.' },
      { id: 't2', name: 'Andrea T.', role: 'Postparto', rating: 5, photo_url: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=200&h=200&auto=format&fit=crop&q=80', text: 'Volví a entrenar después de mi segundo hijo con las clases de funcional femenino. Increíble el acompañamiento.' },
      { id: 't3', name: 'Nico K.', role: 'Socio hace 4 años', rating: 5, photo_url: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200&h=200&auto=format&fit=crop&q=80', text: 'Las máquinas están impecables, siempre hay lugar y los horarios 24hs me salvaron cuando cambié de trabajo.' }
    ];
    c.sections.faq.title = 'Preguntas frecuentes';
    c.sections.faq.items = [
      { id: 'q1', q: '¿Realmente puedo probar una semana gratis?', a: 'Sí. Te acercás, te damos una pulsera de acceso por 7 días y probás todo el gimnasio y las clases. Sin darnos tarjeta ni obligación.' },
      { id: 'q2', q: '¿Hay permanencia?', a: 'No. Cancelás cuando quieras sin cargo. Solo pedimos aviso el mes anterior.' },
      { id: 'q3', q: '¿Se puede pausar la membresía?', a: 'Sí, hasta 60 días al año sin costo (viaje, embarazo, lesión). Se descuenta del próximo pago.' },
      { id: 'q4', q: '¿Necesito reservar las clases?', a: 'Sí, desde la app. Los cupos van de 8 a 20 personas según la clase. Los cancelás sin cargo hasta 2hs antes.' },
      { id: 'q5', q: '¿Puedo entrenar sin experiencia?', a: 'Totalmente. Todo socio nuevo tiene una sesión inicial gratis con un profe que evalúa nivel y arma rutina.' },
      { id: 'q6', q: '¿Hay estacionamiento?', a: 'Sí, propio y gratuito para socios. También bicicletero cubierto.' }
    ];
    c.sections.cta_final.title = 'Empezá esta semana';
    c.sections.cta_final.body = 'Primera semana gratis. Sin tarjeta, sin compromisos.';
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
    c.sections.hero.eyebrow = '🟢 Inscripciones online abiertas';
    c.sections.hero.title = 'Aprendé con cursos que sirven';
    c.sections.hero.subtitle = 'Programas prácticos con mentoría directa y una comunidad de +2.400 alumnos que aprenden con vos.';
    c.sections.hero.image_url = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1800&auto=format&fit=crop&q=80';
    c.sections.stats.enabled = true;
    c.sections.stats.items = [
      { id: 'st1', number: '2.400+', label: 'Alumnos formados' },
      { id: 'st2', number: '4.9', label: 'Rating promedio' },
      { id: 'st3', number: '95%', label: 'Termina el curso' },
      { id: 'st4', number: '18', label: 'Cursos publicados' }
    ];
    c.sections.about.body = 'Somos una academia enfocada en formación práctica. Cada curso tiene proyectos reales, mentoría 1 a 1 mensual, y comunidad activa para resolver dudas. No prometemos milagros — sí compromiso de acompañamiento hasta que aprendas.';
    c.sections.about.image_url = 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200&auto=format&fit=crop&q=80';
    c.sections.features.items = [
      { id: 'f1', icon: '🎯', title: 'Proyectos reales', body: 'Cada módulo termina con un entregable que podés poner en tu portfolio.' },
      { id: 'f2', icon: '👥', title: 'Mentoría 1 a 1', body: 'Videollamada mensual con el instructor. Revisamos tu progreso y desbloqueamos lo que trabe.' },
      { id: 'f3', icon: '💬', title: 'Comunidad activa', body: 'Grupo de Discord con +2.400 alumnos. Compartís tus dudas, encontrás colaboradores.' },
      { id: 'f4', icon: '📱', title: 'Ves cuando querés', body: 'Todos los cursos son on demand. Descargá los videos si te vas de viaje.' },
      { id: 'f5', icon: '🏆', title: 'Certificado con QR', body: 'Al terminar recibís certificado verificable. Ideal para LinkedIn y CV.' },
      { id: 'f6', icon: '🔄', title: 'Actualizaciones gratis', body: 'Cuando actualizamos el contenido lo recibís sin costo. Comprás una vez, tenés para siempre.' }
    ];
    c.sections.testimonials.items = [
      { id: 't1', name: 'Ana R.', role: 'Alumna Diseño Web', rating: 5, photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&auto=format&fit=crop&q=80', text: 'Después del curso conseguí mi primer trabajo remoto. El material es súper actualizado y las mentorías cambian todo.' },
      { id: 't2', name: 'Diego F.', role: 'Alumno Marketing', rating: 5, photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&auto=format&fit=crop&q=80', text: 'Probé varios cursos online y este fue el único que terminé. Los profes están re presentes en la comunidad.' },
      { id: 't3', name: 'Sofi M.', role: 'Alumna Data', rating: 5, photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&auto=format&fit=crop&q=80', text: 'Empecé sin saber nada de programación y ya estoy en una entrevista para trainee. Total recomendable.' }
    ];
    c.sections.faq.items = [
      { id: 'q1', q: '¿Cuánto tiempo tengo para hacer el curso?', a: 'Acceso de por vida. Podés ver los videos cuando quieras, cuantas veces quieras.' },
      { id: 'q2', q: '¿Hay clases en vivo?', a: 'Todo el contenido principal es grabado, pero cada mes hay 2 sesiones en vivo de Q&A con el instructor.' },
      { id: 'q3', q: '¿Aceptan cuotas?', a: 'Sí, hasta 12 cuotas sin interés con tarjetas argentinas. También MercadoPago, transferencia y Stripe internacional.' },
      { id: 'q4', q: '¿Puedo pedir reembolso si no me gusta?', a: 'Sí, 7 días de garantía. Si no te convence, devolución total sin preguntas.' },
      { id: 'q5', q: '¿Necesito conocimientos previos?', a: 'Cada curso indica el nivel requerido en su página. Los principiantes tenemos programas específicos desde cero.' }
    ];
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
    enableOnly(c, ['hero', 'about', 'gallery', 'features', 'stats', 'testimonials', 'pricing', 'contact']);
    c.sections.hero.layout = 'split';
    c.sections.hero.eyebrow = 'Fotógrafa · Buenos Aires';
    c.sections.hero.title = 'Hacé que tu marca destaque';
    c.sections.hero.subtitle = 'Sesiones de producto, contenido para redes y branding visual. Trabajo con marcas independientes y creadores que quieren diferenciarse.';
    c.sections.hero.cta_label = 'Ver portfolio';
    c.sections.hero.cta_href = '#gallery';
    c.sections.hero.cta_label_2 = 'Empezar proyecto';
    c.sections.hero.cta_href_2 = '#contact';
    c.sections.hero.image_url = 'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=1200&auto=format&fit=crop&q=80';
    c.sections.about.title = 'Sobre mí';
    c.sections.about.body = 'Soy fotógrafa desde hace 9 años. Empecé haciendo bodas y evolucioné hacia branding y producto — donde puedo poner mi obsesión por la luz al servicio de la historia de cada marca. Trabajé con más de 60 marcas locales y publiqué en Vogue Latinoamérica, La Nación Revista y Clarín.';
    c.sections.about.image_url = 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=1200&auto=format&fit=crop&q=80';
    c.sections.stats.title = '';
    c.sections.stats.items = [
      { id: 'st1', number: '9', label: 'Años de trayectoria' },
      { id: 'st2', number: '60+', label: 'Marcas trabajadas' },
      { id: 'st3', number: '3.200', label: 'Fotos publicadas' },
      { id: 'st4', number: '4.9', label: 'Rating clientes' }
    ];
    c.sections.features.title = 'Servicios';
    c.sections.features.items = [
      { id: 'f1', icon: '📸', title: 'Fotografía de producto', body: 'Fondos limpios, editorial, lifestyle. Ideal para tienda online, catálogo e Instagram.' },
      { id: 'f2', icon: '🎬', title: 'Contenido para redes', body: 'Packs mensuales de fotos + reels + stories. Con guión, escenografía y edición incluida.' },
      { id: 'f3', icon: '🌟', title: 'Branding visual', body: 'Sesión de identidad completa: fotos de founder, espacios, equipo, valores. Para about y prensa.' },
      { id: 'f4', icon: '🎨', title: 'Dirección de arte', body: 'Concepto, moodboard, escenografía. Cuando querés que la foto tenga una idea detrás.' },
      { id: 'f5', icon: '👗', title: 'Lookbooks', body: 'Sesión completa para colecciones de indumentaria. Modelos y ubicaciones incluidas si hace falta.' },
      { id: 'f6', icon: '💒', title: 'Eventos', body: 'Cobertura fotográfica de lanzamientos, aperturas y eventos corporativos. Entrega en 72hs.' }
    ];
    c.sections.gallery.title = 'Trabajos seleccionados';
    c.sections.gallery.subtitle = 'Una muestra reciente de proyectos';
    c.sections.gallery.columns = 3;
    c.sections.gallery.items = [
      { id: 'g1', image_url: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=900&auto=format&fit=crop&q=80', caption: 'Lookbook indumentaria SS24' },
      { id: 'g2', image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&auto=format&fit=crop&q=80', caption: 'Producto · Cosmética natural' },
      { id: 'g3', image_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&auto=format&fit=crop&q=80', caption: 'Editorial · Revista Vogue' },
      { id: 'g4', image_url: 'https://images.unsplash.com/photo-1512310604669-443f26c35f52?w=900&auto=format&fit=crop&q=80', caption: 'Branding · Café de especialidad' },
      { id: 'g5', image_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&auto=format&fit=crop&q=80', caption: 'Lookbook · Marca de accesorios' },
      { id: 'g6', image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&auto=format&fit=crop&q=80', caption: 'Producto · Tienda de decoración' }
    ];
    c.sections.pricing.title = 'Cómo trabajo';
    c.sections.pricing.subtitle = 'Paquetes cerrados con todo incluido. Podemos armar algo custom si tu proyecto necesita otra cosa.';
    c.sections.pricing.tiers = [
      {
        id: 'p1', name: 'Producto',
        price: 'Desde $ 180.000',
        description: 'Sesión de 15-20 fotos',
        features: ['Estudio + iluminación', 'Escenografía + estilismo', '15-20 fotos finales editadas', 'Entrega en 5 días', 'Uso comercial ilimitado'],
        cta_label: 'Consultar disponibilidad',
        cta_href: '#contact'
      },
      {
        id: 'p2', name: 'Contenido mensual',
        price: '$ 320.000 / mes',
        description: 'Pack redes sociales',
        features: ['1 día de producción al mes', '30 fotos + 6 reels + 12 stories', 'Calendario editorial', 'Edición y textos incluidos', 'Formato optimizado por red'],
        cta_label: 'Reservar mi mes',
        cta_href: '#contact',
        highlighted: true
      },
      {
        id: 'p3', name: 'Branding completo',
        price: 'Desde $ 550.000',
        description: 'Identidad visual full',
        features: ['Sesión founder + equipo', 'Fotos de espacios/producto', 'Moodboard + guía de estilo', 'Assets para web + prensa', 'Sesión de 2 días completos'],
        cta_label: 'Agendar reunión',
        cta_href: '#contact'
      }
    ];
    c.sections.testimonials.title = 'Clientes recientes';
    c.sections.testimonials.items = [
      { id: 't1', name: 'Marina T.', role: 'Fundadora · Marca de cosmética', rating: 5, photo_url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&auto=format&fit=crop&q=80', text: 'Cambió la percepción de mi marca. Antes de trabajar con ella parecíamos amateurs, ahora las fotos son igual o mejores que las de las marcas grandes.' },
      { id: 't2', name: 'Ignacio R.', role: 'Dueño · Café de especialidad', rating: 5, photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&auto=format&fit=crop&q=80', text: 'Súper profesional y muy fácil de trabajar. Interpretó nuestra estética en una sesión y desde entonces vendemos más solo por las fotos.' },
      { id: 't3', name: 'Julia C.', role: 'Directora creativa', rating: 5, photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&auto=format&fit=crop&q=80', text: 'Trabajé con muchos fotógrafos y ella es de las mejores. Tiene ojo, propone y las fotos siempre superan las expectativas.' }
    ];
    c.sections.contact.title = 'Contame de tu proyecto';
    c.sections.contact.subtitle = 'Respondo en menos de 24 horas. Tomamos hasta 4 proyectos por mes para poder dedicarnos a cada uno.';
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
    // Paywall soft por default: los medios editoriales típicamente
    // dejan leer los primeros párrafos gratis + banner recomendando
    // suscribirse. El owner puede cambiar a 'hard' (bloqueante) o
    // 'off' (sin paywall) desde el editor de /owner/site.
    c.paywall = {
      mode: 'soft',
      free_paragraphs: 3,
      title: 'Seguí leyendo esta nota exclusiva',
      message: 'Suscribite y accedé sin límites a todas las notas, análisis, podcasts y newsletters exclusivos.',
      cta_label: 'Suscribirme ahora',
      cta_href: '#pricing',
      dismiss_label: 'Seguir leyendo por ahora'
    };
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
