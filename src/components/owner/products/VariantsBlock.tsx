'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addVariantAction, updateVariantAction, deleteVariantAction, type ProductVariant } from '@/lib/products/actions';

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

export function VariantsBlock({
  productId,
  variants,
  currency
}: {
  productId: string;
  variants: ProductVariant[];
  currency: string;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleAdd(formData: FormData) {
    startTransition(async () => {
      await addVariantAction(productId, formData);
      setShowAdd(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Variantes</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Talles, colores u otras opciones. Cada variante tiene su stock y (opcionalmente) su precio.
          </p>
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/85 hover:bg-white/5"
          >
            + Agregar variante
          </button>
        )}
      </div>

      {variants.length === 0 && !showAdd && (
        <p className="text-xs text-white/40 italic">
          Sin variantes — el stock se maneja a nivel producto. Sumá variantes si vendés talles/colores.
        </p>
      )}

      {variants.length > 0 && (
        <div className="divide-y divide-white/5">
          {variants.map((v) => (
            <VariantRow key={v.id} variant={v} currency={currency} />
          ))}
        </div>
      )}

      {showAdd && (
        <form action={handleAdd} className="rounded border border-white/15 bg-white/[0.02] p-3 space-y-2">
          {/* Axis de la variante: color/talle/sabor/custom — determina el header
              en el buy box ("Color:", "Talle:", "Sabor:", etc). */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1">
              Tipo de variante
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { v: 'color', label: 'Color' },
                { v: 'talle', label: 'Talle' },
                { v: 'sabor', label: 'Sabor' },
                { v: 'material', label: 'Material' },
                { v: '', label: 'Otra (personalizada)' }
              ].map((opt) => (
                <label key={opt.v} className="text-xs cursor-pointer px-2.5 py-1 rounded border border-white/15 has-[:checked]:border-white has-[:checked]:bg-white/10">
                  <input type="radio" name="option_key" value={opt.v} defaultChecked={opt.v === 'color'} className="hidden peer" />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-1">
              Determina el header en el buy box ("Color:", "Talle:", "Sabor:", etc.).
              "Otra" te deja escribir el label como texto libre en el input de abajo.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input
              name="name" placeholder="Valor (ej. Rojo, XL, Chocolate)" required
              className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
            />
            <input
              name="sku" placeholder="SKU (opcional)"
              className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-white/40"
            />
            <input
              type="number" name="stock_qty" placeholder="Stock" required min={0} defaultValue={0}
              className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
            />
            <input
              type="number" name="price_cents" placeholder="Precio (opc, en cents)" min={0}
              className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
            />
          </div>
          <input
            type="url" name="image_url" placeholder="Foto principal de esta variante (URL, opcional)"
            className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
          />
          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2">
            <div className="flex items-center gap-2">
              <input
                type="color" name="swatch_color" defaultValue="#000000"
                title="Color del chip (opcional)"
                className="w-9 h-9 rounded border border-white/15 bg-transparent cursor-pointer"
              />
              <span className="text-[10px] text-white/45">chip</span>
            </div>
            <input
              type="url" name="swatch_image_url" placeholder="… o URL de imagen para el chip"
              className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
            />
          </div>
          <textarea
            name="gallery" rows={2}
            placeholder="Galería específica de esta variante — una URL por línea (opcional). Reemplaza la galería del producto cuando se selecciona."
            className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-white/40"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="text-xs px-3 py-1.5 rounded bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50">
              {pending ? 'Guardando…' : 'Guardar variante'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/60 hover:bg-white/5">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function VariantRow({ variant, currency }: { variant: ProductVariant; currency: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleUpdate(formData: FormData) {
    startTransition(async () => {
      await updateVariantAction(variant.id, formData);
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar variante "${variant.name}"?`)) return;
    startTransition(async () => {
      await deleteVariantAction(variant.id);
      router.refresh();
    });
  }

  const lowStock = variant.stock_qty <= 3;

  if (editing) {
    return (
      <form action={handleUpdate} className="py-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { v: 'color', label: 'Color' },
            { v: 'talle', label: 'Talle' },
            { v: 'sabor', label: 'Sabor' },
            { v: 'material', label: 'Material' },
            { v: '', label: 'Otra' }
          ].map((opt) => {
            const current = variant.option_key ?? 'color';
            return (
              <label key={opt.v} className="text-xs cursor-pointer px-2.5 py-1 rounded border border-white/15 has-[:checked]:border-white has-[:checked]:bg-white/10">
                <input type="radio" name="option_key" value={opt.v}
                  defaultChecked={opt.v === current} className="hidden peer" />
                {opt.label}
              </label>
            );
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input name="name" defaultValue={variant.name} required
            placeholder="Valor (Rojo, XL, Chocolate)"
            className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
          <input name="sku" defaultValue={variant.sku ?? ''} placeholder="SKU"
            className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-white/40" />
          <input type="number" name="stock_qty" defaultValue={variant.stock_qty} required min={0}
            className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
          <input type="number" name="price_cents" defaultValue={variant.price_cents ?? ''} placeholder="Precio (opc)" min={0}
            className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
        </div>
        <input type="url" name="image_url" defaultValue={variant.image_url ?? ''} placeholder="Foto principal (URL, opc)"
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2">
          <div className="flex items-center gap-2">
            <input type="color" name="swatch_color"
              defaultValue={variant.swatch_color ?? '#000000'}
              className="w-9 h-9 rounded border border-white/15 bg-transparent cursor-pointer" />
            <span className="text-[10px] text-white/45">chip</span>
          </div>
          <input type="url" name="swatch_image_url" defaultValue={variant.swatch_image_url ?? ''}
            placeholder="… o URL de imagen para el chip"
            className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
        </div>
        <textarea name="gallery" rows={2}
          defaultValue={(variant.gallery ?? []).join('\n')}
          placeholder="Galería específica (URL por línea, opc)"
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-white/40" />
        <div className="flex gap-2">
          <button type="submit" disabled={pending}
            className="text-xs px-3 py-1.5 rounded bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50">
            Guardar
          </button>
          <button type="button" onClick={() => setEditing(false)}
            className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/60 hover:bg-white/5">
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex items-center gap-1.5 shrink-0">
        {(variant.swatch_color || variant.swatch_image_url) && (
          <span
            title="Chip"
            className="w-6 h-6 rounded-full border border-white/20 shrink-0"
            style={{
              background: variant.swatch_image_url
                ? `url(${variant.swatch_image_url}) center/cover`
                : (variant.swatch_color ?? undefined)
            }}
          />
        )}
        <div className="w-10 h-10 rounded bg-white/5 overflow-hidden shrink-0">
          {variant.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={variant.image_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{variant.name}</div>
        <div className="text-[11px] text-white/45 flex items-center gap-2 mt-0.5">
          {variant.sku && <span className="font-mono">{variant.sku}</span>}
          <span className={lowStock ? 'text-amber-300' : ''}>{variant.stock_qty} en stock</span>
          {variant.price_cents != null && (
            <span>· {formatMoney(variant.price_cents, currency)}</span>
          )}
        </div>
      </div>
      <button type="button" onClick={() => setEditing(true)}
        className="text-xs px-2.5 py-1 rounded border border-white/15 text-white/70 hover:bg-white/5">
        Editar
      </button>
      <button type="button" onClick={handleDelete} disabled={pending}
        className="text-xs px-2.5 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50">
        {pending ? '…' : '×'}
      </button>
    </div>
  );
}
