'use client';

import { useEffect, useRef } from 'react';
import { signalSaving, signalSaved } from '@/lib/ui/save-status';

/**
 * Detector global de "guardado". Mira:
 *  1. submit de CUALQUIER <form> en la página (server action, action URL, etc.)
 *  2. fetch/XHR a /api/* o a server actions internas
 *
 * Cuando arranca un save → signalSaving(). Cuando termina → signalSaved().
 * Así el SaveStatusBar refleja cualquier auto-save o submit sin tocar
 * cada componente individualmente.
 *
 * Heurísticas para evitar ruido:
 * - Forms con method=GET son ignorados (buscadores, etc.)
 * - Forms con action que apunta a un mailto/tel/javascript son ignorados
 * - Si después de 8s no terminó, asumimos saved (failsafe)
 */
export function GlobalSaveListener() {
  const inFlight = useRef(0);

  useEffect(() => {
    function pushSaving() {
      inFlight.current += 1;
      if (inFlight.current === 1) signalSaving();
    }
    function popSaving() {
      inFlight.current = Math.max(0, inFlight.current - 1);
      if (inFlight.current === 0) signalSaved();
    }

    // ─── 1. Forms: capturar submits ───
    function onSubmit(e: Event) {
      const form = e.target as HTMLFormElement | null;
      if (!form || form.tagName !== 'FORM') return;
      const method = (form.getAttribute('method') ?? 'post').toLowerCase();
      if (method === 'get') return;
      const action = form.getAttribute('action') ?? '';
      if (/^(mailto|tel|javascript):/i.test(action)) return;

      pushSaving();
      // Failsafe: si no detectamos el "fin" via fetch ni nav en 8s, marcar saved.
      const timeout = setTimeout(() => popSaving(), 8000);
      // En server actions / form posts el resultado dispara una re-render del RSC.
      // Como heurística, marcamos saved al próximo tick "calmo" (1.2s sin fetch).
      const tick = setTimeout(() => { clearTimeout(timeout); popSaving(); }, 1200);
      void tick;
    }
    document.addEventListener('submit', onSubmit, true);

    // ─── 2. fetch: capturar requests POST/PATCH/PUT/DELETE ───
    const origFetch = window.fetch;
    window.fetch = async function patchedFetch(...args: Parameters<typeof fetch>) {
      const [input, init] = args;
      const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
      const url = typeof input === 'string' ? input
        : input instanceof URL ? input.href
        : (input as Request).url;
      const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      // Evitamos ruido de telemetría/RSC payload requests
      const ignore = url.includes('/_next/') || url.includes('vercel-insights') || url.includes('/__nextjs_');
      if (isMutating && !ignore) {
        pushSaving();
        try {
          return await origFetch.apply(this, args);
        } finally {
          popSaving();
        }
      }
      return origFetch.apply(this, args);
    };

    return () => {
      document.removeEventListener('submit', onSubmit, true);
      window.fetch = origFetch;
    };
  }, []);

  return null;
}
