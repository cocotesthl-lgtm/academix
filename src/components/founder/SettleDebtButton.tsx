'use client';

import { useState, useTransition } from 'react';
import { settleDebtManuallyAction } from '@/lib/debt/manual';

export function SettleDebtButton({
  tenantId,
  tenantSlug,
  balanceCents
}: {
  tenantId: string;
  tenantSlug: string;
  balanceCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [method, setMethod] = useState('crypto');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();

  if (balanceCents <= 0) {
    return (
      <span className="text-xs text-white/30 px-2">sin deuda</span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-1 hover:bg-emerald-500/20"
      >
        Saldar ${(balanceCents / 100).toLocaleString('es-AR')}
      </button>
    );
  }

  return (
    <div className="absolute z-20 mt-1 right-0 w-80 rounded-lg border border-white/20 bg-[#0a0a0a] shadow-xl p-3 space-y-2 text-left">
      <div className="font-semibold text-sm">Marcar deuda como saldada</div>
      <p className="text-xs text-white/60 leading-snug">
        Esto va a registrar un pago manual por <strong>${(balanceCents / 100).toLocaleString('es-AR')}</strong>{' '}
        y llevar el balance a 0. Si el tenant estaba suspendido, se reactiva.
      </p>
      <div>
        <label className="block text-xs text-white/50 mb-1">Método</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-sm"
        >
          <option value="crypto">Cripto (USDT/BTC)</option>
          <option value="bank_transfer">Transferencia bancaria</option>
          <option value="cash">Efectivo</option>
          <option value="other">Otro</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-white/50 mb-1">Referencia (txid, comprobante)</label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={200}
          placeholder="0xabc… o nro de transferencia"
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-xs text-white/50 mb-1">Nota (opcional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-white/50 mb-1">
          Confirmar slug del tenant: <span className="font-mono text-amber-300">{tenantSlug}</span>
        </label>
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={tenantSlug}
          className="w-full rounded bg-white/5 border border-amber-500/30 px-2 py-1 text-sm font-mono"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={pending || confirm.trim() !== tenantSlug}
          onClick={() => {
            const fd = new FormData();
            fd.set('tenant_id', tenantId);
            fd.set('confirm', confirm);
            fd.set('method', method);
            fd.set('reference', reference);
            fd.set('note', note);
            start(async () => {
              await settleDebtManuallyAction(fd);
              setOpen(false);
              setConfirm(''); setReference(''); setNote('');
            });
          }}
          className="flex-1 rounded bg-emerald-500 text-emerald-950 px-3 py-1.5 text-xs font-bold disabled:opacity-30"
        >
          {pending ? 'Saldando…' : 'Confirmar saldo'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setConfirm(''); setReference(''); setNote(''); }}
          className="rounded border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
