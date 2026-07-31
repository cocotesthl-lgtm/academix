'use client';

import { useEffect } from 'react';
import { trackClick } from '@/lib/analytics/client';

/**
 * Listener global de clicks en el storefront. Se monta una sola vez en
 * el layout y captura cualquier click sobre un elemento con `data-cp-track`.
 *
 * Uso desde cualquier componente:
 *   <button data-cp-track="hero-cta-primary">Comprar ahora</button>
 *   <a href="/wa" data-cp-track="footer-whatsapp">WhatsApp</a>
 *
 * El value del data-cp-track es el `label` — usá algo estable/kebab-case.
 * Podés opcionalmente pasar `data-cp-content-kind="course"` para agrupar
 * el click con el catálogo.
 *
 * Fire-and-forget vía sendBeacon → no bloquea navegación, útil para
 * links que rediregen al MP.
 */
export function AutoClickTracker({ tenantId }: { tenantId: string }) {
  useEffect(() => {
    if (!tenantId) return;
    function handleClick(e: MouseEvent) {
      let node = e.target as HTMLElement | null;
      // Subir por el árbol hasta encontrar un ancestro con data-cp-track
      // (necesario para clicks en el <span> hijo de un <button>).
      while (node && node !== document.body) {
        if (node.dataset && node.dataset.cpTrack) {
          const label = node.dataset.cpTrack;
          const kind = node.dataset.cpContentKind as
            | 'physical' | 'course' | 'event' | 'vip' | 'article' | 'paylink' | undefined;
          const productId = node.dataset.cpProductId;
          trackClick(tenantId, label, {
            content_kind: kind,
            product_id: productId || undefined
          });
          return;
        }
        node = node.parentElement;
      }
    }
    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [tenantId]);
  return null;
}
