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

export const MODULE_KEYS = ['catalog', 'calendar', 'crm', 'team', 'sales', 'site'] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export type Modules = Record<ModuleKey, boolean>;

/** Todo prendido — default para tenants existentes (retrocompat). */
export const ALL_MODULES_ON: Modules = {
  catalog: true,
  calendar: true,
  crm: true,
  team: true,
  sales: true,
  site: true
};

export const MODULE_META: Record<ModuleKey, { label: string; description: string; sidebarGroup: string }> = {
  catalog: {
    label: 'Catálogo',
    description: 'Publicaciones, Contenido VIP, Bundles, Categorías, Cupones y Checkout.',
    sidebarGroup: 'Catálogo'
  },
  calendar: {
    label: 'Agenda',
    description: 'Calendario, Reservas, Eventos con tickets, Sedes.',
    sidebarGroup: 'Agenda'
  },
  crm: {
    label: 'CRM & Marketing',
    description: 'Leads, Clientes, Formularios, Mensajes, Afiliados.',
    sidebarGroup: 'CRM & Marketing'
  },
  team: {
    label: 'Personas',
    description: 'Equipo interno e Instructores.',
    sidebarGroup: 'Personas'
  },
  sales: {
    label: 'Ventas',
    description: 'Ventas, Suscripciones, Saldos, Finanzas.',
    sidebarGroup: 'Ventas'
  },
  site: {
    label: 'Mi sitio',
    description: 'Editor de páginas, Templates, Identidad, Dominio.',
    sidebarGroup: 'Mi sitio'
  }
};

/**
 * Presets por vertical. Nuevos tenants pueden arrancar desde uno de
 * estos. Actualmente se aplican solo si el user los elige en /owner/modulos;
 * F2.2 los meterá en onboarding.
 */
export const MODULE_PRESETS = {
  academia: {
    label: 'Academia / Formación',
    description: 'Cursos, membresías VIP, instructores, eventos con inscripción.',
    modules: {
      catalog: true, calendar: true, crm: true, team: true, sales: true, site: true
    } as Modules
  },
  servicios: {
    label: 'Servicios profesionales',
    description: 'Estudio jurídico, consultora, contadores. Turnos y CRM sin ventas online.',
    modules: {
      catalog: false, calendar: true, crm: true, team: true, sales: false, site: true
    } as Modules
  },
  comercio: {
    label: 'Comercio / Concesionaria',
    description: 'Productos, leads que un vendedor cierra, afiliados que traen clientes.',
    modules: {
      catalog: true, calendar: false, crm: true, team: true, sales: true, site: true
    } as Modules
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
