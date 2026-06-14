'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { normalizeFeatures } from './types';

/**
 * Actions del founder para CRUD de planes.
 * Cualquier mutación requiere super_admin.
 */

function parsePriceArs(raw: string): number {
  // El usuario tipea "9.990" o "9990" o "9,990" → cents
  const clean = raw.replace(/[^\d]/g, '');
  const value = parseInt(clean, 10);
  return Number.isFinite(value) ? value * 100 : 0;
}

export async function updatePlanAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const name = String(formData.get('name') ?? '').trim().slice(0, 60);
  const tagline = String(formData.get('tagline') ?? '').trim().slice(0, 120) || null;
  const description = String(formData.get('description') ?? '').trim().slice(0, 500) || null;
  const isActive = formData.get('is_active') === 'on';
  const isFeatured = formData.get('is_featured') === 'on';
  const priceCentsMonthly = parsePriceArs(String(formData.get('price_monthly') ?? '0'));
  const priceCentsAnnual = parsePriceArs(String(formData.get('price_annual') ?? '0'));
  const currency = String(formData.get('currency') ?? 'ARS').trim().slice(0, 3).toUpperCase() || 'ARS';
  const trialDaysRaw = parseInt(String(formData.get('trial_days') ?? '0'), 10);
  const trialDays = Math.max(0, Math.min(90, Number.isFinite(trialDaysRaw) ? trialDaysRaw : 0));

  // Features estructuradas
  const features = normalizeFeatures({
    domains_max: parseInt(String(formData.get('f_domains') ?? '0'), 10) || 0,
    email_marketing_monthly: parseInt(String(formData.get('f_email_marketing') ?? '0'), 10) || 0,
    storage_gb: parseInt(String(formData.get('f_storage_gb') ?? '0'), 10) || 0,
    uploads_enabled: formData.get('f_uploads') === 'on',
    featured_listings: parseInt(String(formData.get('f_featured') ?? '0'), 10) || 0,
    support_sla_hours: parseInt(String(formData.get('f_sla_hours') ?? '48'), 10) || 48,
    support_priority: formData.get('f_priority') === 'on',
    extras: String(formData.get('f_extras') ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20)
  });

  const svc = getServiceClient();
  // Defensivo: si migration 0025 no corrió, omitimos trial_days
  const basePayload = {
    name, tagline, description,
    is_active: isActive, is_featured: isFeatured,
    price_cents_monthly: priceCentsMonthly,
    price_cents_annual: priceCentsAnnual,
    currency, features,
    updated_at: new Date().toISOString()
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (svc.from('plans') as any)
    .update({ ...basePayload, trial_days: trialDays }).eq('id', id);
  if (updErr && updErr.message?.includes('trial_days')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('plans') as any).update(basePayload).eq('id', id);
  }

  revalidatePath('/founder/plans');
  revalidatePath('/mi-plan');
}

export async function reorderPlanAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get('id') ?? '');
  const direction = String(formData.get('direction') ?? '');
  if (!id || (direction !== 'up' && direction !== 'down')) return;
  const svc = getServiceClient();
  const { data: all } = await svc.from('plans').select('id, position').order('position');
  const list = (all ?? []) as Array<{ id: string; position: number }>;
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return;
  const a = list[idx], b = list[swapIdx];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('plans') as any).update({ position: b.position }).eq('id', a.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('plans') as any).update({ position: a.position }).eq('id', b.id);
  revalidatePath('/founder/plans');
}

/**
 * Founder regala un plan a un tenant — sin pasar por MP.
 * Setea el plan + extiende el período por N meses + marca como activo.
 * Cuando vence, el cron lo bajará a 'past_due' (queda en manos del
 * owner suscribirse o ser downgradeado).
 */
export async function giftPlanToTenantAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const tenantId = String(formData.get('tenant_id') ?? '');
  const planId = String(formData.get('plan_id') ?? '');
  const monthsRaw = parseInt(String(formData.get('months') ?? '1'), 10);
  const months = Math.max(1, Math.min(60, Number.isFinite(monthsRaw) ? monthsRaw : 1));
  const periodRaw = String(formData.get('billing_period') ?? 'monthly');
  const period = periodRaw === 'annual' ? 'annual' : 'monthly';
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 500) || null;
  if (!tenantId || !planId) return;

  const svc = getServiceClient();
  const end = new Date();
  end.setMonth(end.getMonth() + months);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    plan_id: planId,
    billing_period: period,
    subscription_status: 'active',
    trial_ends_at: null,
    current_period_end: end.toISOString(),
    last_paid_at: new Date().toISOString(),
    subscription_notes: notes
  }).eq('id', tenantId);

  revalidatePath('/founder/plans/regalar');
  revalidatePath('/founder/tenants');
}

/** Founder cancela manualmente el plan regalado (vuelve a sin plan). */
export async function revokeTenantPlanAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const tenantId = String(formData.get('tenant_id') ?? '');
  if (!tenantId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    plan_id: null,
    subscription_status: 'cancelled',
    current_period_end: null,
    trial_ends_at: null,
    subscription_notes: null
  }).eq('id', tenantId);
  revalidatePath('/founder/plans/regalar');
  revalidatePath('/founder/tenants');
}

/** Owner cambia su plan (sin cobro real todavía — eso es Fase 2). */
export async function setTenantPlanAction(formData: FormData): Promise<void> {
  // Por ahora cualquier user puede setear su plan (free trial). Cuando
  // wireamos MP subscriptions esto requerirá pago confirmado primero.
  const { requireOwner } = await import('@/lib/auth/guards');
  const { tenant } = await requireOwner();
  const planId = String(formData.get('plan_id') ?? '');
  const billingPeriod = String(formData.get('billing_period') ?? 'monthly');
  if (!planId) return;
  const period = billingPeriod === 'annual' ? 'annual' : 'monthly';
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    plan_id: planId,
    billing_period: period,
    subscription_status: 'trial',
    trial_ends_at: new Date(Date.now() + 7 * 86400_000).toISOString()
  }).eq('id', tenant.id);
  revalidatePath('/mi-plan');
}
