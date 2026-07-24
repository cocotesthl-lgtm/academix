'use client';

import { useState, useTransition } from 'react';
import { movePipelineAction } from '@/lib/crm/actions';

/**
 * Selector inline para mover un lead entre pipelines/stages desde el Buzón.
 * Cambia el pipeline → resetea el stage al primero del pipeline destino
 * (así no queda un stage_id de otro pipeline). Guarda al toque con
 * useTransition — sin botón "guardar" explícito.
 */
export function PipelineMoveForm({
  leadId,
  currentPipelineId,
  currentStageId,
  pipelines,
  stagesByPipeline
}: {
  leadId: string;
  currentPipelineId: string;
  currentStageId: string;
  pipelines: Array<{ id: string; name: string }>;
  stagesByPipeline: Record<string, Array<{ id: string; name: string }>>;
}) {
  const [pipelineId, setPipelineId] = useState(currentPipelineId);
  const [stageId, setStageId] = useState(currentStageId);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stages = stagesByPipeline[pipelineId] ?? [];

  function onPipelineChange(newPipelineId: string) {
    setPipelineId(newPipelineId);
    // Reset stage al primero del pipeline destino
    const first = stagesByPipeline[newPipelineId]?.[0]?.id ?? '';
    setStageId(first);
    submit(newPipelineId, first);
  }

  function onStageChange(newStageId: string) {
    setStageId(newStageId);
    submit(pipelineId, newStageId);
  }

  function submit(pid: string, sid: string) {
    setError(null);
    setSaved(false);
    start(async () => {
      try {
        const fd = new FormData();
        fd.set('lead_id', leadId);
        fd.set('pipeline_id', pid);
        fd.set('stage_id', sid);
        await movePipelineAction(fd);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
        // Revertimos visualmente si falla el enforcement
        setPipelineId(currentPipelineId);
        setStageId(currentStageId);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select value={pipelineId} onChange={(e) => onPipelineChange(e.target.value)}
        disabled={pending}
        className="text-xs rounded bg-white/5 border border-white/15 px-2 py-1 disabled:opacity-50">
        {pipelines.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select value={stageId} onChange={(e) => onStageChange(e.target.value)}
        disabled={pending || stages.length === 0}
        className="text-xs rounded bg-white/5 border border-white/15 px-2 py-1 disabled:opacity-50">
        {stages.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {pending && <span className="text-[10px] text-white/40">…</span>}
      {saved && !pending && <span className="text-[10px] text-emerald-300">✓</span>}
      {error && <span className="text-[10px] text-rose-300" title={error}>✗</span>}
    </div>
  );
}
