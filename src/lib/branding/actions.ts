'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export type BrandingResult = { ok: true } | { ok: false; error: string };

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

function extFromMime(mime: string) {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/webp': return 'webp';
    case 'image/svg+xml': return 'svg';
    default: return 'bin';
  }
}

export async function updateBrandingAction(
  _prev: BrandingResult | null,
  formData: FormData
): Promise<BrandingResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Iniciá sesión.' };

  const svc = getServiceClient();

  // Find the user's tenant (owner role).
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
  const logo = formData.get('logo') as File | null;

  if (!name) return { ok: false, error: 'El nombre no puede estar vacío.' };

  // Read current brand to merge
  const { data: current } = await svc
    .from('tenants')
    .select('brand')
    .eq('id', tenantId)
    .single<{ brand: Record<string, unknown> | null }>();

  const brand: Record<string, unknown> = { ...(current?.brand ?? {}) };
  if (primary) brand.primary_color = primary;
  if (accent) brand.accent_color = accent;

  // Optional logo upload
  if (logo && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      return { ok: false, error: 'El logo no puede pesar más de 2 MB.' };
    }
    if (!ALLOWED_MIME.has(logo.type)) {
      return { ok: false, error: 'Formato no soportado. Usá PNG, JPG, WebP o SVG.' };
    }
    const ext = extFromMime(logo.type);
    const path = `${tenantId}/logo-${Date.now()}.${ext}`;
    const arrayBuffer = await logo.arrayBuffer();
    const { error: uploadErr } = await svc.storage
      .from('branding')
      .upload(path, new Uint8Array(arrayBuffer), {
        contentType: logo.type,
        upsert: true
      });
    if (uploadErr) return { ok: false, error: `Upload falló: ${uploadErr.message}` };

    const { data: pub } = svc.storage.from('branding').getPublicUrl(path);
    brand.logo_url = pub.publicUrl;
  }

  const updatePayload = { name, brand, updated_at: new Date().toISOString() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (svc.from('tenants') as any)
    .update(updatePayload)
    .eq('id', tenantId);

  if (updErr) return { ok: false, error: updErr.message };

  // Audit
  const auditPayload = {
    actor_user_id: user.id,
    tenant_id: tenantId,
    action: 'tenant.branding_updated',
    target_type: 'tenant',
    target_id: tenantId,
    after: { name, brand }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await svc.from('audit_log').insert(auditPayload as any);

  revalidatePath('/branding');
  revalidatePath('/dashboard');
  return { ok: true };
}
