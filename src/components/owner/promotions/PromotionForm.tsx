'use client';

import { useState } from 'react';
import {
  PROMOTION_TYPE_DESC, PROMOTION_TYPE_EMOJI, PROMOTION_TYPE_LABEL,
  type Promotion, type PromotionScope, type PromotionType
} from '@/lib/promotions/types';

type Category = { id: string; name: string };
type ProductLite = { id: string; title: string };

type Props = {
  action: (formData: FormData) => Promise<void>;
  promotion?: Promotion | null;
  categories: Category[];
  products: ProductLite[];
  isEdit?: boolean;
};

const TYPES: PromotionType[] = ['nx_pay_m', 'qty_percent', 'min_amount_free_shipping', 'min_amount_percent'];

export function PromotionForm({ action, promotion, categories, products, isEdit = false }: Props) {
  const [type, setType] = useState<PromotionType>(promotion?.type ?? 'nx_pay_m');
  const [scope, setScope] = useState<PromotionScope>(promotion?.scope ?? 'all');
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(
    new Set(promotion?.target_ids ?? [])
  );

  function toggleTarget(id: string) {
    setSelectedTargets((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-6 max-w-3xl">
      {promotion?.id && <input type="hidden" name="id" value={promotion.id} />}

      {/* Tipo (grid de tarjetas) */}
      <div>
        <label className="block text-sm mb-2 text-white/75 font-semibold">Tipo de promoción</label>
        <div className="grid sm:grid-cols-2 gap-2">
          {TYPES.map((t) => {
            const active = type === t;
            return (
              <label key={t}
                className={`cursor-pointer rounded-lg border p-3 transition ${
                  active
                    ? 'border-white bg-white/10 ring-1 ring-white/30'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                }`}>
                <input type="radio" name="type" value={t} checked={active}
                  onChange={() => setType(t)} className="sr-only" />
                <div className="flex items-start gap-2">
                  <span className="text-xl leading-none mt-0.5">{PROMOTION_TYPE_EMOJI[t]}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{PROMOTION_TYPE_LABEL[t]}</div>
                    <p className="text-[11px] text-white/50 mt-0.5 leading-snug">
                      {PROMOTION_TYPE_DESC[t]}
                    </p>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Título */}
      <div>
        <label className="block text-sm mb-1.5 text-white/75">Título</label>
        <input name="title" required maxLength={120}
          defaultValue={promotion?.title ?? ''}
          placeholder={titlePlaceholder(type)}
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5" />
      </div>

      {/* Parámetros por tipo */}
      {type === 'nx_pay_m' && (
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="block text-sm mb-1.5 text-white/75">Cantidad a llevar</label>
            <input type="number" name="buy_qty" min="2" max="20" required
              defaultValue={promotion?.buy_qty ?? 3}
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5" />
            <p className="text-[10px] text-white/40 mt-1">Ej: en 3x2, llevás 3.</p>
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-white/75">Cantidad a pagar</label>
            <input type="number" name="pay_qty" min="1" max="19" required
              defaultValue={promotion?.pay_qty ?? 2}
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5" />
            <p className="text-[10px] text-white/40 mt-1">Ej: en 3x2, pagás 2.</p>
          </div>
        </div>
      )}

      {type === 'qty_percent' && (
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="block text-sm mb-1.5 text-white/75">Cantidad mínima</label>
            <input type="number" name="min_qty" min="2" max="100" required
              defaultValue={promotion?.min_qty ?? 3}
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5" />
            <p className="text-[10px] text-white/40 mt-1">Unidades del scope necesarias.</p>
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-white/75">% off</label>
            <input type="number" name="discount_percent" min="1" max="90" required
              defaultValue={promotion?.discount_percent ?? 10}
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5" />
          </div>
        </div>
      )}

      {(type === 'min_amount_free_shipping' || type === 'min_amount_percent') && (
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="block text-sm mb-1.5 text-white/75">Monto mínimo (pesos)</label>
            <input type="number" name="min_amount" min="1" required
              defaultValue={promotion?.min_amount_cents ? Math.floor(promotion.min_amount_cents / 100) : 80000}
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5" />
          </div>
          {type === 'min_amount_percent' && (
            <div>
              <label className="block text-sm mb-1.5 text-white/75">% off</label>
              <input type="number" name="discount_percent" min="1" max="90" required
                defaultValue={promotion?.discount_percent ?? 15}
                className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5" />
            </div>
          )}
        </div>
      )}

      {/* Scope — sobre qué se aplica */}
      {type !== 'min_amount_free_shipping' && (
        <div>
          <label className="block text-sm mb-2 text-white/75 font-semibold">Aplica a</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(['all', 'category', 'products'] as PromotionScope[]).map((s) => (
              <label key={s}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold ${
                  scope === s ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}>
                <input type="radio" name="scope" value={s} checked={scope === s}
                  onChange={() => setScope(s)} className="sr-only" />
                {s === 'all' ? 'Todo el catálogo' : s === 'category' ? 'Categorías específicas' : 'Productos específicos'}
              </label>
            ))}
          </div>

          {scope === 'category' && (
            <div className="rounded-lg border border-white/10 p-3 max-h-56 overflow-y-auto space-y-1">
              {categories.length === 0 ? (
                <p className="text-xs text-white/40">No hay categorías. Creá alguna en /owner/categories.</p>
              ) : categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 py-1">
                  <input type="checkbox" name="target_ids" value={c.id}
                    checked={selectedTargets.has(c.id)}
                    onChange={() => toggleTarget(c.id)} />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
            </div>
          )}

          {scope === 'products' && (
            <div className="rounded-lg border border-white/10 p-3 max-h-56 overflow-y-auto space-y-1">
              {products.length === 0 ? (
                <p className="text-xs text-white/40">No hay productos. Creá alguno en /owner/products.</p>
              ) : products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 py-1">
                  <input type="checkbox" name="target_ids" value={p.id}
                    checked={selectedTargets.has(p.id)}
                    onChange={() => toggleTarget(p.id)} />
                  <span className="text-sm">{p.title}</span>
                </label>
              ))}
            </div>
          )}

          {scope === 'all' && (
            <p className="text-[11px] text-white/40">La promoción aplica a cualquier producto físico del catálogo.</p>
          )}
        </div>
      )}

      {/* Vigencia opcional */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className="block text-sm mb-1.5 text-white/75">Desde <span className="text-white/40">(opcional)</span></label>
          <input type="datetime-local" name="starts_at"
            defaultValue={promotion?.starts_at ? isoToLocal(promotion.starts_at) : ''}
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-sm" />
        </div>
        <div>
          <label className="block text-sm mb-1.5 text-white/75">Hasta <span className="text-white/40">(opcional)</span></label>
          <input type="datetime-local" name="ends_at"
            defaultValue={promotion?.ends_at ? isoToLocal(promotion.ends_at) : ''}
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-sm" />
        </div>
      </div>

      {/* Prioridad + enabled */}
      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={promotion?.enabled !== false} />
          <span>Activa</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-white/60">Prioridad</span>
          <input type="number" name="priority" min="0" max="99"
            defaultValue={promotion?.priority ?? 0}
            className="w-16 rounded bg-white/5 border border-white/15 px-2 py-1 text-sm" />
          <span className="text-white/40 text-[11px]">(mayor = primero)</span>
        </label>
      </div>

      {/* Descripción opcional */}
      <div>
        <label className="block text-sm mb-1.5 text-white/75">Descripción interna <span className="text-white/40">(opcional)</span></label>
        <textarea name="description" rows={2} maxLength={500}
          defaultValue={promotion?.description ?? ''}
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-sm" />
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit"
          className="rounded-md bg-white text-black px-6 py-2.5 font-semibold hover:bg-white/90">
          {isEdit ? 'Guardar cambios' : 'Crear promoción'}
        </button>
      </div>
    </form>
  );
}

function titlePlaceholder(t: PromotionType): string {
  switch (t) {
    case 'nx_pay_m': return '3x2 en remeras';
    case 'qty_percent': return '10% off comprando 3+';
    case 'min_amount_free_shipping': return 'Envío gratis desde $80.000';
    case 'min_amount_percent': return '15% off en compras +$50.000';
  }
}

function isoToLocal(iso: string): string {
  // 2026-07-08T14:30:00Z → 2026-07-08T14:30 (formato datetime-local)
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
