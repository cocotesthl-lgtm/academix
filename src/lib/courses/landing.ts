/**
 * Config y tipos para landings de curso.
 *
 * Cada curso elige un template (classic | hotmart | funnel | vsl) y puede
 * sobreescribir partes del contenido vía landing_config. La columna
 * landing_variants permite (en el futuro) que los afiliados elijan
 * variantes B/C para A/B/C testing en sus links.
 *
 * Todos los URLs son externos (no almacenamos archivos).
 */

export type LandingTemplate = 'classic' | 'hotmart' | 'funnel' | 'vsl';

export type LandingConfig = {
  // === Hero / banner ===
  /** URL imagen banner del hero (Hotmart usa esto a full width) */
  hero_image_url?: string | null;
  /** Eyebrow corto arriba del título (ej: "🔥 50% OFF · termina hoy") */
  eyebrow?: string;
  /** Headline custom (si vacío usa course.title) */
  headline?: string;
  /** Subtitle bajo el título */
  subtitle?: string;
  /** CTA principal (si vacío usa "Comprar curso") */
  cta_label?: string;
  /** Texto chico bajo el CTA (ej: "7 días de garantía · acceso vitalicio") */
  cta_caption?: string;

  // === Bullets de "qué vas a aprender" ===
  learn_points?: string[];

  // === About / descripción extendida ===
  about_body?: string;

  // === Instructor / productor ===
  instructor_name?: string;
  instructor_role?: string;
  instructor_bio?: string;
  instructor_photo_url?: string | null;

  // === Testimonios específicos del curso ===
  testimonials?: Array<{
    name: string;
    role?: string;
    text: string;
    rating?: number;
    photo_url?: string | null;
  }>;

  // === FAQ específico del curso ===
  faq?: Array<{ q: string; a: string }>;

  // === Garantía / trust ===
  garantia_dias?: number;
  garantia_text?: string;
  trust_badges?: string[];

  // === Bonus stack (qué se llevan extra) ===
  bonuses?: Array<{ title: string; description: string; value?: string }>;

  // === Offer / urgencia ===
  offer_ends_at?: string | null;
  offer_text?: string;

  // === VSL específico ===
  vsl_video_id?: string;          // URL completa de YouTube/Vimeo o ID raw (legacy)
  vsl_video_provider?: 'youtube' | 'vimeo';
  vsl_unlock_seconds?: number;    // 0 = siempre visible
  vsl_form_after_watch?: boolean;
  /** Modo VSL bloqueado: oculta controles + iframe pointer-events-none +
   *  overlay clickeable que bloquea pause. Default true. */
  vsl_block_pause?: boolean;

  // === Multistep form (VSL gated) ===
  multistep_form?: Array<{
    label: string;
    name: string;
    type: 'text' | 'email' | 'tel' | 'select';
    options?: string[];
    required?: boolean;
  }>;
};

export const TEMPLATE_LABELS: Record<LandingTemplate, { label: string; emoji: string; description: string }> = {
  classic: {
    emoji: '📄',
    label: 'Clásica',
    description: 'Layout simple: descripción + módulos + sidebar con precio. La que viene por defecto en Curplat.'
  },
  hotmart: {
    emoji: '🛒',
    label: 'Hotmart product page',
    description: 'Banner grande + bullets + instructor + testimonios + FAQ. Sidebar sticky con precio y garantía.'
  },
  funnel: {
    emoji: '🎯',
    label: 'Funnel ClickFunnels',
    description: 'Landing larga con video, social proof, urgencia, bonus stack y CTAs múltiples. Estilo direct-response.'
  },
  vsl: {
    emoji: '🎥',
    label: 'VSL gated',
    description: 'Video sales letter: el visitante mira un video, después de X segundos se desbloquea un form multipaso, y al completar accede al CTA de compra. Genera leads aunque no compren.'
  }
};

export const DEFAULT_LANDING_CONFIG: LandingConfig = {};

/**
 * Parsea una URL de video (YouTube o Vimeo) y extrae el ID + provider.
 * Acepta varios formatos:
 *  - https://www.youtube.com/watch?v=ABC123
 *  - https://youtu.be/ABC123
 *  - https://www.youtube.com/embed/ABC123
 *  - https://www.youtube.com/shorts/ABC123
 *  - https://vimeo.com/123456
 *  - https://player.vimeo.com/video/123456
 *  - O directamente el ID raw (legacy, por si alguien pega solo el ID)
 *
 * Devuelve null si no reconoce el formato.
 */
export function parseVideoUrl(input: string): { id: string; provider: 'youtube' | 'vimeo' } | null {
  if (!input) return null;
  const v = input.trim();

  // YouTube — todas las variantes
  const yt = v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { id: yt[1], provider: 'youtube' };

  // Vimeo
  const vm = v.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
  if (vm) return { id: vm[1], provider: 'vimeo' };

  // Raw ID (legacy): 11 chars alfanuméricos → asumimos YouTube; solo dígitos → Vimeo
  if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return { id: v, provider: 'youtube' };
  if (/^\d{5,}$/.test(v)) return { id: v, provider: 'vimeo' };

  return null;
}

/* Sample assets reutilizables (URLs externas - cero storage propio) */
const SAMPLE_HERO_IMG = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=2400&q=80&auto=format&fit=crop';
const SAMPLE_INSTRUCTOR_IMG = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&q=80&auto=format&fit=crop';
const SAMPLE_TESTI_1 = 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&q=80&auto=format&fit=crop';
const SAMPLE_TESTI_2 = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&q=80&auto=format&fit=crop';
const SAMPLE_TESTI_3 = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&q=80&auto=format&fit=crop';

/** Defaults razonables si el config viene vacío, por template.
 *  El owner los puede sobreescribir por completo desde el editor.
 */
export function defaultsForTemplate(template: LandingTemplate, courseTitle: string): LandingConfig {
  switch (template) {
    case 'hotmart':
      return {
        eyebrow: '🔥 Promoción por tiempo limitado',
        headline: '',
        subtitle: 'Acceso inmediato. Garantía de 7 días sin preguntas. Acompañamiento directo y método probado.',
        cta_label: 'Quiero este curso',
        cta_caption: '⭐ Curso 4.9/5 · +2.400 alumnos · 7 días de garantía',
        hero_image_url: SAMPLE_HERO_IMG,
        about_body: 'Este curso fue diseñado para que vos puedas dominar la materia desde cero, sin importar tu nivel previo. Cubrimos todo lo que necesitás saber, con casos reales y ejercicios prácticos en cada módulo.\n\nLa metodología combina contenido grabado paso a paso, recursos descargables y soporte directo para resolver tus dudas. El objetivo: que apliques lo que aprendés desde la primera semana.',
        learn_points: [
          'Fundamentos completos desde cero — sin asumir conocimiento previo',
          'Casos reales paso a paso del primer al último módulo',
          'Recursos descargables: plantillas, checklists, ejemplos',
          'Acceso a comunidad privada para resolver dudas',
          'Certificado al finalizar el curso',
          'Acceso de por vida + actualizaciones futuras incluidas'
        ],
        instructor_name: 'Tu nombre acá',
        instructor_role: '+10 años de experiencia · +2.400 alumnos formados',
        instructor_bio: 'Apasionado por enseñar y comprometido con que cada alumno termine el curso aplicando lo aprendido. Vengo del mundo profesional y traigo casos reales a cada clase, no solo teoría de libro.',
        instructor_photo_url: SAMPLE_INSTRUCTOR_IMG,
        garantia_dias: 7,
        garantia_text: 'Si no te gusta en los primeros 7 días, te devolvemos el 100% del dinero. Sin preguntas, sin vueltas.',
        trust_badges: ['Acceso de por vida', 'Certificado al finalizar', 'Soporte directo del instructor', 'Comunidad privada', 'Updates incluidos'],
        testimonials: [
          { name: 'María González', role: 'Estudiante · Buenos Aires', text: 'El mejor curso que tomé. Aprendí más en dos meses que en años buscando por mi cuenta. El soporte del instructor es increíble.', rating: 5, photo_url: SAMPLE_TESTI_1 },
          { name: 'Juan Pérez', role: 'Profesional · Córdoba', text: 'Lo recomiendo 100%. El instructor sabe transmitir, los ejercicios son prácticos y siempre está disponible para responder dudas.', rating: 5, photo_url: SAMPLE_TESTI_2 },
          { name: 'Laura Méndez', role: 'Emprendedora · Rosario', text: 'Cambió mi forma de trabajar. Volví a sentir pasión por lo que hago. La comunidad también es un plus enorme.', rating: 5, photo_url: SAMPLE_TESTI_3 }
        ],
        faq: [
          { q: '¿Necesito conocimientos previos?', a: 'No. Empezamos desde cero y vamos avanzando a tu ritmo. Todos los conceptos se explican paso a paso para que no quedes atrás.' },
          { q: '¿Cuánto dura el curso?', a: 'El acceso es de por vida, así que lo hacés a tu ritmo. La mayoría completa el contenido en 6 a 8 semanas dedicando 30 minutos al día.' },
          { q: '¿Puedo pedir reembolso?', a: 'Sí. Tenés 7 días desde la compra para pedir devolución sin necesidad de justificar. Te devolvemos el 100% sin preguntas.' },
          { q: '¿Cómo recibo el certificado?', a: 'Al completar el 100% de las lecciones lo descargás automáticamente desde tu perfil. Lo podés compartir en LinkedIn.' },
          { q: '¿En qué dispositivos puedo verlo?', a: 'Funciona en cualquier dispositivo: PC, Mac, tablet, celular. Solo necesitás internet y un browser moderno.' }
        ],
        bonuses: [
          { title: '🎁 Plantillas premium descargables', description: 'Material listo para usar en tus propios proyectos: 12 plantillas profesionales editables.', value: 'Valor $50' },
          { title: '🎯 Sesión grupal mensual en vivo', description: 'Una clase Q&A en vivo todos los meses donde resolvemos dudas en grupo.', value: 'Valor $200/año' },
          { title: '📚 Acceso a biblioteca de casos reales', description: '+50 casos analizados paso a paso que sumamos cada mes a la plataforma.', value: 'Valor $150' }
        ],
        offer_text: '⏰ Esta oferta termina pronto. Después vuelve al precio normal sin bonus.',
        offer_ends_at: null
      };
    case 'funnel':
      return {
        eyebrow: '⚠️ ATENCIÓN: lee esto antes de cerrar la página',
        headline: '',
        subtitle: 'El método paso a paso que ya transformó +2.400 vidas. Sin teoría inútil. Solo lo que funciona en la práctica.',
        cta_label: '✅ Sí, lo quiero ahora',
        cta_caption: '7 días de garantía · Sin tarjeta para empezar · Bonus por tiempo limitado',
        hero_image_url: SAMPLE_HERO_IMG,
        about_body: 'Si llegaste hasta acá es porque sabés que algo tiene que cambiar. Llevás meses (¿años?) intentando solo. Probando métodos que te prometen el cielo. Acumulando frustración.\n\nLo entiendo. Yo pasé exactamente por eso. Hasta que descubrí UN cambio simple que multiplicó todo. Hoy te lo voy a contar.',
        learn_points: [
          '✅ El método exacto que usé para llegar a donde estoy',
          '✅ Los 3 errores que cometés y no te das cuenta',
          '✅ Cómo acortar 6 meses de aprendizaje en 6 semanas',
          '✅ Plantillas para que no empieces desde cero',
          '✅ Mi sistema personal de seguimiento y revisión',
          '✅ Acceso a grupo privado de quienes ya lo hicieron'
        ],
        instructor_name: 'Tu nombre acá',
        instructor_role: 'Fundador · +10 años en la industria',
        instructor_bio: 'Empecé como vos. Sin contactos, sin método, equivocándome. Hoy ayudo a otros a no pasar por los mismos errores. Este curso es exactamente lo que me hubiese gustado tener cuando empecé.',
        instructor_photo_url: SAMPLE_INSTRUCTOR_IMG,
        garantia_dias: 7,
        garantia_text: '100% reembolsable si no te sirve. Tomate los 7 días, mirá las primeras clases y si no es para vos te devolvemos hasta el último peso.',
        trust_badges: ['Acceso de por vida', 'Soporte 7 días/semana', 'Comunidad privada', 'Sin letra chica'],
        testimonials: [
          { name: 'María González', role: 'Empezó hace 3 meses', text: 'Pensaba que era otro curso más. Me equivoqué. Las primeras 2 semanas ya estaba aplicando todo. Mi vida cambió.', rating: 5, photo_url: SAMPLE_TESTI_1 },
          { name: 'Juan Pérez', role: 'Empezó hace 6 meses', text: 'Si lo hubiese encontrado antes me ahorraba años. El instructor responde mensajes a las 11 de la noche. Increíble.', rating: 5, photo_url: SAMPLE_TESTI_2 },
          { name: 'Laura Méndez', role: 'Recién egresada', text: 'Probé de todo. Esto fue lo único que funcionó. Recomendado 100%.', rating: 5, photo_url: SAMPLE_TESTI_3 }
        ],
        faq: [
          { q: '¿Y si soy 100% principiante?', a: 'Mejor todavía. El curso está pensado desde cero. Si ya sabés algo, las primeras lecciones las pasás rápido.' },
          { q: '¿Cuánto tiempo necesito por día?', a: 'Entre 20 y 40 minutos. La mayoría dedica eso y termina el curso en 6-8 semanas aplicando todo.' },
          { q: '¿De verdad puedo pedir reembolso?', a: 'Sí. Mandás un mail, te devolvemos el 100% en 24-48hs. Sin justificar, sin trámites raros. Si no te sirve, no nos quedamos con tu plata.' },
          { q: '¿Funciona si no tengo plata para invertir?', a: 'Sí. El método es práctico y no requiere inversión inicial. Empezás aplicando con lo que ya tenés.' },
          { q: '¿Qué pasa si no entiendo algo?', a: 'Tenés acceso al grupo privado y al instructor por mensaje directo. No te quedás solo nunca.' }
        ],
        bonuses: [
          { title: '🎁 BONUS #1: Plantillas premium', description: 'Las mismas que uso yo todos los días. Te ahorran horas de trabajo.', value: 'Valor $97 — HOY GRATIS' },
          { title: '🎁 BONUS #2: Acceso a calls grupales', description: 'Una vez al mes resolvemos dudas en vivo en zoom.', value: 'Valor $297/año — HOY GRATIS' },
          { title: '🎁 BONUS #3: Comunidad privada', description: 'Conectate con gente que está en tu mismo camino.', value: 'Valor incalculable — HOY GRATIS' },
          { title: '🎁 BONUS #4: Updates de por vida', description: 'Cada nuevo módulo que sumamos en el futuro lo tenés gratis.', value: 'HOY GRATIS' }
        ],
        offer_text: '⏰ Esta oferta y los 4 bonus terminan pronto. Después vuelve al precio normal SIN bonus.',
        offer_ends_at: null
      };
    case 'vsl':
      return {
        eyebrow: '▶ MIRÁ EL VIDEO ANTES DE CERRAR',
        headline: '',
        subtitle: `Mirá el video completo. Al terminar, te muestro cómo entrar a ${courseTitle}.`,
        cta_label: '✅ Reservar mi lugar',
        cta_caption: 'Acceso inmediato · Garantía 7 días · Plazas limitadas',
        // El owner pega su video ID acá. No usamos placeholder porque YouTube
        // suele bloquear embeds aleatorios y queda peor que vacío.
        vsl_video_id: '',
        vsl_video_provider: 'youtube',
        vsl_unlock_seconds: 60,
        vsl_form_after_watch: true,
        multistep_form: [
          { label: '¿Cuál es tu nombre y apellido?', name: 'name', type: 'text', required: true },
          { label: '¿A qué email te mandamos toda la info?', name: 'email', type: 'email', required: true },
          { label: '¿Cuál es tu WhatsApp? (te avisamos novedades)', name: 'phone', type: 'tel', required: true },
          { label: '¿En qué situación estás hoy?', name: 'situation', type: 'select',
            options: [
              'Recién estoy empezando, no sé por dónde',
              'Probé por mi cuenta y me frustré',
              'Ya tengo algo de experiencia pero quiero más',
              'Es un tema 100% nuevo para mí'
            ], required: true },
          { label: '¿Qué tan en serio querés esto?', name: 'commitment', type: 'select',
            options: ['Quiero empezar YA', 'Estoy evaluando', 'Solo curiosidad'], required: true }
        ],
        garantia_dias: 7,
        garantia_text: 'Si no te gusta en los primeros 7 días, te devolvemos el 100% del dinero. Sin preguntas.',
        testimonials: [
          { name: 'María González', role: 'Buenos Aires', text: 'El video me hizo entender que era para mí. Después del form me llegó todo y arranqué al día siguiente.', rating: 5, photo_url: SAMPLE_TESTI_1 },
          { name: 'Juan Pérez', role: 'Córdoba', text: 'Mejor inversión del año. La metodología es clarísima y el soporte responde rápido.', rating: 5, photo_url: SAMPLE_TESTI_2 },
          { name: 'Laura Méndez', role: 'Rosario', text: 'Probé otros cursos antes. Este es diferente, hay seguimiento real del instructor.', rating: 5, photo_url: SAMPLE_TESTI_3 }
        ],
        faq: [
          { q: '¿Cuánto tiempo tengo que ver el video?', a: 'Un minuto te alcanza para entender de qué va. Después podés cerrarlo y completar el form.' },
          { q: '¿Para qué me piden mis datos?', a: 'Para mandarte la info del programa al mail/WhatsApp y reservar tu lugar. No los compartimos con terceros.' },
          { q: '¿Cuánto cuesta el curso?', a: 'El precio aparece después del formulario. Tenés 7 días de garantía si no te convence.' },
          { q: '¿Cuándo empieza?', a: 'Acceso inmediato. Una vez que pagás, entrás a todo el contenido sin esperar.' }
        ]
      };
    default:
      return {};
  }
}
