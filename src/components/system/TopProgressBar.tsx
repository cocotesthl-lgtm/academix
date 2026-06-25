'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Barra de progreso top global (Linear/YouTube-style).
 *
 * Se enciende ante CUALQUIER acción que vaya a navegar / mutar y va a tardar:
 *  - click en cualquier <a> interno (Link o anchor)
 *  - submit de cualquier <form> (Server Actions, route handlers, etc.)
 *  - señal manual via `window.__cpStartProgress()` para useTransition
 *
 * Se apaga cuando el pathname o searchParams cambian (nav completada) o
 * tras un timeout de seguridad de 8s (en caso de que la nav no ocurra).
 *
 * Da feedback INMEDIATO en click — la app deja de sentirse "muerta".
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ──
  function start() {
    setActive(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Failsafe: si nadie nos apaga, cortamos a los 8s.
    timeoutRef.current = setTimeout(() => setActive(false), 8000);
  }
  function stop() {
    setActive(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  // ── Click en <a> interno → encender ──
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;                       // sólo click izquierdo
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // nueva pestaña
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      if (anchor.target === '_blank') return;
      if (anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      // Externo: dejamos que el browser lo maneje sin spinner.
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Mismo path + mismo query: no hay nav.
        if (url.pathname === pathname && url.search === window.location.search) return;
      } catch { /* href relativo no-URL — seguimos */ }
      start();
      // Disparamos también el overlay del área central
      window.dispatchEvent(new CustomEvent('cp:nav-start'));
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [pathname]);

  // ── Submit de cualquier <form> → encender ──
  useEffect(() => {
    function onSubmit(e: SubmitEvent) {
      if (e.defaultPrevented) return;
      const form = e.target as HTMLFormElement;
      if (form.target === '_blank') return;
      // Buttons con `formnovalidate` o tipo button no disparan submit nativo.
      start();
    }
    document.addEventListener('submit', onSubmit, true);
    return () => document.removeEventListener('submit', onSubmit, true);
  }, []);

  // ── API global para useTransition / fetch manuales ──
  useEffect(() => {
    const w = window as unknown as {
      __cpStartProgress?: () => void;
      __cpStopProgress?: () => void;
    };
    w.__cpStartProgress = start;
    w.__cpStopProgress = stop;
    return () => {
      delete w.__cpStartProgress;
      delete w.__cpStopProgress;
    };
  }, []);

  // ── Pathname cambió → nav completada → apagar ──
  useEffect(() => {
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!active) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 9999,
        pointerEvents: 'none', background: 'transparent'
      }}
    >
      <div className="cp-progress-bar" />
    </div>
  );
}
