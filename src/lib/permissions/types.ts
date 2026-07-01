/**
 * Permisos modulares por membership (F3.a).
 *
 * Cada usuario, dentro de un workspace, tiene un set de permisos por
 * módulo. La UI (sidebar, botones) y los guards de las server actions
 * consultan esto para decidir si el user puede ver/editar/administrar
 * cada área.
 *
 * Reglas:
 *   - Módulo NO listado en `permissions` = sin acceso.
 *   - Acciones hierárquicas: `admin` ⊃ `edit` ⊃ `view`. Si tenés
 *     `admin`, tenés `edit` y `view` implícitos. Nunca hace falta
 *     listarlas todas.
 *   - `null` en la row = sin permisos (student, o membership legacy).
 */

import type { ModuleKey } from '@/lib/modules/types';

export const ACTIONS = ['view', 'edit', 'admin'] as const;
export type Action = (typeof ACTIONS)[number];

export type Permissions = Partial<Record<ModuleKey, Action[]>>;

const ACTION_LEVEL: Record<Action, number> = { view: 1, edit: 2, admin: 3 };

/** Owner: full admin sobre todo. */
export const OWNER_PERMISSIONS: Permissions = {
  catalog: ['admin'],
  calendar: ['admin'],
  crm: ['admin'],
  team: ['admin'],
  sales: ['admin'],
  site: ['admin']
};

/** Instructor: puede editar su agenda + ver catálogo y leads. */
export const INSTRUCTOR_PERMISSIONS: Permissions = {
  catalog: ['view'],
  calendar: ['edit'],
  crm: ['view']
};

/** Staff genérico: CRM edit + ventas view. Cambiar por preset custom. */
export const STAFF_PERMISSIONS: Permissions = {
  crm: ['edit'],
  sales: ['view']
};

/** Afiliado: ve leads asignados y sus comisiones. */
export const AFFILIATE_PERMISSIONS: Permissions = {
  crm: ['view'],
  sales: ['view']
};

export const PERMISSION_PRESETS = {
  owner: OWNER_PERMISSIONS,
  instructor: INSTRUCTOR_PERMISSIONS,
  staff: STAFF_PERMISSIONS,
  affiliate: AFFILIATE_PERMISSIONS
} as const;

export type PermissionPresetKey = keyof typeof PERMISSION_PRESETS;

/**
 * ¿El user puede ejecutar `action` en `module`?
 * Devuelve true si el nivel del user es >= al pedido.
 */
export function can(permissions: Permissions | null | undefined, module: ModuleKey, action: Action): boolean {
  if (!permissions) return false;
  const granted = permissions[module];
  if (!granted || granted.length === 0) return false;
  const need = ACTION_LEVEL[action];
  const have = Math.max(...granted.map((a) => ACTION_LEVEL[a] ?? 0));
  return have >= need;
}

/** Módulos donde el user tiene al menos `view`. Usado por el sidebar. */
export function viewableModules(permissions: Permissions | null | undefined): Set<ModuleKey> {
  const out = new Set<ModuleKey>();
  if (!permissions) return out;
  for (const [k, actions] of Object.entries(permissions)) {
    if (actions && actions.length > 0) out.add(k as ModuleKey);
  }
  return out;
}

/**
 * Normaliza jsonb crudo de la DB. Filtra keys y actions inválidas para
 * no romper si el schema evoluciona con roles/módulos nuevos.
 */
export function normalizePermissions(raw: unknown): Permissions | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const out: Permissions = {};
  for (const [k, v] of Object.entries(src)) {
    if (!Array.isArray(v)) continue;
    const clean = v.filter((x): x is Action => typeof x === 'string' && (ACTIONS as readonly string[]).includes(x));
    if (clean.length > 0) out[k as ModuleKey] = clean;
  }
  return Object.keys(out).length > 0 ? out : null;
}
