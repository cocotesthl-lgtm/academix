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
  vsl_video_id?: string;          // youtube/vimeo id
  vsl_video_provider?: 'youtube' | 'vimeo';
  vsl_unlock_seconds?: number;    // 0 = siempre visible
  vsl_form_after_watch?: boolean;

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
    description: 'Video sales letter que desbloquea un form multipaso después de cierto tiempo viendo. Próximamente.'
  }
};

export const DEFAULT_LANDING_CONFIG: LandingConfig = {};

/** Defaults razonables si el config viene vacío, por template. */
export function defaultsForTemplate(template: LandingTemplate, courseTitle: string): LandingConfig {
  switch (template) {
    case 'hotmart':
      return {
        eyebrow: '🔥 Promoción por tiempo limitado',
        subtitle: 'Acceso inmediato. Garantía de 7 días sin preguntas.',
        cta_label: 'Quiero este curso',
        cta_caption: '⭐ Curso 4.9/5 · +2.400 alumnos · 7 días de garantía',
        garantia_dias: 7,
        garantia_text: 'Si no te gusta en los primeros 7 días, te devolvemos el 100%. Sin preguntas.',
        trust_badges: ['Acceso de por vida', 'Certificado al finalizar', 'Soporte directo']
      };
    case 'funnel':
      return {
        eyebrow: '⚠️ ATENCIÓN: lee esto antes de cerrar',
        subtitle: 'El método paso a paso que ya transformó +2.400 vidas. Sin teoría inútil.',
        cta_label: '✅ Sí, lo quiero ahora',
        cta_caption: '7 días de garantía · Sin tarjeta para empezar · Bonus por tiempo limitado',
        garantia_dias: 7
      };
    case 'vsl':
      return {
        eyebrow: '▶ Mirá el video antes de seguir',
        subtitle: `Te explico todo sobre ${courseTitle} en este video corto.`,
        vsl_unlock_seconds: 60,
        vsl_form_after_watch: true,
        multistep_form: [
          { label: '¿Cuál es tu nombre?', name: 'name', type: 'text', required: true },
          { label: '¿A qué email te mandamos info?', name: 'email', type: 'email', required: true },
          { label: '¿En qué situación estás hoy?', name: 'situation', type: 'select',
            options: ['Recién empiezo', 'Estoy intentando solo', 'Ya probé y no funcionó'], required: true }
        ]
      };
    default:
      return {};
  }
}
