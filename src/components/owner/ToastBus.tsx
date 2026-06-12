'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

/**
 * Toast notifications system para feedback no-bloqueante.
 *
 * Dispara desde cualquier client component:
 *   showToast('Guardado', 'success')
 *
 * Server actions que redirigen pueden agregar ?toast=msg&tone=success
 * a la URL — el bus lo detecta, lo muestra, y limpia los params.
 *
 * Renderizado en bottom-right desktop, bottom-center mobile.
 * Auto-dismiss en 3s, stackeable, click-to-dismiss antes.
 */

type Tone = 'success' | 'error' | 'info';
type Toast = { id: number; msg: string; tone: Tone };

let nextId = 1;

export function ToastBus() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Eventos window — primary API para client code
  useEffect(() => {
    function onShow(e: Event) {
      const detail = (e as CustomEvent<{ msg: string; tone?: Tone; timeout?: number }>).detail;
      if (!detail?.msg) return;
      const id = nextId++;
      const tone = detail.tone ?? 'success';
      setToasts((prev) => [...prev, { id, msg: detail.msg, tone }]);
      window.setTimeout(() => dismiss(id), detail.timeout ?? 3000);
    }
    window.addEventListener('show-toast', onShow);
    return () => window.removeEventListener('show-toast', onShow);
  }, [dismiss]);

  // URL params — para feedback post-redirect de server actions
  useEffect(() => {
    if (!searchParams) return;
    const msg = searchParams.get('toast');
    const toneRaw = searchParams.get('tone');
    if (!msg) return;
    const tone: Tone = toneRaw === 'error' ? 'error' : toneRaw === 'info' ? 'info' : 'success';
    const id = nextId++;
    setToasts((prev) => [...prev, { id, msg, tone }]);
    window.setTimeout(() => dismiss(id), 3000);
    // Limpiar URL para que el toast no se re-muestre en re-renders
    const url = new URL(window.location.href);
    url.searchParams.delete('toast');
    url.searchParams.delete('tone');
    router.replace(url.pathname + (url.search || ''), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed z-[200] flex flex-col gap-2 pointer-events-none
      bottom-4 left-4 right-4 items-center
      sm:bottom-4 sm:right-4 sm:left-auto sm:items-end">
      {toasts.map((t) => {
        const cls = t.tone === 'success'
          ? 'bg-emerald-500 text-emerald-950'
          : t.tone === 'error'
            ? 'bg-rose-500 text-white'
            : 'bg-sky-500 text-white';
        const icon = t.tone === 'success' ? '✓' : t.tone === 'error' ? '✗' : 'ℹ';
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto rounded-lg px-4 py-2.5 shadow-xl font-medium text-sm
              max-w-md w-full sm:w-auto flex items-center gap-2
              animate-[slideIn_0.2s_ease-out] ${cls}`}
            title="Click para cerrar"
          >
            <span className="text-base">{icon}</span>
            <span className="flex-1 text-left">{t.msg}</span>
          </button>
        );
      })}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideIn {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}} />
    </div>
  );
}

/**
 * Helper para disparar un toast desde cualquier client component.
 * Si se llama en SSR no hace nada (defensivo).
 */
export function showToast(msg: string, tone: Tone = 'success', timeout = 3000): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { msg, tone, timeout } }));
}
