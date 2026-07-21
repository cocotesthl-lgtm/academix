'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export type BrandingResult = { ok: true } | { ok: false; error: string };

/** Solo aceptamos URLs http(s) para evitar javascript:/data: u otros esquemas. */
function safeImageUrl(raw: string): string | null {
  const v = raw.trim();
  if (v === '') return null;
  if (v.length > 2048) return null;
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? v : null;
  } catch {
    return null;
  }
}

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
  // primary_gradient es opcional — un string CSS "linear-gradient(...)"
  // o vacío si el owner quiere el hex sólido. Se guarda en su propia
  // columna (no dentro de brand) porque muchos lugares del código
  // asumen que brand.primary_color es hex y no queremos que un
  // gradient rompa esos consumers legacy.
  const primaryGradient = String(formData.get('primary_gradient') ?? '').trim();
  const accent = String(formData.get('accent_color') ?? '').trim();
  const logoLayoutRaw = String(formData.get('logo_layout') ?? '').trim();
  const logoUrl = String(formData.get('logo_url') ?? '').trim();
  const logoText = String(formData.get('logo_text') ?? '').trim();
  const ogImageUrl = String(formData.get('og_image_url') ?? '').trim();
  const tagline = String(formData.get('tagline') ?? '').trim();

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
  brand.logo_url = safeImageUrl(logoUrl);
  // En modo horizontal el texto no se renderiza, lo guardamos vacío.
  brand.logo_text = logoLayout === 'horizontal' ? null : (logoText.slice(0, 40) || null);
  // OG image (1200×630) para preview en WhatsApp/Twitter/Facebook.
  brand.og_image_url = safeImageUrl(ogImageUrl);
  // Tagline corta que enriquece el <title> hasta 50-60 chars ideales de SEO.
  brand.tagline = tagline.slice(0, 80) || null;

  // primary_gradient viaja como columna dedicada. Intento con la
  // columna primero; si la migration 0083 no corrió aún, retry sin
  // ella (silencioso — el owner ve el hex solo hasta que corra).
  const basePayload = { name, brand, updated_at: new Date().toISOString() };
  const withGradient: Record<string, unknown> = {
    ...basePayload,
    primary_gradient: primaryGradient || null
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updErr = (await (svc.from('tenants') as any).update(withGradient).eq('id', tenantId)).error;
  if (updErr && /primary_gradient/.test(String(updErr.message || ''))) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updErr = (await (svc.from('tenants') as any).update(basePayload).eq('id', tenantId)).error;
  }
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

/**
 * Actualiza las imagenes / texto que se inyectan en los emails que envia
 * la plataforma (confirmaciones, tickets, etc).
 * Todo URL-only — sin uploads (regla del proyecto).
 *
 * Defensivo: si migration 0021 no corrio, las columnas no existen → la
 * action devuelve ok igualmente para no romper UX (el owner lo intentara
 * de nuevo cuando corra la migration).
 */
export async function updateEmailBrandingAction(
  _prev: BrandingResult | null,
  formData: FormData
): Promise<BrandingResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Iniciá sesión.' };
  const svc = getServiceClient();
  const { data: membership } = await svc
    .from('memberships').select('tenant_id')
    .eq('user_id', user.id).eq('role', 'owner').eq('status', 'active')
    .limit(1).maybeSingle<{ tenant_id: string }>();
  if (!membership) return { ok: false, error: 'No sos owner de ninguna academia.' };

  const headerUrl = safeImageUrl(String(formData.get('email_header_image_url') ?? ''));
  const bannerUrl = safeImageUrl(String(formData.get('email_banner_image_url') ?? ''));
  const footerMsgRaw = String(formData.get('email_footer_message') ?? '').trim();
  const footerMsg = footerMsgRaw.length === 0 ? null : footerMsgRaw.slice(0, 500);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (svc.from('tenants') as any)
      .update({
        email_header_image_url: headerUrl,
        email_banner_image_url: bannerUrl,
        email_footer_message:   footerMsg,
        updated_at: new Date().toISOString()
      })
      .eq('id', membership.tenant_id);
    if (updErr && !updErr.message?.includes('email_header_image_url')) {
      return { ok: false, error: updErr.message };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
  revalidatePath('/branding');
  return { ok: true };
}
