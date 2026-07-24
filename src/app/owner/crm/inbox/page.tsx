import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { SegmentedTabs, CONTACTS_TABS } from '@/components/owner/SegmentedTabs';
import { PipelineMoveForm } from '@/components/owner/crm/PipelineMoveForm';

export const dynamic = 'force-dynamic';

type Lead = {
  id: string;
  pipeline_id: string;
  stage_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  value_cents: number | null;
  currency: string | null;
  source: string | null;
  source_form_id: string | null;
  assigned_to_user_id: string | null;
  created_at: string;
};

type Pipeline = { id: string; name: string };
type Stage = { id: string; pipeline_id: string; name: string; color: string | null; position: number; is_won: boolean; is_lost: boolean };
type FormLite = { id: string; title: string; slug: string };

/**
 * Buzón de leads: vista plana de TODOS los leads del tenant sin filtro
 * de pipeline. Sirve como triage — desde acá el owner puede reasignar
 * un lead a otro pipeline con un click, sin tener que arrastrarlo entre
 * columnas del Kanban (que sólo muestra 1 pipeline por vez).
 *
 * Filtros disponibles:
 *   - source: 'form', 'manual', 'import'
 *   - form: form específico que originó el lead
 *   - pipeline actual
 *   - búsqueda por nombre/email/teléfono
 */
export default async function CrmInboxPage({
  searchParams
}: {
  searchParams: Promise<{ source?: string; form?: string; pipeline?: string; q?: string; limit?: string }>;
}) {
  const { tenant } = await requireOwner();
  const sp = await searchParams;
  const source = sp.source?.trim() || '';
  const formFilter = sp.form?.trim() || '';
  const pipelineFilter = sp.pipeline?.trim() || '';
  const q = sp.q?.trim() ?? '';
  const limit = Math.min(500, Math.max(20, parseInt(sp.limit ?? '100', 10) || 100));

  const svc = getServiceClient();

  // Data loads en paralelo — leads + pipelines + stages + forms
  const [
    { data: leadsRaw },
    { data: pipesRaw },
    { data: stagesRaw },
    { data: formsRaw }
  ] = await Promise.all([
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (svc.from('crm_leads') as any)
        .select('id, pipeline_id, stage_id, name, email, phone, value_cents, currency, source, source_form_id, assigned_to_user_id, created_at')
        .eq('tenant_id', tenant.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (source) query = query.eq('source', source);
      if (formFilter) query = query.eq('source_form_id', formFilter);
      if (pipelineFilter) query = query.eq('pipeline_id', pipelineFilter);
      if (q) {
        const safe = q.replace(/[%_]/g, '\\$&');
        query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
      }
      return query;
    })(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('crm_pipelines') as any)
      .select('id, name').eq('tenant_id', tenant.id).order('position'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('crm_stages') as any)
      .select('id, pipeline_id, name, color, position, is_won, is_lost')
      .in('pipeline_id',
        // subquery workaround: sacamos todos los pipeline_ids del tenant
        (await (svc.from('crm_pipelines') as any)
          .select('id').eq('tenant_id', tenant.id)).data?.map((p: { id: string }) => p.id) ?? []
      ).order('position'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('forms') as any)
      .select('id, title, slug').eq('tenant_id', tenant.id).order('title')
  ]);

  const leads = (leadsRaw ?? []) as Lead[];
  const pipelines = (pipesRaw ?? []) as Pipeline[];
  const stages = (stagesRaw ?? []) as Stage[];
  const forms = (formsRaw ?? []) as FormLite[];

  const pipeById = new Map(pipelines.map((p) => [p.id, p]));
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const formById = new Map(forms.map((f) => [f.id, f]));
  // Stages agrupados por pipeline_id para el selector de "mover a"
  const stagesByPipeline = new Map<string, Stage[]>();
  for (const s of stages) {
    if (!stagesByPipeline.has(s.pipeline_id)) stagesByPipeline.set(s.pipeline_id, []);
    stagesByPipeline.get(s.pipeline_id)!.push(s);
  }

  return (
    <div className="max-w-6xl space-y-5">
      <SegmentedTabs tabs={CONTACTS_TABS} />

      <div>
        <h1 className="text-2xl font-bold">📥 Buzón de leads</h1>
        <p className="text-white/60 text-sm mt-1">
          Todos los leads que llegan al sitio (formularios, contacto, newsletter, WhatsApp, manuales) en una sola vista.
          Podés reasignar cualquiera a otro pipeline con un click.
        </p>
      </div>

      {/* Filtros */}
      <form method="get" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1">Origen</label>
          <select name="source" defaultValue={source}
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm min-w-[140px]">
            <option value="">Todos</option>
            <option value="form">Formulario</option>
            <option value="manual">Manual</option>
            <option value="import">Importado</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1">Formulario</label>
          <select name="form" defaultValue={formFilter}
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm min-w-[200px]">
            <option value="">Todos</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1">Pipeline actual</label>
          <select name="pipeline" defaultValue={pipelineFilter}
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm min-w-[180px]">
            <option value="">Todos</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1">Buscar</label>
          <input name="q" defaultValue={q} placeholder="Nombre / email / teléfono"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
        </div>
        <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2">
          Filtrar
        </button>
        {(source || formFilter || pipelineFilter || q) && (
          <Link href="/owner/crm/inbox" className="text-xs text-white/50 hover:text-white px-3 py-2">
            Limpiar
          </Link>
        )}
      </form>

      {/* Listado */}
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-sm text-white/50">
          {source || formFilter || pipelineFilter || q
            ? 'Ningún lead matchea los filtros.'
            : 'No llegó ningún lead todavía. Cuando alguien complete un form del sitio, aparecerá acá.'}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
          {leads.map((l) => {
            const currentPipeline = pipeById.get(l.pipeline_id);
            const currentStage = stageById.get(l.stage_id);
            const sourceForm = l.source_form_id ? formById.get(l.source_form_id) : null;
            return (
              <div key={l.id} className="p-4 bg-white/[0.02] hover:bg-white/[0.03] transition">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{l.name || l.email || '(sin nombre)'}</div>
                      {currentStage && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: `${currentStage.color ?? '#a855f7'}22`,
                            color: currentStage.color ?? '#a855f7'
                          }}>
                          {currentStage.name}{currentStage.is_won ? ' ✓' : currentStage.is_lost ? ' ✗' : ''}
                        </span>
                      )}
                      {currentPipeline && (
                        <span className="text-[10px] text-white/40">
                          en <strong className="text-white/60">{currentPipeline.name}</strong>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/60 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {l.email && <span>{l.email}</span>}
                      {l.phone && <span>{l.phone}</span>}
                      {l.value_cents ? <span className="text-emerald-300">${(Number(l.value_cents) / 100).toLocaleString('es-AR')}</span> : null}
                      <span className="text-white/40">
                        {new Date(l.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {sourceForm && (
                        <span className="text-white/40">via {sourceForm.title}</span>
                      )}
                      {l.source === 'manual' && !sourceForm && (
                        <span className="text-white/40">agregado a mano</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <PipelineMoveForm
                      leadId={l.id}
                      currentPipelineId={l.pipeline_id}
                      currentStageId={l.stage_id}
                      pipelines={pipelines}
                      stagesByPipeline={Object.fromEntries(
                        Array.from(stagesByPipeline.entries()).map(([pid, ss]) => [
                          pid, ss.map((s) => ({ id: s.id, name: s.name }))
                        ])
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {leads.length === limit && (
        <p className="text-xs text-white/45 text-center">
          Mostrando los primeros {limit} leads. Aplicá filtros para reducir el resultado.
        </p>
      )}
    </div>
  );
}
