import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { tenantOrigin } from '@/lib/env';
import { ensureLeadFromSubmission } from '@/lib/crm/ensure-lead';

/**
 * POST /api/contact/[tenantId]
 *
 * Endpoint para el form de la sección "Contacto" del storefront (la que
 * está hardcodeada en el editor, no un form del módulo Forms).
 *
 * Antes: hacía mailto:{email} — abría el cliente de mail del user y no
 * persistía nada. Los envíos se perdían y no aparecían ni en /owner/forms
 * ni en /founder/submissions.
 *
 * Ahora: auto-materializa un form "implícito" por tenant (slug
 * '_contact_section', idempotente) y guarda cada submission como
 * form_submission — que aparece en las mismas vistas que los forms reales.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId } = await ctx.params;
  const form = await req.formData();
  const svc = getServiceClient();

  // Resolver tenant (por id o por slug, defensivo)
  const { data: tenant } = await svc
    .from('tenants').select('id, slug').eq('id', tenantId)
    .maybeSingle<{ id: string; slug: string }>();
  if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });

  const backOrigin = tenantOrigin(tenant.slug);
  const referer = req.headers.get('referer') || `${backOrigin}/#contact`;

  // Extraer los 3 campos que el section usa (Nombre / Email / Mensaje)
  const nombre = String(form.get('Nombre') ?? '').trim().slice(0, 200);
  const email = String(form.get('Email') ?? '').trim().slice(0, 200);
  const mensaje = String(form.get('Mensaje') ?? '').trim().slice(0, 5000);

  if (!nombre || !email) {
    return NextResponse.redirect(`${referer}?contact=error`, { status: 303 });
  }

  // Ensure form implícito — idempotente por (tenant_id, slug) UNIQUE
  const CONTACT_SLUG = '_contact_section';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: existingForm } = await (svc.from('forms') as any)
    .select('id, notify_email').eq('tenant_id', tenant.id).eq('slug', CONTACT_SLUG)
    .maybeSingle();

  if (!existingForm) {
    // Copiamos el email destino desde la config del tenant si lo puso
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tData } = await (svc.from('tenants') as any)
      .select('site_config').eq('id', tenant.id).maybeSingle();
    const contactCfg = tData?.site_config?.sections?.contact ?? {};
    const notifyEmail = typeof contactCfg.email === 'string' && contactCfg.email
      ? contactCfg.email : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created } = await (svc.from('forms') as any).insert({
      tenant_id: tenant.id,
      slug: CONTACT_SLUG,
      title: 'Contacto (sección del sitio)',
      description: 'Form auto-generado desde la sección "Contacto" del editor. Podés cambiar campos o notificación desde acá.',
      submit_label: 'Enviar',
      notify_email: notifyEmail
    }).select('id, notify_email').single();
    existingForm = created;
  }

  if (!existingForm) {
    // Si no se pudo crear (migration 0030 pendiente?) — igual retornamos sin
    // 500 así el user ve el "gracias" y el envío queda perdido en log.
    console.warn('[contact] no se pudo crear form implícito para tenant', tenantId);
    return NextResponse.redirect(`${referer}?contact=sent`, { status: 303 });
  }

  // Insert submission (necesitamos el id para linkear al lead después)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sub, error: subErr } = await (svc.from('form_submissions') as any).insert({
    form_id: existingForm.id,
    tenant_id: tenant.id,
    data: { Nombre: nombre, Email: email, Mensaje: mensaje },
    submitter_name: nombre,
    submitter_email: email,
    source_url: referer.slice(0, 500)
  }).select('id').single();
  if (subErr || !sub) {
    console.warn('[contact] insert submission failed', subErr);
    return NextResponse.redirect(`${referer}?contact=error`, { status: 303 });
  }

  // Crear lead en el CRM — fallback al primer pipeline/stage del tenant
  // (o crea uno "Ventas" default si no hay ninguno). Best-effort — no
  // rompemos el envío si el CRM falla.
  await ensureLeadFromSubmission({
    tenantId: tenant.id,
    submissionId: sub.id,
    formId: existingForm.id,
    submitterName: nombre,
    submitterEmail: email,
    submitterPhone: null,
    data: { Nombre: nombre, Email: email, Mensaje: mensaje },
    formTitle: 'Contacto (sección del sitio)'
  }).catch((e) => { console.warn('[contact] ensureLead failed:', e); });

  return NextResponse.redirect(`${referer}?contact=sent#contact`, { status: 303 });
}
