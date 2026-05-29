'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export type BrandingResult = { ok: true } | { ok: false; error: string };

/**
 * Actualiza branding. URL-only, sin uploads.
 * Campos editables:
 *  - name (academia)
 *  - primary_color, accent_color
 *  - logo_layout: 'square' | 'horizontal'
 *  - logo_url (URL del logo principal)
 *  - logo_text (texto opcional al lado del logo, solo aplica si layout=square)
 */
export async function updateBrandingAction(
  _prev: BrandingResult | null,
  formData: FormData
): Promise<BrandingResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Iniciá sesión.' };

  const svc = getServiceClient();

  const { data: membership } = await svc
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  if (!membership) return { ok: false, error: 'No sos owner de ninguna academia.' };

  const tenantId = membership.tenant_id;

  const name = String(formData.get('name') ?? '').trim();
  const primary = String(formData.get('primary_color') ?? '').trim();
  const accent = String(formData.get('accent_color') ?? '').trim();
  const logoLayoutRaw = String(formData.get('logo_layout') ?? '').trim();
  const logoUrl = String(formData.get('logo_url') ?? '').trim();
  const logoText = String(formData.get('logo_text') ?? '').trim();

  if (!name) return { ok: false, error: 'El nombre no puede estar vacío.' };

  const logoLayout: 'square' | 'horizontal' =
    logoLayoutRaw === 'horizontal' ? 'horizontal' : 'square';

  const { data: current } = await svc
    .from('tenants')
    .select('brand')
    .eq('id', tenantId)
    .single<{ brand: Record<string, unknown> | null }>();

  const brand: Record<string, unknown> = { ...(current?.brand ?? {}) };
  if (primary) brand.primary_color = primary;
  if (accent) brand.accent_color = accent;
  brand.logo_layout = logoLayout;
  brand.logo_url = logoUrl || null;
  brand.logo_text = logoText || null;

  const updatePayload = { name, brand, updated_at: new Date().toISOString() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (svc.from('tenants') as any)
    .update(updatePayload)
    .eq('id', tenantId);

  if (updErr) return { ok: false, error: updErr.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await svc.from('audit_log').insert({
    actor_user_id: user.id,
    tenant_id: tenantId,
    action: 'tenant.branding_updated',
    target_type: 'tenant',
    target_id: tenantId,
    after: { name, brand }
  } as any);

  revalidatePath('/branding');
  revalidatePath('/dashboard');
  return { ok: true };
}
