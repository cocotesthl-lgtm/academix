'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export type AffiliateLinkResult =
  | { ok: true; code: string; url: string }
  | { ok: false; error: string };

function generateCode(): string {
  // 8 chars, base36-ish, URL-safe.
  return randomBytes(6).toString('base64url').slice(0, 8).toLowerCase();
}

export async function createAffiliateLinkAction(formData: FormData): Promise<AffiliateLinkResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Iniciá sesión para generar tu link.' };

  const courseId = String(formData.get('course_id') ?? '');
  const tenantSlug = String(formData.get('tenant_slug') ?? '');
  if (!courseId || !tenantSlug) return { ok: false, error: 'Faltan datos.' };

  const svc = getServiceClient();

  // Validate course exists, is published, and affiliate is enabled
  const { data: course } = await svc
    .from('courses')
    .select('id, slug, tenant_id, status, affiliate_enabled')
    .eq('id', courseId)
    .maybeSingle<{
      id: string;
      slug: string;
      tenant_id: string;
      status: string;
      affiliate_enabled: boolean;
    }>();
  if (!course) return { ok: false, error: 'Curso no encontrado.' };
  if (course.status !== 'published') return { ok: false, error: 'El curso no está publicado.' };
  if (!course.affiliate_enabled) return { ok: false, error: 'Este curso no acepta afiliados.' };

  // Check if affiliate already has a link for this course
  const { data: existing } = await svc
    .from('affiliate_links')
    .select('code')
    .eq('course_id', courseId)
    .eq('affiliate_user_id', user.id)
    .maybeSingle<{ code: string }>();

  let code: string;
  if (existing) {
    code = existing.code;
  } else {
    // Try up to 5 times on code collision
    let inserted = false;
    code = '';
    for (let i = 0; i < 5 && !inserted; i++) {
      code = generateCode();
      const payload = {
        tenant_id: course.tenant_id,
        course_id: courseId,
        affiliate_user_id: user.id,
        code
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (svc.from('affiliate_links') as any).insert(payload);
      if (!error) {
        inserted = true;
      } else if (!error.message.includes('duplicate')) {
        return { ok: false, error: error.message };
      }
    }
    if (!inserted) return { ok: false, error: 'No pudimos generar un código único. Intentá de nuevo.' };
  }

  // Build URL (uses root domain in prod, .localhost in dev)
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'bzseguridad.store';
  const isLocal = !process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL.includes('localhost');
  const host = isLocal ? `${tenantSlug}.localhost:3000` : `${tenantSlug}.${root}`;
  const proto = isLocal ? 'http' : 'https';
  const url = `${proto}://${host}/c/${course.slug}?ref=${code}`;

  revalidatePath('/affiliate');
  return { ok: true, code, url };
}
