'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

/* ─────────── Util: sanitizar URL (http/https) ─────────── */

function safeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.length > 2048) return null;
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? v : null;
  } catch { return null; }
}

/** Mutaciones de los recursos del owner siempre invalidan ambos paneles. */
function revalidateAffiliatePanels(): void {
  revalidateAffiliatePanels();
}

/* ─────────── Affiliate signup (público, desde el storefront) ─────────── */

/**
 * Crea (o reactiva) la membresía 'affiliate' del user actual en el tenant.
 * Mode 'auto' aprueba al toque. Si el tenant tiene approval flow se queda
 * en pending (no implementado todavía, por ahora todos quedan active).
 */
export async function signupAsAffiliateAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  if (!tenantId) return;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Mandamos al login storefront con next a /affiliate
    redirect('/login?next=/affiliate');
  }

  const svc = getServiceClient();

  // ¿Ya tiene membresía?
  const { data: existing } = await svc
    .from('memberships')
    .select('id, role, status')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('role', 'affiliate')
    .maybeSingle<{ id: string; role: string; status: string }>();

  if (existing) {
    if (existing.status !== 'active') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('memberships') as any)
        .update({ status: 'active' })
        .eq('id', existing.id);
    }
    redirect('/affiliate');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('memberships') as any).insert({
    tenant_id: tenantId,
    user_id: user.id,
    role: 'affiliate',
    status: 'active'
  });

  redirect('/affiliate');
}

/* ─────────── Promo materials (owner CRUD) ─────────── */

export async function addPromoMaterialAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('promo_materials') as any).insert({
    tenant_id: tenant.id,
    type: (String(formData.get('type') ?? 'asset') as string).slice(0, 20) || 'asset',
    title: title.slice(0, 120),
    description: String(formData.get('description') ?? '').trim().slice(0, 500) || null,
    asset_url: safeUrl(String(formData.get('asset_url') ?? '')),
    copy_text: String(formData.get('copy_text') ?? '').slice(0, 5000) || null,
    thumbnail_url: safeUrl(String(formData.get('thumbnail_url') ?? ''))
  });

  revalidateAffiliatePanels();
}

export async function deletePromoMaterialAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('promo_materials').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidateAffiliatePanels();
}

/* ─────────── Community links (owner CRUD) ─────────── */

export async function addCommunityLinkAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const label = String(formData.get('label') ?? '').trim();
  const url = safeUrl(String(formData.get('url') ?? ''));
  if (!label || !url) return;

  const network = (String(formData.get('network') ?? 'other') as string).slice(0, 30) || 'other';
  const audience = (String(formData.get('audience') ?? 'affiliates') as string).slice(0, 20) || 'affiliates';

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('community_links') as any).insert({
    tenant_id: tenant.id,
    network, label: label.slice(0, 120), url,
    description: String(formData.get('description') ?? '').trim().slice(0, 500) || null,
    audience
  });

  revalidateAffiliatePanels();
}

export async function deleteCommunityLinkAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('community_links').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidateAffiliatePanels();
}

/* ─────────── Broadcasts (owner manda mensaje a todos los afiliados) ─────────── */

export async function sendBroadcastAction(formData: FormData): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!subject || !body) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('affiliate_broadcasts') as any).insert({
    tenant_id: tenant.id,
    author_user_id: userId,
    subject: subject.slice(0, 200),
    body: body.slice(0, 5000),
    pinned: formData.get('pinned') === 'on'
  });

  revalidateAffiliatePanels();
}

export async function deleteBroadcastAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('affiliate_broadcasts').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidateAffiliatePanels();
}

/* ─────────── Mark broadcast read (afiliado) ─────────── */

export async function markBroadcastReadAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const messageId = String(formData.get('message_id') ?? '');
  if (!messageId) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('affiliate_message_reads') as any).upsert(
    { message_id: messageId, affiliate_user_id: user.id },
    { onConflict: 'message_id,affiliate_user_id' }
  );
  revalidatePath('/affiliate');
}
