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
  | 'radio'      // 1 opción visible (cards), elegís una. Ej "Sede".
  | 'multi'      // varias opciones visibles, podés elegir N (checkboxes en grupo).
  | 'checkbox'
  | 'date'
  | 'time'       // input HTML <input type="time"> (HH:MM)
  | 'number'
  | 'heading';   // No es input — sólo título/separador visual entre secciones del form

export type CheckoutField = {
  id: string;
  key: string;             // identificador estable (ej 'company_size')
  label: string;
  type: CheckoutFieldType;
  required: boolean;
  placeholder?: string;
  /** para 'select' | 'radio' | 'multi'. Cada string puede llevar un sufijo
   *  `|+5000` o `|-2000` para sumar/restar pesos al total cuando se elige.
   *  Ej: "Sede Premium|+5000" o "Pack básico|-3000".
   *  Parsear con `parseOption()`. */
  options?: string[];
  helper?: string;         // texto descriptivo debajo del input
  position: number;
  default_checked?: boolean;     // sólo 'checkbox' — viene pre-tildado
  price_delta_cents?: number;    // sólo 'checkbox' — suma este monto al total si está tildado
};

/** Parsea una opción con sufijo `|+5000` o `|-1000` (pesos) y devuelve
 *  label limpio + delta en CENTAVOS. Sin sufijo → delta=0. */
export function parseOption(raw: string): { label: string; deltaCents: number } {
  const i = raw.lastIndexOf('|');
  if (i < 0) return { label: raw.trim(), deltaCents: 0 };
  const label = raw.slice(0, i).trim();
  const rest = raw.slice(i + 1).trim().replace(/\s/g, '');
  // Acepta "+5000", "-1000", "5000", "+5.000", "-1.500"
  const sign = rest.startsWith('-') ? -1 : 1;
  const num = parseFloat(rest.replace(/[+,-]/g, '').replace(/\./g, ''));
  if (Number.isNaN(num)) return { label: raw.trim(), deltaCents: 0 };
  return { label, deltaCents: sign * Math.round(num * 100) };
}

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
