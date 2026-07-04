'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adjustStockAction, type ProductVariant } from '@/lib/products/actions';

export function StockAdjustBlock({
  productId,
  variants,
  productStock,
  hasVariants
}: {
  productId: string;
  variants: ProductVariant[];
  productStock: number;
  hasVariants: boolean;
}) {
  const router = useRouter();
  const [targetVariantId, setTargetVariantId] = useState<string>(
    hasVariants ? variants[0]?.id ?? '' : ''
  );
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<'restock' | 'adjustment' | 'return' | 'damage'>('restock');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();
  const [tick, setTick] = useState<'idle' | 'ok'>('idle');

  const currentStock = hasVariants
    ? variants.find((v) => v.id === targetVariantId)?.stock_qty ?? 0
    : productStock;
  const newStock = Math.max(0, currentStock + delta);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (delta === 0 || pending) return;
    startTransition(async () => {
      await adjustStockAction(
        productId,
        hasVariants ? targetVariantId : null,
        delta,
        reason,
        note || undefined
      );
      setDelta(0);
      setNote('');
      setTick('ok');
      setTimeout(() => setTick('idle'), 1500);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-white/10 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Ajustar stock</h3>
        <p className="text-xs text-white/50 mt-0.5">
          Sumá o restá stock manualmente. Se guarda historial con la razón.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {hasVariants && (
          <div>
            <label className="block text-xs mb-1 text-white/60">Variante</label>
            <select
              value={targetVariantId}
              onChange={(e) => setTargetVariantId(e.target.value)}
              className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.name} · {v.stock_qty} en stock</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs mb-1 text-white/60">Cambio</label>
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
              placeholder="+10 o -3"
              className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
            />
          </div>
          <div>
            <label className="block text-xs mb-1 text-white/60">Razón</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
            >
              <option value="restock">Reposición</option>
              <option value="adjustment">Ajuste manual</option>
              <option value="return">Devolución</option>
              <option value="damage">Rotura/Merma</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-white/60">Stock final</label>
            <div className={`rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm font-mono ${
              delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-amber-300' : 'text-white/60'
            }`}>
              {currentStock} → {newStock}
            </div>
          </div>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
        />

        <button
          type="submit"
          disabled={delta === 0 || pending}
          className="text-xs px-3 py-1.5 rounded bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-40"
        >
          {pending ? 'Aplicando…' : tick === 'ok' ? '✓ Aplicado' : 'Aplicar ajuste'}
        </button>
      </form>
    </div>
  );
}
