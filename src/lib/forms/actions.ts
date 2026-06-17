'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID, createHash } from 'node:crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Form Builder — server actions.
 *
 * Forms y sus campos viven en el tenant del owner. Las submissions (envíos)
 * llegan vía submitFormAction desde el storefront público.
 */

const VALID_FIELD_TYPES = new Set([
  'text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'number'
]);

function slugify(input: string): string {
  return input
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'form';
}

/* ===== Form CRUD ===== */

export async function createFormAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;
  const slugRaw = String(formData.get('slug') ?? '').trim() || slugify(title);
  const slug = slugify(slugRaw);

  const svc = getServiceClient();
  const id = randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('forms') as any).insert({
    id, tenant_id: tenant.id, slug, title,
    description: String(formData.get('description') ?? '').trim() || null,
    notify_email: String(formData.get('notify_email') ?? '').trim() || null
  });

  // Campos mínimos por default: nombre + email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('form_fields') as any).insert([
    { form_id: id, position: 0, field_type: 'text',  name: 'nombre', label: 'Nombre', required: true },
    { form_id: id, position: 1, field_type: 'email', name: 'email',  label: 'Email',  required: true },
    { form_id: id, position: 2, field_type: 'textarea', name: 'mensaje', label: 'Mensaje', required: false }
  ]);

  revalidatePath('/owner/forms');
  redirect(`/forms/${id}`);
}

export async function deleteFormAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('forms') as any).delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/forms');
}

export async function updateFormMetaAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const updates: Record<string, unknown> = {
    title: String(formData.get('title') ?? '').trim() || 'Sin título',
    description: String(formData.get('description') ?? '').trim() || null,
    success_message: String(formData.get('success_message') ?? '').trim() || '¡Gracias!',
    redirect_url: String(formData.get('redirect_url') ?? '').trim() || null,
    submit_label: String(formData.get('submit_label') ?? '').trim() || 'Enviar',
    notify_email: String(formData.get('notify_email') ?? '').trim() || null,
    updated_at: new Date().toISOString()
  };
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('forms') as any).update(updates).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath(`/owner/forms/${id}`);
}

/* ===== Field CRUD ===== */

export async function addFieldAction(formData: FormData): Promise<void> {
  await requireOwner();
  const formId = String(formData.get('form_id') ?? '');
  const typeRaw = String(formData.get('field_type') ?? 'text');
  const field_type = VALID_FIELD_TYPES.has(typeRaw) ? typeRaw : 'text';
  const label = String(formData.get('label') ?? '').trim();
  if (!formId || !label) return;
  const name = slugify(label).replace(/-/g, '_');

  const svc = getServiceClient();
  // Calcular position al final
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('form_fields') as any)
    .select('position').eq('form_id', formId).order('position', { ascending: false }).limit(1);
  const nextPos = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;

  const optionsRaw = String(formData.get('options') ?? '').trim();
  const options = field_type === 'select' && optionsRaw
    ? optionsRaw.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ({ value: slugify(l), label: l }))
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('form_fields') as any).insert({
    form_id: formId,
    position: nextPos,
    field_type,
    name,
    label,
    placeholder: String(formData.get('placeholder') ?? '').trim() || null,
    required: formData.get('required') === 'on',
    options,
    help_text: String(formData.get('help_text') ?? '').trim() || null
  });

  revalidatePath(`/owner/forms/${formId}`);
}

export async function deleteFieldAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get('id') ?? '');
  const formId = String(formData.get('form_id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('form_fields') as any).delete().eq('id', id);
  if (formId) revalidatePath(`/owner/forms/${formId}`);
}

export async function moveFieldAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get('id') ?? '');
  const formId = String(formData.get('form_id') ?? '');
  const dir = String(formData.get('dir') ?? '');
  if (!id || !formId || (dir !== 'up' && dir !== 'down')) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fields } = await (svc.from('form_fields') as any)
    .select('id, position').eq('form_id', formId).order('position');
  if (!fields) return;
  const idx = (fields as Array<{ id: string; position: number }>).findIndex((f) => f.id === id);
  if (idx === -1) return;
  const newIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= fields.length) return;
  const a = fields[idx], b = fields[newIdx];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('form_fields') as any).update({ position: b.position }).eq('id', a.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('form_fields') as any).update({ position: a.position }).eq('id', b.id);
  revalidatePath(`/owner/forms/${formId}`);
}

/* ===== Submit público (sin auth) ===== */

/**
 * Llamado desde el FormRenderer público. NO requiere auth — usa service client
 * pero valida que el form exista y pertenezca al tenant correcto.
 */
export async function submitFormAction(formData: FormData): Promise<{ ok: boolean; message: string; redirect?: string }> {
  const formId = String(formData.get('__form_id') ?? '');
  const honeypot = String(formData.get('__hp') ?? '');
  if (honeypot) return { ok: true, message: 'OK' }; // bot — fake success

  if (!formId) return { ok: false, message: 'Formulario inválido' };

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: form } = await (svc.from('forms') as any)
    .select('id, tenant_id, success_message, redirect_url, notify_email, title, default_pipeline_id, default_stage_id')
    .eq('id', formId).single();
  if (!form) return { ok: false, message: 'Formulario no encontrado' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fields } = await (svc.from('form_fields') as any)
    .select('name, field_type, required, label').eq('form_id', formId);
  const fieldList = (fields ?? []) as Array<{ name: string; field_type: string; required: boolean; label: string }>;

  const data: Record<string, unknown> = {};
  for (const f of fieldList) {
    const raw = formData.get(f.name);
    if (raw == null || raw === '') {
      if (f.required) return { ok: false, message: `El campo "${f.label}" es obligatorio` };
      continue;
    }
    if (f.field_type === 'checkbox') data[f.name] = raw === 'on' || raw === 'true';
    else if (f.field_type === 'number') data[f.name] = Number(raw);
    else data[f.name] = String(raw).slice(0, 5000);
  }

  // Denormalización
  const submitter_email = (data.email as string) || (data.correo as string) || null;
  const submitter_name = (data.nombre as string) || (data.name as string) || null;
  const submitter_phone = (data.telefono as string) || (data.phone as string) || null;

  const ipHash = createHash('sha256').update(`${Date.now()}`).digest('hex').slice(0, 32);

  // Insert submission
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sub } = await (svc.from('form_submissions') as any).insert({
    form_id: formId,
    tenant_id: form.tenant_id,
    data,
    submitter_email,
    submitter_name,
    submitter_phone,
    source_url: String(formData.get('__source') ?? '').slice(0, 500) || null,
    ip_hash: ipHash
  }).select('id').single();

  // Si el form tiene pipeline default, crear lead en el CRM
  if (form.default_pipeline_id && form.default_stage_id && sub?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead } = await (svc.from('crm_leads') as any).insert({
      tenant_id: form.tenant_id,
      pipeline_id: form.default_pipeline_id,
      stage_id: form.default_stage_id,
      name: submitter_name,
      email: submitter_email,
      phone: submitter_phone,
      source: 'form',
      source_form_id: formId,
      source_submission_id: sub.id,
      data
    }).select('id').single();
    if (lead?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('form_submissions') as any).update({ lead_id: lead.id }).eq('id', sub.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('crm_lead_activity') as any).insert({
        lead_id: lead.id,
        activity_type: 'created',
        payload: { source: 'form', form_title: form.title }
      });
    }
  }

  return {
    ok: true,
    message: form.success_message || '¡Gracias!',
    redirect: form.redirect_url || undefined
  };
}
