'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export type CouponResult = { ok: true; code?: string } | { ok: false; error: string };

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

export async function createCouponAction(formData: FormData): Promise<CouponResult> {
  const { tenant } = await requireOwner();
  const codeRaw = String(formData.get('code') ?? '').trim();
  const type = String(formData.get('type') ?? 'percent');
  const amountRaw = String(formData.get('amount') ?? '0').replace(/[^0-9.]/g, '');
  const courseId = String(formData.get('course_id') ?? '').trim() || null;
  const maxRaw = String(formData.get('max_redemptions') ?? '').trim();
  const expiresAt = String(formData.get('expires_at') ?? '').trim() || null;

  if (!['percent', 'fixed'].includes(type)) return { ok: false, error: 'Tipo inválido.' };
  const amount = parseFloat(amountRaw);
  if (!amount || amount <= 0) return { ok: false, error: 'Monto inválido.' };
  if (type === 'percent' && amount > 100) return { ok: false, error: 'El % no puede ser mayor a 100.' };

  const code = codeRaw ? normalizeCode(codeRaw) : 'PROMO' + randomBytes(3).toString('hex').toUpperCase();
  if (!/^[A-Z0-9-]{3,40}$/.test(code)) return { ok: false, error: 'Código inválido. A-Z, 0-9, guión, 3-40 chars.' };

  const svc = getServiceClient();

  // fixed amount is in pesos in the form, we store cents
  const storedAmount = type === 'fixed' ? Math.round(amount * 100) : amount;

  const payload = {
    tenant_id: tenant.id,
    code,
    type,
    amount: storedAmount,
    course_id: courseId,
    max_redemptions: maxRaw ? parseInt(maxRaw, 10) : null,
    expires_at: expiresAt || null,
    status: 'active',
    source: 'manual'
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('coupons') as any).insert(payload);
  if (error) {
    if (error.message.includes('duplicate')) return { ok: false, error: 'Ya existe un cupón con ese código.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/coupons');
  return { ok: true, code };
}

export async function setCouponStatusAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !['active', 'paused', 'expired'].includes(status)) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('coupons') as any)
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', tenant.id);
  revalidatePath('/coupons');
}

export async function deleteCouponAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('coupons').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/coupons');
}

/**
 * Server-side validation used by checkout. Returns the discounted price
 * (in cents) plus metadata for redemption tracking.
 */
export type ValidatedCoupon = {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  amount: number;
  discount_cents: number;
  final_cents: number;
};

export async function validateCoupon(
  tenantId: string,
  rawCode: string,
  courseId: string,
  priceCents: number
): Promise<ValidatedCoupon | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const svc = getServiceClient();

  const { data } = await svc
    .from('coupons')
    .select('id, code, type, amount, course_id, max_redemptions, redemption_count, expires_at, starts_at, status')
    .eq('tenant_id', tenantId)
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle<{
      id: string; code: string; type: 'percent' | 'fixed'; amount: number;
      course_id: string | null; max_redemptions: number | null; redemption_count: number;
      expires_at: string | null; starts_at: string | null; status: string;
    }>();
  if (!data) return null;
  const now = Date.now();
  if (data.expires_at && new Date(data.expires_at).getTime() < now) return null;
  if (data.starts_at && new Date(data.starts_at).getTime() > now) return null;
  if (data.max_redemptions !== null && data.redemption_count >= data.max_redemptions) return null;
  if (data.course_id && data.course_id !== courseId) return null;

  let discount = 0;
  if (data.type === 'percent') {
    discount = Math.round(priceCents * (Number(data.amount) / 100));
  } else {
    discount = Math.min(priceCents, Math.round(Number(data.amount)));
  }
  const finalCents = Math.max(0, priceCents - discount);

  return {
    id: data.id,
    code: data.code,
    type: data.type,
    amount: Number(data.amount),
    discount_cents: discount,
    final_cents: finalCents
  };
}

