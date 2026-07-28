'use client';

import { useMemo, useState } from 'react';
import type { PhysicalProduct, ProductVariant } from '@/lib/products/actions';
import { ProductGallery } from './ProductGallery';
import { ProductBuyBox } from './ProductBuyBox';

/**
 * Wrapper client que comparte la variante seleccionada entre el ProductBuyBox
 * (donde el buyer clickea los swatches de color/talle) y la ProductGallery
 * (que muestra la galería específica de la variante cuando existe).
 *
 * Comportamiento:
 *  - Sin variantes             → galería del producto, buy box sin selector.
 *  - Con variantes             → arranca en la primera con stock. Al cambiar,
 *    si la variante tiene `gallery`, se muestra esa (con su image_url como
 *    cover). Sino cae a la galería del producto.
 */
export function ProductDetailInteractive({
  tenantId,
  product,
  variants,
  walletBonus = null,
  extras
}: {
  tenantId: string;
  product: PhysicalProduct;
  variants: ProductVariant[];
  walletBonus?: { cents: number; symbol: string; label: string; logoUrl?: string | null } | null;
  /** Slot debajo del buy box (rating, description, sku, etc). Server-rendered. */
  extras?: React.ReactNode;
}) {
  const hasVariants = variants.length > 0;
  const initialId = hasVariants
    ? (variants.find((v) => v.stock_qty > 0)?.id ?? variants[0].id)
    : '';
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const current = useMemo(
    () => variants.find((v) => v.id === selectedId) ?? null,
    [variants, selectedId]
  );

  // Cover + galería activos: si la variante trae su propia galería la usamos;
  // sino usamos la del producto. El cover se sobreescribe con image_url de la
  // variante (fallback a la del producto) siempre — para que aunque no haya
  // gallery-por-variante, el "foto principal" refleje la selección.
  const activeCover = current?.image_url ?? product.cover_url;
  const activeGallery = (current?.gallery && current.gallery.length > 0)
    ? current.gallery
    : product.gallery;

  return (
    <div className="mt-6 grid md:grid-cols-2 gap-10">
      <ProductGallery
        cover={activeCover}
        gallery={activeGallery}
        title={product.title}
      />
      <div>
        {extras}
        <ProductBuyBox
          tenantId={tenantId}
          product={product}
          variants={variants}
          walletBonus={walletBonus}
          selectedVariantId={selectedId}
          onSelectVariant={setSelectedId}
        />
      </div>
    </div>
  );
}
