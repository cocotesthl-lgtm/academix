/**
 * Tipos y defaults para el checkout custom.
 * El owner edita esto en /owner/checkout (default tenant) o como override
 * por curso en /owner/courses/[id].
 */

export type CheckoutFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'date'
  | 'number';

export type CheckoutField = {
  id: string;
  key: string;             // identificador estable (ej 'company_size')
  label: string;
  type: CheckoutFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];      // sólo para 'select'
  helper?: string;         // texto descriptivo debajo del input
  position: number;
};

export type BaseFieldKey = 'name' | 'dni' | 'phone' | 'location';

export type BaseFieldConfig = {
  enabled: boolean;
  required: boolean;
};

export type CheckoutConfig = {
  base_fields: Record<BaseFieldKey, BaseFieldConfig>;
  extra_fields: CheckoutField[];
};

export const DEFAULT_CHECKOUT_CONFIG: CheckoutConfig = {
  base_fields: {
    name:     { enabled: true,  required: true  },
    dni:      { enabled: true,  required: true  },
    phone:    { enabled: true,  required: true  },
    location: { enabled: true,  required: true  }
  },
  extra_fields: []
};

/**
 * Normaliza un valor leído de la DB (puede ser null, {} o estructura completa)
 * a CheckoutConfig garantizando que base_fields y extra_fields existen y
 * son del shape correcto. Hace deep-merge contra los defaults.
 */
export function mergeCheckoutConfig(stored: unknown): CheckoutConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_CHECKOUT_CONFIG)) as CheckoutConfig;
  if (!stored || typeof stored !== 'object') return base;
  const s = stored as Partial<CheckoutConfig>;

  if (s.base_fields && typeof s.base_fields === 'object') {
    for (const k of Object.keys(base.base_fields) as BaseFieldKey[]) {
      const v = s.base_fields[k];
      if (v && typeof v === 'object') {
        base.base_fields[k] = {
          enabled:  typeof v.enabled  === 'boolean' ? v.enabled  : base.base_fields[k].enabled,
          required: typeof v.required === 'boolean' ? v.required : base.base_fields[k].required
        };
      }
    }
  }

  if (Array.isArray(s.extra_fields)) {
    base.extra_fields = s.extra_fields
      .filter((f): f is CheckoutField =>
        !!f && typeof f.id === 'string' && typeof f.key === 'string' &&
        typeof f.label === 'string' && typeof f.type === 'string')
      .map((f, idx) => ({
        ...f,
        required: !!f.required,
        position: typeof f.position === 'number' ? f.position : idx,
        options: Array.isArray(f.options) ? f.options.filter((o) => typeof o === 'string') : undefined
      }))
      .sort((a, b) => a.position - b.position);
  }

  return base;
}

/**
 * Devuelve la config efectiva para un curso: si el curso tiene override
 * usalo, sino caé al default del tenant.
 */
export function resolveCheckoutConfig(opts: {
  tenantConfig: unknown;
  courseConfig: unknown | null;
}): CheckoutConfig {
  if (opts.courseConfig && typeof opts.courseConfig === 'object'
      && Object.keys(opts.courseConfig as object).length > 0) {
    return mergeCheckoutConfig(opts.courseConfig);
  }
  return mergeCheckoutConfig(opts.tenantConfig);
}

/** Sanitiza un key (para que sea seguro como name de input HTML). */
export function sanitizeFieldKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40) || 'campo';
}
