import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Crea un lead en el CRM a partir de una submission de form.
 *
 * Resolución del pipeline:
 *   1. Si el form tiene default_pipeline_id + default_stage_id → usar esos.
 *   2. Sino, primer pipeline + primer stage del tenant.
 *   3. Sino, crea un pipeline default "Ventas" con 4 stages estándar y usa el primero.
 *
 * Idempotente por submission_id — si ya hay lead vinculado a esta
 * submission no crea uno nuevo. Devuelve el lead_id (o null si falló).
 *
 * Usado por: submitFormAction (forms builder), /api/contact/[tenantId],
 * /api/newsletter/[tenantId], y cualquier otro endpoint que quiera
 * poblar leads desde una submission.
 */
export async function ensureLeadFromSubmission(opts: {
  tenantId: string;
  submissionId: string;
  formId: string;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterPhone: string | null;
  data: Record<string, unknown>;
  /** Título del form — se guarda en el activity log del lead */
  formTitle?: string;
  /** Overrides opcionales — si el form ya tiene default seteados */
  preferPipelineId?: string | null;
  preferStageId?: string | null;
}): Promise<string | null> {
  const svc = getServiceClient();

  // Idempotencia: si la submission ya tiene lead, devolver ese
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subExisting } = await (svc.from('form_submissions') as any)
    .select('lead_id').eq('id', opts.submissionId).maybeSingle();
  if (subExisting?.lead_id) return subExisting.lead_id;

  let pipelineId: string | null = opts.preferPipelineId ?? null;
  let stageId: string | null = opts.preferStageId ?? null;

  if (!pipelineId || !stageId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: p } = await (svc.from('crm_pipelines') as any)
        .select('id').eq('tenant_id', opts.tenantId).order('position').limit(1).maybeSingle();
      if (p?.id) {
        pipelineId = p.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: s } = await (svc.from('crm_stages') as any)
          .select('id').eq('pipeline_id', p.id).order('position').limit(1).maybeSingle();
        stageId = s?.id ?? null;
      } else {
        // No hay pipelines — crear uno default "Ventas"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newP } = await (svc.from('crm_pipelines') as any).insert({
          tenant_id: opts.tenantId, name: 'Ventas', position: 0
        }).select('id').single();
        if (newP?.id) {
          pipelineId = newP.id;
          const defaultStages = [
            { name: 'Nuevo',      position: 0, color: '#f97316' },
            { name: 'Contactado', position: 1, color: '#3b82f6' },
            { name: 'Cotizado',   position: 2, color: '#eab308' },
            { name: 'Ganado',     position: 3, color: '#10b981', is_won: true },
            { name: 'Perdido',    position: 4, color: '#ef4444', is_lost: true }
          ];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: insertedStages } = await (svc.from('crm_stages') as any)
            .insert(defaultStages.map((s) => ({ ...s, pipeline_id: newP.id })))
            .select('id, position');
          const firstStage = (insertedStages as Array<{ id: string; position: number }> ?? [])
            .sort((a, b) => a.position - b.position)[0];
          stageId = firstStage?.id ?? null;
        }
      }
    } catch { /* fallback silencioso — no interrumpir */ }
  }

  if (!pipelineId || !stageId) return null;

  // Crear lead
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead } = await (svc.from('crm_leads') as any).insert({
    tenant_id: opts.tenantId,
    pipeline_id: pipelineId,
    stage_id: stageId,
    name: opts.submitterName,
    email: opts.submitterEmail,
    phone: opts.submitterPhone,
    source: 'form',
    source_form_id: opts.formId,
    source_submission_id: opts.submissionId,
    data: opts.data
  }).select('id').single();

  if (!lead?.id) return null;

  // Linkear submission → lead (para dedupe futuro)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('form_submissions') as any)
    .update({ lead_id: lead.id }).eq('id', opts.submissionId);

  // Activity log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('crm_lead_activity') as any).insert({
    lead_id: lead.id,
    activity_type: 'created',
    payload: { source: 'form', form_title: opts.formTitle ?? 'form' }
  });

  return lead.id;
}
