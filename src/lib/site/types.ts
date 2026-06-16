export type TestimonialItem = {
  id: string;
  name: string;
  role?: string;
  photo_url?: string | null;
  text: string;
  rating?: number;     // 1..5
};

export type FaqItem = { id: string; q: string; a: string };
export type StatItem = { id: string; number: string; label: string };
export type LearnItem = { id: string; text: string };
export type FeatureItem = { id: string; icon: string; title: string; body: string };
export type LogoItem = { id: string; name: string; logo_url: string | null; href?: string | null };

export type NavLink = { id: string; label: string; href: string };
export type SocialLink = {
  id: string;
  network: 'instagram' | 'youtube' | 'linkedin' | 'twitter' | 'tiktok' | 'facebook' | 'web';
  href: string;
};

export type PricingTier = {
  id: string;
  name: string;            // "Básico", "Pro", "Elite"
  price: string;           // free-form ("$ 14.900 / mes", "Gratis")
  description?: string;
  features: string[];      // bullets
  cta_label: string;
  cta_href: string;
  highlighted?: boolean;   // true → tarjeta destacada
};

export type GalleryItem = {
  id: string;
  image_url: string;
  caption?: string;
};

/**
 * Tarjeta manual del catálogo. Permite agregar al grid del catálogo bloques
 * que NO son cursos: info pura, producto estilo ecommerce (con precio + tachado
 * + stock), o link a página externa. Todos los campos opcionales — si cta_text
 * está vacío la card no muestra botón (tarjeta informativa).
 */
export type ManualCard = {
  id: string;
  title: string;
  subtitle?: string;       // texto chico arriba del título (categoría/etiqueta)
  body?: string;           // descripción
  image_url?: string | null;
  price?: string;          // libre, ej "$ 9.999" o "Gratis"
  old_price?: string;      // libre, se muestra tachado (descuento)
  stock_label?: string;    // ej "Pocas unidades", "Últimos 3"
  ribbon_text?: string;
  ribbon_tone?: 'featured' | 'sale' | 'urgent' | 'new' | 'info';
  cta_text?: string;       // vacío = sin botón (info card)
  cta_href?: string;
};

export type InstructorItem = {
  id: string;
  name: string;
  credentials?: string;
  bio?: string;
  photo_url: string | null;
};

export type InstructorDisplay = 'single' | 'grid' | 'carousel';

export type CustomImagePos = 'none' | 'left' | 'right' | 'top';

export type HeroLayout = 'centered' | 'split' | 'gallery';

export type SectionKey =
  | 'hero'
  | 'trusted_by'
  | 'about'
  | 'instructor'
  | 'stats'
  | 'learn_points'
  | 'features'
  | 'featured'
  | 'catalog'
  | 'testimonials'
  | 'before_after'
  | 'faq'
  | 'offer'
  | 'pricing'
  | 'video'
  | 'gallery'
  | 'newsletter'
  | 'custom'
  | 'contact'
  | 'cta_final';

/**
 * Shared base for every section: enable flag + optional bg color override.
 * Sections add their own fields on top.
 */
type SectionBase = {
  enabled: boolean;
  bg_color?: string | null;          // fondo de la sección
  text_color?: string | null;        // color de todos los texts (catch-all)
  // ─ Personalización fina (todos opcionales, nulos = usa el default) ─
  title_color?: string | null;       // h1/h2/h3 — overrides text_color para títulos
  body_color?: string | null;        // p / texto chico — overrides text_color para body
  accent_color?: string | null;      // botones y bordes destacados — overrides tenant primary
  card_bg_color?: string | null;     // bg de las tarjetas internas (features, testimonials, etc)
  card_border_color?: string | null; // borde de esas tarjetas
  font_family?: string | null;       // 'sans' | 'serif' | 'display' | 'mono' | null=heredar
  title_weight?: string | null;      // 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black'
  // ─ Background image (URL only, sin uploads) ─
  bg_image_url?: string | null;      // URL de imagen de fondo
  bg_image_opacity?: number | null;  // 0..1 opacidad de la imagen (default 1)
  bg_image_position?: string | null; // 'cover' | 'contain' | 'repeat' (default 'cover')
  // ─ Efectos de texto en títulos ─
  text_effect?: string | null;       // 'none' | 'shadow' | 'glow' | 'neon' | 'outline'
  // ─ Botones (CTA) — opcionales, fallback a accent + brand ─
  button_bg_color?: string | null;
  button_text_color?: string | null;
  button_border_color?: string | null;
  button_glow?: boolean | null;      // efecto brillo en botones
  button_hidden?: boolean | null;    // ocultar todos los CTAs de esta sección
};

export type SiteConfig = {
  sections: {
    hero:         SectionBase & { layout: HeroLayout; eyebrow: string; title: string | null; subtitle: string; cta_label: string; cta_href: string; cta_label_2: string; cta_href_2: string; caption: string; image_url: string | null; gallery_urls?: string[] };
    trusted_by:   SectionBase & { title: string; items: LogoItem[]; grayscale: boolean; marquee: boolean };
    about:        SectionBase & { title: string; body: string; image_url: string | null };
    instructor:   SectionBase & { title: string; display_mode: InstructorDisplay; name: string; bio: string; photo_url: string | null; credentials: string; items: InstructorItem[] };
    stats:        SectionBase & { title: string; items: StatItem[] };
    learn_points: SectionBase & { title: string; subtitle: string; items: LearnItem[] };
    features:     SectionBase & { title: string; items: FeatureItem[] };
    featured:     SectionBase & { title: string };
    catalog:      SectionBase & { title: string; show_filters: boolean; max_visible: number; pagination_mode: 'show_more' | 'paginated';
      cta_mode?: 'course_link' | 'no_button' | 'custom_url'; cta_custom_href?: string;
      manual_cards?: ManualCard[];                 // tarjetas custom mezcladas con cursos
      manual_cards_position?: 'before' | 'after';  // dónde aparecen vs cursos auto (default 'before')
      show_auto_courses?: boolean;                  // default true. Si false, solo manual_cards
      card_style?: 'classic' | 'compact';           // 'compact' = grid 4-5 col, imagen cuadrada (tipo MeLi/Amazon)
    };
    testimonials: SectionBase & { title: string; items: TestimonialItem[] };
    before_after: SectionBase & { title: string; before_label: string; after_label: string; before_image_url: string | null; after_image_url: string | null; before_body: string; after_body: string };
    faq:          SectionBase & { title: string; items: FaqItem[] };
    offer:        SectionBase & { title: string; subtitle: string; ends_at: string | null; cta_label: string; cta_href: string };
    pricing:      SectionBase & { title: string; subtitle: string; tiers: PricingTier[] };
    video:        SectionBase & { title: string; subtitle: string; provider: 'drive' | 'youtube'; video_id: string };
    gallery:      SectionBase & { title: string; subtitle: string; items: GalleryItem[]; columns: 2 | 3 | 4 };
    newsletter:   SectionBase & { title: string; subtitle: string; cta_label: string };
    custom:       SectionBase & { title: string; subtitle: string; body: string; image_url: string | null; image_pos: CustomImagePos; cta_label: string; cta_href: string };
    contact:      SectionBase & { title: string; subtitle: string; email: string; whatsapp: string; name_label: string; email_label: string; message_label: string; submit_label: string };
    cta_final:    SectionBase & { title: string; body: string; cta_label: string; cta_href: string };
  };
  order: SectionKey[];
  nav: { links: NavLink[]; show_login: boolean };
  footer: { text: string; socials: SocialLink[]; links: NavLink[] };
};

export const DEFAULT_ORDER: SectionKey[] = [
  'hero',
  'trusted_by',
  'stats',
  'about',
  'video',
  'learn_points',
  'features',
  'instructor',
  'featured',
  'catalog',
  'pricing',
  'before_after',
  'gallery',
  'testimonials',
  'faq',
  'offer',
  'custom',
  'cta_final',
  'newsletter',
  'contact'   // anteúltimo según pedido — pero al ser la última realmente queda como cierre
];

/**
 * Default config for NEW tenants: storefront completo con contenido de muestra
 * para que el sitio se vea armado desde el día 1. El owner puede editar/desactivar
 * todo desde /owner/site.
 *
 * Existing tenants no se ven afectados — mergeConfig respeta su config almacenada
 * key por key. Solo se aplica a tenants creados después de este cambio.
 */
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  sections: {
    hero: {
      enabled: true,
      // gallery = banner Amazon-style (imagen full-width + CTA overlay).
      // El owner puede cambiarlo a 'split' (texto + imagen al lado) o 'centered'
      // (solo texto centrado) desde el builder.
      layout: 'gallery',
      eyebrow: '🟢 Beta abierta · Inscripciones online',
      title: null,
      subtitle: 'Aprendé con cursos prácticos, mentoría directa y una comunidad que te acompaña en cada paso del camino.',
      cta_label: 'Ver cursos',
      cta_href: '#cursos',
      cta_label_2: 'Cómo funciona',
      cta_href_2: '#features',
      caption: 'Sin tarjeta · Acceso de por vida · Certificado al finalizar',
      // Imagen placeholder de Unsplash (gratis, libre uso). El owner la reemplaza
      // por la suya desde el builder pegando otra URL.
      image_url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=2400&q=80&auto=format&fit=crop'
    },
    trusted_by: {
      enabled: true,
      title: 'Más de 2.400 alumnos confían en nosotros',
      grayscale: true,
      marquee: true,
      items: [
        { id: '00000000-0000-0000-0000-000000000060', name: 'Acme Corp', logo_url: null, href: null },
        { id: '00000000-0000-0000-0000-000000000061', name: 'Globex', logo_url: null, href: null },
        { id: '00000000-0000-0000-0000-000000000062', name: 'Initech', logo_url: null, href: null },
        { id: '00000000-0000-0000-0000-000000000063', name: 'Umbrella', logo_url: null, href: null },
        { id: '00000000-0000-0000-0000-000000000064', name: 'Hooli', logo_url: null, href: null },
        { id: '00000000-0000-0000-0000-000000000065', name: 'Massive', logo_url: null, href: null },
        { id: '00000000-0000-0000-0000-000000000066', name: 'Vandelay', logo_url: null, href: null },
        { id: '00000000-0000-0000-0000-000000000067', name: 'Pied Piper', logo_url: null, href: null }
      ]
    },
    about: {
      enabled: true,
      title: 'Sobre nosotros',
      body: 'Somos una academia comprometida con tu crecimiento. Combinamos contenido de alta calidad con acompañamiento personalizado para que aprendas haciendo y veas resultados desde el primer día.\n\nNuestra metodología está pensada para que avances a tu ritmo, con apoyo cuando lo necesités y libertad para explorar a fondo.',
      image_url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80&auto=format&fit=crop'
    },
    instructor: {
      enabled: true,
      title: 'Conocé a tu equipo',
      display_mode: 'grid',
      name: 'Tu nombre acá',
      bio: 'Apasionado por enseñar y por ver crecer a cada alumno. Vengo formando personas hace varios años con un método práctico, sin vueltas, orientado a resultados reales.',
      photo_url: null,
      credentials: '+10 años de experiencia · +1.000 alumnos formados',
      items: [
        { id: '00000000-0000-0000-0000-000000000080', name: 'Tu nombre acá', credentials: '+10 años · +1.000 alumnos', bio: 'Apasionado por enseñar y orientado a resultados.', photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&q=80&auto=format&fit=crop' },
        { id: '00000000-0000-0000-0000-000000000081', name: 'Co-instructor 1', credentials: 'Especialista en UX', bio: 'Aporta la mirada práctica y los casos reales.', photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&q=80&auto=format&fit=crop' },
        { id: '00000000-0000-0000-0000-000000000082', name: 'Co-instructor 2', credentials: 'Mentoría 1 a 1', bio: 'Acompañamiento personalizado para cada alumno.', photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&q=80&auto=format&fit=crop' }
      ]
    },
    stats: {
      enabled: true,
      title: 'En números',
      items: [
        { id: '00000000-0000-0000-0000-000000000001', number: '+2.400', label: 'alumnos formados' },
        { id: '00000000-0000-0000-0000-000000000002', number: '98%', label: 'satisfacción' },
        { id: '00000000-0000-0000-0000-000000000003', number: '+50hs', label: 'de contenido' },
        { id: '00000000-0000-0000-0000-000000000004', number: '5★', label: 'puntaje promedio' }
      ]
    },
    learn_points: {
      enabled: true,
      title: 'Qué vas a aprender',
      subtitle: 'Habilidades concretas que vas a poder aplicar desde el día uno.',
      items: [
        { id: '00000000-0000-0000-0000-000000000010', text: 'Fundamentos sólidos desde cero' },
        { id: '00000000-0000-0000-0000-000000000011', text: 'Casos prácticos del mundo real' },
        { id: '00000000-0000-0000-0000-000000000012', text: 'Acompañamiento personalizado' },
        { id: '00000000-0000-0000-0000-000000000013', text: 'Comunidad activa de alumnos' },
        { id: '00000000-0000-0000-0000-000000000014', text: 'Certificado al finalizar' },
        { id: '00000000-0000-0000-0000-000000000015', text: 'Acceso de por vida al contenido' }
      ]
    },
    features: {
      enabled: true,
      title: 'Por qué elegirnos',
      items: [
        { id: '00000000-0000-0000-0000-000000000020', icon: '⚡', title: 'Aprendizaje rápido', body: 'Vas a ver resultados visibles en pocas semanas con un método probado.' },
        { id: '00000000-0000-0000-0000-000000000021', icon: '🎯', title: 'Enfoque práctico', body: 'Cada lección incluye ejercicios y casos reales. Nada de teoría que no se usa.' },
        { id: '00000000-0000-0000-0000-000000000022', icon: '🤝', title: 'Soporte directo', body: 'Resolvemos tus dudas. No estás solo en el camino.' }
      ]
    },
    featured: { enabled: true, title: 'Cursos destacados' },
    catalog: { enabled: true, title: 'Todos los cursos', show_filters: true, max_visible: 3, pagination_mode: 'show_more', manual_cards: [], manual_cards_position: 'before', show_auto_courses: true },
    testimonials: {
      enabled: true,
      title: 'Lo que dicen nuestros alumnos',
      items: [
        { id: '00000000-0000-0000-0000-000000000030', name: 'María González', role: 'Estudiante', text: 'El mejor curso que tomé. Aprendí más en dos meses que en años buscando por mi cuenta.', rating: 5, photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&q=80&auto=format&fit=crop' },
        { id: '00000000-0000-0000-0000-000000000031', name: 'Juan Pérez', role: 'Profesional', text: 'Lo recomiendo 100%. El instructor sabe transmitir y siempre está disponible para responder.', rating: 5, photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&q=80&auto=format&fit=crop' },
        { id: '00000000-0000-0000-0000-000000000032', name: 'Laura Méndez', role: 'Emprendedora', text: 'Cambió mi forma de trabajar. Volví a sentir pasión por lo que hago.', rating: 5, photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&q=80&auto=format&fit=crop' }
      ]
    },
    before_after: { enabled: false, title: 'Antes vs después', before_label: 'Antes', after_label: 'Después', before_image_url: null, after_image_url: null, before_body: '', after_body: '' },
    faq: {
      enabled: true,
      title: 'Preguntas frecuentes',
      items: [
        { id: '00000000-0000-0000-0000-000000000040', q: '¿Necesito conocimientos previos?', a: 'No. Empezamos desde cero y vamos avanzando a tu ritmo. Todos los conceptos se explican paso a paso.' },
        { id: '00000000-0000-0000-0000-000000000041', q: '¿Cuánto dura el curso?', a: 'El acceso es de por vida, así que lo hacés a tu ritmo. La mayoría completa el contenido en 6 a 8 semanas.' },
        { id: '00000000-0000-0000-0000-000000000042', q: '¿Puedo pedir reembolso?', a: 'Sí. Tenés 7 días desde la compra para pedir devolución sin preguntas.' },
        { id: '00000000-0000-0000-0000-000000000043', q: '¿Cómo recibo el certificado?', a: 'Al completar el 100% de las lecciones lo descargás automáticamente desde tu perfil.' },
        { id: '00000000-0000-0000-0000-000000000044', q: '¿Cómo accedo a los videos?', a: 'Inmediatamente después de la compra. Funciona en cualquier dispositivo (compu, tablet, celu).' }
      ]
    },
    offer: { enabled: false, title: 'Oferta por tiempo limitado', subtitle: 'Inscribite antes que termine.', ends_at: null, cta_label: 'Aprovecharla', cta_href: '#cursos' },
    pricing: {
      enabled: true,
      title: 'Planes a tu medida',
      subtitle: 'Elegí el nivel de profundidad. Acceso de por vida en todos.',
      tiers: [
        {
          id: '00000000-0000-0000-0000-000000000070',
          name: 'Básico',
          price: 'Gratis',
          description: 'Para empezar y conocer el método.',
          features: ['Acceso al curso de bienvenida', 'Comunidad pública', 'Recursos descargables'],
          cta_label: 'Empezar gratis',
          cta_href: '#cursos',
          highlighted: false
        },
        {
          id: '00000000-0000-0000-0000-000000000071',
          name: 'Pro',
          price: '$14.900',
          description: 'El programa completo + comunidad activa.',
          features: ['Todo lo del Básico', 'Curso completo paso a paso', 'Comunidad privada con instructor', 'Certificado al finalizar', 'Acceso de por vida'],
          cta_label: 'Quiero el Pro',
          cta_href: '#cursos',
          highlighted: true
        },
        {
          id: '00000000-0000-0000-0000-000000000072',
          name: 'Elite',
          price: '$29.900',
          description: 'Mentoría 1 a 1 y workshops avanzados.',
          features: ['Todo lo del Pro', 'Masterclass intensiva', '4 sesiones 1 a 1 con instructor', 'Acceso prioritario a novedades'],
          cta_label: 'Sumarme al Elite',
          cta_href: '#cursos',
          highlighted: false
        }
      ]
    },
    video: { enabled: false, title: 'Mirá cómo trabajamos', subtitle: '', provider: 'youtube', video_id: '' },
    gallery: { enabled: false, title: 'Galería', subtitle: '', items: [], columns: 3 },
    newsletter: {
      enabled: true,
      title: 'Sumate al newsletter',
      subtitle: 'Recibí contenido exclusivo, descuentos y novedades antes que nadie.',
      cta_label: 'Suscribirme'
    },
    custom: {
      enabled: false,
      title: 'Bloque personalizado',
      subtitle: '',
      body: 'Usá este bloque para lo que necesites: testimonios largos, anuncios, condiciones especiales, lo que quieras.',
      image_url: null,
      image_pos: 'right',
      cta_label: '',
      cta_href: '#'
    },
    contact: {
      enabled: true,
      title: 'Contactanos',
      subtitle: '¿Querés saber más antes de inscribirte? Escribinos.',
      email: '',
      whatsapp: '',
      name_label: 'Nombre',
      email_label: 'Email',
      message_label: 'Mensaje',
      submit_label: 'Enviar'
    },
    cta_final: {
      enabled: true,
      title: '¿Listo para empezar?',
      body: 'Sumate a los miles de alumnos que ya están transformando su camino con nosotros.',
      cta_label: 'Empezar ahora',
      cta_href: '#cursos'
    }
  },
  order: DEFAULT_ORDER,
  nav: {
    links: [
      { id: '00000000-0000-0000-0000-000000000050', label: 'Cursos', href: '#cursos' },
      { id: '00000000-0000-0000-0000-000000000051', label: 'Testimonios', href: '#testimonios' },
      { id: '00000000-0000-0000-0000-000000000052', label: 'FAQ', href: '#faq' }
    ],
    show_login: true
  },
  footer: {
    text: 'Hecho con dedicación. Cualquier consulta escribinos.',
    socials: [],
    links: []
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeConfig(stored: any): SiteConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIG)) as SiteConfig;
  if (!stored || typeof stored !== 'object') return base;

  if (stored.sections && typeof stored.sections === 'object') {
    for (const key of Object.keys(base.sections) as SectionKey[]) {
      const s = stored.sections[key];
      if (s && typeof s === 'object') {
        base.sections[key] = { ...base.sections[key], ...s } as never;
      }
    }

    // Instructor migration: si el tenant viejo tiene name/bio pero items vacio,
    // migrar a primer item del array (no perder data).
    const ins = base.sections.instructor;
    if (ins && (!ins.items || ins.items.length === 0) && (ins.name || ins.bio || ins.photo_url)) {
      ins.items = [{
        id: '00000000-0000-0000-0000-000000000099',
        name: ins.name || 'Instructor',
        credentials: ins.credentials,
        bio: ins.bio,
        photo_url: ins.photo_url
      }];
    }
  }
  if (Array.isArray(stored.order) && stored.order.length > 0) {
    const stored_order = stored.order.filter((k: string) => k in base.sections) as SectionKey[];
    const missing = DEFAULT_ORDER.filter((k) => !stored_order.includes(k));
    base.order = [...stored_order, ...missing];
  }
  if (stored.nav && typeof stored.nav === 'object') {
    base.nav = { ...base.nav, ...stored.nav };
    if (!Array.isArray(base.nav.links)) base.nav.links = [];
  }
  if (stored.footer && typeof stored.footer === 'object') {
    base.footer = { ...base.footer, ...stored.footer };
    if (!Array.isArray(base.footer.socials)) base.footer.socials = [];
    if (!Array.isArray(base.footer.links)) base.footer.links = [];
  }
  return base;
}
