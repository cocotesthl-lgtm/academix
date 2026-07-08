'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import type { PromotionScope, PromotionType } from './types';

const VALID_TYPES: PromotionType[] = ['nx_pay_m', 'qty_percent', 'min_amount_free_shipping', 'min_amount_percent'];
const VALID_SCOPES: PromotionScope[] = ['all', 'category', 'products'];

/** Convierte "3x2" o "3" en int. Fallback null. */
function toInt(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

/** Convierte pesos a cents (input en $ del owner). */
function toCents(v: FormDataEntryValue | null): number | null {
  const n = toInt(v);
  if (n == null) return null;
  return n * 100;
}

export async function createPromotionAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const type = String(formData.get('type') ?? '') as PromotionType;
  if (!VALID_TYPES.includes(type)) return;
  const scope = String(formData.get('scope') ?? 'all') as PromotionScope;
  const payload: Record<string, unknown> = {
    tenant_id: tenant.id,
    title: String(formData.get('title') ?? '').trim().slice(0, 120) || 'Sin título',
    description: String(formData.get('description') ?? '').trim().slice(0, 500) || null,
    type,
    scope: VALID_SCOPES.includes(scope) ? scope : 'all',
    target_ids: parseTargets(formData),
    buy_qty: toInt(formData.get('buy_qty')),
    pay_qty: toInt(formData.get('pay_qty')),
    min_qty: toInt(formData.get('min_qty')),
    min_amount_cents: toCents(formData.get('min_amount')),
    discount_percent: clampPercent(toInt(formData.get('discount_percent'))),
    starts_at: parseDate(formData.get('starts_at')),
    ends_at: parseDate(formData.get('ends_at')),
    enabled: formData.get('enabled') === 'on' || formData.get('enabled') === 'true' || !formData.has('enabled'),
    priority: toInt(formData.get('priority')) ?? 0
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('promotions') as any)
    .insert(payload).select('id').single();
  if (error) {
    console.error('[createPromotion]', error);
    return;
  }
  revalidatePath('/owner/promotions');
  redirect(`/owner/promotions/${(data as { id: string }).id}`);
}

export async function updatePromotionAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const type = String(formData.get('type') ?? '') as PromotionType;
  if (!VALID_TYPES.includes(type)) return;
  const scope = String(formData.get('scope') ?? 'all') as PromotionScope;
  const patch: Record<string, unknown> = {
    title: String(formData.get('title') ?? '').trim().slice(0, 120) || 'Sin título',
    description: String(formData.get('description') ?? '').trim().slice(0, 500) || null,
    type,
    scope: VALID_SCOPES.includes(scope) ? scope : 'all',
    target_ids: parseTargets(formData),
    buy_qty: toInt(formData.get('buy_qty')),
    pay_qty: toInt(formData.get('pay_qty')),
    min_qty: toInt(formData.get('min_qty')),
    min_amount_cents: toCents(formData.get('min_amount')),
    discount_percent: clampPercent(toInt(formData.get('discount_percent'))),
    starts_at: parseDate(formData.get('starts_at')),
    ends_at: parseDate(formData.get('ends_at')),
    enabled: formData.get('enabled') === 'on' || formData.get('enabled') === 'true',
    priority: toInt(formData.get('priority')) ?? 0,
    updated_at: new Date().toISOString()
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('promotions') as any)
    .update(patch).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/promotions');
  revalidatePath(`/owner/promotions/${id}`);
}

export async function togglePromotionAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const id = String(formData.get('id') ?? '');
  const enabled = formData.get('enabled') === 'true';
  if (!id) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('promotions') as any)
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/promotions');
}

export async function deletePromotionAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await svc.from('promotions').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/promotions');
  redirect('/owner/promotions');
}

// ── helpers ────────────────────────────────────────────────────────

function parseTargets(formData: FormData): string[] {
  const raw = formData.getAll('target_ids');
  return raw.map((v) => String(v).trim()).filter(Boolean).slice(0, 100);
}

function parseDate(v: FormDataEntryValue | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function clampPercent(n: number | null): number | null {
  if (n == null) return null;
  return Math.max(1, Math.min(90, n));
}
