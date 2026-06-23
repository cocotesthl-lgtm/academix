'use client';

import { useEffect, useState } from 'react';
import { SAVE_EVENT } from '@/lib/ui/save-status';

type Status =
  | { kind: 'idle' }
  | { kind: 'saving'; message?: string }
  | { kind: 'saved'; message?: string }
  | { kind: 'error'; message?: string };

/**
 * Barra de estado de guardado en la sidebar. Escucha eventos custom
 * 'curplat-save-status' (dispatched por lib/ui/save-status helpers).
 *
 * Estados:
 *  - idle: oculta (no quita altura ni ocupa visualmente)
 *  - saving: pulse + spinner
 *  - saved: check verde, vuelve a idle en 2s
 *  - error: aviso rojo, vuelve a idle en 4s
 */
export function SaveStatusBar() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ kind: Status['kind']; message?: string }>;
      const next = ce.detail;
      if (!next) return;
      if (next.kind === 'saving') {
        setStatus({ kind: 'saving', message: next.message });
      } else if (next.kind === 'saved') {
        setStatus({ kind: 'saved', message: next.message });
        setTimeout(() => {
          setStatus((s) => (s.kind === 'saved' ? { kind: 'idle' } : s));
        }, 2000);
      } else if (next.kind === 'error') {
        setStatus({ kind: 'error', message: next.message });
        setTimeout(() => {
          setStatus((s) => (s.kind === 'error' ? { kind: 'idle' } : s));
        }, 4000);
      }
    };
    window.addEventListener(SAVE_EVENT, handler);
    return () => window.removeEventListener(SAVE_EVENT, handler);
  }, []);

  if (status.kind === 'idle') return null;

  const config = {
    saving: { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', text: 'text-fuchsia-200', icon: '⟳', label: 'Guardando…' },
    saved:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-200', icon: '✓', label: 'Guardado' },
    error:  { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-200', icon: '⚠', label: 'Error al guardar' }
  }[status.kind];

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs ${config.bg} ${config.border} ${config.text}`}>
      <span className={status.kind === 'saving' ? 'inline-block animate-spin' : ''}>
        {config.icon}
      </span>
      <span className="flex-1 truncate">{status.message ?? config.label}</span>
    </div>
  );
}
