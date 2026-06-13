/**
 * Tipos y helpers del sistema de planes.
 * Schema completo en migration 0023.
 */

export type PlanFeatures = {
  domains_max: number;              // 0 = no permite dominio propio
  email_marketing_monthly: number;  // emails marketing por mes
  storage_gb: number;               // GB de storage
  uploads_enabled: boolean;
  featured_listings: number;        // cursos destacados (999 = ilimitado)
  support_sla_hours: number;
  support_priority: boolean;
  extras: string[];                 // bullets adicionales libres
};

export type Plan = {
  id: string;
  slug: string;                     // 'initial' | 'medium' | 'pro' | custom
  name: string;
  tagline: string | null;
  description: string | null;
  position: number;
  is_active: boolean;
  is_featured: boolean;             // resaltado visual
  price_cents_monthly: number;
  price_cents_annual: number;
  currency: string;
  features: PlanFeatures;
  created_at?: string;
};

export type BillingPeriod = 'monthly' | 'annual';

export type TenantSubscription = {
  plan_id: string | null;
  billing_period: BillingPeriod;
  subscription_status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'paused';
  trial_ends_at: string | null;
  current_period_end: string | null;
  last_paid_at: string | null;
};

export type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;            // percent (0-100) o cents
  plan_ids: string[];                // vacío = todos
  applies_to: 'monthly' | 'annual' | 'both';
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
};

export type PlanAnnouncement = {
  id: string;
  title: string;
  message: string;
  cta_label: string | null;
  cta_href: string | null;
  promo_code: string | null;
  bg_color: string;
  text_color: string;
  plan_ids: string[];
  is_active: boolean;
  expires_at: string | null;
};

/** Defaults para nuevas filas en UI del founder. */
export const DEFAULT_PLAN_FEATURES: PlanFeatures = {
  domains_max: 0,
  email_marketing_monthly: 0,
  storage_gb: 1,
  uploads_enabled: true,
  featured_listings: 0,
  support_sla_hours: 48,
  support_priority: false,
  extras: []
};

/** % ahorro del anual vs mensual × 12. */
export function annualSavingsPct(plan: Plan): number {
  const annualCost = plan.price_cents_annual;
  const monthlyTotal = plan.price_cents_monthly * 12;
  if (monthlyTotal === 0) return 0;
  return Math.round(((monthlyTotal - annualCost) / monthlyTotal) * 100);
}

/** Precio mensual equivalente del plan anual (para mostrar "$X/mes"). */
export function annualMonthlyEquivalent(plan: Plan): number {
  return Math.round(plan.price_cents_annual / 12);
}

/** Aplicar descuento de promo code a un precio. */
export function applyDiscount(priceCents: number, code: PromoCode): number {
  if (code.discount_type === 'percent') {
    return Math.max(0, Math.round(priceCents * (1 - code.discount_value / 100)));
  }
  return Math.max(0, priceCents - code.discount_value);
}

/** Parse safe del jsonb features (defensivo si DB devuelve null). */
export function normalizeFeatures(raw: unknown): PlanFeatures {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PLAN_FEATURES };
  const r = raw as Record<string, unknown>;
  return {
    domains_max: typeof r.domains_max === 'number' ? r.domains_max : 0,
    email_marketing_monthly: typeof r.email_marketing_monthly === 'number' ? r.email_marketing_monthly : 0,
    storage_gb: typeof r.storage_gb === 'number' ? r.storage_gb : 1,
    uploads_enabled: r.uploads_enabled !== false,
    featured_listings: typeof r.featured_listings === 'number' ? r.featured_listings : 0,
    support_sla_hours: typeof r.support_sla_hours === 'number' ? r.support_sla_hours : 48,
    support_priority: r.support_priority === true,
    extras: Array.isArray(r.extras) ? (r.extras as string[]).filter((x) => typeof x === 'string').slice(0, 20) : []
  };
}
