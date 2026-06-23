'use client';

/**
 * Helper global de "guardando / guardado" para mostrar feedback en la sidebar.
 * Cualquier componente cliente puede llamar signalSaving() / signalSaved()
 * y la <SaveStatusBar /> los refleja.
 *
 * Implementación con eventos custom en window → sin React context ni props,
 * funciona desde cualquier lado del árbol (incluso server components que
 * envuelven client islands).
 */

type SaveEvent = { kind: 'saving' | 'saved' | 'error'; message?: string };

export const SAVE_EVENT = 'curplat-save-status';

export function signalSaving(message?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SaveEvent>(SAVE_EVENT, {
    detail: { kind: 'saving', message }
  }));
}

export function signalSaved(message?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SaveEvent>(SAVE_EVENT, {
    detail: { kind: 'saved', message }
  }));
}

export function signalSaveError(message?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SaveEvent>(SAVE_EVENT, {
    detail: { kind: 'error', message }
  }));
}

/**
 * Wrapper conveniente para auto-save: dispara 'saving' antes, 'saved' al
 * éxito, 'error' si tira. Devuelve el valor original.
 */
export async function withSaveStatus<T>(fn: () => Promise<T>, opts?: {
  saving?: string; saved?: string;
}): Promise<T> {
  signalSaving(opts?.saving);
  try {
    const r = await fn();
    signalSaved(opts?.saved);
    return r;
  } catch (e) {
    signalSaveError(e instanceof Error ? e.message : 'Error guardando');
    throw e;
  }
}
