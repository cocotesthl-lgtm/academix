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
  /** para 'select' | 'radio' | 'multi'. Cada string puede llevar un sufijo:
   *  - monto fijo en pesos: `|+5000`, `|-2000` (ej "Sede Premium|+5000")
   *  - porcentaje del precio base: `|+10%`, `|-5%` (ej "Cupón|-15%")
   *  Parsear con `parseOption()`. */
  options?: string[];
  helper?: string;         // texto descriptivo debajo del input
  position: number;
  default_checked?: boolean;     // sólo 'checkbox' — viene pre-tildado
  /** sólo 'checkbox'. Monto fijo en CENTAVOS sumado al total si está tildado.
   *  Mutuamente excluyente con price_delta_pct (si ambos están seteados, gana pct). */
  price_delta_cents?: number;
  /** sólo 'checkbox'. Porcentaje (decimal: 0.1 = 10%) aplicado al precio
   *  BASE de la publicación si está tildado. Positivo suma, negativo resta. */
  price_delta_pct?: number;
};

/** Parsea una opción con sufijo `|+5000`, `|-1000`, `|+10%`, `|-5%`.
 *  Devuelve label limpio + delta en CENTAVOS y delta en PORCENTAJE (decimal).
 *  Si no hay sufijo, ambos son 0. */
export function parseOption(raw: string): { label: string; deltaCents: number; deltaPct: number } {
  const i = raw.lastIndexOf('|');
  if (i < 0) return { label: raw.trim(), deltaCents: 0, deltaPct: 0 };
  const label = raw.slice(0, i).trim();
  const rest = raw.slice(i + 1).trim().replace(/\s/g, '');
  const sign = rest.startsWith('-') ? -1 : 1;
  const isPct = rest.endsWith('%');
  const clean = rest.replace(/[+,-]/g, '').replace(/%/g, '').replace(/\./g, '');
  const num = parseFloat(clean);
  if (Number.isNaN(num)) return { label: raw.trim(), deltaCents: 0, deltaPct: 0 };
  if (isPct) {
    return { label, deltaCents: 0, deltaPct: sign * (num / 100) };
  }
  return { label, deltaCents: sign * Math.round(num * 100), deltaPct: 0 };
}

/** Resuelve el delta total en CENTAVOS dado un parsed y el precio base
 *  contra el cual aplica el %. Usar el precio base de la publicación. */
export function deltaToCents(
  parsed: { deltaCents: number; deltaPct: number },
  basePriceCents: number
): number {
  return parsed.deltaCents + Math.round(basePriceCents * parsed.deltaPct);
}

export type BaseFieldKey = 'name' | 'dni' | 'phone' | 'location';

export type BaseFieldConfig = {
  enabled: boolean;
  required: boolean;
};

/**
 * Diseño visual del checkout. Todos opcionales — si el owner no los seteó,
 * el component cae al color primary del tenant y a estilos default.
 */
export type CheckoutDesign = {
  /** Color de CTA principal ("Confirmar compra"). Default: tenant primary. */
  cta_color?: string | null;
  /** Color de acento (radios seleccionados, badges, links). Default: cta_color. */
  accent_color?: string | null;
  /** Estilo de tarjetas contenedoras. */
  card_style?: 'rounded' | 'square' | null;
};

export type CheckoutConfig = {
  base_fields: Record<BaseFieldKey, BaseFieldConfig>;
  extra_fields: CheckoutField[];
  design?: CheckoutDesign;
};

export const DEFAULT_CHECKOUT_CONFIG: CheckoutConfig = {
  base_fields: {
    name:     { enabled: true,  required: true  },
    dni:      { enabled: true,  required: true  },
    phone:    { enabled: true,  required: true  },
    location: { enabled: true,  required: true  }
  },
  extra_fields: [],
  design: {}
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

  // Diseño (opcional). Valido hex/color-safe para evitar inyección de CSS.
  if (s.design && typeof s.design === 'object') {
    const d = s.design;
    const HEX = /^#[0-9a-fA-F]{3,8}$/;
    const cta = typeof d.cta_color === 'string' && HEX.test(d.cta_color) ? d.cta_color : null;
    const accent = typeof d.accent_color === 'string' && HEX.test(d.accent_color) ? d.accent_color : null;
    const card = d.card_style === 'square' || d.card_style === 'rounded' ? d.card_style : null;
    base.design = { cta_color: cta, accent_color: accent, card_style: card };
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
