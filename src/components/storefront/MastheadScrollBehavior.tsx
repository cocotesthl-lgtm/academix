'use client';

import { useEffect } from 'react';

/**
 * Cliente-side effect que agrega `data-scrolled="true"` al header
 * data-storefront-header cuando el usuario scrollea más allá de un
 * threshold. El CSS del layout usa ese atributo para:
 *   - Mostrar el nav de categorías DENTRO del dark bar (inline con el logo)
 *   - Ocultar la barra blanca sticky de categorías separada
 *
 * Look The Times: al scrollear las categorías se "meten" arriba y todo
 * queda condensado en una sola fila oscura pegada al top.
 *
 * Sin JS (SSR / usuarios con JS off) el nav sticky separado sigue
 * funcionando como fallback — no se rompe nada, solo se pierde la
 * animación de merge.
 */
export function MastheadScrollBehavior({ threshold = 180 }: { threshold?: number }) {
  useEffect(() => {
    const header = document.querySelector('[data-storefront-header]') as HTMLElement | null;
    if (!header) return;
    let raf = 0;
    let last = -1;
    function apply(scrolled: boolean) {
      if (!header) return;
      header.dataset.scrolled = scrolled ? 'true' : 'false';
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const scrolled = window.scrollY > threshold ? 1 : 0;
        if (scrolled !== last) {
          last = scrolled;
          apply(scrolled === 1);
        }
      });
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      apply(false);
    };
  }, [threshold]);
  return null;
}
