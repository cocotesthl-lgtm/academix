import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';
import { normalizeFeatures, type Plan } from './types';

/**
 * Lista los planes activos ordenados por position.
 * Defensivo: si migration 0023 no corrió devuelve [].
 */
export async function getActivePlans(): Promise<Plan[]> {
  const svc = getServiceClient();
  try {
    const { data, error } = await svc
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('position', { ascending: true });
    if (error) return [];
    return ((data ?? []) as Array<Omit<Plan, 'features'> & { features: unknown }>).map((p) => ({
      ...p,
      features: normalizeFeatures(p.features)
    }));
  } catch { return []; }
}

export async function getAllPlans(): Promise<Plan[]> {
  const svc = getServiceClient();
  try {
    const { data, error } = await svc
      .from('plans').select('*').order('position', { ascending: true });
    if (error) return [];
    return ((data ?? []) as Array<Omit<Plan, 'features'> & { features: unknown }>).map((p) => ({
      ...p,
      features: normalizeFeatures(p.features)
    }));
  } catch { return []; }
}

export async function getPlanById(id: string): Promise<Plan | null> {
  const svc = getServiceClient();
  try {
    const { data, error } = await svc
      .from('plans').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    const p = data as Omit<Plan, 'features'> & { features: unknown };
    return { ...p, features: normalizeFeatures(p.features) };
  } catch { return null; }
}

/** Códigos promo activos (no expirados, no llenos). */
export async function getActivePromoCodes(): Promise<Array<{
  id: string; code: string; description: string | null;
  discount_type: 'percent' | 'fixed'; discount_value: number;
  plan_ids: string[]; applies_to: 'monthly' | 'annual' | 'both';
  max_uses: number | null; used_count: number;
  expires_at: string | null; is_active: boolean;
}>> {
  const svc = getServiceClient();
  try {
    const { data, error } = await svc
      .from('plan_promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as unknown as Array<{
      id: string; code: string; description: string | null;
      discount_type: 'percent' | 'fixed'; discount_value: number;
      plan_ids: string[]; applies_to: 'monthly' | 'annual' | 'both';
      max_uses: number | null; used_count: number;
      expires_at: string | null; is_active: boolean;
    }>;
  } catch { return []; }
}

/** Buscar un código específico por string — usado al aplicarlo. */
export async function findPromoCode(rawCode: string): Promise<{
  id: string; code: string;
  discount_type: 'percent' | 'fixed'; discount_value: number;
  plan_ids: string[]; applies_to: 'monthly' | 'annual' | 'both';
  max_uses: number | null; used_count: number;
  expires_at: string | null; is_active: boolean;
} | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const svc = getServiceClient();
  try {
    const { data, error } = await svc
      .from('plan_promo_codes').select('*').eq('code', code).maybeSingle();
    if (error || !data) return null;
    return data as unknown as {
      id: string; code: string;
      discount_type: 'percent' | 'fixed'; discount_value: number;
      plan_ids: string[]; applies_to: 'monthly' | 'annual' | 'both';
      max_uses: number | null; used_count: number;
      expires_at: string | null; is_active: boolean;
    };
  } catch { return null; }
}

/** Anuncios activos no expirados, ordenados por más reciente. */
export async function getActiveAnnouncements(): Promise<Array<{
  id: string; title: string; message: string;
  cta_label: string | null; cta_href: string | null; promo_code: string | null;
  bg_color: string; text_color: string;
  plan_ids: string[]; is_active: boolean; expires_at: string | null;
}>> {
  const svc = getServiceClient();
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await svc
      .from('plan_announcements').select('*')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as unknown as Array<{
      id: string; title: string; message: string;
      cta_label: string | null; cta_href: string | null; promo_code: string | null;
      bg_color: string; text_color: string;
      plan_ids: string[]; is_active: boolean; expires_at: string | null;
    }>;
  } catch { return []; }
}

export async function getAllAnnouncements(): Promise<Array<{
  id: string; title: string; message: string;
  cta_label: string | null; cta_href: string | null; promo_code: string | null;
  bg_color: string; text_color: string;
  plan_ids: string[]; is_active: boolean; expires_at: string | null;
}>> {
  const svc = getServiceClient();
  try {
    const { data, error } = await svc
      .from('plan_announcements').select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as unknown as Array<{
      id: string; title: string; message: string;
      cta_label: string | null; cta_href: string | null; promo_code: string | null;
      bg_color: string; text_color: string;
      plan_ids: string[]; is_active: boolean; expires_at: string | null;
    }>;
  } catch { return []; }
}

/** Plan + estado de suscripción de un tenant. */
export async function getTenantPlan(tenantId: string): Promise<{
  plan: Plan | null;
  billing_period: 'monthly' | 'annual';
  subscription_status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}> {
  const svc = getServiceClient();
  try {
    const { data, error } = await svc
      .from('tenants')
      .select('plan_id, billing_period, subscription_status, trial_ends_at, current_period_end')
      .eq('id', tenantId).maybeSingle();
    if (error || !data) {
      return { plan: null, billing_period: 'monthly', subscription_status: 'trial',
        trial_ends_at: null, current_period_end: null };
    }
    const t = data as { plan_id: string | null; billing_period: 'monthly' | 'annual';
      subscription_status: string; trial_ends_at: string | null; current_period_end: string | null };
    const plan = t.plan_id ? await getPlanById(t.plan_id) : null;
    return {
      plan,
      billing_period: t.billing_period ?? 'monthly',
      subscription_status: t.subscription_status ?? 'trial',
      trial_ends_at: t.trial_ends_at,
      current_period_end: t.current_period_end
    };
  } catch {
    return { plan: null, billing_period: 'monthly', subscription_status: 'trial',
      trial_ends_at: null, current_period_end: null };
  }
}
