'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * CRM — Pipelines, Stages, Leads, Activity.
 *
 * Conceptual:
 *  - Un tenant tiene N pipelines (ej. "Ventas", "Soporte", "Contratación").
 *  - Cada pipeline tiene M stages (columnas del kanban, ej. "Nuevo → Cerrado").
 *  - Cada stage contiene leads ordenados por position.
 *  - Cada lead tiene activity (historial de cambios + comentarios).
 */

const DEFAULT_STAGES = [
  { name: 'Nuevo',       color: '#a855f7', position: 0, is_won: false, is_lost: false },
  { name: 'Contactado',  color: '#3b82f6', position: 1, is_won: false, is_lost: false },
  { name: 'Cotizado',    color: '#eab308', position: 2, is_won: false, is_lost: false },
  { name: 'Ganado',      color: '#10b981', position: 3, is_won: true,  is_lost: false },
  { name: 'Perdido',     color: '#ef4444', position: 4, is_won: false, is_lost: true  }
];

/**
 * Asegura que el tenant tenga al menos un pipeline. Si no tiene, crea uno
 * "Ventas" con las 5 etapas default. Idempotente — solo crea si está vacío.
 * Devuelve el pipeline_id default (el is_default=true o el primero).
 */
export async function ensureDefaultPipeline(tenantId: string): Promise<string | null> {
  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (svc.from('crm_pipelines') as any)
      .select('id, is_default').eq('tenant_id', tenantId).order('position');
    const list = (existing ?? []) as Array<{ id: string; is_default: boolean }>;
    if (list.length > 0) {
      const def = list.find((p) => p.is_default);
      return def?.id ?? list[0].id;
    }

    // Crear pipeline default
    const pipelineId = randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('crm_pipelines') as any).insert({
      id: pipelineId, tenant_id: tenantId,
      name: 'Ventas', description: 'Pipeline default', is_default: true, position: 0
    });
    // Stages default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('crm_stages') as any).insert(
      DEFAULT_STAGES.map((s) => ({ ...s, id: randomUUID(), pipeline_id: pipelineId }))
    );
    return pipelineId;
  } catch {
    return null;
  }
}

/* ===== Pipeline CRUD ===== */

export async function createPipelineAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const svc = getServiceClient();
  const id = randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_pipelines') as any).insert({
    id, tenant_id: tenant.id, name,
    description: String(formData.get('description') ?? '').trim() || null,
    position: Date.now() % 100000
  });
  // Crear stages default para el pipeline nuevo también
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_stages') as any).insert(
    DEFAULT_STAGES.map((s) => ({ ...s, id: randomUUID(), pipeline_id: id }))
  );
  revalidatePath('/owner/crm');
}

export async function deletePipelineAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_pipelines') as any).delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/crm');
}

export async function renamePipelineAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!id || !name) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_pipelines') as any).update({ name }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/crm');
}

/* ===== Stage CRUD ===== */

export async function addStageAction(formData: FormData): Promise<void> {
  await requireOwner();
  const pipelineId = String(formData.get('pipeline_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!pipelineId || !name) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('crm_stages') as any)
    .select('position').eq('pipeline_id', pipelineId).order('position', { ascending: false }).limit(1);
  const nextPos = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_stages') as any).insert({
    id: randomUUID(), pipeline_id: pipelineId, name,
    color: String(formData.get('color') ?? '#a855f7'),
    position: nextPos
  });
  revalidatePath('/owner/crm');
}

export async function deleteStageAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // No deja eliminar si tiene leads (FK on delete restrict).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_leads') as any).delete().eq('stage_id', id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_stages') as any).delete().eq('id', id);
  revalidatePath('/owner/crm');
}

export async function updateStageAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!id || !name) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_stages') as any).update({
    name,
    color: String(formData.get('color') ?? '#a855f7')
  }).eq('id', id);
  revalidatePath('/owner/crm');
}

/* ===== Lead CRUD ===== */

export async function createLeadAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const pipelineId = String(formData.get('pipeline_id') ?? '');
  const stageId = String(formData.get('stage_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!pipelineId || !stageId || !name) return;

  const svc = getServiceClient();
  const id = randomUUID();
  const valueRaw = parseInt(String(formData.get('value_cents') ?? '0'), 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_leads') as any).insert({
    id, tenant_id: tenant.id, pipeline_id: pipelineId, stage_id: stageId,
    name,
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    value_cents: Number.isFinite(valueRaw) ? valueRaw : 0,
    source: 'manual',
    notes: String(formData.get('notes') ?? '').trim() || null,
    position: Date.now() % 100000
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_lead_activity') as any).insert({
    lead_id: id, activity_type: 'created', payload: { source: 'manual' }
  });
  revalidatePath('/owner/crm');
}

export async function updateLeadAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  const valueRaw = parseInt(String(formData.get('value_cents') ?? '0'), 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_leads') as any).update({
    name: String(formData.get('name') ?? '').trim() || 'Sin nombre',
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    value_cents: Number.isFinite(valueRaw) ? valueRaw : 0,
    notes: String(formData.get('notes') ?? '').trim() || null,
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_lead_activity') as any).insert({
    lead_id: id, activity_type: 'edited'
  });
  revalidatePath('/owner/crm');
}

export async function deleteLeadAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_leads') as any).delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/crm');
}

/**
 * Mueve un lead a otra etapa (drag&drop). Si stageId no cambia, actualiza position.
 */
export async function moveLeadAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const stageId = String(formData.get('stage_id') ?? '');
  if (!id || !stageId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentRaw } = await (svc.from('crm_leads') as any)
    .select('stage_id').eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  const current = currentRaw as { stage_id: string } | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_leads') as any).update({
    stage_id: stageId,
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);

  if (current && current.stage_id !== stageId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('crm_lead_activity') as any).insert({
      lead_id: id, activity_type: 'stage_changed',
      payload: { from_stage: current.stage_id, to_stage: stageId }
    });
  }
  revalidatePath('/owner/crm');
}

export async function addLeadCommentAction(formData: FormData): Promise<void> {
  await requireOwner();
  const leadId = String(formData.get('lead_id') ?? '');
  const comment = String(formData.get('comment') ?? '').trim();
  if (!leadId || !comment) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_lead_activity') as any).insert({
    lead_id: leadId, activity_type: 'comment', comment
  });
  revalidatePath('/owner/crm');
}

/**
 * Conexión form → pipeline: setea default_pipeline_id + default_stage_id en el form.
 * Cuando llegue una submission a ese form, automáticamente crea un lead en ese stage.
 */
export async function setFormPipelineAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const formId = String(formData.get('form_id') ?? '');
  if (!formId) return;
  const pipelineId = String(formData.get('pipeline_id') ?? '').trim() || null;
  const stageId = String(formData.get('stage_id') ?? '').trim() || null;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('forms') as any).update({
    default_pipeline_id: pipelineId,
    default_stage_id: stageId,
    updated_at: new Date().toISOString()
  }).eq('id', formId).eq('tenant_id', tenant.id);
  revalidatePath(`/owner/forms/${formId}`);
}
