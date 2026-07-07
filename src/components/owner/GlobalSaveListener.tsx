'use client';

import { useEffect, useRef } from 'react';
import { signalSaving, signalSaved } from '@/lib/ui/save-status';

/**
 * Detector global de "guardado". Mira:
 *  1. submit de <form> con acción explícita a URL (endpoint /api/*)
 *  2. fetch/XHR mutantes a /api/*
 *
 * IMPORTANTE — NO trackeamos server actions de Next.js.
 * Los server actions (React 19) hacen POST al mismo URL de la página con
 * header 'Next-Action'. Si los trackeamos acá, cada autosave en el site
 * editor dispara un ciclo guardando→guardado en la sidebar, y como el
 * toolbar del editor YA muestra su propio estado, quedaban dos indicadores
 * flickeando en paralelo (parecía un loop infinito de "guardando/guardado"
 * al usuario). Los saves de server actions se muestran en el toolbar del
 * editor correspondiente — no acá.
 *
 * Fallback: si algún componente quiere feedback global explícito, puede
 * llamar directamente a signalSaving/signalSaved (via withSaveStatus).
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

    /** Chequea si el request es un server action de Next.js. */
    function isServerAction(init?: RequestInit): boolean {
      if (!init?.headers) return false;
      const h = init.headers;
      if (h instanceof Headers) return h.has('next-action');
      if (Array.isArray(h)) return h.some(([k]) => k.toLowerCase() === 'next-action');
      if (typeof h === 'object') {
        return Object.keys(h as Record<string, string>).some((k) => k.toLowerCase() === 'next-action');
      }
      return false;
    }

    // ─── 1. Forms: solo submits con action a /api/* (server actions no
    //           usan action URL — usan React 19 useActionState) ───
    function onSubmit(e: Event) {
      const form = e.target as HTMLFormElement | null;
      if (!form || form.tagName !== 'FORM') return;
      const method = (form.getAttribute('method') ?? 'post').toLowerCase();
      if (method === 'get') return;
      const action = form.getAttribute('action') ?? '';
      if (!action || /^(mailto|tel|javascript):/i.test(action)) return;
      // Solo trackear submits con action que apunte a /api/* — los form
      // actions de server actions no tienen atributo action explícito.
      if (!action.includes('/api/')) return;

      pushSaving();
      const timeout = setTimeout(() => popSaving(), 8000);
      const tick = setTimeout(() => { clearTimeout(timeout); popSaving(); }, 1200);
      void tick;
    }
    document.addEventListener('submit', onSubmit, true);

    // ─── 2. fetch: solo POST/PATCH/PUT/DELETE a /api/* ───
    const origFetch = window.fetch;
    window.fetch = async function patchedFetch(...args: Parameters<typeof fetch>) {
      const [input, init] = args;
      const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
      const url = typeof input === 'string' ? input
        : input instanceof URL ? input.href
        : (input as Request).url;
      const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      const isApiCall = url.includes('/api/');
      const isServerActionCall = isServerAction(init);
      // Solo tracear API mutations reales — NO server actions ni RSC payloads
      const shouldTrack = isMutating && isApiCall && !isServerActionCall;
      if (shouldTrack) {
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
