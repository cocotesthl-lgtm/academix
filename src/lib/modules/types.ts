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
  'courses', 'ecommerce', 'vip', 'bundles', 'promotions', 'dropshipping', 'plans', 'wallets',
  // Submódulos de Agenda (F2.b)
  'events', 'reservations',
  // Submódulos de CRM (F2.b)
  'blog', 'forms', 'affiliates',
  // Submódulos de Ventas (F2.b)
  'pay_links'
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export type Modules = Record<ModuleKey, boolean>;

/** Todo prendido — default para tenants existentes (retrocompat). */
export const ALL_MODULES_ON: Modules = {
  catalog: true, calendar: true, crm: true, team: true, sales: true, site: true,
  courses: true, ecommerce: true, vip: true, bundles: true, promotions: true, dropshipping: true, plans: true, wallets: true,
  events: true, reservations: true,
  blog: true, forms: true, affiliates: true,
  pay_links: true
};

/**
 * Relación macro → submódulos. Se usa en /owner/modulos para agrupar
 * visualmente los toggles. Un submódulo solo aparece si su macro
 * está prendido; apagar el macro esconde toda la sección.
 */
export const MODULE_TREE: Partial<Record<ModuleKey, ModuleKey[]>> = {
  catalog:  ['courses', 'ecommerce', 'vip', 'bundles', 'promotions', 'dropshipping', 'plans', 'wallets'],
  calendar: ['events', 'reservations'],
  crm:      ['blog', 'forms', 'affiliates'],
  sales:    ['pay_links']
};

/**
 * Nivel de módulo. Los macro controlan grupos enteros del sidebar; los
 * sub controlan items individuales dentro del grupo.
 */
export const MODULE_LEVEL: Record<ModuleKey, 'macro' | 'sub'> = {
  catalog: 'macro', calendar: 'macro', crm: 'macro', team: 'macro', sales: 'macro', site: 'macro',
  courses: 'sub', ecommerce: 'sub', vip: 'sub', bundles: 'sub', promotions: 'sub', dropshipping: 'sub', plans: 'sub', wallets: 'sub',
  events: 'sub', reservations: 'sub',
  blog: 'sub', forms: 'sub', affiliates: 'sub',
  pay_links: 'sub'
};

export const MODULE_META: Record<ModuleKey, {
  label: string;
  description: string;
  sidebarGroup: string;
  emoji?: string;
  /** Descripción larga para la card de detalle del App Store. */
  longDescription?: string;
  /** Features que se muestran como bullets en la card de detalle. */
  features?: string[];
}> = {
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
    description: 'Cursos online, mentorías, eventos, servicios — todo lo que se crea desde "Crear publicación".',
    longDescription: 'Vendé conocimiento, servicios y productos digitales con landing pages profesionales. Ideal para academias, coaches, consultores y creators.',
    sidebarGroup: 'Catálogo',
    emoji: '🎓',
    features: [
      'Cursos online con módulos y lecciones (video, PDF, imagen)',
      'Templates de landing (Hotmart, VSL, Funnel, Clásica)',
      'Precios únicos o suscripción mensual/anual',
      'Certificados descargables al terminar',
      'Progreso y calendario para el alumno'
    ]
  },
  ecommerce: {
    label: 'Tienda online (productos físicos)',
    description: 'Productos físicos con variantes, stock, zonas de envío y carrito completo.',
    longDescription: 'Vendé productos físicos como Tienda Nube o Shopify. Variantes por talle/color, stock real, calculadora de envíos por provincia, y carrito multi-producto.',
    sidebarGroup: 'Catálogo',
    emoji: '🛒',
    features: [
      'Productos con variantes (talle, color, etc.)',
      'Stock por variante con historial de movimientos',
      'Zonas de envío por provincia + tarifas por peso',
      'Carrito lateral estilo ML/Amazon',
      'Checkout con dirección y MP integrado'
    ]
  },
  vip: {
    label: 'Contenido VIP',
    description: 'Packs de contenido premium bloqueado, con suscripción o compra única.',
    longDescription: 'Cerrá contenido exclusivo detrás de un paywall. Ideal para creators con galería premium, community managers o consultores con material privado.',
    sidebarGroup: 'Catálogo',
    emoji: '💎',
    features: [
      'Galería bloqueada estilo OnlyFans / Patreon',
      'Preview público + acceso pago',
      'Suscripción mensual/anual o compra única',
      'Comentarios y likes por post',
      'Notificaciones a suscriptos al subir contenido'
    ]
  },
  bundles: {
    label: 'Bundles / Kits',
    description: 'Combos armados por vos, vendidos como un producto único ("Kit skincare", "Pack asado").',
    longDescription: 'Vendé packs curados por vos que combinan varios productos y cursos con un descuento por comprarlo junto.',
    sidebarGroup: 'Catálogo',
    emoji: '🎁',
    features: [
      'Mezclá cursos y productos físicos en el mismo bundle',
      'Precio del bundle + precio "lista" para mostrar el ahorro',
      'Página propia con galería y descripción',
      'El buyer recibe todos los items al comprar'
    ]
  },
  promotions: {
    label: 'Promociones automáticas',
    description: 'Reglas del carrito estilo Shopify (3x2, % off por cantidad, envío gratis desde monto).',
    longDescription: 'Descuentos que se aplican automáticamente al carrito cuando el buyer cumple la condición. Sin códigos ni interacción — solo agregar productos y el descuento aparece.',
    sidebarGroup: 'Catálogo',
    emoji: '🏷️',
    features: [
      '3x2, 4x3 y variantes (Nx1, Nx2)',
      '% off por cantidad ("10% off comprando 3+")',
      'Envío gratis desde monto ("$80.000+")',
      'Cupones con código (se aplican en el checkout)',
      'Vigencia por fecha + scope por categoría o producto'
    ]
  },
  dropshipping: {
    label: 'Dropshipping (marketplace interno)',
    description: 'Vendé productos de otros suppliers de OfferNow con tu markup. O sé supplier y que otros los vendan.',
    longDescription: 'Marketplace interno tipo AliExpress. Como reseller no tenés stock — cuando alguien te compra, el supplier envía. Como supplier ampliás distribución sin buscar clientes.',
    sidebarGroup: 'Catálogo',
    emoji: '🔁',
    features: [
      'Explorá catálogo mayorista con filtros por categoría',
      'Añadí a tu tienda con markup en % o $ fijo',
      'White-label: el buyer no sabe que es dropshipping',
      'Órdenes ruteadas automáticamente al supplier',
      'Tracking y estado sincronizado ambas puntas'
    ]
  },
  plans: {
    label: 'Planes / Suscripciones a clientes',
    description: 'Vendé planes recurrentes: membresías, cuotas, cobros por servicio.',
    longDescription: 'Ideal para gimnasios, coaches, consultores y agencias. Cargá el plan una vez, tus clientes se suscriben y facturás sin intervención.',
    sidebarGroup: 'Catálogo',
    emoji: '💳',
    features: [
      'Planes con cuota mensual/anual/personalizada',
      'Cliente puede ver historial y renovar solo',
      'Facturación recurrente automática via MP',
      'Estados: activo, suspendido, cancelado, moroso'
    ]
  },
  wallets: {
    label: 'Saldos (wallet interna)',
    description: 'Wallet estilo MercadoPago/PayPal dentro de tu sitio. Vendé "carga de saldo", regalá saldo con cualquier compra, y tu cliente lo gasta como quiera.',
    longDescription: 'Cada cliente tiene una billetera en tu tienda con moneda personalizable (ARS, USD, BTC, "Créditos"…). Podés venderla como producto tipo "Carga de saldo", regalar saldo bonus en cualquier compra o suscripción, y hasta permitir transferencias entre clientes o retiros.',
    sidebarGroup: 'Catálogo',
    emoji: '💰',
    features: [
      'Nombre y símbolo de la moneda personalizables (BTC, USD, ARS, Créditos, etc.)',
      'Producto tipo "Carga de saldo" — el cliente paga y se le acredita',
      'Bonus configurable por producto: regalá saldo al comprar cualquier cosa',
      'Transferencias entre clientes (opcional)',
      'Solicitudes de retiro con aprobación manual',
      'Historial de movimientos + ajustes admin'
    ]
  },
  // ── SUB de Agenda ────────────────────────────────────────
  events: {
    label: 'Eventos con tickets',
    description: 'Eventos con entradas numeradas, zonas, escaneo QR.',
    longDescription: 'Vendé entradas a eventos presenciales u online. Cada ticket con QR único que se valida en la puerta. Ideal para conferencias, workshops y shows.',
    sidebarGroup: 'Agenda',
    emoji: '🎫',
    features: [
      'Multiples tipos de tickets (VIP, general, early-bird)',
      'QR único por ticket con validación en puerta',
      'Zonas y sectores (con o sin numeración)',
      'Cupo por tipo con corte automático al llenar',
      'Fecha y sede — o link Zoom si es online'
    ]
  },
  reservations: {
    label: 'Reservas y turnos',
    description: 'Turnos y reservas (mentorías, restaurantes, sedes múltiples).',
    longDescription: 'Calendario de turnos con reserva self-service. El cliente elige día/hora entre los disponibles y paga en el momento. Multi-sede y multi-recurso.',
    sidebarGroup: 'Agenda',
    emoji: '📅',
    features: [
      'Grilla horaria por recurso o profesional',
      'Multi-sede con horarios distintos',
      'Recordatorios automáticos al cliente',
      'Reserva gratuita o con seña',
      'Bloqueos por vacaciones o feriados'
    ]
  },
  // ── SUB de CRM ───────────────────────────────────────────
  blog: {
    label: 'Blog / Artículos',
    description: 'CMS de artículos editoriales con categorías y RSS.',
    longDescription: 'Publicá contenido editorial para SEO y newsletter. Editor visual, categorías, tags y RSS listo para Feedly / Google News.',
    sidebarGroup: 'CRM & Marketing',
    emoji: '📝',
    features: [
      'Editor visual con imágenes, videos y bloques',
      'Categorías y tags para organización',
      'SEO por post (title, description, OG image)',
      'Feed RSS público en /rss.xml',
      'Posts destacados y programación por fecha'
    ]
  },
  forms: {
    label: 'Formularios',
    description: 'Builder de formularios con submissions y conexión a CRM.',
    longDescription: 'Creá formularios de contacto, encuestas, o formularios de captación de leads. Cada submission entra automáticamente al CRM como un nuevo lead.',
    sidebarGroup: 'CRM & Marketing',
    emoji: '📋',
    features: [
      'Builder con drag & drop de campos',
      'Campos condicionales (mostrar/ocultar según respuesta)',
      'Submissions guardadas + notificación por email',
      'Auto-crea leads en el CRM al recibir',
      'Embeds en cualquier página de tu sitio'
    ]
  },
  affiliates: {
    label: 'Afiliados',
    description: 'Programa de afiliados con links de referido, comisiones y multi-nivel.',
    longDescription: 'Convertí a tus clientes en vendedores. Cada afiliado tiene su link único, y cuando alguien compra por ese link se le paga una comisión configurable.',
    sidebarGroup: 'CRM & Marketing',
    emoji: '🤝',
    features: [
      'Links de referido únicos por afiliado',
      'Comisión en % o $ fija por venta',
      'Multi-nivel (afiliado que trae afiliados)',
      'Dashboard del afiliado con ventas y saldo',
      'Payout via MP o transferencia manual'
    ]
  },
  // ── SUB de Ventas ────────────────────────────────────────
  pay_links: {
    label: 'Links de pago',
    description: 'Cobrá con un link corto — para servicios, adelantos, cualquier monto custom.',
    longDescription: 'Generá una URL /pay/abc123 con monto, título y descripción. Compartila por WhatsApp / mail / DM y el cliente paga con MP en segundos. Sin necesidad de crear un curso o producto. Si tenés afiliados prendidos, ellos pueden compartir el mismo link con su ref y llevarse comisión.',
    sidebarGroup: 'Ventas',
    emoji: '🔗',
    features: [
      'Link corto compartible /pay/<code>',
      'Monto, título, descripción y foto opcional',
      'Reglas: expiración, cupo máximo, campos requeridos al buyer',
      'Analytics por link: vistas, clicks, ventas',
      'Los afiliados pueden generar sus variantes con ref (si la app de afiliados está on)'
    ]
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
