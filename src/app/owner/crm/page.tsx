import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { ensureDefaultPipeline, createPipelineAction, renamePipelineAction, deletePipelineAction } from '@/lib/crm/actions';
import { KanbanBoard, type Stage, type Lead, type ActivityRow } from '@/components/owner/crm/KanbanBoard';

export const dynamic = 'force-dynamic';

type Pipeline = { id: string; name: string; description: string | null; is_default: boolean };

export default async function CrmPage({ searchParams }: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { tenant } = await requireOwner();
  const { p: selectedPipelineParam } = await searchParams;
  const svc = getServiceClient();

  let migrationMissing = false;
  let pipelines: Pipeline[] = [];

  try {
    // Auto-crear pipeline default si no hay ninguno
    await ensureDefaultPipeline(tenant.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeRes = await (svc.from('crm_pipelines') as any)
      .select('id, name, description, is_default')
      .eq('tenant_id', tenant.id)
      .order('position', { ascending: true });
    if (pipeRes.error?.message?.includes('does not exist')) migrationMissing = true;
    pipelines = (pipeRes.data ?? []) as Pipeline[];
  } catch {
    migrationMissing = true;
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineParam) ?? pipelines.find((p) => p.is_default) ?? pipelines[0];

  let stages: Stage[] = [];
  let leads: Lead[] = [];
  const activitiesByLead: Record<string, ActivityRow[]> = {};

  if (selectedPipeline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stagesRes = await (svc.from('crm_stages') as any)
      .select('id, name, color, position, is_won, is_lost')
      .eq('pipeline_id', selectedPipeline.id)
      .order('position');
    stages = (stagesRes.data ?? []) as Stage[];

    if (stages.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leadsRes = await (svc.from('crm_leads') as any)
        .select('id, stage_id, name, email, phone, value_cents, currency, source, notes, created_at')
        .eq('tenant_id', tenant.id)
        .eq('pipeline_id', selectedPipeline.id)
        .is('archived_at', null)
        .order('position', { ascending: true });
      leads = (leadsRes.data ?? []) as Lead[];

      if (leads.length > 0) {
        const leadIds = leads.map((l) => l.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actRes = await (svc.from('crm_lead_activity') as any)
          .select('id, lead_id, activity_type, comment, created_at')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false })
          .limit(200);
        for (const a of (actRes.data ?? []) as ActivityRow[]) {
          if (!activitiesByLead[a.lead_id]) activitiesByLead[a.lead_id] = [];
          activitiesByLead[a.lead_id].push(a);
        }
      }
    }
  }

  const totalValue = leads.reduce((sum, l) => sum + (l.value_cents || 0), 0);
  const totalLeads = leads.length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">📊 CRM — Leads</h1>
          <p className="text-white/60 text-sm mt-1">
            Tablero Kanban. Arrastrá los leads entre columnas para cambiar su etapa.
          </p>
        </div>
        <Link
          href="/owner/forms"
          className="text-xs px-3 py-2 rounded border border-white/15 hover:bg-white/5 transition"
        >
          📝 Formularios →
        </Link>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración. Pegá <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en Supabase SQL Editor.
        </div>
      )}

      {!migrationMissing && pipelines.length > 0 && (
        <>
          {/* Tabs de pipelines */}
          <div className="flex items-center gap-2 flex-wrap border-b border-white/10 pb-3">
            {pipelines.map((p) => (
              <Link
                key={p.id}
                href={`/owner/crm?p=${p.id}`}
                className={`text-sm px-3 py-1.5 rounded-full transition ${
                  selectedPipeline?.id === p.id
                    ? 'bg-white text-black font-semibold'
                    : 'border border-white/15 text-white/70 hover:bg-white/5'
                }`}
              >
                {p.name}
              </Link>
            ))}

            <details className="relative">
              <summary className="text-xs cursor-pointer text-white/50 hover:text-white px-3 py-1.5 rounded border border-dashed border-white/15 list-none">
                + Nuevo pipeline
              </summary>
              <div className="absolute mt-2 right-0 z-20 w-72 rounded-xl border border-white/15 bg-[#111] p-3 shadow-xl">
                <form action={createPipelineAction} className="space-y-2">
                  <input name="name" required placeholder="Nombre del pipeline" autoFocus
                    className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
                  <input name="description" placeholder="Descripción (opcional)"
                    className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
                  <button className="w-full rounded bg-white text-black text-sm font-semibold py-1.5">
                    Crear pipeline
                  </button>
                  <p className="text-[10px] text-white/40">Se crea con etapas Nuevo / Contactado / Cotizado / Ganado / Perdido.</p>
                </form>
              </div>
            </details>

            {selectedPipeline && pipelines.length > 1 && (
              <form action={deletePipelineAction} className="ml-auto">
                <input type="hidden" name="id" value={selectedPipeline.id} />
                <button
                  className="text-xs text-rose-300 hover:text-rose-200 px-2 py-1 rounded border border-rose-500/30 hover:bg-rose-500/10"
                  onClick={(e) => {
                    if (!confirm(`¿Eliminar el pipeline "${selectedPipeline.name}" y todos sus leads?`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  Eliminar pipeline
                </button>
              </form>
            )}
          </div>

          {/* Resumen */}
          {selectedPipeline && (
            <div className="flex items-center gap-6 text-xs text-white/70">
              <span><strong className="text-white text-base">{totalLeads}</strong> {totalLeads === 1 ? 'lead' : 'leads'}</span>
              {totalValue > 0 && <span>Valor total: <strong className="text-emerald-300">$ {(totalValue / 100).toLocaleString('es-AR')}</strong></span>}
            </div>
          )}

          {selectedPipeline && (
            <PipelineRenameForm pipeline={selectedPipeline} />
          )}

          {selectedPipeline && stages.length > 0 ? (
            <KanbanBoard
              pipelineId={selectedPipeline.id}
              stages={stages}
              leads={leads}
              activitiesByLead={activitiesByLead}
            />
          ) : selectedPipeline ? (
            <div className="rounded-xl border border-white/10 p-8 text-center text-white/40 text-sm">
              Sin etapas todavía. Agregá una columna desde el tablero.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function PipelineRenameForm({ pipeline }: { pipeline: Pipeline }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-white/50 hover:text-white inline-block">⚙ Renombrar pipeline</summary>
      <form action={renamePipelineAction} className="mt-2 flex gap-2 items-center max-w-md">
        <input type="hidden" name="id" value={pipeline.id} />
        <input name="name" defaultValue={pipeline.name} required
          className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-1.5 text-sm" />
        <button className="rounded bg-white text-black text-xs font-semibold px-3 py-1.5">
          Guardar
        </button>
      </form>
    </details>
  );
}
