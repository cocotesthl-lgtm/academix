/**
 * Módulos activables por workspace (F2 de la evolución nav).
 *
 * Cada workspace elige cuáles de estos "grupos de features" quiere ver.
 * El sidebar del panel se filtra según esto. Inicio y Configuración
 * siempre visibles.
 *
 * Añadir un módulo nuevo:
 *   1. Sumarlo a MODULE_KEYS
 *   2. Sumarlo a MODULE_META (label + descripción)
 *   3. Sumarlo a los presets relevantes
 *   4. Actualizar OwnerSidebar.tsx para asociar el/los grupos filtrables
 */

/**
 * Módulos macro (grupos del sidebar) + submódulos (features dentro de un grupo).
 *
 * ─ MACRO ────────────────────────────────────────────────────────
 * catalog, calendar, crm, team, sales, site
 *   Cada uno controla un grupo entero del sidebar. Apagarlo esconde
 *   todo el grupo.
 *
 * ─ SUBMÓDULOS ───────────────────────────────────────────────────
 * courses, ecommerce, vip, bundles → dentro de "Catálogo"
 * events, reservations             → dentro de "Agenda"
 * blog, forms, affiliates          → dentro de "CRM & Marketing"
 *
 *   Controlan items específicos del sidebar y sirven para que el owner
 *   diga "vendo cursos, NO productos físicos" y le desaparezca la
 *   duplicación de "Publicaciones" vs "Productos físicos".
 *   Un submódulo apagado no borra la data — solo lo esconde del
 *   sidebar y del wizard "Crear oferta".
 */
export const MODULE_KEYS = [
  // Macro (F2)
  'catalog', 'calendar', 'crm', 'team', 'sales', 'site',
  // Submódulos de Catálogo (F2.b)
  'courses', 'ecommerce', 'vip', 'bundles', 'promotions', 'dropshipping', 'plans',
  // Submódulos de Agenda (F2.b)
  'events', 'reservations',
  // Submódulos de CRM (F2.b)
  'blog', 'forms', 'affiliates'
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export type Modules = Record<ModuleKey, boolean>;

/** Todo prendido — default para tenants existentes (retrocompat). */
export const ALL_MODULES_ON: Modules = {
  catalog: true, calendar: true, crm: true, team: true, sales: true, site: true,
  courses: true, ecommerce: true, vip: true, bundles: true, promotions: true, dropshipping: true, plans: true,
  events: true, reservations: true,
  blog: true, forms: true, affiliates: true
};

/**
 * Relación macro → submódulos. Se usa en /owner/modulos para agrupar
 * visualmente los toggles. Un submódulo solo aparece si su macro
 * está prendido; apagar el macro esconde toda la sección.
 */
export const MODULE_TREE: Partial<Record<ModuleKey, ModuleKey[]>> = {
  catalog:  ['courses', 'ecommerce', 'vip', 'bundles', 'promotions', 'dropshipping', 'plans'],
  calendar: ['events', 'reservations'],
  crm:      ['blog', 'forms', 'affiliates']
};

/**
 * Nivel de módulo. Los macro controlan grupos enteros del sidebar; los
 * sub controlan items individuales dentro del grupo.
 */
export const MODULE_LEVEL: Record<ModuleKey, 'macro' | 'sub'> = {
  catalog: 'macro', calendar: 'macro', crm: 'macro', team: 'macro', sales: 'macro', site: 'macro',
  courses: 'sub', ecommerce: 'sub', vip: 'sub', bundles: 'sub', promotions: 'sub', dropshipping: 'sub', plans: 'sub',
  events: 'sub', reservations: 'sub',
  blog: 'sub', forms: 'sub', affiliates: 'sub'
};

export const MODULE_META: Record<ModuleKey, { label: string; description: string; sidebarGroup: string; emoji?: string }> = {
  // ── MACRO ────────────────────────────────────────────────
  catalog: {
    label: 'Catálogo',
    description: 'Todo lo que vendés + cómo se compra (publicaciones, tienda, VIP, cupones, checkout).',
    sidebarGroup: 'Catálogo'
  },
  calendar: {
    label: 'Agenda',
    description: 'Todo lo que tiene fecha/hora: eventos con tickets, reservas, sedes.',
    sidebarGroup: 'Agenda'
  },
  crm: {
    label: 'CRM & Marketing',
    description: 'Leads, clientes, formularios, mensajes, afiliados, blog.',
    sidebarGroup: 'CRM & Marketing'
  },
  team: {
    label: 'Personas',
    description: 'Equipo interno e instructores.',
    sidebarGroup: 'Personas'
  },
  sales: {
    label: 'Ventas',
    description: 'Ventas, órdenes, suscripciones, saldos, finanzas.',
    sidebarGroup: 'Ventas'
  },
  site: {
    label: 'Mi sitio',
    description: 'Editor de páginas, templates, identidad, dominio.',
    sidebarGroup: 'Mi sitio'
  },
  // ── SUB de Catálogo ──────────────────────────────────────
  courses: {
    label: 'Cursos & publicaciones',
    description: 'Cursos online, mentorías, eventos, servicios — todo lo que se crea desde "Crear oferta".',
    sidebarGroup: 'Catálogo',
    emoji: '🎓'
  },
  ecommerce: {
    label: 'Ecommerce (productos físicos)',
    description: 'Productos físicos con variantes, stock, zonas de envío y carrito.',
    sidebarGroup: 'Catálogo',
    emoji: '🛒'
  },
  vip: {
    label: 'Contenido VIP',
    description: 'Packs de contenido premium con suscripción o compra única.',
    sidebarGroup: 'Catálogo',
    emoji: '💎'
  },
  bundles: {
    label: 'Bundles / Kits',
    description: 'Combos armados por vos, vendidos como un producto único ("Kit skincare", "Pack asado").',
    sidebarGroup: 'Catálogo',
    emoji: '🎁'
  },
  promotions: {
    label: 'Promociones automáticas',
    description: 'Reglas del carrito estilo Shopify (3x2, % off por cantidad, envío gratis desde monto).',
    sidebarGroup: 'Catálogo',
    emoji: '🏷️'
  },
  dropshipping: {
    label: 'Dropshipping (marketplace interno)',
    description: 'Vendé productos de otros suppliers de OfferNow con tu markup. O suscribite como supplier y dejá que otros los vendan por vos.',
    sidebarGroup: 'Catálogo',
    emoji: '🔁'
  },
  plans: {
    label: 'Planes / Suscripciones',
    description: 'Vendé planes de suscripción a tus clientes (ej: gimnasio con membresía mensual, coaching con cuota fija).',
    sidebarGroup: 'Catálogo',
    emoji: '💳'
  },
  // ── SUB de Agenda ────────────────────────────────────────
  events: {
    label: 'Eventos con tickets',
    description: 'Eventos con entradas numeradas, zonas, escaneo QR.',
    sidebarGroup: 'Agenda',
    emoji: '🎫'
  },
  reservations: {
    label: 'Reservas',
    description: 'Turnos y reservas (mentorías, restaurantes, sedes múltiples).',
    sidebarGroup: 'Agenda',
    emoji: '📅'
  },
  // ── SUB de CRM ───────────────────────────────────────────
  blog: {
    label: 'Blog / Artículos',
    description: 'CMS de artículos editoriales con categorías y RSS.',
    sidebarGroup: 'CRM & Marketing',
    emoji: '📝'
  },
  forms: {
    label: 'Formularios',
    description: 'Builder de formularios con submissions y conexión a CRM.',
    sidebarGroup: 'CRM & Marketing',
    emoji: '📋'
  },
  affiliates: {
    label: 'Afiliados',
    description: 'Programa de afiliados con links de referido, comisiones y multi-nivel.',
    sidebarGroup: 'CRM & Marketing',
    emoji: '🤝'
  }
};

/**
 * Presets por vertical. Nuevos tenants pueden arrancar desde uno de
 * estos. Actualmente se aplican solo si el user los elige en /owner/modulos;
 * F2.2 los meterá en onboarding.
 */
/** Helper: parte de todo apagado y prende solo lo listado. */
function preset(...on: ModuleKey[]): Modules {
  const m: Modules = { ...ALL_MODULES_ON };
  for (const k of MODULE_KEYS) m[k] = false;
  for (const k of on) m[k] = true;
  return m;
}

export const MODULE_PRESETS = {
  academia: {
    label: 'Academia / Formación',
    description: 'Cursos, membresías VIP, instructores, eventos con inscripción.',
    modules: preset('catalog', 'courses', 'vip', 'bundles', 'promotions',
      'calendar', 'events',
      'crm', 'forms', 'affiliates',
      'team', 'sales', 'site')
  },
  ecommerce: {
    label: 'Ecommerce / Tienda online',
    description: 'Solo productos físicos con stock, variantes, envíos y promos (3x2, envío gratis).',
    modules: preset('catalog', 'ecommerce', 'bundles', 'promotions',
      'crm', 'forms', 'affiliates',
      'sales', 'site')
  },
  servicios: {
    label: 'Servicios profesionales',
    description: 'Estudio jurídico, consultora, contadores. Turnos y CRM sin ventas online.',
    modules: preset('calendar', 'reservations',
      'crm', 'forms', 'blog',
      'team', 'site')
  },
  comercio: {
    label: 'Comercio / Concesionaria',
    description: 'Productos, leads que un vendedor cierra, afiliados que traen clientes.',
    modules: preset('catalog', 'ecommerce', 'promotions',
      'crm', 'forms', 'affiliates',
      'team', 'sales', 'site')
  },
  personalizado: {
    label: 'Personalizado (todo prendido)',
    description: 'Todos los módulos activos. Después apagás los que no uses.',
    modules: ALL_MODULES_ON
  }
} as const;

export type PresetKey = keyof typeof MODULE_PRESETS;

/**
 * Sanea un jsonb crudo de la DB a un Modules válido.
 * Cualquier módulo faltante en la row se asume prendido (defensivo:
 * si el schema evoluciona y agrega un módulo nuevo, los tenants viejos
 * lo ven prendido automáticamente en vez de desaparecer del sidebar).
 */
export function normalizeModules(raw: unknown): Modules {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...ALL_MODULES_ON };
  for (const k of MODULE_KEYS) {
    if (typeof src[k] === 'boolean') out[k] = src[k] as boolean;
  }
  return out;
}
