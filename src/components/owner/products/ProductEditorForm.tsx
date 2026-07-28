'use client';

import { useEffect, useRef, useState } from 'react';
import { updateProductAction, type PhysicalProduct, type ProductVariant } from '@/lib/products/actions';
import { VariantsBlock } from './VariantsBlock';
import { StockAdjustBlock } from './StockAdjustBlock';
import { VideoUploader } from './VideoUploader';

export function ProductEditorForm({
  product,
  variants,
  categories,
  uploadsEnabled = false,
  planName = null,
  walletsEnabled = false,
  walletCurrency = null,
  walletBonusCents = 0,
  paypalCurrency = null,
  paypalPriceCents = null
}: {
  product: PhysicalProduct;
  variants: ProductVariant[];
  categories: Array<{ id: string; name: string }>;
  /** true si el plan del tenant incluye features.uploads_enabled */
  uploadsEnabled?: boolean;
  planName?: string | null;
  /** App Saldos instalada — habilita el input de bonus wallet. */
  walletsEnabled?: boolean;
  walletCurrency?: { label: string; symbol: string } | null;
  walletBonusCents?: number;
  /** Moneda PayPal del tenant. Null = PayPal no conectado, oculta el input. */
  paypalCurrency?: string | null;
  /** Precio PayPal actual del producto. Null = no seteado. */
  paypalPriceCents?: number | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [gallery, setGallery] = useState<string>(product.gallery.join('\n'));

  useEffect(() => {
    function onSaveAll() {
      formRef.current?.requestSubmit();
    }
    window.addEventListener('cp:save-all', onSaveAll);
    return () => window.removeEventListener('cp:save-all', onSaveAll);
  }, []);

  const hasVariants = variants.length > 0;
  const boundUpdate = updateProductAction.bind(null, product.id);

  return (
    <div className="space-y-6">
      <form ref={formRef} action={boundUpdate} className="space-y-6">
        {/* Título y slug */}
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
          <div>
            <label className="block text-sm mb-1.5 text-white/70">Título</label>
            <input
              name="title"
              defaultValue={product.title}
              required
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-white/70">Slug (URL)</label>
            <input
              name="slug"
              defaultValue={product.slug}
              placeholder="auto"
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/40"
            />
          </div>
        </div>

        {/* Cover + gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5 text-white/70">Foto principal (URL)</label>
            <input
              type="url"
              name="cover_url"
              defaultValue={product.cover_url ?? ''}
              placeholder="https://…"
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
            />
            <p className="text-xs text-white/40 mt-1">📐 Cuadrada o 4:5. Fondo neutro para que resalte el producto.</p>
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-white/70">
              Galería <span className="text-white/40">(una URL por línea, max 12)</span>
            </label>
            <textarea
              name="gallery"
              value={gallery}
              onChange={(e) => setGallery(e.target.value)}
              rows={4}
              placeholder="https://…imagen.jpg&#10;https://youtube.com/watch?v=…&#10;https://…video.mp4"
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/40"
            />
            <p className="text-[10px] text-white/40 mt-1.5 leading-snug">
              🎬 <strong>Soporta videos</strong>: pegá links de YouTube, Vimeo o
              archivos <code>.mp4</code>/<code>.webm</code> — se detectan solos y
              aparecen con ▶ en la galería. El buyer los ve inline o en fullscreen
              al clickear.
            </p>

            {/* Uploader premium — solo aparece si el plan lo permite.
                Sino muestra un card explicando la limitación + CTA upgrade. */}
            <VideoUploader
              uploadsEnabled={uploadsEnabled}
              planName={planName}
              onUploaded={(url) => {
                // Append URL al textarea de galería (new-line safe)
                setGallery((prev) => {
                  const clean = prev.trim();
                  return clean ? `${clean}\n${url}` : url;
                });
              }}
            />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm mb-1.5 text-white/70">Descripción</label>
          <textarea
            name="description"
            defaultValue={product.description ?? ''}
            rows={5}
            placeholder="Detalles del producto, medidas, material, cuidado…"
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
          />
        </div>

        {/* Precio + SKU */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1.5 text-white/70">Precio (en centavos)</label>
            <input
              type="number"
              name="price_cents"
              defaultValue={product.price_cents}
              min={0}
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
            />
            <p className="text-xs text-white/40 mt-1">Ej: 250000 = $2.500 · Moneda: {product.currency}</p>
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-white/70">
              Precio anterior <span className="text-white/40">(opcional, tachado)</span>
            </label>
            <input
              type="number"
              name="compare_at_price_cents"
              defaultValue={product.compare_at_price_cents ?? ''}
              min={0}
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-white/70">
              SKU <span className="text-white/40">(código interno)</span>
            </label>
            <input
              name="sku"
              defaultValue={product.sku ?? ''}
              placeholder="REM-001"
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-white/40"
            />
          </div>
        </div>

        {/* Precio internacional PayPal — gate por PayPal conectado */}
        {paypalCurrency && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/[0.04] p-4 space-y-2">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <label className="text-sm font-semibold text-blue-100 flex items-center gap-1.5">
                🌍 Precio internacional (PayPal — {paypalCurrency})
              </label>
              <span className="text-[10px] text-white/45 uppercase tracking-wider">Opcional</span>
            </div>
            <p className="text-xs text-white/60 leading-snug">
              Monto en {paypalCurrency} que se cobra al buyer que paga por PayPal.
              Si lo dejás vacío, PayPal cobra el precio del producto interpretado como {paypalCurrency}
              (puede quedar sin sentido si el precio está en pesos).
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-white/50 text-sm">{paypalCurrency}</span>
              <input
                name="paypal_price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={paypalPriceCents != null ? (paypalPriceCents / 100).toString() : ''}
                placeholder="15.00"
                className="flex-1 max-w-[200px] rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/40"
              />
            </div>
          </div>
        )}

        {/* Bonus wallet (App Saldos) — gated por moduleKey='wallets' */}
        {walletsEnabled && (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-4 space-y-2">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <label className="text-sm font-semibold text-emerald-100 flex items-center gap-1.5">
                💰 Bonus de saldo al comprar
              </label>
              <span className="text-[10px] text-white/45 uppercase tracking-wider">Opcional</span>
            </div>
            <p className="text-xs text-white/60 leading-snug">
              Al comprar este producto, se acredita este monto en la wallet del buyer
              {walletCurrency ? <> en <strong>{walletCurrency.symbol} {walletCurrency.label}</strong></> : null}.
              Ideal para cashback o retención. <code className="bg-black/40 px-1 rounded">0</code> = sin bonus.
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-white/50 text-sm">{walletCurrency?.symbol ?? '$'}</span>
              <input
                name="wallet_bonus"
                type="number"
                min="0"
                step="1"
                defaultValue={(walletBonusCents / 100).toString()}
                className="flex-1 max-w-[200px] rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/40"
              />
              {walletCurrency && <span className="text-[11px] text-white/45">{walletCurrency.label}</span>}
            </div>
          </div>
        )}

        {/* Stock (solo si no hay variantes) */}
        <div className="rounded-lg border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Inventario</h3>
            {hasVariants && (
              <span className="text-[10px] uppercase tracking-wider text-white/45">
                Stock manejado por variantes
              </span>
            )}
          </div>
          {!hasVariants && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5 text-white/70">Cantidad en stock</label>
                <input
                  type="number"
                  name="stock_qty"
                  defaultValue={product.stock_qty}
                  min={0}
                  className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
                />
              </div>
              <div className="flex items-center gap-3 mt-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    name="track_stock"
                    defaultChecked={product.track_stock}
                  />
                  Controlar stock (destildar = ilimitado)
                </label>
              </div>
            </div>
          )}
          <input type="hidden" name="stock_qty" value={hasVariants ? product.stock_qty : undefined} />
        </div>

        {/* Envío */}
        <div className="rounded-lg border border-white/10 p-4 space-y-3">
          <h3 className="text-sm font-semibold">Envío</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="requires_shipping"
                defaultChecked={product.requires_shipping}
              />
              Requiere envío a domicilio
            </label>
            <div>
              <label className="block text-sm mb-1.5 text-white/70">
                Peso (gramos) <span className="text-white/40">(opcional)</span>
              </label>
              <input
                type="number"
                name="weight_g"
                defaultValue={product.weight_g ?? ''}
                min={0}
                className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
              />
            </div>
          </div>
        </div>

        {/* Categoría */}
        {categories.length > 0 && (
          <div>
            <label className="block text-sm mb-1.5 text-white/70">Categoría</label>
            <select
              name="category_id"
              defaultValue={product.category_id ?? ''}
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
            >
              <option value="">— sin categoría —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Rating / Reseñas (manual — no hay reviews reales) */}
        <div className="rounded-lg border border-white/10 p-4 space-y-3">
          <h3 className="text-sm font-semibold">⭐ Rating y reseñas</h3>
          <p className="text-xs text-white/45">
            Prueba social manual estilo Amazon / MercadoLibre. Dejalo vacío o en 0 si no querés mostrar estrellas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5 text-white/70">
                Puntuación <span className="text-white/40">(0 a 5, ej. 4.3)</span>
              </label>
              <input
                type="number"
                name="rating"
                step="0.1"
                min="0"
                max="5"
                defaultValue={product.rating ?? ''}
                placeholder="4.3"
                className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-white/70">
                Cantidad de reseñas
              </label>
              <input
                type="number"
                name="reviews_count"
                min="0"
                defaultValue={product.reviews_count ?? 0}
                placeholder="5592"
                className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
              />
            </div>
          </div>
        </div>

        {/* Especificaciones — ficha técnica visible en la página de detalle */}
        <div className="rounded-lg border border-white/10 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">📋 Ficha técnica (especificaciones)</h3>
            <p className="text-xs text-white/45 mt-0.5">
              Grid de características estilo MercadoLibre. Un ítem por línea con formato{' '}
              <code className="bg-black/40 px-1 rounded">Etiqueta | Valor</code>. Ejemplo:{' '}
              <code className="bg-black/40 px-1 rounded">Tipo de tensiómetro | De brazo</code>.
              Dejalo vacío para no mostrar el bloque.
            </p>
          </div>
          <textarea
            name="specs"
            defaultValue={(product.specs ?? []).map((s) => `${s.label} | ${s.value}`).join('\n')}
            rows={6}
            placeholder="Tipo de tensiómetro | De brazo&#10;Cantidad de usuarios | 2&#10;Tipos de mediciones | Presión sistólica, diastólica, frecuencia cardíaca&#10;Tipo de inflado | Automático&#10;Cantidad total de memorias | 99"
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/40"
          />
        </div>

        {/* SEO */}
        <div className="rounded-lg border border-white/10 p-4 space-y-3">
          <h3 className="text-sm font-semibold">SEO</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5 text-white/70">
                Título SEO <span className="text-white/40">(50-60 chars)</span>
              </label>
              <input
                name="seo_title"
                defaultValue={product.seo_title ?? ''}
                maxLength={60}
                className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-white/70">
                Descripción SEO <span className="text-white/40">(hasta 160 chars)</span>
              </label>
              <input
                name="seo_description"
                defaultValue={product.seo_description ?? ''}
                maxLength={160}
                className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Bloques separados (fuera del form principal): variants + ajuste de stock */}
      <VariantsBlock productId={product.id} variants={variants} currency={product.currency} />

      {(hasVariants || product.track_stock) && (
        <StockAdjustBlock
          productId={product.id}
          variants={variants}
          productStock={product.stock_qty}
          hasVariants={hasVariants}
        />
      )}
    </div>
  );
}
