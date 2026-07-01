'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { AFFILIATE_PERMISSIONS } from '@/lib/permissions/types';

export type AffiliateMode = 'disabled' | '1click' | 'approval';

/**
 * Solicita afiliación al tenant desde el storefront ("Trabajá con nosotros").
 *
 * - Si affiliate_mode='disabled' → error
 * - Si affiliate_mode='1click'   → crea membership status='active' al instante
 * - Si affiliate_mode='approval' → crea membership status='pending'
 *
 * Devuelve un objeto con el resultado en vez de redirigir, para que la
 * page cliente maneje el UX (toast, cambio de vista, etc).
 */
export async function requestAffiliationAction(formData: FormData): Promise<{
  ok: boolean;
  status?: 'active' | 'pending';
  error?: string;
}> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  if (!tenantId) return { ok: false, error: 'tenant_id requerido' };

  // El user debe estar logueado
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Debés iniciar sesión primero' };

  const svc = getServiceClient();
  // Modo del tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (svc.from('tenants') as any)
    .select('affiliate_mode').eq('id', tenantId).maybeSingle();
  const mode = ((tenant as { affiliate_mode?: string } | null)?.affiliate_mode ?? 'disabled') as AffiliateMode;
  if (mode === 'disabled') return { ok: false, error: 'Este sitio no acepta afiliados por ahora' };

  // ¿Ya existe membership?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('memberships') as any)
    .select('id, role, status').eq('user_id', user.id).eq('tenant_id', tenantId).maybeSingle();
  const row = existing as { id: string; role: string; status: string } | null;

  const newStatus = mode === '1click' ? 'active' : 'pending';

  if (row) {
    // Ya existe alguna membership. Si ya es affiliate active/pending, no hacer nada.
    if (row.role === 'affiliate' && (row.status === 'active' || row.status === 'pending')) {
      return { ok: true, status: row.status as 'active' | 'pending' };
    }
    // Si es owner/instructor/staff, no la degradamos — devolvemos error suave.
    if (row.role === 'owner' || row.role === 'instructor') {
      return { ok: false, error: 'Ya formás parte del equipo — no podés ser afiliado del mismo sitio' };
    }
    // Cualquier otra combinación: update a affiliate.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('memberships') as any)
      .update({ role: 'affiliate', status: newStatus, permissions: AFFILIATE_PERMISSIONS })
      .eq('id', row.id);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('memberships') as any).insert({
      user_id: user.id,
      tenant_id: tenantId,
      role: 'affiliate',
      status: newStatus,
      permissions: AFFILIATE_PERMISSIONS
    });
  }

  revalidatePath('/');
  return { ok: true, status: newStatus };
}

/** Owner setea el modo del tenant. */
export async function setAffiliateModeAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const mode = String(formData.get('mode') ?? 'disabled') as AffiliateMode;
  const rateRaw = String(formData.get('commission_rate') ?? '').trim();
  const terms = String(formData.get('terms') ?? '').trim() || null;
  if (!['disabled', '1click', 'approval'].includes(mode)) return;

  let rate: number | null = null;
  if (rateRaw) {
    const parsed = parseFloat(rateRaw.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      rate = parsed > 1 ? parsed / 100 : parsed; // acepta 20 o 0.2
    }
  }

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    affiliate_mode: mode,
    affiliate_commission_rate: rate,
    affiliate_terms: terms
  }).eq('id', tenant.id);
  revalidatePath('/owner/affiliates');
}

/** Owner aprueba/rechaza una solicitud pendiente. */
export async function decideAffiliateApplicationAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const userId = String(formData.get('user_id') ?? '');
  const decision = String(formData.get('decision') ?? ''); // 'approve' | 'reject'
  if (!userId || !['approve', 'reject'].includes(decision)) return;

  const svc = getServiceClient();
  if (decision === 'approve') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('memberships') as any)
      .update({ status: 'active' })
      .eq('tenant_id', tenant.id).eq('user_id', userId).eq('role', 'affiliate');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('memberships') as any)
      .delete()
      .eq('tenant_id', tenant.id).eq('user_id', userId).eq('role', 'affiliate').eq('status', 'pending');
  }
  revalidatePath('/owner/affiliates');
}
