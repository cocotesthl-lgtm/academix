'use client';

import { useState, useTransition } from 'react';
import { setStageApproversAction } from '@/lib/crm/actions';
import type { TeamMember } from './KanbanBoard';

/**
 * Popover para configurar aprobadores de una etapa. El owner (o admin)
 * marca miembros del equipo con checkbox — sólo esos podrán mover leads
 * HACIA esta etapa. Vacío = cualquiera puede (default).
 *
 * Usa <details> nativo para el toggle open/close — sin state global.
 */
export function StageApproversPopover({
  stageId, stageName, team, initialApprovers
}: {
  stageId: string;
  stageName: string;
  team: TeamMember[];
  initialApprovers: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialApprovers));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const isGated = selected.size > 0;

  function toggle(userId: string) {
    setSaved(false);
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    setSelected(next);
  }

  function save() {
    start(async () => {
      const fd = new FormData();
      fd.set('stage_id', stageId);
      fd.set('approver_user_ids', Array.from(selected).join(','));
      await setStageApproversAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <details className="relative">
      <summary
        title={isGated
          ? `Sólo ${selected.size} miembro${selected.size === 1 ? '' : 's'} puede${selected.size === 1 ? '' : 'n'} admitir leads acá`
          : 'Restringir quién puede admitir leads en esta etapa'}
        className={`list-none cursor-pointer text-[10px] px-1 py-0.5 rounded hover:bg-white/5 ${
          isGated ? 'text-amber-400' : 'text-white/40 hover:text-white'
        }`}
      >
        {isGated ? '🔒' : '🔓'}
      </summary>
      <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-xl border border-white/15 bg-[#111] p-3 shadow-2xl">
        <div className="text-xs font-semibold mb-1">Aprobadores de "{stageName}"</div>
        <p className="text-[10px] text-white/50 mb-2">
          Sólo los marcados pueden mover leads a esta etapa. Sin nadie marcado, cualquier miembro puede.
        </p>
        {team.length === 0 ? (
          <p className="text-[11px] text-white/40 py-2">Sin miembros en el equipo todavía.</p>
        ) : (
          <div className="space-y-1 max-h-56 overflow-y-auto -mx-1 px-1">
            {team.map((m) => {
              const label = m.display_name || m.email || m.user_id.slice(0, 8);
              return (
                <label key={m.user_id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/5 rounded px-1.5 py-1">
                  <input type="checkbox" checked={selected.has(m.user_id)}
                    onChange={() => toggle(m.user_id)}
                    className="w-3.5 h-3.5" />
                  <span className="truncate flex-1">{label}</span>
                  <span className="text-[9px] uppercase tracking-wider text-white/40">{m.role}</span>
                </label>
              );
            })}
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
          {selected.size > 0 && (
            <button type="button" onClick={() => { setSelected(new Set()); setSaved(false); }}
              className="text-[10px] text-white/50 hover:text-white">
              Quitar restricción
            </button>
          )}
          <button type="button" onClick={save} disabled={pending}
            className="ml-auto text-xs rounded bg-white text-black px-3 py-1 font-semibold disabled:opacity-50">
            {pending ? '…' : saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>
    </details>
  );
}
