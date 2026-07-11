/**
 * Tipos de producto soportados + defaults inteligentes por tipo.
 * Reduce fricción: el owner elige qué vende, la plataforma configura el resto.
 */

import type { ModuleKey } from '@/lib/modules/types';

export type ProductType =
  | 'course'
  | 'event'
  | 'mentorship'
  | 'vip_pack'
  | 'digital'
  | 'physical'
  | 'service'
  | 'multi_venue'
  | 'restaurant'
  | 'topup';

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
  /**
   * Submódulo al que pertenece este tipo. El wizard "Crear oferta" solo
   * muestra tipos cuyo submódulo esté activo. Ej: si el owner apagó
   * 'ecommerce', desaparece 'physical' del wizard.
   */
  moduleKey: ModuleKey;
  /**
   * Si al elegir este tipo el flujo tiene que ir a OTRA ruta (no crear un
   * course), ponemos acá el href. Se usa para 'physical' que va a
   * /owner/products/new (physical_products table) en vez de crear un
   * row en courses.
   */
  createHref?: string;
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
    ctaText: 'Comprar curso',
    moduleKey: 'courses'
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
    ctaText: 'Comprar entrada',
    moduleKey: 'events'
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
    ctaText: 'Reservar mentoría',
    moduleKey: 'reservations'
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
    ctaText: 'Suscribirme',
    moduleKey: 'vip'
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
    ctaText: 'Comprar ahora',
    moduleKey: 'courses'
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
    ctaText: 'Comprar',
    // Físico va al form de /owner/products (physical_products, con
    // variantes/stock/envíos). El wizard, al seleccionar physical, redirige
    // acá en vez de insertar en la tabla courses.
    moduleKey: 'ecommerce',
    createHref: '/products/new'
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
    ctaText: 'Contratar',
    moduleKey: 'courses'
  },
  {
    id: 'multi_venue',
    emoji: '🎯',
    label: 'Experiencia con sedes',
    short: 'Cliente elige sede → fecha → hora. Sin pago online (cobrás en el lugar).',
    examples: 'Ej: "Tiro al blanco", "Escape room", "Paintball", "Gimnasio".',
    landingTemplate: 'hotmart',
    calendarMode: 'none', // el calendario vive por-sede vía ReservationWidget
    pricingMode: 'one_time',
    contentTitle: 'Qué incluye la experiencia',
    moduleLabel: 'actividades',
    lessonLabel: 'items',
    showContentSection: true,
    ctaText: 'Reservar lugar',
    moduleKey: 'reservations'
  },
  {
    id: 'restaurant',
    emoji: '🍽️',
    label: 'Restaurante / Reserva',
    short: 'Reservas con fecha, hora y cantidad de personas. Sin pago online.',
    examples: 'Ej: "Cena en La Cabrera", "Almuerzo Don Julio".',
    landingTemplate: 'classic',
    calendarMode: 'none',
    pricingMode: 'one_time',
    contentTitle: 'La carta / menú',
    moduleLabel: 'secciones',
    lessonLabel: 'platos',
    showContentSection: false,
    ctaText: 'Reservar mesa',
    moduleKey: 'reservations'
  },
  {
    id: 'topup',
    emoji: '💰',
    label: 'Carga de saldo',
    short: 'El cliente paga y se le acredita saldo disponible en su cuenta.',
    examples: 'Ej: "Carga $1000", "Pack de horas coworking", "Voucher regalo".',
    landingTemplate: 'classic',
    calendarMode: 'none',
    pricingMode: 'one_time',
    contentTitle: 'Cómo funciona',
    moduleLabel: 'items',
    lessonLabel: 'pasos',
    showContentSection: false,
    ctaText: 'Cargar saldo',
    moduleKey: 'wallets'
  }
];

export function getProductTypeSpec(id: string | null | undefined): ProductTypeSpec {
  const found = PRODUCT_TYPES.find((p) => p.id === id);
  return found ?? PRODUCT_TYPES[0]; // course default
}
