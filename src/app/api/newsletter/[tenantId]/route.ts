import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { tenantOrigin } from '@/lib/env';

/**
 * POST /api/newsletter/[tenantId]
 *
 * Endpoint para el form de la sección "Newsletter" del storefront (built-in
 * del editor, no un form del módulo Forms).
 *
 * Antes: action="#" — el form no hacía absolutamente nada. Peor: mostraba
 * el mensaje "Integración con email marketing próximamente" que hacía
 * pensar que estaba en desarrollo.
 *
 * Ahora: auto-materializa un form implícito por tenant (slug '_newsletter',
 * idempotente) y guarda cada suscripción como form_submission. Aparece
 * en /owner/forms + /owner/submissions + /founder/submissions.
 *
 * Además dedupea por email: si el email ya se suscribió antes, no se
 * inserta 2 veces. Devuelve success igual (para no filtrar quién ya está
 * suscripto — típico anti-scraping de newsletters).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId } = await ctx.params;
  const form = await req.formData();
  const svc = getServiceClient();

  const { data: tenant } = await svc
    .from('tenants').select('id, slug').eq('id', tenantId)
    .maybeSingle<{ id: string; slug: string }>();
  if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });

  const backOrigin = tenantOrigin(tenant.slug);
  const referer = req.headers.get('referer') || `${backOrigin}/`;

  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  if (!email || !email.includes('@')) {
    return NextResponse.redirect(`${referer}?newsletter=error`, { status: 303 });
  }

  // Auto-materializar form implícito
  const NL_SLUG = '_newsletter';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: existingForm } = await (svc.from('forms') as any)
    .select('id').eq('tenant_id', tenant.id).eq('slug', NL_SLUG)
    .maybeSingle();

  if (!existingForm) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created } = await (svc.from('forms') as any).insert({
      tenant_id: tenant.id,
      slug: NL_SLUG,
      title: 'Newsletter (sección del sitio)',
      description: 'Suscripciones al newsletter que llegan por la sección "Newsletter" del editor. Cada email queda acá — podés exportar para importar a Mailchimp/Brevo cuando quieras.',
      submit_label: 'Suscribirme'
    }).select('id').single();
    existingForm = created;
  }

  if (!existingForm) {
    console.warn('[newsletter] no se pudo crear form implícito para tenant', tenantId);
    return NextResponse.redirect(`${referer}?newsletter=sent`, { status: 303 });
  }

  // Dedupe por email — si ya se suscribió, no insertamos otra vez
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dup } = await (svc.from('form_submissions') as any)
    .select('id').eq('form_id', existingForm.id).eq('submitter_email', email)
    .limit(1).maybeSingle();

  if (!dup) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('form_submissions') as any).insert({
      form_id: existingForm.id,
      tenant_id: tenant.id,
      data: { email },
      submitter_email: email,
      source_url: referer.slice(0, 500)
    });
  }

  return NextResponse.redirect(`${referer}?newsletter=sent#${form.get('_anchor') ?? 'newsletter'}`, { status: 303 });
}
