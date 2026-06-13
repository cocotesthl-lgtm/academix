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
