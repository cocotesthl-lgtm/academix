'use client';

import { useState, useTransition } from 'react';
import {
  createLeadAction, updateLeadAction, deleteLeadAction, moveLeadAction,
  addStageAction, deleteStageAction, updateStageAction, addLeadCommentAction
} from '@/lib/crm/actions';

export type Stage = {
  id: string;
  name: string;
  color: string | null;
  position: number;
  is_won: boolean;
  is_lost: boolean;
};

export type Lead = {
  id: string;
  stage_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  value_cents: number;
  currency: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
};

export type ActivityRow = {
  id: string;
  lead_id: string;
  activity_type: string;
  comment: string | null;
  created_at: string;
};

export function KanbanBoard({
  pipelineId,
  stages,
  leads,
  activitiesByLead
}: {
  pipelineId: string;
  stages: Stage[];
  leads: Lead[];
  activitiesByLead: Record<string, ActivityRow[]>;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeStageForAdd, setActiveStageForAdd] = useState<string | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editingStageId, setEditingStageId] = useState<string | null>(null);

  const leadsByStage: Record<string, Lead[]> = {};
  for (const s of stages) leadsByStage[s.id] = [];
  for (const l of leads) {
    if (leadsByStage[l.stage_id]) leadsByStage[l.stage_id].push(l);
  }

  function fmt(cents: number, cur: string | null) {
    if (!cents) return null;
    return `$ ${(cents / 100).toLocaleString('es-AR')} ${cur ?? 'ARS'}`;
  }

  function onDragStart(e: React.DragEvent, leadId: string) {
    setDraggingId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    if (!draggingId) return;
    const lead = leads.find((l) => l.id === draggingId);
    setDraggingId(null);
    if (!lead || lead.stage_id === stageId) return;
    start(async () => {
      const fd = new FormData();
      fd.set('id', draggingId);
      fd.set('stage_id', stageId);
      await moveLeadAction(fd);
    });
  }

  const totalsByStage: Record<string, number> = {};
  for (const s of stages) {
    totalsByStage[s.id] = (leadsByStage[s.id] ?? []).reduce((sum, l) => sum + (l.value_cents || 0), 0);
  }

  const openLead = openLeadId ? leads.find((l) => l.id === openLeadId) ?? null : null;
  const openLeadActivities = openLeadId ? (activitiesByLead[openLeadId] ?? []) : [];

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageLeads = leadsByStage[stage.id] ?? [];
          const total = totalsByStage[stage.id];
          const isAdding = activeStageForAdd === stage.id;
          const isEditing = editingStageId === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, stage.id)}
              className="flex-shrink-0 w-72 bg-white/[0.02] border border-white/10 rounded-xl p-3 flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-3 gap-2">
                {isEditing ? (
                  <StageEditForm stage={stage} onDone={() => setEditingStageId(null)} />
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: stage.color ?? '#a855f7' }}
                      />
                      <h3 className="font-semibold text-sm truncate">
                        {stage.name}
                        {stage.is_won && <span className="ml-1 text-emerald-400 text-xs">✓</span>}
                        {stage.is_lost && <span className="ml-1 text-rose-400 text-xs">✗</span>}
                      </h3>
                      <span className="text-[10px] text-white/40 flex-shrink-0">{stageLeads.length}</span>
                    </div>
                    <div className="flex gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => setEditingStageId(stage.id)}
                        className="text-[10px] text-white/40 hover:text-white px-1 py-0.5 rounded hover:bg-white/5"
                        title="Editar columna"
                      >✎</button>
                      {!stage.is_won && !stage.is_lost && (
                        <DeleteStageButton stageId={stage.id} stageName={stage.name} leadCount={stageLeads.length} />
                      )}
                    </div>
                  </>
                )}
              </div>

              {total > 0 && (
                <div className="text-[10px] text-white/55 -mt-2 mb-2">{fmt(total, 'ARS')}</div>
              )}

              <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
                {stageLeads.length === 0 && (
                  <div className="text-[10px] text-white/30 text-center py-6 border border-dashed border-white/10 rounded">
                    Sin leads
                  </div>
                )}
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, lead.id)}
                    onClick={() => setOpenLeadId(lead.id)}
                    className={`rounded-lg border border-white/10 bg-[#161616] p-3 cursor-grab active:cursor-grabbing hover:border-white/20 transition ${
                      draggingId === lead.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="font-medium text-sm">{lead.name || 'Sin nombre'}</div>
                    {lead.email && <div className="text-[11px] text-white/55 mt-0.5 truncate">{lead.email}</div>}
                    {lead.phone && <div className="text-[11px] text-white/55 truncate">{lead.phone}</div>}
                    <div className="flex items-center justify-between mt-2">
                      {fmt(lead.value_cents, lead.currency) ? (
                        <span className="text-[11px] font-semibold text-emerald-300">{fmt(lead.value_cents, lead.currency)}</span>
                      ) : <span />}
                      <span className="text-[9px] text-white/40 uppercase">{lead.source}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add lead inline */}
              {isAdding ? (
                <AddLeadInline
                  pipelineId={pipelineId}
                  stageId={stage.id}
                  onDone={() => setActiveStageForAdd(null)}
                />
              ) : (
                <button
                  onClick={() => setActiveStageForAdd(stage.id)}
                  className="mt-2 text-xs text-white/60 hover:text-white border border-dashed border-white/10 hover:border-white/20 rounded-lg py-2 transition"
                >
                  + Agregar lead
                </button>
              )}
            </div>
          );
        })}

        {/* Botón agregar columna */}
        <AddStageColumn pipelineId={pipelineId} />
      </div>

      {pending && (
        <div className="fixed bottom-4 right-4 bg-white text-black text-xs px-3 py-2 rounded shadow-lg z-50">
          Guardando…
        </div>
      )}

      {openLead && (
        <LeadDetailModal
          lead={openLead}
          activities={openLeadActivities}
          stages={stages}
          onClose={() => setOpenLeadId(null)}
        />
      )}
    </>
  );
}

function StageEditForm({ stage, onDone }: { stage: Stage; onDone: () => void }) {
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color ?? '#a855f7');
  const [pending, start] = useTransition();
  return (
    <form
      className="flex items-center gap-1.5 flex-1"
      action={() => start(async () => {
        const fd = new FormData();
        fd.set('id', stage.id); fd.set('name', name); fd.set('color', color);
        await updateStageAction(fd);
        onDone();
      })}
    >
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
        className="w-5 h-5 rounded bg-transparent cursor-pointer" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="flex-1 min-w-0 rounded bg-white/5 border border-white/15 px-2 py-1 text-xs"
      />
      <button type="submit" disabled={pending} className="text-[10px] px-1.5 py-1 rounded bg-white text-black font-semibold">✓</button>
      <button type="button" onClick={onDone} className="text-[10px] px-1.5 py-1 rounded border border-white/20">✕</button>
    </form>
  );
}

function DeleteStageButton({ stageId, stageName, leadCount }: {
  stageId: string; stageName: string; leadCount: number;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      action={() => {
        const msg = leadCount > 0
          ? `⚠️ La columna "${stageName}" tiene ${leadCount} lead(s). Si eliminás se borran también. ¿Continuar?`
          : `¿Eliminar la columna "${stageName}"?`;
        if (!confirm(msg)) return;
        start(async () => {
          const fd = new FormData();
          fd.set('id', stageId);
          await deleteStageAction(fd);
        });
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="text-[10px] text-rose-400 hover:text-rose-300 px-1 py-0.5 rounded hover:bg-rose-500/10"
        title="Eliminar columna"
      >×</button>
    </form>
  );
}

function AddLeadInline({ pipelineId, stageId, onDone }: {
  pipelineId: string; stageId: string; onDone: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-2 space-y-1.5 border border-white/10 rounded-lg p-2 bg-white/[0.02]"
      action={(fd) => {
        const name = String(fd.get('name') ?? '').trim();
        if (!name) return;
        fd.set('pipeline_id', pipelineId);
        fd.set('stage_id', stageId);
        start(async () => {
          await createLeadAction(fd);
          onDone();
        });
      }}
    >
      <input name="name" placeholder="Nombre *" required
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs" autoFocus />
      <input name="email" type="email" placeholder="Email"
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs" />
      <input name="phone" placeholder="Teléfono"
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs" />
      <input name="value_cents" type="number" min={0} placeholder="Valor en centavos (opcional)"
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs" />
      <div className="flex gap-1">
        <button type="submit" disabled={pending}
          className="flex-1 rounded bg-white text-black text-xs font-semibold py-1.5">
          {pending ? '…' : 'Crear'}
        </button>
        <button type="button" onClick={onDone}
          className="rounded border border-white/20 text-xs px-2 py-1.5">✕</button>
      </div>
    </form>
  );
}

function AddStageColumn({ pipelineId }: { pipelineId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex-shrink-0 w-12 hover:w-72 bg-white/[0.02] border border-dashed border-white/10 hover:border-white/20 rounded-xl flex items-center justify-center text-white/40 hover:text-white transition-all"
        title="Agregar columna"
      >+</button>
    );
  }
  return (
    <form
      className="flex-shrink-0 w-72 bg-white/[0.02] border border-white/15 rounded-xl p-3 space-y-2 self-start"
      action={(fd) => start(async () => {
        fd.set('pipeline_id', pipelineId);
        await addStageAction(fd);
        setOpen(false);
      })}
    >
      <h4 className="text-xs font-semibold text-white/80">Nueva columna</h4>
      <input name="name" required placeholder="Ej. Negociando" autoFocus
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-white/55">Color:</label>
        <input name="color" type="color" defaultValue="#a855f7"
          className="w-7 h-7 rounded bg-transparent cursor-pointer" />
      </div>
      <div className="flex gap-1.5">
        <button type="submit" disabled={pending}
          className="flex-1 rounded bg-white text-black text-xs font-semibold py-1.5">
          {pending ? '…' : 'Crear'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="rounded border border-white/20 text-xs px-2 py-1.5">✕</button>
      </div>
    </form>
  );
}

function LeadDetailModal({ lead, activities, stages, onClose }: {
  lead: Lead; activities: ActivityRow[]; stages: Stage[]; onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(lead.name ?? '');
  const [email, setEmail] = useState(lead.email ?? '');
  const [phone, setPhone] = useState(lead.phone ?? '');
  const [valueCents, setValueCents] = useState(String(lead.value_cents || 0));
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [comment, setComment] = useState('');

  const stageById = new Map(stages.map((s) => [s.id, s]));

  function save() {
    start(async () => {
      const fd = new FormData();
      fd.set('id', lead.id);
      fd.set('name', name); fd.set('email', email); fd.set('phone', phone);
      fd.set('value_cents', valueCents); fd.set('notes', notes);
      await updateLeadAction(fd);
      onClose();
    });
  }

  function del() {
    if (!confirm(`¿Eliminar el lead "${name || 'sin nombre'}"?`)) return;
    start(async () => {
      const fd = new FormData();
      fd.set('id', lead.id);
      await deleteLeadAction(fd);
      onClose();
    });
  }

  function postComment() {
    if (!comment.trim()) return;
    start(async () => {
      const fd = new FormData();
      fd.set('lead_id', lead.id);
      fd.set('comment', comment);
      await addLeadCommentAction(fd);
      setComment('');
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-[#0f0f0f] border border-white/15 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Detalle del lead</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-white/55 mb-1">Nombre</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/55 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/55 mb-1">Teléfono</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-white/55 mb-1">Valor estimado (en centavos)</label>
              <input type="number" min={0} value={valueCents} onChange={(e) => setValueCents(e.target.value)}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
              <p className="text-[10px] text-white/40 mt-1">Ej. 50000 = $ 500.00</p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-white/55 mb-1">Notas internas</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-white/10">
            <button onClick={save} disabled={pending}
              className="flex-1 rounded bg-white text-black text-sm font-semibold py-2">
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button onClick={del} disabled={pending}
              className="rounded border border-rose-500/40 text-rose-300 text-sm px-4 py-2 hover:bg-rose-500/10">
              Eliminar
            </button>
          </div>
        </div>

        {/* Actividad */}
        <div className="p-5 border-t border-white/10 space-y-3">
          <h4 className="font-semibold text-sm">💬 Actividad e historial</h4>
          <div className="space-y-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Agregar un comentario interno…"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
            />
            <button onClick={postComment} disabled={pending || !comment.trim()}
              className="rounded bg-white text-black text-xs font-semibold px-3 py-1.5 disabled:opacity-50">
              Publicar comentario
            </button>
          </div>

          {activities.length === 0 ? (
            <p className="text-xs text-white/40 italic">Sin actividad aún.</p>
          ) : (
            <ul className="space-y-2 mt-3">
              {activities.map((a) => (
                <li key={a.id} className="rounded border border-white/10 p-2.5 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium uppercase tracking-wider text-white/60 text-[10px]">
                      {activityLabel(a.activity_type, stageById)}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {new Date(a.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  {a.comment && <p className="text-white/80 whitespace-pre-line">{a.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function activityLabel(type: string, _stageById: Map<string, Stage>): string {
  switch (type) {
    case 'created': return '✨ Lead creado';
    case 'stage_changed': return '➡️ Movido de etapa';
    case 'assigned': return '👤 Asignado';
    case 'comment': return '💬 Comentario';
    case 'edited': return '✎ Editado';
    case 'archived': return '🗄 Archivado';
    default: return type;
  }
}
