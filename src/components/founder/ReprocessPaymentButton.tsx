'use client';

import { useState, useTransition } from 'react';
import { reprocessMpPaymentAction, type ReprocessResult } from '@/lib/payments/reprocess';

export function ReprocessPaymentButton({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ReprocessResult | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs rounded border border-blue-500/30 bg-blue-500/10 text-blue-300 px-2 py-1 hover:bg-blue-500/20"
        title="Importar venta de MP que el webhook no procesó"
      >
        Re-importar MP
      </button>
    );
  }

  return (
    <div className="absolute z-20 mt-1 right-0 w-80 rounded-lg border border-white/20 bg-[#0a0a0a] shadow-xl p-3 space-y-2 text-left">
      <div className="font-semibold text-sm">Re-importar venta de MercadoPago</div>
      <p className="text-xs text-white/60 leading-snug">
        Si el webhook no procesó una venta, pegá el <strong>payment_id</strong> de MP
        (lo encontrás en la URL de retorno o en MP → Actividad).
      </p>
      <div>
        <label className="block text-xs text-white/50 mb-1">Payment ID</label>
        <input
          type="text"
          value={paymentId}
          onChange={(e) => setPaymentId(e.target.value.trim())}
          placeholder="Ej: 161024002233"
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-sm font-mono"
        />
      </div>

      {result?.ok && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs p-2">
          ✓ {result.reused ? 'Ya existía' : 'Importada'}. Sale: <span className="font-mono">{result.saleId}</span>
        </div>
      )}
      {result && !result.ok && (
        <div className="rounded border border-red-500/40 bg-red-500/10 text-red-200 text-xs p-2">
          ❌ {result.error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={pending || !paymentId}
          onClick={() => {
            const fd = new FormData();
            fd.set('tenant_id', tenantId);
            fd.set('payment_id', paymentId);
            start(async () => {
              const r = await reprocessMpPaymentAction(null, fd);
              setResult(r);
              if (r.ok) setPaymentId('');
            });
          }}
          className="flex-1 rounded bg-blue-500 text-blue-950 px-3 py-1.5 text-xs font-bold disabled:opacity-30"
        >
          {pending ? 'Importando…' : 'Re-importar'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setPaymentId(''); setResult(null); }}
          className="rounded border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
