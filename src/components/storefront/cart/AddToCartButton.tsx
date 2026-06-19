'use client';

import { useState } from 'react';
import { addToCart, type CartItem } from './CartWidget';

/**
 * Botón "Agregar al carrito" para usar en cards de curso/pack/etc.
 * Solo se monta cuando el tenant tiene cart_enabled=true; sino se renderiza
 * el botón "Comprar ya" tradicional.
 */
export function AddToCartButton({
  tenantId,
  item,
  primary,
  fullWidth = false
}: {
  tenantId: string;
  item: Omit<CartItem, 'qty'>;
  primary: string;
  fullWidth?: boolean;
}) {
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addToCart(tenantId, item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      className={`rounded-md font-semibold text-white shadow hover:shadow-lg transition ${
        fullWidth ? 'w-full py-3 px-4 text-sm' : 'px-4 py-2 text-xs'
      } ${added ? 'animate-pulse' : ''}`}
      style={{ background: added ? '#10b981' : primary }}
    >
      {added ? '✓ Agregado' : '🛒 Agregar al carrito'}
    </button>
  );
}
