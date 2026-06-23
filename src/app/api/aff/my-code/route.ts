import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getOrCreateAffiliateLink } from '@/lib/affiliates/links';
import { ensureAffiliateMembership } from '@/lib/affiliates/panel';
import { resolveTenantIdBySlug } from '@/lib/tenant/resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/aff/my-code?slug=<course-slug>&tenant=<tenant-slug>
 *
 * Devuelve el code de affiliate link del user logueado para esa publicación.
 * Lo crea si no existe (idempotente). Usado por AffiliateBar mientras el
 * afiliado navega las landings.
 *
 * Diseño: el caller pasa tenant explícitamente (en vez de re-parsear host).
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const slug = req.nextUrl.searchParams.get('slug');
  const tenantSlug = req.nextUrl.searchParams.get('tenant');
  if (!slug || !tenantSlug) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  const tenantId = await resolveTenantIdBySlug(tenantSlug);
  if (!tenantId) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

  // Profile (is_affiliate) + course en paralelo
  const svc = getServiceClient();
  const [profileRes, courseRes] = await Promise.all([
    svc.from('profiles').select('is_affiliate').eq('id', user.id)
      .maybeSingle<{ is_affiliate: boolean }>(),
    svc.from('courses')
      .select('id, affiliate_enabled')
      .eq('tenant_id', tenantId).eq('slug', slug)
      .maybeSingle<{ id: string; affiliate_enabled: boolean }>()
  ]);

  if (!profileRes.data?.is_affiliate) {
    return NextResponse.json({ error: 'not_affiliate' }, { status: 403 });
  }
  const course = courseRes.data;
  if (!course) return NextResponse.json({ error: 'course_not_found' }, { status: 404 });
  if (!course.affiliate_enabled) return NextResponse.json({ error: 'affiliate_disabled' }, { status: 409 });

  // Asegurar membership tenant (autocrea si es el 1er link para este tenant)
  // y generar/recuperar el código en paralelo.
  const [, linkResult] = await Promise.all([
    ensureAffiliateMembership({ tenantId, userId: user.id }),
    getOrCreateAffiliateLink({ tenantId, courseId: course.id, affiliateUserId: user.id })
  ]);
  if (!linkResult.ok) return NextResponse.json({ error: linkResult.error }, { status: 500 });
  return NextResponse.json({ code: linkResult.code });
}
