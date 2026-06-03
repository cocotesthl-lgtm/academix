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

/* ─────────── Afiliados platform-level (Curplat) ─────────── */

/**
 * Marca al user logueado como afiliado de Curplat (platform-level).
 * Setea profiles.is_affiliate = true. La membership por tenant se autocrea
 * después, cuando genera el primer link en alguna academia.
 *
 * `redirectTo` opcional: a dónde mandar después de afiliarse (default /affiliate).
 */
export async function becomeAffiliateAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = String(formData.get('next') ?? '/affiliate');
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('profiles') as any)
    .update({
      is_affiliate: true,
      affiliate_signup_at: new Date().toISOString()
    })
    .eq('id', user.id);

  const redirectTo = String(formData.get('redirect_to') ?? '/affiliate');
  redirect(redirectTo);
}

/**
 * Asegura que existe membership(role='affiliate', status='active') para el
 * (user, tenant). Idempotente. Usado al generar el primer affiliate link
 * en cada academia — el owner ve al afiliado entre los suyos.
 */
export async function ensureAffiliateMembership(opts: {
  tenantId: string; userId: string;
}): Promise<void> {
  const svc = getServiceClient();
  const { data: existing } = await svc
    .from('memberships')
    .select('id, status')
    .eq('tenant_id', opts.tenantId)
    .eq('user_id', opts.userId)
    .eq('role', 'affiliate')
    .maybeSingle<{ id: string; status: string }>();

  if (existing) {
    if (existing.status !== 'active') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('memberships') as any).update({ status: 'active' }).eq('id', existing.id);
    }
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('memberships') as any).insert({
    tenant_id: opts.tenantId,
    user_id: opts.userId,
    role: 'affiliate',
    status: 'active'
  });
}

/**
 * @deprecated Use becomeAffiliateAction + ensureAffiliateMembership.
 * Mantenida para que el form viejo de "Quiero ser afiliado" del storefront
 * siga funcionando (ahora hace ambas cosas: flag global + membership tenant).
 */
export async function signupAsAffiliateAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/affiliate');

  const svc = getServiceClient();
  // Marcar flag platform-level
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('profiles') as any)
    .update({ is_affiliate: true, affiliate_signup_at: new Date().toISOString() })
    .eq('id', user.id);

  // Autocrear membership del tenant si vino tenant_id
  if (tenantId) {
    await ensureAffiliateMembership({ tenantId, userId: user.id });
  }
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
