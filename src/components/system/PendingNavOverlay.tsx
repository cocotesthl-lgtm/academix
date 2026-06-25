'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Overlay de loading que se muestra MIENTRAS navegás de una página a otra.
 *
 * - Se enciende vía CustomEvent 'cp:nav-start' (lo dispara el sidebar al click)
 * - Se apaga apenas cambia el pathname (nav completada) o failsafe 8s
 *
 * No depende de Next.js loading.tsx (que no siempre dispara visiblemente).
 * Es 100% client-side, sincrónico, garantizado.
 *
 * Cubre solo el área `<main>` para no tapar la sidebar — los selectores
 * habituales son 'main', '[role="main"]', o fallback al body.
 */
export function PendingNavOverlay() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  // Encender vía evento custom (el sidebar lo dispara)
  useEffect(() => {
    function onStart() { setActive(true); }
    window.addEventListener('cp:nav-start', onStart);
    return () => window.removeEventListener('cp:nav-start', onStart);
  }, []);

  // Apagar cuando el pathname cambia
  useEffect(() => { setActive(false); }, [pathname]);

  // Failsafe — si la nav tarda mucho, igual lo apagamos a los 8s
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 8000);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 50,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Solo cubrimos el área a la derecha de la sidebar.
        // Las sidebars en este proyecto miden ~16rem (w-60/w-64).
        paddingLeft: 'var(--cp-sidebar-w, 16rem)',
        background: 'rgba(10, 10, 10, 0.35)',
        backdropFilter: 'blur(2px)',
        transition: 'opacity 120ms ease-out'
      }}
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: '50%',
          border: '4px solid rgba(255,255,255,0.18)',
          borderTopColor: '#34d399',
          animation: 'cp-spin 700ms linear infinite'
        }}
      />
    </div>
  );
}
