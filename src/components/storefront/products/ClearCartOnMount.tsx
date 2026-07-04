'use client';

import { useEffect } from 'react';

/**
 * Al cargar la página de gracias, vaciamos los items físicos del carrito
 * — el pago está en manos de MP. Si estaba pendiente y falla, el usuario
 * puede volver a agregar productos. Los cursos NO se tocan (kind !== 'physical').
 */
export function ClearCartOnMount({ tenantId }: { tenantId: string }) {
  useEffect(() => {
    const key = `curplat_cart_${tenantId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = JSON.parse(raw) as any[];
      const filtered = items.filter((i) => i?.kind !== 'physical');
      localStorage.setItem(key, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('curplat-cart-changed', { detail: { tenantId } }));
    } catch { /* ignore */ }
  }, [tenantId]);
  return null;
}
