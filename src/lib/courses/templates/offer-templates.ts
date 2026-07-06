import type { ProductType } from '@/lib/courses/product-types';

/**
 * Plantillas pre-armadas POR tipo de oferta. Cada una pre-llena el wizard
 * de "Nueva publicación" con título, descripción, precio y cover de muestra
 * para que el owner clone el ejemplo y ajuste — en vez de empezar en blanco.
 *
 * Hardcoded en OfferNow (no per-tenant) → cero costo DB, fácil curar/editar.
 */

export type OfferTemplate = {
  id: string;
  productType: ProductType;
  name: string;             // Cómo se muestra en la galería ("Curso intro UX")
  shortDesc: string;        // 1 línea bajo el nombre
  // ─ Pre-fill del form ─
  title: string;
  description: string;
  priceArs: number;         // 0 = gratis. En ARS, lo paseamos a price input.
  coverUrl?: string;
};

/**
 * Una plantilla por tipo (las podemos sumar después). El cover usa Unsplash
 * (URL pública, sin upload). Si querés cambiarlo, editás acá y deploy.
 */
export const OFFER_TEMPLATES: OfferTemplate[] = [
  {
    id: 'tpl-course-ux',
    productType: 'course',
    name: 'Curso online — UX desde cero',
    shortDesc: 'Curso de 4 módulos con videos, ideal para empezar.',
    title: 'UX Research desde cero',
    description: 'Aprendé las bases del diseño centrado en el usuario. Investigación, prototipado y validación con casos reales.',
    priceArs: 19900,
    coverUrl: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1200&q=80'
  },
  {
    id: 'tpl-event-workshop',
    productType: 'event',
    name: 'Evento — Workshop presencial',
    shortDesc: 'Taller con 3 entradas (General / VIP / Palco).',
    title: 'Workshop de fotografía urbana',
    description: 'Una jornada práctica recorriendo el barrio con cámara en mano. Incluye material, café y revisión grupal de las tomas.',
    priceArs: 8500,
    coverUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80'
  },
  {
    id: 'tpl-mentorship-coaching',
    productType: 'mentorship',
    name: 'Mentoría — Coaching de carrera',
    shortDesc: 'Sesiones 1-a-1 con calendario de slots.',
    title: 'Coaching de carrera — Sesión de 60 min',
    description: 'Reservá un encuentro 1-a-1 conmigo para revisar tu CV, prepararte para una entrevista o definir tu próximo paso profesional.',
    priceArs: 15000,
    coverUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&q=80'
  },
  {
    id: 'tpl-vip-monthly',
    productType: 'vip_pack',
    name: 'VIP — Suscripción mensual',
    shortDesc: 'Galería bloqueada con renovación automática.',
    title: 'Acceso VIP mensual',
    description: 'Contenido exclusivo todas las semanas: detrás de cámara, archivos sin marca de agua y prioridad para resolver dudas.',
    priceArs: 4990,
    coverUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80'
  },
  {
    id: 'tpl-digital-template',
    productType: 'digital',
    name: 'Digital — Plantilla Notion',
    shortDesc: 'Descarga inmediata después del pago.',
    title: 'Notion template — Productividad Pro',
    description: 'Sistema personal de gestión: agenda, proyectos, notas, hábitos y reviews. Probado por +2000 usuarios.',
    priceArs: 6900,
    coverUrl: 'https://images.unsplash.com/photo-1611224885990-ab7363d7f2a9?w=1200&q=80'
  },
  {
    id: 'tpl-physical-remera',
    productType: 'physical',
    name: 'Físico — Remera edición limitada',
    shortDesc: 'Producto que se envía a domicilio.',
    title: 'Remera oversize — Edición limitada',
    description: 'Algodón premium 100%, estampa serigráfica. Talles S/M/L/XL. Envíos a todo el país en 3-5 días hábiles.',
    priceArs: 18500,
    coverUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80'
  },
  {
    id: 'tpl-service-logo',
    productType: 'service',
    name: 'Servicio — Logo + branding',
    shortDesc: 'Pago por trabajo, con entregables definidos.',
    title: 'Identidad visual completa — Logo + branding',
    description: 'Diseño de marca profesional: logo, variantes, paleta de colores, tipografías y manual de marca en PDF. Entrega en 14 días.',
    priceArs: 95000,
    coverUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b8?w=1200&q=80'
  },
  {
    id: 'tpl-multi-tiro',
    productType: 'multi_venue',
    name: 'Multi-sede — Experiencia de tiro',
    shortDesc: 'Cliente elige sede + fecha + hora.',
    title: 'Experiencia de tiro al blanco',
    description: 'Una hora de práctica con instructor + equipamiento incluido. Disponible en nuestras 3 sedes. Apto sin experiencia previa.',
    priceArs: 12000,
    coverUrl: 'https://images.unsplash.com/photo-1584824388878-7df198a9b8ab?w=1200&q=80'
  },
  {
    id: 'tpl-restaurant-parrilla',
    productType: 'restaurant',
    name: 'Restaurante — Parrilla del centro',
    shortDesc: 'Reservas con fecha, hora y nº de personas.',
    title: 'La Parrilla del Centro',
    description: 'Carnes a la parrilla, achuras y guarniciones caseras. Ambiente familiar en pleno microcentro. Reservá tu mesa.',
    priceArs: 0,
    coverUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=80'
  },
  {
    id: 'tpl-topup-saldo',
    productType: 'topup',
    name: 'Saldo — Carga $1000',
    shortDesc: 'Suma saldo en la cuenta del cliente al pagar.',
    title: 'Carga de saldo $1000',
    description: 'Al confirmar el pago se acreditan $1000 en tu cuenta para usar en cualquiera de nuestros servicios. No vence.',
    priceArs: 1000,
    coverUrl: 'https://images.unsplash.com/photo-1565514020179-026b92b84bb6?w=1200&q=80'
  }
];

export function getTemplatesForType(type: ProductType): OfferTemplate[] {
  return OFFER_TEMPLATES.filter((t) => t.productType === type);
}

export function getTemplateById(id: string): OfferTemplate | null {
  return OFFER_TEMPLATES.find((t) => t.id === id) ?? null;
}
