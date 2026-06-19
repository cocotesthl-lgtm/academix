/**
 * Tipos de producto soportados + defaults inteligentes por tipo.
 * Reduce fricción: el owner elige qué vende, la plataforma configura el resto.
 */

export type ProductType =
  | 'course'
  | 'event'
  | 'mentorship'
  | 'vip_pack'
  | 'digital'
  | 'physical'
  | 'service';

export type ProductTypeSpec = {
  id: ProductType;
  emoji: string;
  label: string;
  short: string;
  examples: string;
  /** Plantilla de landing recomendada por default */
  landingTemplate: 'classic' | 'hotmart' | 'funnel' | 'vsl';
  /** Calendario del checkout — slot para mentorías, date para eventos */
  calendarMode: 'none' | 'date' | 'slot';
  /** Suscripción mensual/anual o pago único */
  pricingMode: 'one_time' | 'subscription';
  /** Etiquetas de la sección "Contenido" */
  contentTitle: string;
  moduleLabel: string;
  lessonLabel: string;
  /** Mostrar la sección de contenido en la landing pública */
  showContentSection: boolean;
  /** Texto del CTA en la landing (e.g. "Comprar curso", "Reservar lugar") */
  ctaText: string;
};

export const PRODUCT_TYPES: ProductTypeSpec[] = [
  {
    id: 'course',
    emoji: '🎓',
    label: 'Curso online',
    short: 'Videos + módulos. Acceso permanente o por tiempo.',
    examples: 'Ej: "UX desde cero", "Marketing digital", "Inglés A1→B2".',
    landingTemplate: 'hotmart',
    calendarMode: 'none',
    pricingMode: 'one_time',
    contentTitle: 'Contenido del curso',
    moduleLabel: 'módulos',
    lessonLabel: 'lecciones',
    showContentSection: true,
    ctaText: 'Comprar curso'
  },
  {
    id: 'event',
    emoji: '🎟️',
    label: 'Evento con entradas',
    short: 'Concierto, taller presencial, charla, conferencia.',
    examples: 'Ej: "Workshop sábado 18hs", "Festival electrónico".',
    landingTemplate: 'hotmart',
    calendarMode: 'date',
    pricingMode: 'one_time',
    contentTitle: 'Detalles del evento',
    moduleLabel: 'jornadas',
    lessonLabel: 'actividades',
    showContentSection: false,
    ctaText: 'Comprar entrada'
  },
  {
    id: 'mentorship',
    emoji: '🗣️',
    label: 'Mentoría 1-a-1',
    short: 'Sesiones individuales con vos. El comprador elige slot.',
    examples: 'Ej: "Coaching ejecutivo", "Asesoría legal 1hr".',
    landingTemplate: 'classic',
    calendarMode: 'slot',
    pricingMode: 'one_time',
    contentTitle: 'Qué incluye la mentoría',
    moduleLabel: 'encuentros',
    lessonLabel: 'sesiones',
    showContentSection: true,
    ctaText: 'Reservar mentoría'
  },
  {
    id: 'vip_pack',
    emoji: '🔒',
    label: 'Pack VIP / Contenido exclusivo',
    short: 'Galería bloqueada (estilo OnlyFans). Acceso por suscripción.',
    examples: 'Ej: "Pack fotos exclusivas", "Detrás de cámara".',
    landingTemplate: 'classic',
    calendarMode: 'none',
    pricingMode: 'subscription',
    contentTitle: 'Qué hay adentro',
    moduleLabel: 'álbumes',
    lessonLabel: 'archivos',
    showContentSection: false,
    ctaText: 'Suscribirme'
  },
  {
    id: 'digital',
    emoji: '💾',
    label: 'Producto digital',
    short: 'eBook, plantilla, preset, software, PDF descargable.',
    examples: 'Ej: "Notion template", "30 presets Lightroom", "Ebook".',
    landingTemplate: 'hotmart',
    calendarMode: 'none',
    pricingMode: 'one_time',
    contentTitle: 'Qué incluye',
    moduleLabel: 'archivos',
    lessonLabel: 'items',
    showContentSection: true,
    ctaText: 'Comprar ahora'
  },
  {
    id: 'physical',
    emoji: '📦',
    label: 'Producto físico',
    short: 'Algo que se envía a domicilio. Requiere dirección de envío.',
    examples: 'Ej: "Remera edición limitada", "Libro firmado", "Kit".',
    landingTemplate: 'classic',
    calendarMode: 'none',
    pricingMode: 'one_time',
    contentTitle: 'Detalles del producto',
    moduleLabel: 'variantes',
    lessonLabel: 'opciones',
    showContentSection: false,
    ctaText: 'Comprar'
  },
  {
    id: 'service',
    emoji: '🛠️',
    label: 'Servicio profesional',
    short: 'Diseño, traducción, consultoría — pago por trabajo.',
    examples: 'Ej: "Logo + branding", "Traducción 5000 palabras".',
    landingTemplate: 'classic',
    calendarMode: 'none',
    pricingMode: 'one_time',
    contentTitle: 'Qué incluye el servicio',
    moduleLabel: 'entregables',
    lessonLabel: 'items',
    showContentSection: true,
    ctaText: 'Contratar'
  }
];

export function getProductTypeSpec(id: string | null | undefined): ProductTypeSpec {
  const found = PRODUCT_TYPES.find((p) => p.id === id);
  return found ?? PRODUCT_TYPES[0]; // course default
}
