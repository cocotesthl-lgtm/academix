/**
 * Puente WhatsApp ↔ CRM.
 *
 * Cuando entra un mensaje de un contacto NUEVO al bot (conversación
 * recién creada), automáticamente crea un lead en el primer pipeline
 * del tenant y en el primer stage de ese pipeline. Después vincula el
 * lead a la conversación (crm_lead_id) para que el owner pueda saltar
 * entre inbox y CRM.
 *
 * Idempotente: si la conversación ya tiene crm_lead_id, no hace nada.
 * Silencioso: cualquier error se ignora — no queremos que un pipeline
 * mal configurado rompa la recepción de mensajes.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Svc = any;

export async function maybeCreateCrmLead(
  svc: Svc,
  tenantId: string,
  conversation: { id: string; wa_customer_id: string; customer_name: string | null; crm_lead_id?: string | null }
): Promise<void> {
  try {
    if (conversation.crm_lead_id) return; // ya vinculado

    // Buscar el default_pipeline_id del tenant, o el primer pipeline que exista
    const { data: crmCfg } = await svc.from('crm_config')
      .select('default_pipeline_id').eq('tenant_id', tenantId).limit(1).maybeSingle();
    let pipelineId: string | null = crmCfg?.default_pipeline_id ?? null;
    if (!pipelineId) {
      const { data: p } = await svc.from('crm_pipelines')
        .select('id').eq('tenant_id', tenantId).order('position', { ascending: true })
        .limit(1).maybeSingle();
      pipelineId = p?.id ?? null;
    }
    if (!pipelineId) return; // el tenant no tiene CRM configurado — abortamos silencioso

    // Primer stage del pipeline
    const { data: stage } = await svc.from('crm_stages')
      .select('id').eq('pipeline_id', pipelineId).order('position', { ascending: true })
      .limit(1).maybeSingle();
    if (!stage?.id) return;

    const { data: newLead } = await svc.from('crm_leads').insert({
      tenant_id: tenantId,
      pipeline_id: pipelineId,
      stage_id: stage.id,
      name: conversation.customer_name || null,
      phone: conversation.wa_customer_id,
      source: 'whatsapp',
      data: { wa_conversation_id: conversation.id }
    }).select('id').single();

    if (newLead?.id) {
      await svc.from('whatsapp_conversations')
        .update({ crm_lead_id: newLead.id })
        .eq('id', conversation.id);
    }
  } catch {
    /* silencioso — no rompemos el webhook por errores de CRM */
  }
}
