'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomBytes } from 'crypto';
import { requireOwner, requireUser } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { getTenantModules } from '@/lib/modules/queries';

/**
 * Actions del módulo pay_links.
 * Owners (+ admin/staff) hacen CRUD completo. Afiliados sólo pueden
 * "clonar" un link maestro que tenga allow_affiliates=true — al hacerlo
 * se crea una row hija con affiliate_user_id y parent_link_id apuntando
 * al original. Cuando alguien pague por esa hija, la comisión queda
 * asignada al afiliado.
 */

// base62 code opaco (~48 bits de entropía es suficiente para links no
// enumerables — hay auth por row igual, no es un secreto)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function genCode(len = 8): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function uniqueCode(): Promise<string> {
  const svc = getServiceClient();
  for (let i = 0; i < 6; i++) {
    const c = genCode(8);
    const { data } = await svc.from('pay_links').select('id').eq('code', c).maybeSingle<{ id: string }>();
    if (!data) return c;
  }
  return genCode(12); // fallback
}

// ── Owner: crear/editar/borrar/pausar ─────────────────────────────

/**
 * Crea un pay_link vacío con code + redirige al editor. Igual patrón que
 * createArticleAction — evita un wizard, arrastramos al owner al detalle
 * donde termina de configurar.
 */
export async function createPayLinkAction(): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const svc = getServiceClient();
  const code = await uniqueCode();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('pay_links') as any).insert({
    tenant_id: tenant.id,
    code,
    title: 'Nuevo link de pago',
    amount_cents: 100000, // $1000 default
    currency: 'ARS',
    created_by: userId,
    creator_role: 'owner',
    status: 'active'
  }).select('id').single();
  if (error) throw new Error(error.message);
  revalidatePath('/owner/pay-links');
  redirect(`/owner/pay-links/${(data as { id: string }).id}`);
}

export async function updatePayLinkAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const title = String(formData.get('title') ?? '').trim().slice(0, 120) || 'Sin título';
  const description = String(formData.get('description') ?? '').trim().slice(0, 1000) || null;
  const cover_url = String(formData.get('cover_url') ?? '').trim() || null;
  const amountRaw = String(formData.get('amount') ?? '').trim();
  // Aceptamos "$1234,50" o "1234.50" — normalizamos a centavos
  const amountNum = Number(amountRaw.replace(/[^\d.,-]/g, '').replace(',', '.'));
  const amount_cents = Number.isFinite(amountNum) && amountNum >= 0
    ? Math.round(amountNum * 100)
    : 0;
  const currency = String(formData.get('currency') ?? 'ARS').trim().toUpperCase().slice(0, 4) || 'ARS';

  const max_uses_raw = String(formData.get('max_uses') ?? '').trim();
  const max_uses = max_uses_raw ? Math.max(1, Math.min(999999, parseInt(max_uses_raw, 10) || 1)) : null;
  const expires_raw = String(formData.get('expires_at') ?? '').trim();
  const expires_at = expires_raw ? new Date(expires_raw).toISOString() : null;

  const require_name = formData.get('require_name') === 'on';
  const require_email = formData.get('require_email') === 'on';
  const require_phone = formData.get('require_phone') === 'on';
  const require_dni = formData.get('require_dni') === 'on';
  const custom_note = String(formData.get('custom_note') ?? '').trim().slice(0, 500) || null;

  const allow_affiliates = formData.get('allow_affiliates') === 'on';
  const commRaw = String(formData.get('affiliate_commission_pct') ?? '').trim();
  const commNum = Number(commRaw.replace(',', '.'));
  const affiliate_commission_pct = commRaw && Number.isFinite(commNum) && commNum >= 0 && commNum <= 100
    ? commNum
    : null;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('pay_links') as any).update({
    title, description, cover_url,
    amount_cents, currency,
    max_uses, expires_at,
    require_name, require_email, require_phone, require_dni,
    custom_note,
    allow_affiliates, affiliate_commission_pct,
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);

  revalidatePath('/owner/pay-links');
  revalidatePath(`/owner/pay-links/${id}`);
}

export async function togglePayLinkStatusAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const nextStatus = String(formData.get('next_status') ?? 'active');
  if (!id || !['active', 'paused'].includes(nextStatus)) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('pay_links') as any).update({
    status: nextStatus,
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/pay-links');
  revalidatePath(`/owner/pay-links/${id}`);
}

export async function deletePayLinkAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('pay_links').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/pay-links');
  redirect('/owner/pay-links');
}

// ── Afiliado: clonar un link con ref propio ────────────────────────

/**
 * Un afiliado clona un link maestro (parent). Requiere:
 *  - Módulo affiliates prendido en el tenant
 *  - Link parent con allow_affiliates=true y status='active'
 *  - Usuario tiene membership 'affiliate' activa en el tenant
 *
 * Si el afiliado ya clonó este link antes, devolvemos el existente
 * (idempotente — no queremos code inflation).
 */
export async function cloneLinkForAffiliateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const userId = user.id;
  const parentLinkId = String(formData.get('parent_link_id') ?? '');
  if (!parentLinkId) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parent } = await (svc.from('pay_links') as any)
    .select('id, tenant_id, allow_affiliates, status, title, amount_cents, currency')
    .eq('id', parentLinkId).maybeSingle();
  if (!parent) return;
  if (!parent.allow_affiliates || parent.status !== 'active') return;

  // Chequear que el user es afiliado activo del tenant
  const { data: mem } = await svc
    .from('memberships').select('id')
    .eq('tenant_id', parent.tenant_id).eq('user_id', userId)
    .eq('role', 'affiliate').eq('status', 'active')
    .maybeSingle<{ id: string }>();
  if (!mem) return;

  // Chequear módulo affiliates on
  const modules = await getTenantModules(parent.tenant_id);
  if (modules.affiliates === false) return;

  // ¿Ya existe una hija de este user? Idempotente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('pay_links') as any)
    .select('id, code')
    .eq('parent_link_id', parentLinkId).eq('affiliate_user_id', userId)
    .maybeSingle();
  if (existing) {
    revalidatePath('/');
    return;
  }

  // Crear la hija
  const code = await uniqueCode();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('pay_links') as any).insert({
    tenant_id: parent.tenant_id,
    code,
    title: parent.title,
    amount_cents: parent.amount_cents,
    currency: parent.currency,
    created_by: userId,
    creator_role: 'affiliate',
    affiliate_user_id: userId,
    parent_link_id: parentLinkId,
    status: 'active',
    // Hereda toggles pero NO puede editar
    require_email: true, require_name: true,
    allow_affiliates: false
  });
}

// ── Contadores (views/clicks) — best-effort desde página pública ────

export async function trackPayLinkViewAction(code: string): Promise<void> {
  if (!code || code.length > 20) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.rpc as any)('increment', {}).catch(() => {}); // no-op si no existe
  // Fallback simple: leer + escribir. Race condition aceptable para
  // contadores de vistas (aproximación, no billing).
  const { data } = await svc.from('pay_links').select('id, views_count').eq('code', code).maybeSingle<{ id: string; views_count: number }>();
  if (!data) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('pay_links') as any).update({ views_count: (data.views_count ?? 0) + 1 }).eq('id', data.id);
}
