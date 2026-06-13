'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * CRUD de códigos promocionales y banners de anuncio.
 * Solo founder. Defensivo si migration 0023 no corrió.
 */

function sanitizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
}

export async function createPromoCodeAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const code = sanitizeCode(String(formData.get('code') ?? ''));
  if (code.length < 3) return;

  const discountType = String(formData.get('discount_type') ?? 'percent') === 'fixed' ? 'fixed' : 'percent';
  const discountValue = Math.max(0, parseInt(String(formData.get('discount_value') ?? '0'), 10) || 0);
  const description = String(formData.get('description') ?? '').trim().slice(0, 200) || null;
  const appliesTo = (() => {
    const raw = String(formData.get('applies_to') ?? 'both');
    return raw === 'monthly' || raw === 'annual' ? raw : 'both';
  })();
  const maxUses = String(formData.get('max_uses') ?? '').trim();
  const maxUsesValue = maxUses ? parseInt(maxUses, 10) : null;
  const expiresAt = String(formData.get('expires_at') ?? '').trim() || null;

  // Plan IDs múltiples (checkboxes)
  const planIds = formData.getAll('plan_ids').map((p) => String(p)).filter(Boolean);

  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('plan_promo_codes') as any).insert({
      code, description, discount_type: discountType,
      discount_value: discountValue,
      plan_ids: planIds,
      applies_to: appliesTo,
      max_uses: maxUsesValue && Number.isFinite(maxUsesValue) ? maxUsesValue : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      is_active: true
    });
  } catch { /* migration missing */ }
  revalidatePath('/founder/plans/promos');
}

export async function togglePromoCodeAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === 'true';
  if (!id) return;
  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('plan_promo_codes') as any)
      .update({ is_active: active }).eq('id', id);
  } catch { /* migration missing */ }
  revalidatePath('/founder/plans/promos');
}

export async function deletePromoCodeAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  try {
    await svc.from('plan_promo_codes').delete().eq('id', id);
  } catch { /* migration missing */ }
  revalidatePath('/founder/plans/promos');
}

/* ─── Anuncios / banner ─── */

export async function upsertAnnouncementAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get('id') ?? '').trim() || null;
  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  const message = String(formData.get('message') ?? '').trim().slice(0, 500);
  if (!title || !message) return;

  const ctaLabel = String(formData.get('cta_label') ?? '').trim().slice(0, 40) || null;
  const ctaHref = String(formData.get('cta_href') ?? '').trim().slice(0, 200) || null;
  const promoCode = String(formData.get('promo_code') ?? '').trim().toUpperCase().slice(0, 30) || null;
  const bgColor = String(formData.get('bg_color') ?? '#a855f7').trim();
  const textColor = String(formData.get('text_color') ?? '#ffffff').trim();
  const planIds = formData.getAll('plan_ids').map((p) => String(p)).filter(Boolean);
  const expiresAt = String(formData.get('expires_at') ?? '').trim() || null;
  const isActive = formData.get('is_active') === 'on';

  const payload = {
    title, message, cta_label: ctaLabel, cta_href: ctaHref, promo_code: promoCode,
    bg_color: bgColor, text_color: textColor, plan_ids: planIds,
    is_active: isActive,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
  };

  const svc = getServiceClient();
  try {
    if (id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('plan_announcements') as any).update(payload).eq('id', id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('plan_announcements') as any).insert(payload);
    }
  } catch { /* migration missing */ }
  revalidatePath('/founder/plans/banner');
  revalidatePath('/dashboard');
  revalidatePath('/mi-plan');
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  try {
    await svc.from('plan_announcements').delete().eq('id', id);
  } catch { /* migration missing */ }
  revalidatePath('/founder/plans/banner');
}
